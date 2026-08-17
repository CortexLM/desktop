/**
 * PriorityQueue - budget-aware scheduling queue.
 *
 * Orders pending work by priority so urgent requests are served first, with
 * age-based promotion so low-priority work cannot starve indefinitely
 * (INFRAMIND budget-aware scheduler).
 */

import {
  type Clock,
  PRIORITY_WEIGHT,
  type TaskPriority,
  systemClock,
} from './types';

export interface QueueConfig {
  /** Max entries retained; enqueue past this throws unless evictable. */
  maxSize?: number;
  /**
   * Weight added per second of waiting. Lets an aged low-priority entry
   * eventually outrank fresh high-priority work.
   */
  agingWeightPerSecond?: number;
  /**
   * Wait time in ms after which an entry is promoted to at least `high`,
   * bounding worst-case starvation.
   */
  starvationThresholdMs?: number;
}

const QUEUE_DEFAULTS = {
  maxSize: 1_000,
  agingWeightPerSecond: 5,
  starvationThresholdMs: 30_000,
} as const;

/** A queued item plus its scheduling metadata. */
export interface QueueEntry<T> {
  id: string;
  payload: T;
  priority: TaskPriority;
  enqueuedAt: number;
  /** Sequence number, used as a FIFO tiebreaker at equal effective priority. */
  sequence: number;
}

/** Aggregate queue statistics. */
export interface QueueStats {
  size: number;
  byPriority: Record<TaskPriority, number>;
  /** Wait time of the oldest entry in ms. */
  oldestWaitMs: number;
  /** Mean wait time across queued entries in ms. */
  averageWaitMs: number;
}

export class PriorityQueue<T> {
  private readonly clock: Clock;
  private readonly config: Required<QueueConfig>;
  private entries: QueueEntry<T>[] = [];
  private sequence = 0;

  constructor(config: QueueConfig = {}, clock: Clock = systemClock) {
    this.clock = clock;
    this.config = {
      maxSize: config.maxSize ?? QUEUE_DEFAULTS.maxSize,
      agingWeightPerSecond: config.agingWeightPerSecond ?? QUEUE_DEFAULTS.agingWeightPerSecond,
      starvationThresholdMs:
        config.starvationThresholdMs ?? QUEUE_DEFAULTS.starvationThresholdMs,
    };
  }

  /**
   * Adds an item. When full, evicts the lowest-priority entry if the incoming
   * item outranks it; otherwise rejects the incoming item.
   */
  enqueue(payload: T, priority: TaskPriority = 'normal'): QueueEntry<T> {
    if (this.entries.length >= this.config.maxSize) {
      const evicted = this.evictLowest(priority);
      if (!evicted) {
        throw new Error(
          `Queue is full (${this.config.maxSize}) and no lower-priority entry to evict`
        );
      }
    }

    this.sequence += 1;
    const entry: QueueEntry<T> = {
      id: `q_${this.sequence.toString(36)}`,
      payload,
      priority,
      enqueuedAt: this.clock.now(),
      sequence: this.sequence,
    };
    this.entries.push(entry);
    return entry;
  }

  /** Removes and returns the highest effective-priority entry. */
  dequeue(): QueueEntry<T> | undefined {
    if (this.entries.length === 0) return undefined;

    const now = this.clock.now();
    let bestIndex = 0;
    let bestWeight = this.effectiveWeight(this.entries[0]!, now);

    for (let i = 1; i < this.entries.length; i += 1) {
      const weight = this.effectiveWeight(this.entries[i]!, now);
      // Ties break FIFO, since entries are appended in sequence order.
      if (weight > bestWeight) {
        bestWeight = weight;
        bestIndex = i;
      }
    }

    return this.entries.splice(bestIndex, 1)[0];
  }

  /** Highest-priority entry without removing it. */
  peek(): QueueEntry<T> | undefined {
    if (this.entries.length === 0) return undefined;

    const now = this.clock.now();
    return this.entries.reduce((best, entry) =>
      this.effectiveWeight(entry, now) > this.effectiveWeight(best, now) ? entry : best
    );
  }

  /** Removes a specific entry by id. Returns true when found. */
  remove(id: string): boolean {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index === -1) return false;
    this.entries.splice(index, 1);
    return true;
  }

  /** Number of queued entries. */
  size(): number {
    return this.entries.length;
  }

  /** True when nothing is queued. */
  isEmpty(): boolean {
    return this.entries.length === 0;
  }

  /** Wait-time and priority distribution statistics. */
  getStats(): QueueStats {
    const now = this.clock.now();
    const byPriority: Record<TaskPriority, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    let oldestWaitMs = 0;
    let totalWaitMs = 0;

    for (const entry of this.entries) {
      byPriority[entry.priority] += 1;
      const waitMs = now - entry.enqueuedAt;
      oldestWaitMs = Math.max(oldestWaitMs, waitMs);
      totalWaitMs += waitMs;
    }

    return {
      size: this.entries.length,
      byPriority,
      oldestWaitMs,
      averageWaitMs: this.entries.length > 0 ? totalWaitMs / this.entries.length : 0,
    };
  }

  /** Entries in scheduling order, without mutating the queue. */
  toArray(): QueueEntry<T>[] {
    const now = this.clock.now();
    return [...this.entries].sort(
      (a, b) => this.effectiveWeight(b, now) - this.effectiveWeight(a, now) || a.sequence - b.sequence
    );
  }

  /** Discards all entries. */
  clear(): void {
    this.entries = [];
  }

  /**
   * Priority weight plus an aging bonus. Entries waiting past the starvation
   * threshold are floored at `high` so they cannot be indefinitely deferred.
   */
  private effectiveWeight(entry: QueueEntry<T>, now: number): number {
    const waitMs = Math.max(0, now - entry.enqueuedAt);
    const base =
      waitMs >= this.config.starvationThresholdMs
        ? Math.max(PRIORITY_WEIGHT[entry.priority], PRIORITY_WEIGHT.high)
        : PRIORITY_WEIGHT[entry.priority];
    const agingBonus = (waitMs / 1_000) * this.config.agingWeightPerSecond;
    return base + agingBonus;
  }

  /** Evicts the lowest-priority entry when it ranks below `incoming`. */
  private evictLowest(incoming: TaskPriority): boolean {
    if (this.entries.length === 0) return false;

    let lowestIndex = 0;
    let lowestWeight = PRIORITY_WEIGHT[this.entries[0]!.priority];

    for (let i = 1; i < this.entries.length; i += 1) {
      const weight = PRIORITY_WEIGHT[this.entries[i]!.priority];
      if (weight < lowestWeight) {
        lowestWeight = weight;
        lowestIndex = i;
      }
    }

    if (lowestWeight >= PRIORITY_WEIGHT[incoming]) return false;
    this.entries.splice(lowestIndex, 1);
    return true;
  }
}
