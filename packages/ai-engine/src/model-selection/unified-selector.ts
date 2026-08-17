/**
 * UnifiedModelSelector — one composed answer to "which model runs this?".
 *
 * Replaces three overlapping entry points with one. Instead of calling
 * `ModelRouter.route` (blind to provider health), `AdaptiveRouter.route` (blind
 * to task complexity) or `getModelForPreset` (blind to both), callers ask this.
 *
 * @example Composing all three criteria
 * ```ts
 * const selector = new UnifiedModelSelector({ registry, orchestrator });
 *
 * const decision = selector.select({
 *   preset: 'fastest',                      // (1) intent: constrains lanes to cheap..mid
 *   task: { id: 't-1', prompt: 'format this file' },  // (2) trivial -> proposes cheap lane
 *   priority: 'high',
 * });
 * // (3) infra: if the cheap lane's providers are saturated, the decision moves
 * // to a callable lane and says so.
 * decision.provider;      // 'anthropic'
 * decision.proposedTier;  // 'cheap'
 * decision.tier;          // 'mid'
 * decision.deviation;     // 'lane-shift'
 * decision.reason;
 * // preset=fastest (lanes cheap..mid, objective=latency);
 * // task=simple/formatting @0.70 -> proposed cheap lane;
 * // cheap lane unavailable: openrouter:google/gemini-3.7-flash (queue saturated (1.00));
 * // infrastructure forced cheap -> mid; selected anthropic/claude-sonnet-4.5; ...
 * ```
 *
 * @example Executing, with escalation and infrastructure bookkeeping
 * ```ts
 * const result = await selector.execute(
 *   { task, preset: 'smartest' },
 *   async ({ provider, model }) => {
 *     const response = await registry.getProvider(provider)!.chat(messages, { model });
 *     return { success: response.content.length > 0, value: response, usage: response.usage };
 *   }
 * );
 * ```
 *
 * Do **not** additionally submit the same work to `InfraAwareOrchestrator.execute`:
 * `execute` here already performs the monitor/breaker bookkeeping, and doing both
 * double-counts queue depth and spend. To use the orchestrator's queueing and
 * congestion-aware parallelism, build the task with `toOrchestrationTask` instead.
 */

import { ModelRouter, type ModelRouterConfig } from '../routing/model-router';
import type { TokenUsage } from '../routing/cost-tracker';
import type { FailureKind, ModelTier, Task, TierModel } from '../routing/types';
import type { InfraAwareOrchestrator, OrchestrationTask } from '../orchestration/infra-aware-orchestrator';
import type { AIProviderRegistry } from '../registry';
import type { ModelPreset } from '../model-presets';
import { buildLaneCandidates } from './lane-candidates';
import { selectComposed, type InfraSurface } from './selection-engine';
import type { LaneCandidate, SelectionDecision, SelectionRequest } from './types';

/** One executor invocation result, mirroring `ModelRouter`'s contract. */
export interface SelectionAttemptResult<T> {
  success: boolean;
  value?: T;
  usage: TokenUsage;
  failureKind?: FailureKind;
  message?: string;
  /** Provider's Retry-After, propagated to the infrastructure monitor. */
  retryAfterMs?: number;
}

/** Outcome of a composed execution. */
export interface SelectionResult<T> {
  success: boolean;
  value?: T;
  /** Decision that produced the final outcome. */
  decision: SelectionDecision;
  /** Every decision made, in order. */
  attempts: SelectionDecision[];
  /** Actual USD spend across all attempts. */
  cost: number;
  /** USD the same usage would have cost unrouted. */
  baselineCost: number;
  failureKind?: FailureKind;
  message?: string;
}

export interface UnifiedModelSelectorConfig {
  /** Passed through to the underlying `ModelRouter`. */
  routing?: ModelRouterConfig;
  /** Lane -> model overrides, kept in sync with the lane candidate table. */
  tiers?: Partial<Record<ModelTier, Partial<TierModel>>>;
  /** Extra deployment-specific candidates appended per lane. */
  extraCandidates?: Partial<Record<ModelTier, Omit<LaneCandidate, 'tier' | 'primary'>[]>>;
  /** Fully replace the lane candidate table. */
  laneCandidates?: Record<ModelTier, LaneCandidate[]>;
  /** Preset applied when a request omits one. */
  defaultPreset?: ModelPreset;
  /** Let infrastructure pressure push selection outside the preset window. */
  allowInfraEscape?: boolean;
  /** Estimated output tokens when a request omits it. Defaults to 1000. */
  defaultOutputTokens?: number;
  /** Retries on a transient failure before failing over. Defaults to 1. */
  transientRetries?: number;
}

export interface UnifiedModelSelectorDeps {
  /** Restricts candidates to providers actually registered. */
  registry?: AIProviderRegistry;
  /** Supplies live infrastructure state. An `InfraAwareOrchestrator` satisfies this. */
  orchestrator?: InfraSurface;
  /** Reuse an existing router, so learned statistics are shared. */
  router?: ModelRouter;
}

const DEFAULT_OUTPUT_TOKENS = 1_000;

export class UnifiedModelSelector {
  private readonly router: ModelRouter;
  private readonly infra?: InfraSurface;
  private readonly candidates: Record<ModelTier, LaneCandidate[]>;
  private readonly defaultPreset?: ModelPreset;
  private readonly allowInfraEscape: boolean;
  private readonly defaultOutputTokens: number;
  private readonly transientRetries: number;

  constructor(deps: UnifiedModelSelectorDeps = {}, config: UnifiedModelSelectorConfig = {}) {
    this.router = deps.router ?? new ModelRouter({ ...config.routing, tiers: config.tiers });
    this.infra = deps.orchestrator;
    this.candidates =
      config.laneCandidates ??
      buildLaneCandidates({
        tiers: config.tiers,
        extra: config.extraCandidates,
        availableProviders: deps.registry?.getProviderIds(),
      });
    this.defaultPreset = config.defaultPreset;
    this.allowInfraEscape = config.allowInfraEscape ?? false;
    this.defaultOutputTokens = config.defaultOutputTokens ?? DEFAULT_OUTPUT_TOKENS;
    this.transientRetries = Math.max(0, config.transientRetries ?? 1);
  }

  /** The two-tier router underneath, for cost reports and learner persistence. */
  getRouter(): ModelRouter {
    return this.router;
  }

  /** The lane -> candidates table in force. */
  getLaneCandidates(): Record<ModelTier, LaneCandidate[]> {
    return this.candidates;
  }

  /**
   * Compose a decision without executing it. Pure with respect to learned state
   * and cost: nothing is recorded.
   */
  select(request: SelectionRequest): SelectionDecision {
    return selectComposed(request, this.engineDeps());
  }

  /**
   * Route, execute, and escalate. Keeps `routing/`'s learner and cost ledger and
   * `orchestration/`'s monitor and breakers in sync on every attempt.
   */
  async execute<T>(
    request: SelectionRequest,
    executor: (decision: SelectionDecision) => Promise<SelectionAttemptResult<T>>
  ): Promise<SelectionResult<T>> {
    const attempts: SelectionDecision[] = [];
    const excluded = new Set(request.exclude ?? []);
    let transientRetriesLeft = this.transientRetries;
    let forcedTier: ModelTier | undefined;
    let attemptNumber = 1;
    let escalated = false;
    let cost = 0;
    let baselineCost = 0;
    let lastFailure: FailureKind | undefined;
    let lastMessage: string | undefined;

    // Bounded: every iteration either returns, consumes a transient retry,
    // excludes a provider, or escalates a lane — all finite.
    for (;;) {
      const decision = selectComposed({ ...request, exclude: [...excluded] }, this.engineDeps(), {
        forcedTier,
        attempt: attemptNumber,
        escalated,
      });
      attempts.push(decision);

      if (!decision.provider || !decision.model) {
        return {
          success: false,
          decision,
          attempts,
          cost,
          baselineCost,
          failureKind: lastFailure,
          message: lastMessage ?? decision.reason,
        };
      }

      const ticket = this.beginInfraRequest(decision, request);
      let result: SelectionAttemptResult<T>;
      try {
        result = await executor(decision);
      } catch (error) {
        // An executor that throws is treated as a provider error: neither the
        // model nor the lane is implicated, so nothing is learned from it.
        this.endInfraRequest(decision, ticket, { ok: false });
        return {
          success: false,
          decision,
          attempts,
          cost,
          baselineCost,
          failureKind: 'provider-error',
          message: error instanceof Error ? error.message : String(error),
        };
      }

      this.endInfraRequest(decision, ticket, {
        ok: result.success,
        usage: result.usage,
        retryAfterMs: result.retryAfterMs,
      });

      const failureKind: FailureKind | undefined = result.success
        ? undefined
        : (result.failureKind ?? 'incorrect-output');

      // Attribute to the *selected* candidate, not the lane default.
      this.router.recordOutcome(this.windowedTask(request, decision), decision.choice, {
        succeeded: result.success,
        usage: result.usage,
        failureKind,
      });

      const records = this.router.getCostTracker().getRecords();
      const record = records[records.length - 1];
      if (record) {
        cost += record.cost;
        baselineCost += record.baselineCost;
      }

      if (result.success) {
        return { success: true, value: result.value, decision, attempts, cost, baselineCost };
      }

      lastFailure = failureKind;
      lastMessage = result.message;

      // Fatal: an auth or config problem is not fixed by another lane. Try
      // another provider in the same lane if one exists, since the fault is
      // provider-local.
      if (failureKind === 'provider-error') {
        excluded.add(decision.provider);
        forcedTier = decision.tier;
        attemptNumber += 1;
        if (this.hasAlternative(decision, excluded)) continue;
        break;
      }

      // Transient: infrastructure noise. Retry, letting selection fail over to
      // another provider in the same lane rather than paying for a higher one.
      if (failureKind === 'transient' && transientRetriesLeft > 0) {
        transientRetriesLeft -= 1;
        excluded.add(decision.provider);
        forcedTier = decision.tier;
        attemptNumber += 1;
        continue;
      }

      // Capability failure: this is where escalation belongs.
      const next = this.router.escalate(
        this.windowedTask(request, decision),
        decision.choice,
        failureKind!
      );
      if (!next) break;

      forcedTier = next.tier;
      attemptNumber = next.attempt;
      escalated = true;
    }

    return {
      success: false,
      decision: attempts[attempts.length - 1]!,
      attempts,
      cost,
      baselineCost,
      failureKind: lastFailure,
      message: lastMessage,
    };
  }

  /**
   * Build an `OrchestrationTask` bound to a composed decision, for callers that
   * want the orchestrator's queueing, admission control and congestion-aware
   * parallelism. The lane is fixed by this selector; the orchestrator picks among
   * that lane's providers and owns retry and failover.
   */
  toOrchestrationTask<T>(
    request: SelectionRequest,
    run: (context: { provider: string; model: string }) => Promise<{ value: T; usage?: TokenUsage }>
  ): OrchestrationTask<T> {
    const decision = this.select(request);
    const lane = this.candidates[decision.tier] ?? [];

    return {
      id: request.task.id,
      estimatedInputTokens: request.task.estimatedTokens ?? 0,
      estimatedOutputTokens: request.estimatedOutputTokens ?? this.defaultOutputTokens,
      priority: request.priority,
      cacheKey: request.cacheKey,
      exclude: request.exclude,
      restrictTo: [...new Set(lane.map((candidate) => candidate.provider))],
      run: async ({ providerId }) => {
        const candidate =
          lane.find((entry) => entry.provider === providerId && entry.primary) ??
          lane.find((entry) => entry.provider === providerId);
        if (!candidate) {
          throw new Error(
            `Provider '${providerId}' has no candidate in the ${decision.tier} lane`
          );
        }
        const output = await run({ provider: providerId, model: candidate.model });
        return {
          value: output.value,
          usage: output.usage
            ? { inputTokens: output.usage.inputTokens, outputTokens: output.usage.outputTokens }
            : undefined,
        };
      },
    };
  }

  /** Clear learned statistics and the cost ledger. */
  reset(): void {
    this.router.reset();
  }

  // --- internals ---

  private engineDeps() {
    return {
      router: this.router,
      candidates: this.candidates,
      infra: this.infra,
      defaultPreset: this.defaultPreset,
      allowInfraEscape: this.allowInfraEscape,
      defaultOutputTokens: this.defaultOutputTokens,
    };
  }

  /**
   * `ModelRouter` reads the lane window off the task, so escalation and outcome
   * recording must see the composed window rather than the raw task.
   */
  private windowedTask(request: SelectionRequest, decision: SelectionDecision): Task {
    return { ...request.task, minTier: decision.window.min, maxTier: decision.window.max };
  }

  private hasAlternative(decision: SelectionDecision, excluded: Set<string>): boolean {
    return (this.candidates[decision.tier] ?? []).some(
      (candidate) => !excluded.has(candidate.provider)
    );
  }

  private beginInfraRequest(decision: SelectionDecision, request: SelectionRequest) {
    if (!this.infra || !decision.provider) return undefined;
    if (!this.infra.monitor.hasProvider(decision.provider)) return undefined;

    const breaker = this.infra.breakers?.get(decision.provider);
    // Selection already filtered open circuits; acquire reserves a half-open probe.
    breaker?.acquire();

    const queueId = this.infra.monitor.enqueue(decision.provider);
    return this.infra.monitor.startRequest(
      decision.provider,
      request.task.estimatedTokens ?? 0,
      queueId
    );
  }

  private endInfraRequest(
    decision: SelectionDecision,
    ticket: ReturnType<InfrastructureMonitorLike['startRequest']> | undefined,
    outcome: { ok: boolean; usage?: TokenUsage; retryAfterMs?: number }
  ): void {
    if (!this.infra || !ticket || !decision.provider) return;

    if (outcome.ok) {
      this.infra.monitor.completeRequest(ticket, {
        inputTokens: outcome.usage?.inputTokens ?? 0,
        outputTokens: outcome.usage?.outputTokens ?? 0,
      });
      this.infra.breakers?.recordSuccess(decision.provider);
      return;
    }

    this.infra.monitor.failRequest(ticket, {
      retryAfterMs: outcome.retryAfterMs,
      tokensConsumed: outcome.usage?.inputTokens ?? 0,
    });
    this.infra.breakers?.recordFailure(decision.provider);
  }
}

/** Narrow structural view used only for the ticket type. */
type InfrastructureMonitorLike = InfraSurface['monitor'];

/**
 * Convenience constructor: wires a registry and an orchestrator together.
 * `InfraAwareOrchestrator` exposes `monitor`, `router` and `breakers`, so it
 * satisfies the infrastructure surface directly.
 */
export function createUnifiedModelSelector(
  deps: { registry?: AIProviderRegistry; orchestrator?: InfraAwareOrchestrator; router?: ModelRouter },
  config: UnifiedModelSelectorConfig = {}
): UnifiedModelSelector {
  return new UnifiedModelSelector(
    {
      registry: deps.registry,
      router: deps.router,
      orchestrator: deps.orchestrator
        ? {
            monitor: deps.orchestrator.monitor,
            router: deps.orchestrator.router,
            breakers: deps.orchestrator.breakers,
          }
        : undefined,
    },
    config
  );
}
