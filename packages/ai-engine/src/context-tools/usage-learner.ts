/**
 * Usage learner: the "learnable" half of Context-as-a-Tool.
 *
 * Tracks which context actually contributed to progress, learns per-file and
 * per-source reliability, and predicts what to fetch next. Without this the
 * tools are just manual plumbing; with it, retention decisions improve over a
 * session and across sessions when state is persisted.
 *
 * Scoring is deliberately transparent (weighted linear terms, no opaque model)
 * because eviction decisions must be explainable when they go wrong.
 */

import type {
  ContextItem,
  ContextPrediction,
  ContextSource,
  FileUsageStats,
  UsageObservation,
} from './types';

/**
 * Smoothing constant for hit rates. Prior of 1 fetch / 0.5 useful keeps a
 * single unlucky observation from driving a file's score to zero.
 */
const PRIOR_FETCHES = 1;
const PRIOR_USEFUL = 0.5;

/** Weights for `expectedUtility`. Tuned so no single signal dominates. */
const WEIGHTS = {
  recency: 0.3,
  frequency: 0.25,
  learnedFileHitRate: 0.2,
  taskRelevance: 0.15,
  tierBoost: 0.1,
} as const;

/** Turns after which recency contribution has decayed substantially. */
const RECENCY_HALF_LIFE = 5;

export interface SerializedLearnerState {
  files: FileUsageStats[];
  sources: Array<{ source: ContextSource; fetches: number; usefulHits: number }>;
  cooccurrence: Array<{ file: string; related: Array<{ file: string; count: number }> }>;
}

export class ContextUsageLearner {
  private readonly files = new Map<string, FileUsageStats>();
  private readonly sources = new Map<ContextSource, { fetches: number; usefulHits: number }>();
  /** file -> (co-useful file -> count). Powers "you'll probably also need" hints. */
  private readonly cooccurrence = new Map<string, Map<string, number>>();
  /** Lowercased task keywords, used for lexical relevance. */
  private taskTerms: string[] = [];

  /** Set the task description so relevance scoring has something to match. */
  setTaskContext(description: string): void {
    this.taskTerms = tokenizeTerms(description);
  }

  /** Record one observation of context being useful or not. */
  observe(observation: UsageObservation): void {
    const sourceStats = this.sources.get(observation.source) ?? { fetches: 0, usefulHits: 0 };
    sourceStats.fetches += 1;
    if (observation.useful) sourceStats.usefulHits += 1;
    this.sources.set(observation.source, sourceStats);

    if (!observation.filePath) return;

    const existing = this.files.get(observation.filePath);
    const fetches = (existing?.fetches ?? 0) + 1;
    const usefulHits = (existing?.usefulHits ?? 0) + (observation.useful ? 1 : 0);

    this.files.set(observation.filePath, {
      filePath: observation.filePath,
      fetches,
      usefulHits,
      hitRate: smoothedRate(usefulHits, fetches),
      lastSeenTurn: observation.turn,
    });
  }

  /**
   * Record that a set of files were useful together in one turn, so the learner
   * can later suggest the rest of a cluster when one member is fetched.
   */
  observeCooccurrence(filePaths: readonly string[]): void {
    const unique = [...new Set(filePaths)];

    for (const file of unique) {
      const related = this.cooccurrence.get(file) ?? new Map<string, number>();

      for (const other of unique) {
        if (other === file) continue;
        related.set(other, (related.get(other) ?? 0) + 1);
      }

      this.cooccurrence.set(file, related);
    }
  }

  getFileStats(filePath: string): FileUsageStats | undefined {
    return this.files.get(filePath);
  }

  /** Smoothed useful-rate for a source type. Defaults to the neutral prior. */
  getSourceHitRate(source: ContextSource): number {
    const stats = this.sources.get(source);
    if (!stats) return smoothedRate(0, 0);
    return smoothedRate(stats.usefulHits, stats.fetches);
  }

  /**
   * Expected utility of keeping an item, in 0..1.
   *
   * Pinned items are not scored here: retention for them is not a judgement
   * call. Callers filter pinned items before ranking.
   */
  expectedUtility(item: ContextItem, currentTurn: number): number {
    const recency = this.recencyScore(item, currentTurn);
    const frequency = saturate(item.useCount, 3);
    const fileRate = item.filePath ? (this.files.get(item.filePath)?.hitRate ?? smoothedRate(0, 0)) : this.getSourceHitRate(item.source);
    const relevance = this.taskRelevance(item);
    const tierBoost = item.tier === 'long-term' ? 1 : item.tier === 'task' ? 1 : 0.4;

    const score =
      WEIGHTS.recency * recency +
      WEIGHTS.frequency * frequency +
      WEIGHTS.learnedFileHitRate * fileRate +
      WEIGHTS.taskRelevance * relevance +
      WEIGHTS.tierBoost * tierBoost;

    return clamp01(score);
  }

  /**
   * Rank eviction candidates worst-first, so a caller can free tokens by
   * walking the list until the deficit is covered.
   */
  rankForEviction(items: readonly ContextItem[], currentTurn: number): ContextItem[] {
    return items
      .filter((item) => !item.pinned && item.tier !== 'task')
      .map((item) => ({ item, utility: this.expectedUtility(item, currentTurn) }))
      .sort((a, b) => {
        if (a.utility !== b.utility) return a.utility - b.utility;
        // Break ties by size: dropping a bigger item frees more per decision.
        return b.item.tokens - a.item.tokens;
      })
      .map((entry) => entry.item);
  }

  /**
   * Predict files worth fetching, from learned hit rates plus co-occurrence
   * with what is already loaded. This is what turns a second run on a similar
   * task into fewer wasted fetches.
   */
  predict(options: { alreadyLoaded?: readonly string[]; limit?: number } = {}): ContextPrediction[] {
    const loaded = new Set(options.alreadyLoaded ?? []);
    const limit = options.limit ?? 5;
    const scores = new Map<string, ContextPrediction>();

    for (const stats of this.files.values()) {
      if (loaded.has(stats.filePath)) continue;
      if (stats.usefulHits === 0) continue;

      scores.set(stats.filePath, {
        filePath: stats.filePath,
        confidence: clamp01(stats.hitRate),
        reason: `useful in ${stats.usefulHits}/${stats.fetches} previous fetches`,
      });
    }

    // Boost files that historically appeared alongside currently loaded files.
    for (const file of loaded) {
      const related = this.cooccurrence.get(file);
      if (!related) continue;

      for (const [candidate, count] of related) {
        if (loaded.has(candidate)) continue;

        const boost = clamp01(saturate(count, 3) * 0.5);
        const existing = scores.get(candidate);

        if (existing) {
          scores.set(candidate, {
            ...existing,
            confidence: clamp01(existing.confidence + boost),
            reason: `${existing.reason}; co-occurs with ${file}`,
          });
        } else {
          scores.set(candidate, {
            filePath: candidate,
            confidence: boost,
            reason: `co-occurs with ${file} (${count}x)`,
          });
        }
      }
    }

    return [...scores.values()]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  /** Export state for cross-session persistence. */
  serialize(): SerializedLearnerState {
    return {
      files: [...this.files.values()],
      sources: [...this.sources.entries()].map(([source, stats]) => ({ source, ...stats })),
      cooccurrence: [...this.cooccurrence.entries()].map(([file, related]) => ({
        file,
        related: [...related.entries()].map(([f, count]) => ({ file: f, count })),
      })),
    };
  }

  /** Restore previously serialized state. Replaces current state. */
  static deserialize(state: SerializedLearnerState): ContextUsageLearner {
    const learner = new ContextUsageLearner();

    for (const file of state.files) {
      learner.files.set(file.filePath, { ...file });
    }

    for (const entry of state.sources) {
      learner.sources.set(entry.source, {
        fetches: entry.fetches,
        usefulHits: entry.usefulHits,
      });
    }

    for (const entry of state.cooccurrence) {
      learner.cooccurrence.set(
        entry.file,
        new Map(entry.related.map((r) => [r.file, r.count])),
      );
    }

    return learner;
  }

  private recencyScore(item: ContextItem, currentTurn: number): number {
    const referenceTurn = item.lastUsedAtTurn ?? item.addedAtTurn;
    const age = Math.max(0, currentTurn - referenceTurn);
    // Exponential decay: halves every RECENCY_HALF_LIFE turns.
    return Math.pow(0.5, age / RECENCY_HALF_LIFE);
  }

  private taskRelevance(item: ContextItem): number {
    if (this.taskTerms.length === 0) return 0.5; // No task signal: stay neutral.

    const haystack = `${item.filePath ?? ''} ${(item.symbols ?? []).join(' ')} ${item.content}`.toLowerCase();
    let matches = 0;

    for (const term of this.taskTerms) {
      if (haystack.includes(term)) matches += 1;
    }

    return clamp01(matches / this.taskTerms.length);
  }
}

/** Words worth matching on: drops short tokens and common English filler. */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'when', 'where',
  'what', 'which', 'should', 'would', 'could', 'have', 'has', 'are', 'was',
  'fix', 'add', 'make', 'use', 'using', 'need', 'needs',
]);

function tokenizeTerms(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 2 && !STOP_WORDS.has(term)),
    ),
  ];
}

function smoothedRate(usefulHits: number, fetches: number): number {
  return (usefulHits + PRIOR_USEFUL) / (fetches + PRIOR_FETCHES);
}

/** Diminishing-returns curve mapping a count to 0..1. */
function saturate(value: number, scale: number): number {
  if (value <= 0) return 0;
  return value / (value + scale);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
