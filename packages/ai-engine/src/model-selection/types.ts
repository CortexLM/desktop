/**
 * Types for composed model selection.
 *
 * Three existing subsystems each answer part of "which model should run this?":
 *
 *  - `model-presets.ts` — user intent ("cheapest", "smartest"), per provider.
 *  - `routing/`         — task complexity -> price lane, with learning.
 *  - `orchestration/`   — live infrastructure state -> which providers are callable.
 *
 * They do not compose on their own because they disagree about what a decision
 * *is*: a preset names a model within a provider, a lane names one hardcoded
 * (provider, model) pair, and the infrastructure router names a provider with no
 * opinion about the model. This module introduces the missing shared vocabulary:
 * a **lane holds several interchangeable candidates across providers**, so
 * "cheap lane" survives one provider going down.
 */

import type { ModelPreset } from '../model-presets';
import type { Classification } from '../routing/task-classifier';
import type { ModelChoice, ModelTier, Task, TierPricing } from '../routing/types';
import type {
  ProviderId,
  RoutingDecision,
  SLAObjective,
  SLATargets,
  TaskPriority,
} from '../orchestration/types';

/**
 * One concrete, callable (provider, model) pair belonging to a price lane.
 *
 * Several candidates per lane is the point: it is what lets an infrastructure
 * veto on one provider be absorbed *inside* the lane, instead of forcing a
 * change of lane (which would change cost and capability for a reason that has
 * nothing to do with either).
 */
export interface LaneCandidate {
  tier: ModelTier;
  provider: ProviderId;
  model: string;
  displayName: string;
  /** Max input tokens. Differs *within* a lane, so it is checked per candidate. */
  contextWindow: number;
  /** USD per 1M tokens. Configuration, not a constant — override per deployment. */
  pricing: TierPricing;
  /**
   * True for the lane's canonical binding, i.e. the model `routing/` itself
   * assigns to this lane. Preferred whenever it is eligible, so the composed
   * decision matches the standalone `ModelRouter` decision when infrastructure
   * is healthy.
   */
  primary: boolean;
}

/** How a preset narrows the search space. */
export interface PresetConstraint {
  /** Never select below this lane. */
  minTier?: ModelTier;
  /** Never select above this lane. */
  maxTier?: ModelTier;
  /** Objective handed to the infrastructure router's scoring. */
  objective: SLAObjective;
}

/** Why the final lane differs from the one classification proposed. */
export type LaneDeviation =
  /** Final lane is the proposed lane. */
  | 'none'
  /** Proposed lane kept, but not on its primary provider. */
  | 'in-lane-failover'
  /** Proposed lane was entirely uncallable; a different lane was used. */
  | 'lane-shift'
  /** Proposed lane was outside the preset window and got clamped. */
  | 'preset-clamp'
  /** Lane changed because the input did not fit the proposed lane's context. */
  | 'context-fit';

/** A candidate that was considered and rejected, with the reason. */
export interface RejectedCandidate {
  tier: ModelTier;
  provider: ProviderId;
  model: string;
  reason: string;
}

/** Request for a composed selection. */
export interface SelectionRequest {
  /** The unit of work, as understood by `routing/`. */
  task: Task;
  /** User intent. Falls back to the selector's `defaultPreset`, if any. */
  preset?: ModelPreset;
  /** Scheduling urgency, passed to infrastructure scoring. */
  priority?: TaskPriority;
  /** SLA overrides merged onto the preset's objective. */
  sla?: Partial<SLATargets>;
  /** Estimated output tokens, for cost projection. Defaults to 1000. */
  estimatedOutputTokens?: number;
  /** Stable prefix key enabling cache-affinity routing. */
  cacheKey?: string;
  /** Providers to skip, e.g. ones that already failed this task. */
  exclude?: ProviderId[];
}

/** The single composed routing decision. */
export interface SelectionDecision {
  /** Chosen provider, or null when nothing is callable. */
  provider: ProviderId | null;
  /** Chosen model, or null when nothing is callable. */
  model: string | null;
  /** Lane actually selected. */
  tier: ModelTier;
  /** Lane that task classification proposed, before infrastructure filtering. */
  proposedTier: ModelTier;
  /** Preset in force, when any. */
  preset?: ModelPreset;
  /** Lane window the preset imposed, intersected with the task's own bounds. */
  window: { min: ModelTier; max: ModelTier };
  /** Task classification that produced `proposedTier`. */
  classification: Classification;
  /** Relationship between `proposedTier` and `tier`. */
  deviation: LaneDeviation;
  /** Everything rejected along the way, with per-candidate reasons. */
  rejected: RejectedCandidate[];
  /** Composed, human-readable explanation covering all three criteria. */
  reason: string;
  /** Price sheet of the selected candidate. */
  pricing?: TierPricing;
  /** Context window of the selected candidate. */
  contextWindow?: number;
  /** 1-based attempt number; >1 after escalation. */
  attempt: number;
  /** True when this decision came from escalating a failed cheaper attempt. */
  escalated: boolean;
  /** True when every eligible candidate misses the SLA targets. */
  slaAtRisk: boolean;
  /** Raw infrastructure decision for the winning lane, when infra was consulted. */
  infrastructure?: RoutingDecision;
  /**
   * The equivalent `routing/` choice, reflecting the *selected* candidate rather
   * than the lane's default binding. Feed this to `ModelRouter.recordOutcome`
   * so cost and learning are attributed to what actually ran.
   */
  choice: ModelChoice;
}
