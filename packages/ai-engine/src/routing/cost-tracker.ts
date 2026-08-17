/**
 * Cost tracking for routed tasks.
 *
 * Every attempt is recorded with its tier, token usage, and actual cost. The
 * baseline is what the same token usage would have cost on the expensive lane,
 * which is what an unrouted agent would have spent. Savings are the difference,
 * and escalation waste is tracked separately so the routing policy can be
 * judged on cost per *successful* task rather than cost per token.
 */

import { computeCost } from './model-tiers';
import type { ModelTier, TaskComplexity, TaskKind, TierModel, TierPricing } from './types';
import { TIER_ORDER } from './types';

/** Token usage for one model call. */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** One recorded attempt. */
export interface CostRecord {
  taskId: string;
  tier: ModelTier;
  provider: string;
  model: string;
  kind?: TaskKind;
  complexity: TaskComplexity;
  attempt: number;
  escalated: boolean;
  succeeded: boolean;
  usage: TokenUsage;
  /** Actual USD cost of this attempt. */
  cost: number;
  /** USD this attempt would have cost on the expensive lane. */
  baselineCost: number;
  timestamp: number;
}

/** Aggregate figures for a slice of records. */
export interface CostSummary {
  attempts: number;
  tasks: number;
  successfulTasks: number;
  inputTokens: number;
  outputTokens: number;
  /** Total actual spend, USD. */
  cost: number;
  /** Total spend if everything had gone to the expensive lane, USD. */
  baselineCost: number;
  /** baselineCost - cost, USD. Negative if routing lost money. */
  savings: number;
  /** Savings as a fraction of baseline, 0-1. */
  savingsRatio: number;
  /** Spend on attempts that failed and were escalated away from, USD. */
  escalationWaste: number;
  /** Actual cost divided by successful tasks, USD. The number that matters. */
  costPerSuccessfulTask: number;
}

/** Full report, sliced by task kind and by tier. */
export interface CostReport {
  overall: CostSummary;
  byKind: Record<string, CostSummary>;
  byComplexity: Record<string, CostSummary>;
  byTier: Record<string, CostSummary>;
  /** Share of attempts sent to each tier, 0-1. */
  tierDistribution: Record<ModelTier, number>;
  /** Escalations per task, averaged. */
  escalationRate: number;
}

function emptySummary(): CostSummary {
  return {
    attempts: 0,
    tasks: 0,
    successfulTasks: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    baselineCost: 0,
    savings: 0,
    savingsRatio: 0,
    escalationWaste: 0,
    costPerSuccessfulTask: 0,
  };
}

function summarize(records: CostRecord[]): CostSummary {
  const summary = emptySummary();
  const taskIds = new Set<string>();
  const succeededTaskIds = new Set<string>();

  for (const record of records) {
    summary.attempts += 1;
    summary.inputTokens += record.usage.inputTokens;
    summary.outputTokens += record.usage.outputTokens;
    summary.cost += record.cost;
    summary.baselineCost += record.baselineCost;
    taskIds.add(record.taskId);
    if (record.succeeded) succeededTaskIds.add(record.taskId);
    if (!record.succeeded) summary.escalationWaste += record.cost;
  }

  summary.tasks = taskIds.size;
  summary.successfulTasks = succeededTaskIds.size;
  summary.savings = summary.baselineCost - summary.cost;
  summary.savingsRatio = summary.baselineCost > 0 ? summary.savings / summary.baselineCost : 0;
  summary.costPerSuccessfulTask =
    summary.successfulTasks > 0 ? summary.cost / summary.successfulTasks : summary.cost;

  return summary;
}

export class CostTracker {
  private readonly records: CostRecord[] = [];
  private readonly baselinePricing: TierPricing;

  /**
   * @param baselinePricing Pricing to compare against. Defaults to the
   *   expensive lane, i.e. "what we would have paid without routing".
   */
  constructor(models: Record<ModelTier, TierModel>, baselinePricing?: TierPricing) {
    this.baselinePricing = baselinePricing ?? models.expensive.pricing;
  }

  /** Record one attempt and return the stored record. */
  record(entry: {
    taskId: string;
    tier: ModelTier;
    provider: string;
    model: string;
    pricing: TierPricing;
    kind?: TaskKind;
    complexity: TaskComplexity;
    attempt: number;
    escalated: boolean;
    succeeded: boolean;
    usage: TokenUsage;
  }): CostRecord {
    const record: CostRecord = {
      taskId: entry.taskId,
      tier: entry.tier,
      provider: entry.provider,
      model: entry.model,
      kind: entry.kind,
      complexity: entry.complexity,
      attempt: entry.attempt,
      escalated: entry.escalated,
      succeeded: entry.succeeded,
      usage: entry.usage,
      cost: computeCost(entry.pricing, entry.usage.inputTokens, entry.usage.outputTokens),
      baselineCost: computeCost(this.baselinePricing, entry.usage.inputTokens, entry.usage.outputTokens),
      timestamp: Date.now(),
    };

    this.records.push(record);
    return record;
  }

  /** All recorded attempts, in order. */
  getRecords(): readonly CostRecord[] {
    return this.records;
  }

  /** Aggregate everything recorded so far. */
  getSummary(): CostSummary {
    return summarize(this.records);
  }

  /** Full report, sliced by kind, complexity, and tier. */
  getReport(): CostReport {
    const byKind: Record<string, CostSummary> = {};
    const byComplexity: Record<string, CostSummary> = {};
    const byTier: Record<string, CostSummary> = {};

    const group = (
      target: Record<string, CostSummary>,
      keyOf: (record: CostRecord) => string
    ): void => {
      const buckets = new Map<string, CostRecord[]>();
      for (const record of this.records) {
        const key = keyOf(record);
        const bucket = buckets.get(key);
        if (bucket) bucket.push(record);
        else buckets.set(key, [record]);
      }
      for (const [key, bucket] of buckets) {
        target[key] = summarize(bucket);
      }
    };

    group(byKind, (r) => r.kind ?? 'unknown');
    group(byComplexity, (r) => r.complexity);
    group(byTier, (r) => r.tier);

    const tierDistribution = {} as Record<ModelTier, number>;
    for (const tier of TIER_ORDER) {
      tierDistribution[tier] = this.records.length
        ? this.records.filter((r) => r.tier === tier).length / this.records.length
        : 0;
    }

    const taskIds = new Set(this.records.map((r) => r.taskId));
    const escalations = this.records.filter((r) => r.escalated).length;

    return {
      overall: summarize(this.records),
      byKind,
      byComplexity,
      byTier,
      tierDistribution,
      escalationRate: taskIds.size ? escalations / taskIds.size : 0,
    };
  }

  /** Human-readable report, for CLI output or logs. */
  formatReport(): string {
    const report = this.getReport();
    const { overall } = report;
    const usd = (n: number): string => `$${n.toFixed(4)}`;
    const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

    const lines = [
      'Model routing cost report',
      '─'.repeat(48),
      `Tasks:                 ${overall.tasks} (${overall.successfulTasks} succeeded)`,
      `Attempts:              ${overall.attempts}`,
      `Tokens:                ${overall.inputTokens} in / ${overall.outputTokens} out`,
      `Actual cost:           ${usd(overall.cost)}`,
      `Baseline (all-Opus):   ${usd(overall.baselineCost)}`,
      `Savings:               ${usd(overall.savings)} (${pct(overall.savingsRatio)})`,
      `Escalation waste:      ${usd(overall.escalationWaste)}`,
      `Cost per success:      ${usd(overall.costPerSuccessfulTask)}`,
      `Escalations per task:  ${report.escalationRate.toFixed(2)}`,
      '',
      'Tier distribution',
    ];

    for (const tier of TIER_ORDER) {
      lines.push(`  ${tier.padEnd(10)} ${pct(report.tierDistribution[tier])}`);
    }

    const kinds = Object.entries(report.byKind);
    if (kinds.length > 0) {
      lines.push('', 'By task kind');
      for (const [kind, summary] of kinds.sort((a, b) => b[1].cost - a[1].cost)) {
        lines.push(
          `  ${kind.padEnd(16)} ${usd(summary.cost).padStart(10)}  saved ${pct(summary.savingsRatio).padStart(6)}`
        );
      }
    }

    return lines.join('\n');
  }

  /** Drop all records. */
  reset(): void {
    this.records.length = 0;
  }
}
