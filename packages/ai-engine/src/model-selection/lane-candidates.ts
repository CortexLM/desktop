/**
 * Lane -> candidate models, across providers.
 *
 * This is the structural fix that makes composition possible. `routing/` binds
 * each lane to exactly one `(provider, model)` pair, so an infrastructure veto on
 * that provider left the lane with nothing to offer and forced a change of lane —
 * changing cost and capability because of an unrelated queue depth.
 *
 * Here a lane is a *set* of interchangeable candidates. The lane's canonical
 * binding from `DEFAULT_TIER_MODELS` is always first and marked `primary`, so
 * with healthy infrastructure the composed decision matches what `ModelRouter`
 * would have chosen on its own. The rest are fallbacks, used only when the
 * primary is not callable.
 *
 * Prices are USD per 1M tokens and are **configuration**: they change often and
 * differ per account. Override them via `UnifiedModelSelector`'s
 * `laneCandidates` / `tiers` config rather than editing this table.
 */

import { resolveTierModels } from '../routing/model-tiers';
import type { ModelTier, TierModel } from '../routing/types';
import { TIER_ORDER } from '../routing/types';
import type { LaneCandidate } from './types';

/**
 * Cross-provider fallbacks per lane, excluding each lane's primary binding.
 *
 * Context windows are listed per candidate because they vary *within* a lane:
 * the cheap lane's Gemini models hold 1M tokens while every mid and expensive
 * candidate holds 200k. That inversion is load-bearing — see `FALLBACK_NOTES`.
 */
const LANE_FALLBACKS: Record<ModelTier, Omit<LaneCandidate, 'tier' | 'primary'>[]> = {
  cheap: [
    {
      provider: 'openrouter',
      model: 'google/gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro',
      contextWindow: 1_000_000,
      pricing: { input: 1.25, output: 10 },
    },
    {
      provider: 'openrouter',
      model: 'deepseek/deepseek-r1',
      displayName: 'DeepSeek R1',
      contextWindow: 64_000,
      pricing: { input: 0.55, output: 2.19 },
    },
    {
      provider: 'ollama',
      model: 'llama3.1',
      displayName: 'Llama 3.1 (local)',
      contextWindow: 128_000,
      pricing: { input: 0, output: 0 },
    },
  ],
  mid: [
    {
      provider: 'openai',
      model: 'gpt-4o-2024-11-20',
      displayName: 'GPT-4o (Nov 2024)',
      contextWindow: 128_000,
      pricing: { input: 2.5, output: 10 },
    },
    {
      provider: 'openrouter',
      model: 'openai/gpt-4.5-turbo',
      displayName: 'GPT-4.5 Turbo',
      contextWindow: 128_000,
      pricing: { input: 5, output: 15 },
    },
  ],
  expensive: [
    {
      // Same weights as the primary, different infrastructure path: the ideal
      // failover, since capability is unchanged.
      provider: 'openrouter',
      model: 'anthropic/claude-opus-4.8-fast',
      displayName: 'Claude Opus 4.8 (Fast, via OpenRouter)',
      contextWindow: 200_000,
      pricing: { input: 15, output: 75 },
    },
    {
      provider: 'openai',
      model: 'gpt-4.5-turbo',
      displayName: 'GPT-4.5 Turbo',
      contextWindow: 128_000,
      pricing: { input: 5, output: 15 },
    },
    {
      provider: 'grok',
      model: 'claude-opus-5:stable',
      displayName: 'Claude Opus 5 (Grok)',
      contextWindow: 200_000,
      pricing: { input: 2, output: 10 },
    },
  ],
};

/**
 * Known gaps in the fallback table, documented rather than silently papered over:
 *
 * 1. **Large-context work is single-provider.** Every candidate above 200k tokens
 *    is an OpenRouter-hosted Gemini. If OpenRouter is down, a 500k-token task has
 *    no home at all — selection returns `provider: null` with that reason instead
 *    of picking a model guaranteed to overflow. Fixing this needs a non-OpenRouter
 *    long-context provider, which is a deployment decision, not a code change.
 *
 * 2. **Infrastructure cost signals are per provider, not per model.** The
 *    monitor's `ProviderCapacity` carries one price per provider, so it cannot
 *    tell a lane's cheap candidate from an expensive one on the same provider.
 *    Lane pricing here is therefore the authority for spend; the monitor's prices
 *    are only used for its own budget accounting.
 */
export const FALLBACK_NOTES = {
  longContextProviders: ['openrouter'] as const,
  longContextThresholdTokens: 200_000,
} as const;

/**
 * Build the lane -> candidates table.
 *
 * `tiers` overrides flow through `resolveTierModels`, so the primary of each lane
 * stays identical to what a `ModelRouter` built with the same overrides uses.
 * `extra` appends deployment-specific candidates after the built-in fallbacks.
 */
export function buildLaneCandidates(options: {
  tiers?: Partial<Record<ModelTier, Partial<TierModel>>>;
  extra?: Partial<Record<ModelTier, Omit<LaneCandidate, 'tier' | 'primary'>[]>>;
  /** When set, drop candidates whose provider is not in this list. */
  availableProviders?: readonly string[];
} = {}): Record<ModelTier, LaneCandidate[]> {
  const primaries = resolveTierModels(options.tiers);
  const allowed = options.availableProviders ? new Set(options.availableProviders) : undefined;
  const table = {} as Record<ModelTier, LaneCandidate[]>;

  for (const tier of TIER_ORDER) {
    const primary = primaries[tier];
    const candidates: LaneCandidate[] = [
      {
        tier,
        provider: primary.provider,
        model: primary.model,
        displayName: primary.displayName,
        contextWindow: primary.contextWindow,
        pricing: primary.pricing,
        primary: true,
      },
      ...[...LANE_FALLBACKS[tier], ...(options.extra?.[tier] ?? [])].map((candidate) => ({
        ...candidate,
        tier,
        primary: false,
      })),
    ];

    // De-duplicate on (provider, model); an override can collide with a fallback.
    const seen = new Set<string>();
    table[tier] = candidates.filter((candidate) => {
      const key = `${candidate.provider}:${candidate.model}`;
      if (seen.has(key)) return false;
      if (allowed && !allowed.has(candidate.provider)) return false;
      seen.add(key);
      return true;
    });
  }

  return table;
}
