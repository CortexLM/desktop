/**
 * Composed model selection.
 *
 * One decision that applies all three existing criteria in order:
 * user intent (preset) -> task complexity (lane proposal) -> infrastructure
 * state (eligibility veto and final pick).
 *
 * The three subsystems stay where they are and keep their own tests; this module
 * is the composition layer, not a replacement. See `README.md` for what was
 * unified, what was deliberately left separate, and the design points contested.
 */

export { UnifiedModelSelector, createUnifiedModelSelector } from './unified-selector';
export type {
  UnifiedModelSelectorConfig,
  UnifiedModelSelectorDeps,
  SelectionAttemptResult,
  SelectionResult,
} from './unified-selector';

export { buildLaneCandidates, FALLBACK_NOTES } from './lane-candidates';

export {
  PRESET_CONSTRAINTS,
  NO_PRESET_CONSTRAINT,
  constraintFor,
  resolveWindow,
  laneSearchOrder,
} from './preset-constraints';

export { selectComposed } from './selection-engine';
export type { InfraSurface, EngineDeps } from './selection-engine';

export type {
  LaneCandidate,
  LaneDeviation,
  PresetConstraint,
  RejectedCandidate,
  SelectionDecision,
  SelectionRequest,
} from './types';
