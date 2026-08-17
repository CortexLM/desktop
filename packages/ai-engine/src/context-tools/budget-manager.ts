/**
 * Token budget accounting for the CAT workspace.
 *
 * Design note: the budget is a *reporting* surface, not just a guard. The paper's
 * result depends on the agent seeing its own remaining budget and reacting, so
 * every tool result carries a fresh snapshot. Hiding the budget and silently
 * truncating is what static-compression baselines do, and it is what we beat.
 */

import type { BudgetPressure, BudgetSnapshot, ContextItem, ContextTier } from './types';

/** Utilization thresholds for pressure states. */
const PRESSURE_THRESHOLDS = {
  moderate: 0.5,
  high: 0.75,
  critical: 0.9,
} as const;

/**
 * Tokens a "typical" fetch costs. Used to decide `needsRelief`, i.e. whether
 * the agent should free space before it tries to pull more context.
 */
const TYPICAL_FETCH_TOKENS = 1500;

export interface BudgetManagerConfig {
  /** Full context window of the target model. */
  maxTokens: number;
  /** Tokens held back for the model's reply. */
  reserveForOutput?: number;
  /** Override for the fetch-size heuristic behind `needsRelief`. */
  typicalFetchTokens?: number;
}

export class ContextBudgetManager {
  private readonly maxTokens: number;
  private readonly reserveForOutput: number;
  private readonly typicalFetchTokens: number;
  private overflowEvents = 0;

  constructor(config: BudgetManagerConfig) {
    if (config.maxTokens <= 0) {
      throw new Error('maxTokens must be positive');
    }

    const reserve = config.reserveForOutput ?? 4096;

    if (reserve >= config.maxTokens) {
      throw new Error('reserveForOutput must be smaller than maxTokens');
    }

    this.maxTokens = config.maxTokens;
    this.reserveForOutput = reserve;
    this.typicalFetchTokens = config.typicalFetchTokens ?? TYPICAL_FETCH_TOKENS;
  }

  /** Tokens available for context after the output reservation. */
  get usable(): number {
    return this.maxTokens - this.reserveForOutput;
  }

  /**
   * Build the snapshot the agent sees. Recorded as an overflow event when used
   * tokens exceed the usable budget, which is the failure mode we track in A/B.
   */
  snapshot(items: readonly ContextItem[]): BudgetSnapshot {
    const byTier: Record<ContextTier, number> = {
      task: 0,
      'long-term': 0,
      'short-term': 0,
    };

    let used = 0;

    for (const item of items) {
      used += item.tokens;
      byTier[item.tier] += item.tokens;
    }

    const usable = this.usable;
    const remaining = usable - used;
    const utilization = used / usable;

    if (remaining < 0) {
      this.overflowEvents += 1;
    }

    return {
      max: this.maxTokens,
      reservedForOutput: this.reserveForOutput,
      usable,
      used,
      remaining,
      utilization,
      pressure: this.classify(utilization),
      byTier,
      needsRelief: remaining < this.typicalFetchTokens,
    };
  }

  /** Whether an addition of `tokens` fits in the usable budget. */
  canFit(items: readonly ContextItem[], tokens: number): boolean {
    return this.snapshot(items).remaining >= tokens;
  }

  /**
   * Tokens that must be freed to fit `tokens` more. Zero when it already fits.
   */
  deficitFor(items: readonly ContextItem[], tokens: number): number {
    const { remaining } = this.snapshot(items);
    return remaining >= tokens ? 0 : tokens - remaining;
  }

  get overflowCount(): number {
    return this.overflowEvents;
  }

  private classify(utilization: number): BudgetPressure {
    if (utilization >= PRESSURE_THRESHOLDS.critical) return 'critical';
    if (utilization >= PRESSURE_THRESHOLDS.high) return 'high';
    if (utilization >= PRESSURE_THRESHOLDS.moderate) return 'moderate';
    return 'low';
  }

  /**
   * Render the budget for the agent's prompt. Plain text beats JSON here:
   * it costs fewer tokens and models act on it more reliably.
   */
  static describe(snapshot: BudgetSnapshot): string {
    const pct = Math.round(snapshot.utilization * 100);
    const lines = [
      `Context budget: ${snapshot.used}/${snapshot.usable} tokens used (${pct}%), ${snapshot.remaining} remaining.`,
      `Pressure: ${snapshot.pressure}.`,
      `Breakdown - task: ${snapshot.byTier.task}, long-term: ${snapshot.byTier['long-term']}, short-term: ${snapshot.byTier['short-term']}.`,
    ];

    if (snapshot.pressure === 'critical') {
      lines.push('Free space now: call forget_context on unused items or summarize_context on old turns.');
    } else if (snapshot.needsRelief) {
      lines.push('Little room for another fetch. Consider summarize_context before get_more_context.');
    }

    return lines.join('\n');
  }
}
