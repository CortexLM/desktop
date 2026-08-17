/**
 * Tier -> model bindings and cost math.
 *
 * Prices are USD per 1M tokens. They are configuration, not constants: override
 * them via `ModelRouter` config when a deployment negotiates different rates or
 * pins different models.
 */

import type { ModelTier, TierModel, TierPricing } from './types';
import { TIER_ORDER } from './types';

/**
 * Default lane assignment.
 *
 * cheap -> Gemini 3.7 Flash: mechanical work, much cheaper than the top lane.
 * mid -> Claude Sonnet 4.5: bug fixes and small features.
 * expensive -> Claude Opus 4.8: architecture, refactors, hard debugging.
 */
export const DEFAULT_TIER_MODELS: Record<ModelTier, TierModel> = {
  cheap: {
    tier: 'cheap',
    provider: 'openrouter',
    model: 'google/gemini-3.7-flash',
    displayName: 'Gemini 3.7 Flash',
    contextWindow: 1_000_000,
    pricing: { input: 0.3, output: 2.5 },
  },
  mid: {
    tier: 'mid',
    provider: 'anthropic',
    model: 'claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4.5',
    contextWindow: 200_000,
    pricing: { input: 3, output: 15 },
  },
  expensive: {
    tier: 'expensive',
    provider: 'anthropic',
    model: 'claude-opus-4.8',
    displayName: 'Claude Opus 4.8',
    contextWindow: 200_000,
    pricing: { input: 15, output: 75 },
  },
};

/** Typical agent turn is read-heavy: mostly input tokens, little output. */
export const DEFAULT_INPUT_RATIO = 0.9;

/** Merge partial overrides onto the default tier table. */
export function resolveTierModels(
  overrides?: Partial<Record<ModelTier, Partial<TierModel>>>
): Record<ModelTier, TierModel> {
  const resolved = {} as Record<ModelTier, TierModel>;

  for (const tier of TIER_ORDER) {
    const base = DEFAULT_TIER_MODELS[tier];
    const override = overrides?.[tier];
    resolved[tier] = {
      ...base,
      ...override,
      tier,
      pricing: { ...base.pricing, ...override?.pricing },
    };
  }

  return resolved;
}

/** Position of a tier in the cheap -> expensive walk. */
export function tierIndex(tier: ModelTier): number {
  return TIER_ORDER.indexOf(tier);
}

/** Next tier up, or `undefined` when already at the top. */
export function nextTier(tier: ModelTier): ModelTier | undefined {
  return TIER_ORDER[tierIndex(tier) + 1];
}

/** Constrain a tier to an inclusive [min, max] window. */
export function clampTier(tier: ModelTier, min?: ModelTier, max?: ModelTier): ModelTier {
  let index = tierIndex(tier);
  if (min) index = Math.max(index, tierIndex(min));
  if (max) index = Math.min(index, tierIndex(max));
  // Non-null: index stays inside TIER_ORDER because all inputs are valid tiers.
  return TIER_ORDER[index]!;
}

/** Cost in USD for a given token split. */
export function computeCost(
  pricing: TierPricing,
  inputTokens: number,
  outputTokens: number
): number {
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/**
 * Blended cost per 1M tokens at a given input/output mix. Used to compare lanes
 * without committing to a specific token count.
 */
export function blendedCostPerMillion(pricing: TierPricing, inputRatio = DEFAULT_INPUT_RATIO): number {
  const ratio = Math.min(1, Math.max(0, inputRatio));
  return pricing.input * ratio + pricing.output * (1 - ratio);
}

/**
 * How many times cheaper `cheap` is than `expensive` at the given mix.
 *
 * This is a property of whatever price table is configured, not a constant of
 * the world. The default table yields ~40x at the default input mix, but that is
 * an artefact of pairing the cheapest available Flash model against Opus; on
 * realistically mixed traffic the observed gap is closer to ~8x. No routing
 * logic reads this value — it exists for reporting — and none of the escalation
 * math assumes any particular ratio.
 */
export function costRatio(
  cheap: TierPricing,
  expensive: TierPricing,
  inputRatio = DEFAULT_INPUT_RATIO
): number {
  const cheapCost = blendedCostPerMillion(cheap, inputRatio);
  if (cheapCost === 0) return Infinity;
  return blendedCostPerMillion(expensive, inputRatio) / cheapCost;
}
