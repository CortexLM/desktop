/**
 * Preset -> constraint mapping.
 *
 * A preset is user intent, so it acts *first* and it acts as a **window**, not a
 * preference: if the user asked for `cheapest`, silently spending Opus money is
 * a bug, not a helpful upgrade. Task classification then proposes a lane inside
 * that window, and infrastructure decides what is callable.
 *
 * Note a genuine conflict between the two catalogues this reconciles:
 * `MODEL_PRESETS` is *per provider* ("cheapest for anthropic" = Sonnet 4.5),
 * while `routing/` lanes are *global* (Sonnet 4.5 is the mid lane). The two
 * cannot both be authoritative. Resolution used here: the lane window is
 * authoritative for spend, and the preset's per-provider model is applied only
 * as a tie-break *within* the selected lane. So `cheapest` never buys a mid-lane
 * model just because one provider's own "cheapest" entry happens to be one.
 */

import type { ModelPreset } from '../model-presets';
import { tierIndex } from '../routing/model-tiers';
import type { ModelTier } from '../routing/types';
import { TIER_ORDER } from '../routing/types';
import type { PresetConstraint } from './types';

/**
 * Default constraint per preset.
 *
 * - `cheapest`  — pinned to the cheap lane. A ceiling that can be exceeded is
 *                 not a ceiling.
 * - `fastest`   — cheap or mid. The top lane is the slowest, so allowing it
 *                 would contradict the intent; latency objective ranks the
 *                 remaining providers.
 * - `smartest`  — mid or expensive, quality objective. Not pinned to expensive:
 *                 the mid lane is a legitimate answer when the top lane is
 *                 uncallable, and refusing to run at all is worse.
 * - `reasoning` — expensive only, quality objective. Reasoning work that silently
 *                 lands on a cheap model produces confident wrong answers, which
 *                 is the failure mode this preset exists to avoid.
 */
export const PRESET_CONSTRAINTS: Record<ModelPreset, PresetConstraint> = {
  cheapest: { minTier: 'cheap', maxTier: 'cheap', objective: 'cost' },
  fastest: { minTier: 'cheap', maxTier: 'mid', objective: 'latency' },
  smartest: { minTier: 'mid', maxTier: 'expensive', objective: 'quality' },
  reasoning: { minTier: 'expensive', maxTier: 'expensive', objective: 'quality' },
};

/** Constraint applied when no preset is set: full range, balanced scoring. */
export const NO_PRESET_CONSTRAINT: PresetConstraint = { objective: 'balanced' };

/** Constraint for a preset, or the neutral one when the preset is absent. */
export function constraintFor(preset?: ModelPreset): PresetConstraint {
  return preset ? PRESET_CONSTRAINTS[preset] : NO_PRESET_CONSTRAINT;
}

/**
 * Intersect the preset window with the task's own `minTier`/`maxTier` bounds.
 *
 * Both are caller intent, so neither overrides the other; the result is the
 * narrower window. A contradictory intersection (min above max) collapses to the
 * upper bound, matching `ModelRouter`'s existing behaviour so the two never
 * disagree about an impossible window.
 */
export function resolveWindow(
  constraint: PresetConstraint,
  taskMin?: ModelTier,
  taskMax?: ModelTier
): { min: ModelTier; max: ModelTier } {
  const minIndex = Math.max(
    constraint.minTier ? tierIndex(constraint.minTier) : 0,
    taskMin ? tierIndex(taskMin) : 0
  );
  const maxIndex = Math.min(
    constraint.maxTier ? tierIndex(constraint.maxTier) : TIER_ORDER.length - 1,
    taskMax ? tierIndex(taskMax) : TIER_ORDER.length - 1
  );

  if (minIndex > maxIndex) {
    const collapsed = TIER_ORDER[maxIndex]!;
    return { min: collapsed, max: collapsed };
  }

  return { min: TIER_ORDER[minIndex]!, max: TIER_ORDER[maxIndex]! };
}

/**
 * Lanes to try, in order, starting from the proposed lane.
 *
 * Nearest-first, breaking ties **upward**. Rationale: if the proposed lane is
 * uncallable, a more capable lane still produces a correct answer for more
 * money, whereas a cheaper lane risks a wrong answer — and a wrong answer costs
 * a retry plus the user's trust. Overpaying is the recoverable error.
 */
export function laneSearchOrder(
  proposed: ModelTier,
  window: { min: ModelTier; max: ModelTier }
): ModelTier[] {
  const proposedIndex = tierIndex(proposed);
  const minIndex = tierIndex(window.min);
  const maxIndex = tierIndex(window.max);

  const clamped = Math.min(Math.max(proposedIndex, minIndex), maxIndex);
  const order: ModelTier[] = [TIER_ORDER[clamped]!];

  for (let distance = 1; distance < TIER_ORDER.length; distance += 1) {
    for (const index of [clamped + distance, clamped - distance]) {
      if (index < minIndex || index > maxIndex) continue;
      order.push(TIER_ORDER[index]!);
    }
  }

  return order;
}
