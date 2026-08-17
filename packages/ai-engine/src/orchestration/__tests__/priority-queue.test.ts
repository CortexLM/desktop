/**
 * Tests for PriorityQueue - priority ordering with anti-starvation aging.
 */

import { PriorityQueue } from '../priority-queue';
import type { Clock } from '../types';

class FakeClock implements Clock {
  private current = 1_000_000;

  now(): number {
    return this.current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

describe('PriorityQueue', () => {
  let clock: FakeClock;
  let queue: PriorityQueue<string>;

  beforeEach(() => {
    clock = new FakeClock();
    queue = new PriorityQueue<string>({}, clock);
  });

  describe('priority ordering', () => {
    it('serves higher priority first', () => {
      queue.enqueue('low-task', 'low');
      queue.enqueue('critical-task', 'critical');
      queue.enqueue('normal-task', 'normal');

      expect(queue.dequeue()!.payload).toBe('critical-task');
      expect(queue.dequeue()!.payload).toBe('normal-task');
      expect(queue.dequeue()!.payload).toBe('low-task');
    });

    it('breaks ties FIFO', () => {
      queue.enqueue('first', 'normal');
      queue.enqueue('second', 'normal');
      queue.enqueue('third', 'normal');

      expect(queue.dequeue()!.payload).toBe('first');
      expect(queue.dequeue()!.payload).toBe('second');
      expect(queue.dequeue()!.payload).toBe('third');
    });

    it('defaults to normal priority', () => {
      const entry = queue.enqueue('task');
      expect(entry.priority).toBe('normal');
    });

    it('returns undefined when empty', () => {
      expect(queue.dequeue()).toBeUndefined();
      expect(queue.peek()).toBeUndefined();
    });

    it('peeks without removing', () => {
      queue.enqueue('task', 'high');

      expect(queue.peek()!.payload).toBe('task');
      expect(queue.size()).toBe(1);
    });
  });

  describe('aging', () => {
    it('promotes long-waiting entries over fresh ones', () => {
      const aging = new PriorityQueue<string>(
        { agingWeightPerSecond: 20, starvationThresholdMs: 999_999 },
        clock
      );

      aging.enqueue('old-low', 'low');
      // 10s of aging adds 200 weight, beating high's base weight of 100.
      clock.advance(10_000);
      aging.enqueue('fresh-high', 'high');

      expect(aging.dequeue()!.payload).toBe('old-low');
    });

    it('does not let brief aging override priority', () => {
      queue.enqueue('old-low', 'low');
      clock.advance(500);
      queue.enqueue('fresh-critical', 'critical');

      expect(queue.dequeue()!.payload).toBe('fresh-critical');
    });

    it('floors starved entries at high priority', () => {
      const starving = new PriorityQueue<string>(
        { agingWeightPerSecond: 0, starvationThresholdMs: 5_000 },
        clock
      );

      starving.enqueue('starved-low', 'low');
      clock.advance(5_000);
      starving.enqueue('fresh-normal', 'normal');

      // Promoted to `high`, which outranks normal even with aging disabled.
      expect(starving.dequeue()!.payload).toBe('starved-low');
    });

    it('keeps critical above a starvation-promoted entry', () => {
      const starving = new PriorityQueue<string>(
        { agingWeightPerSecond: 0, starvationThresholdMs: 1_000 },
        clock
      );

      starving.enqueue('starved-low', 'low');
      clock.advance(1_000);
      starving.enqueue('fresh-critical', 'critical');

      expect(starving.dequeue()!.payload).toBe('fresh-critical');
    });
  });

  describe('capacity', () => {
    it('evicts a lower-priority entry when full', () => {
      const small = new PriorityQueue<string>({ maxSize: 2 }, clock);
      small.enqueue('low-1', 'low');
      small.enqueue('low-2', 'low');
      small.enqueue('critical', 'critical');

      expect(small.size()).toBe(2);
      expect(small.dequeue()!.payload).toBe('critical');
    });

    it('rejects an incoming entry that cannot displace anything', () => {
      const small = new PriorityQueue<string>({ maxSize: 1 }, clock);
      small.enqueue('critical', 'critical');

      expect(() => small.enqueue('low', 'low')).toThrow(/full/);
    });

    it('rejects an equal-priority entry when full', () => {
      const small = new PriorityQueue<string>({ maxSize: 1 }, clock);
      small.enqueue('normal-1', 'normal');

      expect(() => small.enqueue('normal-2', 'normal')).toThrow(/full/);
    });
  });

  describe('removal', () => {
    it('removes a specific entry by id', () => {
      const entry = queue.enqueue('task', 'normal');
      queue.enqueue('other', 'normal');

      expect(queue.remove(entry.id)).toBe(true);
      expect(queue.size()).toBe(1);
      expect(queue.dequeue()!.payload).toBe('other');
    });

    it('reports false for an unknown id', () => {
      expect(queue.remove('missing')).toBe(false);
    });

    it('clears every entry', () => {
      queue.enqueue('a');
      queue.enqueue('b');
      queue.clear();

      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('stats', () => {
    it('counts entries per priority', () => {
      queue.enqueue('a', 'critical');
      queue.enqueue('b', 'normal');
      queue.enqueue('c', 'normal');

      const stats = queue.getStats();
      expect(stats.size).toBe(3);
      expect(stats.byPriority.critical).toBe(1);
      expect(stats.byPriority.normal).toBe(2);
      expect(stats.byPriority.low).toBe(0);
    });

    it('reports wait times', () => {
      queue.enqueue('old');
      clock.advance(4_000);
      queue.enqueue('new');
      clock.advance(2_000);

      const stats = queue.getStats();
      expect(stats.oldestWaitMs).toBe(6_000);
      expect(stats.averageWaitMs).toBe(4_000);
    });

    it('reports zeroes when empty', () => {
      const stats = queue.getStats();
      expect(stats.size).toBe(0);
      expect(stats.averageWaitMs).toBe(0);
    });
  });

  it('lists entries in scheduling order', () => {
    queue.enqueue('low', 'low');
    queue.enqueue('critical', 'critical');
    queue.enqueue('normal', 'normal');

    expect(queue.toArray().map((entry) => entry.payload)).toEqual([
      'critical',
      'normal',
      'low',
    ]);
  });
});
