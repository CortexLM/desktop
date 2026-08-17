/**
 * Two-tier model routing.
 *
 * Route mechanical work to a cheap model and reserve frontier models for
 * reasoning. Moving the read-heavy majority of turns off the top lane cuts spend;
 * how much depends on the configured price table (~8x on realistically mixed
 * tokens, higher on the default table's Flash-vs-Opus pairing).
 *
 * For new code prefer `model-selection/`, which composes this with live
 * infrastructure state and the user's preset. Used alone, this router will
 * happily route to a provider whose circuit is open.
 */

export { ModelRouter } from './model-router';
export type {
  ModelRouterConfig,
  AttemptResult,
  RoutedResult,
} from './model-router';

export { classifyTask, tierForComplexity, COMPLEXITY_TIER, KIND_COMPLEXITY, STRUCTURAL_THRESHOLDS } from './task-classifier';
export type { Classification } from './task-classifier';

export {
  DEFAULT_TIER_MODELS,
  DEFAULT_INPUT_RATIO,
  resolveTierModels,
  tierIndex,
  nextTier,
  clampTier,
  computeCost,
  blendedCostPerMillion,
  costRatio,
} from './model-tiers';

export { EscalationLearner } from './escalation';
export type { EscalationLearnerConfig, AttemptOutcome, TierStats } from './escalation';

export { routedChat, classifyProviderError } from './routed-chat';
export type { RoutedChatOptions } from './routed-chat';

export { CostTracker } from './cost-tracker';
export type { CostRecord, CostReport, CostSummary, TokenUsage } from './cost-tracker';

export { TIER_ORDER } from './types';
export type {
  ModelTier,
  ModelChoice,
  Task,
  TaskComplexity,
  TaskKind,
  TaskFailure,
  FailureKind,
  TierModel,
  TierPricing,
} from './types';
