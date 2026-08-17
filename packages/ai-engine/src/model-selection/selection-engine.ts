/**
 * The composed selection engine: preset -> classification -> infrastructure.
 *
 * Ordering, and why it is this ordering:
 *
 *  1. **Preset (constraint).** User intent bounds the search space before
 *     anything is computed. It goes first because it is the only input that is
 *     not an inference — the user actually said it.
 *  2. **Classification (proposal).** `routing/` proposes a lane inside that
 *     window, including its learned start-tier shift and bounded exploration.
 *  3. **Context fit (hard filter).** A candidate that cannot hold the input is
 *     not a candidate. Applied per *candidate*, not per lane, because context
 *     windows differ inside a lane.
 *  4. **Infrastructure (veto + final pick).** `orchestration/` decides which of
 *     the surviving candidates are callable, and ranks them. It is last and it is
 *     final: routing to a saturated provider is wrong no matter how cheap it is.
 */

import { getModelForPreset } from '../model-presets';
import { classifyTask, tierForComplexity } from '../routing/task-classifier';
import type { ModelRouter } from '../routing/model-router';
import type { ModelChoice, ModelTier, Task } from '../routing/types';
import type { AdaptiveRouter } from '../orchestration/adaptive-router';
import type { CircuitBreakerRegistry } from '../orchestration/circuit-breaker';
import type { InfrastructureMonitor } from '../orchestration/infrastructure-monitor';
import type { InfrastructureSnapshot, RoutingRequest, SLATargets } from '../orchestration/types';
import { constraintFor, laneSearchOrder, resolveWindow } from './preset-constraints';
import type {
  LaneCandidate,
  LaneDeviation,
  RejectedCandidate,
  SelectionDecision,
  SelectionRequest,
} from './types';

/** The orchestration pieces the engine consults. All optional. */
export interface InfraSurface {
  monitor: InfrastructureMonitor;
  router: AdaptiveRouter;
  breakers?: CircuitBreakerRegistry;
}

export interface EngineDeps {
  router: ModelRouter;
  candidates: Record<ModelTier, LaneCandidate[]>;
  infra?: InfraSurface;
  defaultPreset?: SelectionRequest['preset'];
  /**
   * Allow leaving the preset's lane window when every lane inside it is
   * uncallable. Defaults to false: a `cheapest` request that cannot be served
   * cheaply should say so rather than quietly spend more.
   */
  allowInfraEscape?: boolean;
  defaultOutputTokens: number;
}

const DEFAULT_SELECTION_ATTEMPT = 1;

/** One lane's evaluation outcome. */
interface LaneOutcome {
  candidate?: LaneCandidate;
  infrastructure?: SelectionDecision['infrastructure'];
  rejected: RejectedCandidate[];
  /** Set when infra had nothing to say about this lane's candidates. */
  unmonitored?: boolean;
}

export function selectComposed(
  request: SelectionRequest,
  deps: EngineDeps,
  options: { forcedTier?: ModelTier; attempt?: number; escalated?: boolean; snapshot?: InfrastructureSnapshot } = {}
): SelectionDecision {
  const preset = request.preset ?? deps.defaultPreset;
  const constraint = constraintFor(preset);
  const task = request.task;

  // (1) Preset window, intersected with the task's own bounds.
  let window = resolveWindow(constraint, task.minTier, task.maxTier);

  // (2) Lane proposal. `ModelRouter.route` is given the composed window so its
  // learning, exploration and context handling all operate inside it.
  const classification = classifyTask(task);
  const routed = deps.router.route({ ...task, minTier: window.min, maxTier: window.max });
  const proposedTier = options.forcedTier ?? routed.tier;

  const baselineTier = tierForComplexity(classification.complexity);
  const laneOrder = laneSearchOrder(proposedTier, window);

  // Escape hatch: when the preset window is uncallable end to end, optionally
  // consider lanes outside it, tried only after every in-window lane has failed.
  const escapeLanes =
    deps.allowInfraEscape && !options.forcedTier
      ? laneSearchOrder(proposedTier, { min: 'cheap', max: 'expensive' }).filter(
          (tier) => !laneOrder.includes(tier)
        )
      : [];

  const rejected: RejectedCandidate[] = [];
  const snapshot = options.snapshot ?? deps.infra?.monitor.getSnapshot();

  for (const tier of [...laneOrder, ...escapeLanes]) {
    const outcome = evaluateLane(tier, request, deps, snapshot);
    rejected.push(...outcome.rejected);

    if (!outcome.candidate) continue;

    const escaped = !laneOrder.includes(tier);
    if (escaped) {
      window = { min: 'cheap', max: 'expensive' };
    }

    return buildDecision({
      request,
      deps,
      preset,
      constraint,
      window,
      classification,
      proposedTier,
      baselineTier,
      tier,
      candidate: outcome.candidate,
      infrastructure: outcome.infrastructure,
      unmonitored: outcome.unmonitored,
      rejected,
      attempt: options.attempt ?? DEFAULT_SELECTION_ATTEMPT,
      escalated: options.escalated ?? false,
      escaped,
    });
  }

  // Nothing callable anywhere. Report it instead of returning a choice that is
  // known to fail.
  return buildEmptyDecision({
    request,
    deps,
    preset,
    constraint,
    window,
    classification,
    proposedTier,
    rejected,
    attempt: options.attempt ?? DEFAULT_SELECTION_ATTEMPT,
    escalated: options.escalated ?? false,
  });
}

/** Filter one lane's candidates by context and exclusions, then ask infra. */
function evaluateLane(
  tier: ModelTier,
  request: SelectionRequest,
  deps: EngineDeps,
  snapshot?: InfrastructureSnapshot
): LaneOutcome {
  const rejected: RejectedCandidate[] = [];
  const excluded = new Set(request.exclude ?? []);
  const estimatedTokens = request.task.estimatedTokens ?? 0;

  const viable = (deps.candidates[tier] ?? []).filter((candidate) => {
    if (excluded.has(candidate.provider)) {
      rejected.push({ ...ref(candidate), reason: 'provider excluded by caller' });
      return false;
    }
    // (3) Context fit, per candidate. The cheap lane holds 1M tokens while every
    // pricier lane holds 200k, so this filter is not monotonic in price.
    if (estimatedTokens > 0 && estimatedTokens > candidate.contextWindow) {
      rejected.push({
        ...ref(candidate),
        reason: `~${estimatedTokens} tokens exceed ${candidate.contextWindow} context window`,
      });
      return false;
    }
    return true;
  });

  if (viable.length === 0) {
    return { rejected };
  }

  // No infrastructure wired: fall back to the lane's own ordering.
  if (!deps.infra || !snapshot) {
    return { candidate: viable[0]!, rejected, unmonitored: true };
  }

  // (4) Infrastructure veto. Only providers the monitor knows about can be
  // judged; a candidate on an unregistered provider is invisible to it.
  const monitored = viable.filter((candidate) => snapshot.providers[candidate.provider]);
  if (monitored.length === 0) {
    return { candidate: viable[0]!, rejected, unmonitored: true };
  }

  const decision = deps.infra.router.route(toRoutingRequest(request, deps, monitored), snapshot);
  const eligible = new Set(
    decision.scores.filter((score) => !score.ineligibleReason).map((score) => score.providerId)
  );

  // Record every veto, including when the lane still succeeds, so `reason` can
  // explain what was skipped and why.
  for (const score of decision.scores) {
    if (!score.ineligibleReason) continue;
    for (const candidate of monitored.filter((entry) => entry.provider === score.providerId)) {
      rejected.push({ ...ref(candidate), reason: score.ineligibleReason });
    }
  }

  if (eligible.size === 0) {
    return { rejected, infrastructure: decision };
  }

  /*
   * Infrastructure is a **veto, not a preference**. When the lane's primary
   * binding is callable, it wins outright and infra's ranking is not consulted.
   *
   * Two reasons. First, the monitor's `ProviderCapacity` carries one price and
   * one quality score *per provider*, so its scoring cannot distinguish two
   * models on the same provider — the lane table has strictly better cost
   * information, and the worse signal must not override the better one. Second,
   * it keeps this facade's decision identical to a standalone `ModelRouter`
   * decision whenever infrastructure is healthy, so adopting the facade does not
   * silently re-route healthy traffic.
   */
  const primary = monitored.find((candidate) => candidate.primary && eligible.has(candidate.provider));
  if (primary) {
    return { candidate: primary, rejected, infrastructure: decision };
  }

  // Primary vetoed: now infra's ranking picks among the surviving fallbacks.
  if (!decision.providerId) {
    return { rejected, infrastructure: decision };
  }

  const winner = pickWithinProvider(
    monitored.filter((candidate) => candidate.provider === decision.providerId),
    request,
    deps
  );

  return { candidate: winner, rejected, infrastructure: decision };
}

/**
 * Several candidates can share a provider, and the infrastructure router names
 * only the provider, so a model still has to be chosen.
 *
 * Reached only once the lane's primary has been vetoed. Prefer, in order: the
 * preset's own model for that provider (the one place `MODEL_PRESETS`'s
 * per-provider table gets a say), then any remaining primary, then the cheapest
 * blended price.
 */
function pickWithinProvider(
  candidates: LaneCandidate[],
  request: SelectionRequest,
  deps: EngineDeps
): LaneCandidate {
  const preset = request.preset ?? deps.defaultPreset;

  if (preset) {
    const presetModel = getModelForPreset(preset, candidates[0]!.provider);
    const match = candidates.find((candidate) => candidate.model === presetModel);
    if (match) return match;
  }

  const primary = candidates.find((candidate) => candidate.primary);
  if (primary) return primary;

  return candidates.reduce((best, candidate) =>
    candidate.pricing.input + candidate.pricing.output <
    best.pricing.input + best.pricing.output
      ? candidate
      : best
  );
}

function toRoutingRequest(
  request: SelectionRequest,
  deps: EngineDeps,
  candidates: LaneCandidate[]
): RoutingRequest {
  const constraint = constraintFor(request.preset ?? deps.defaultPreset);
  const sla: SLATargets = { objective: constraint.objective, ...request.sla };

  return {
    estimatedInputTokens: request.task.estimatedTokens ?? 0,
    estimatedOutputTokens: request.estimatedOutputTokens ?? deps.defaultOutputTokens,
    priority: request.priority,
    sla,
    cacheKey: request.cacheKey,
    exclude: request.exclude,
    restrictTo: [...new Set(candidates.map((candidate) => candidate.provider))],
  };
}

function ref(candidate: LaneCandidate) {
  return { tier: candidate.tier, provider: candidate.provider, model: candidate.model };
}

interface BuildArgs {
  request: SelectionRequest;
  deps: EngineDeps;
  preset?: SelectionRequest['preset'];
  constraint: ReturnType<typeof constraintFor>;
  window: { min: ModelTier; max: ModelTier };
  classification: ReturnType<typeof classifyTask>;
  proposedTier: ModelTier;
  baselineTier: ModelTier;
  tier: ModelTier;
  candidate: LaneCandidate;
  infrastructure?: SelectionDecision['infrastructure'];
  unmonitored?: boolean;
  rejected: RejectedCandidate[];
  attempt: number;
  escalated: boolean;
  escaped: boolean;
}

function buildDecision(args: BuildArgs): SelectionDecision {
  const deviation = classifyDeviation(args);
  const choice: ModelChoice = {
    tier: args.tier,
    provider: args.candidate.provider,
    model: args.candidate.model,
    pricing: args.candidate.pricing,
    contextWindow: args.candidate.contextWindow,
    complexity: args.classification.complexity,
    confidence: args.classification.confidence,
    reason: '',
    attempt: args.attempt,
    escalated: args.escalated,
  };

  const reason = composeReason(args, deviation);
  choice.reason = reason;

  return {
    provider: args.candidate.provider,
    model: args.candidate.model,
    tier: args.tier,
    proposedTier: args.proposedTier,
    preset: args.preset,
    window: args.window,
    classification: args.classification,
    deviation,
    rejected: args.rejected,
    reason,
    pricing: args.candidate.pricing,
    contextWindow: args.candidate.contextWindow,
    attempt: args.attempt,
    escalated: args.escalated,
    slaAtRisk: args.infrastructure?.slaAtRisk ?? false,
    infrastructure: args.infrastructure,
    choice,
  };
}

function classifyDeviation(args: BuildArgs): LaneDeviation {
  if (args.tier !== args.proposedTier) return 'lane-shift';
  if (args.escaped) return 'lane-shift';

  if (!args.candidate.primary) return 'in-lane-failover';

  if (args.proposedTier !== args.baselineTier) {
    // The lane moved before infrastructure was consulted: either the preset
    // window clamped it, or the router's context fit / learning moved it.
    const estimated = args.request.task.estimatedTokens ?? 0;
    const baselineCandidate = (args.deps.candidates[args.baselineTier] ?? []).find((c) => c.primary);
    if (estimated > 0 && baselineCandidate && estimated > baselineCandidate.contextWindow) {
      return 'context-fit';
    }
    if (args.preset) return 'preset-clamp';
  }

  return 'none';
}

function composeReason(args: BuildArgs, deviation: LaneDeviation): string {
  const parts: string[] = [];

  parts.push(
    args.preset
      ? `preset=${args.preset} (lanes ${args.window.min}..${args.window.max}, objective=${args.constraint.objective})`
      : `no preset (lanes ${args.window.min}..${args.window.max}, objective=${args.constraint.objective})`
  );

  parts.push(
    `task=${args.classification.complexity}` +
      (args.classification.kind ? `/${args.classification.kind}` : '') +
      ` @${args.classification.confidence.toFixed(2)} -> proposed ${args.proposedTier} lane`
  );

  const laneNotes = args.rejected
    .filter((entry) => entry.tier === args.proposedTier)
    .map((entry) => `${entry.provider}:${entry.model} (${entry.reason})`);

  if (laneNotes.length > 0) {
    // "unavailable" only when the lane was actually abandoned; otherwise some of
    // its candidates were merely skipped.
    const abandoned = args.tier !== args.proposedTier;
    parts.push(
      `${abandoned ? `${args.proposedTier} lane unavailable` : `skipped in ${args.proposedTier} lane`}: ` +
        laneNotes.join(', ')
    );
  }

  switch (deviation) {
    case 'in-lane-failover':
      parts.push(`kept ${args.tier} lane, failed over within it`);
      break;
    case 'lane-shift':
      parts.push(
        `infrastructure forced ${args.proposedTier} -> ${args.tier}` +
          (args.escaped ? ' (outside preset window; allowInfraEscape enabled)' : '')
      );
      break;
    case 'context-fit':
      parts.push(`context size required the ${args.tier} lane`);
      break;
    case 'preset-clamp':
      parts.push(`preset window clamped the lane to ${args.tier}`);
      break;
    default:
      break;
  }

  if (args.unmonitored) {
    parts.push('no infrastructure signal for this lane; used lane ordering');
  }

  parts.push(`selected ${args.candidate.provider}/${args.candidate.model}`);

  // Only quote infrastructure's own rationale when infrastructure actually made
  // the pick. Under primary-wins it did not, and pasting its reason in would name
  // a provider that was never selected.
  if (args.infrastructure?.providerId === args.candidate.provider) {
    parts.push(args.infrastructure.reason);
  } else if (args.infrastructure) {
    parts.push(
      `infra eligible, lane primary kept (infra ranking preferred ${args.infrastructure.providerId ?? 'none'})`
    );
  }

  return parts.join('; ');
}

function buildEmptyDecision(args: {
  request: SelectionRequest;
  deps: EngineDeps;
  preset?: SelectionRequest['preset'];
  constraint: ReturnType<typeof constraintFor>;
  window: { min: ModelTier; max: ModelTier };
  classification: ReturnType<typeof classifyTask>;
  proposedTier: ModelTier;
  rejected: RejectedCandidate[];
  attempt: number;
  escalated: boolean;
}): SelectionDecision {
  const summary = args.rejected
    .map((entry) => `${entry.tier}/${entry.provider}:${entry.model} (${entry.reason})`)
    .join('; ');

  const reason =
    `no callable candidate in lanes ${args.window.min}..${args.window.max}` +
    (args.preset ? ` under preset=${args.preset}` : '') +
    (summary ? `: ${summary}` : '');

  const fallback = (args.deps.candidates[args.proposedTier] ?? [])[0];

  return {
    provider: null,
    model: null,
    tier: args.proposedTier,
    proposedTier: args.proposedTier,
    preset: args.preset,
    window: args.window,
    classification: args.classification,
    deviation: 'none',
    rejected: args.rejected,
    reason,
    attempt: args.attempt,
    escalated: args.escalated,
    slaAtRisk: true,
    choice: {
      tier: args.proposedTier,
      provider: fallback?.provider ?? '',
      model: fallback?.model ?? '',
      pricing: fallback?.pricing ?? { input: 0, output: 0 },
      contextWindow: fallback?.contextWindow ?? 0,
      complexity: args.classification.complexity,
      confidence: args.classification.confidence,
      reason,
      attempt: args.attempt,
      escalated: args.escalated,
    },
  };
}

/** Re-exported for the facade's escalation path. */
export type { Task };
