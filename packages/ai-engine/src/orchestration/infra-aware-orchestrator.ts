/**
 * InfraAwareOrchestrator - executes tasks under infrastructure constraints.
 *
 * Closes the INFRAMIND loop: observe infrastructure -> route -> admit or
 * throttle -> execute with retry -> re-observe. Failures and degradation
 * trigger failover to the next-best provider, and batch parallelism tracks
 * measured congestion instead of being fixed up front.
 */

import { BackpressureController, type BackpressureConfig } from './backpressure';
import { CircuitBreakerRegistry, type CircuitBreakerConfig } from './circuit-breaker';
import { InfrastructureMonitor, type MonitorConfig } from './infrastructure-monitor';
import { AdaptiveRouter, type RouterConfig } from './adaptive-router';
import { PriorityQueue, type QueueConfig } from './priority-queue';
import { RetryPolicy, type RetryConfig, extractRetryAfterMs } from './retry-policy';
import {
  DEFAULT_SLA,
  type Clock,
  type InfrastructureSnapshot,
  type ProviderCapacity,
  type ProviderId,
  type RequestUsage,
  type RoutingDecision,
  type SLATargets,
  type TaskPriority,
  systemClock,
} from './types';

/** Work item submitted to the orchestrator. */
export interface OrchestrationTask<T = unknown> {
  /** Caller-supplied identifier, echoed in results. */
  id: string;
  /** Executes the task against the routed provider. */
  run: (context: TaskContext) => Promise<TaskOutput<T>>;
  /** Estimated input tokens, used for routing and admission control. */
  estimatedInputTokens?: number;
  /** Estimated output tokens, used for cost projection. */
  estimatedOutputTokens?: number;
  priority?: TaskPriority;
  /** SLA overrides for this task. */
  sla?: SLATargets;
  /** Stable prefix key enabling cache-affinity routing. */
  cacheKey?: string;
  /** Providers this task must not use. */
  exclude?: ProviderId[];
  /** Restrict routing to these providers. */
  restrictTo?: ProviderId[];
}

/** Execution context handed to a task's `run`. */
export interface TaskContext {
  providerId: ProviderId;
  /** 1-based attempt number. */
  attempt: number;
  /** Infrastructure state at routing time. */
  snapshot: InfrastructureSnapshot;
}

/** What a task returns, including usage for cost and cache accounting. */
export interface TaskOutput<T> {
  value: T;
  usage?: RequestUsage;
}

/** Result of an orchestrated task. */
export interface TaskResult<T> {
  taskId: string;
  success: boolean;
  value?: T;
  error?: Error;
  /** Provider that ultimately handled the task. */
  providerId?: ProviderId;
  /** Every provider tried, in order. */
  attemptedProviders: ProviderId[];
  /** Total attempts across all providers. */
  attempts: number;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /** Ms spent waiting on throttles and backoff. */
  waitedMs: number;
  /** Billed cost in USD. */
  costUsd: number;
  /** Routing rationale for the final attempt. */
  routingReason?: string;
}

export interface OrchestratorConfig {
  monitor?: MonitorConfig;
  router?: RouterConfig;
  backpressure?: BackpressureConfig;
  circuitBreaker?: CircuitBreakerConfig;
  retry?: RetryConfig;
  queue?: QueueConfig;
  /** Default SLA for tasks that omit one. */
  defaultSla?: SLATargets;
  /** Max providers to try per task before giving up. */
  maxProviderFailovers?: number;
  /** Max time a task may spend waiting for capacity, in ms. */
  maxCapacityWaitMs?: number;
}

/** Cumulative orchestrator counters. */
export interface OrchestratorStats {
  tasksSubmitted: number;
  tasksSucceeded: number;
  tasksFailed: number;
  totalRetries: number;
  totalFailovers: number;
  totalThrottledMs: number;
  totalCostUsd: number;
}

const ORCHESTRATOR_DEFAULTS = {
  maxProviderFailovers: 3,
  maxCapacityWaitMs: 30_000,
} as const;

export class InfraAwareOrchestrator {
  readonly monitor: InfrastructureMonitor;
  readonly router: AdaptiveRouter;
  readonly backpressure: BackpressureController;
  readonly breakers: CircuitBreakerRegistry;
  readonly retry: RetryPolicy;

  private readonly clock: Clock;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly defaultSla: SLATargets;
  private readonly maxProviderFailovers: number;
  private readonly maxCapacityWaitMs: number;
  private readonly pending: PriorityQueue<OrchestrationTask<unknown>>;
  private stats: OrchestratorStats = {
    tasksSubmitted: 0,
    tasksSucceeded: 0,
    tasksFailed: 0,
    totalRetries: 0,
    totalFailovers: 0,
    totalThrottledMs: 0,
    totalCostUsd: 0,
  };

  constructor(
    config: OrchestratorConfig = {},
    deps: { clock?: Clock; sleep?: (ms: number) => Promise<void> } = {}
  ) {
    this.clock = deps.clock ?? systemClock;
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

    this.monitor = new InfrastructureMonitor(config.monitor, this.clock);
    this.breakers = new CircuitBreakerRegistry(config.circuitBreaker, this.clock);
    this.router = new AdaptiveRouter(this.monitor, config.router, this.breakers);
    this.backpressure = new BackpressureController(this.monitor, config.backpressure);
    this.retry = new RetryPolicy(config.retry, { sleep: this.sleep });
    this.pending = new PriorityQueue<OrchestrationTask<unknown>>(config.queue, this.clock);

    this.defaultSla = config.defaultSla ?? DEFAULT_SLA;
    this.maxProviderFailovers =
      config.maxProviderFailovers ?? ORCHESTRATOR_DEFAULTS.maxProviderFailovers;
    this.maxCapacityWaitMs =
      config.maxCapacityWaitMs ?? ORCHESTRATOR_DEFAULTS.maxCapacityWaitMs;
  }

  /** Registers a provider and its infrastructure limits. */
  registerProvider(providerId: ProviderId, capacity: ProviderCapacity): void {
    this.monitor.registerProvider(providerId, capacity);
  }

  /** Current infrastructure observation. */
  getSnapshot(): InfrastructureSnapshot {
    return this.monitor.getSnapshot();
  }

  /** Cumulative counters. */
  getStats(): OrchestratorStats {
    return { ...this.stats };
  }

  /** Routing decision for a task without executing it. */
  planRoute(task: OrchestrationTask<unknown>): RoutingDecision {
    return this.router.route(this.toRoutingRequest(task));
  }

  /**
   * Executes one task: route, admit, run with retry, fail over on error.
   * Never throws; failures are reported on the result.
   */
  async execute<T>(task: OrchestrationTask<T>): Promise<TaskResult<T>> {
    this.stats.tasksSubmitted += 1;

    const startedAt = this.clock.now();
    const attemptedProviders: ProviderId[] = [];
    let attempts = 0;
    let waitedMs = 0;
    let costUsd = 0;
    let lastError: Error | undefined;
    let routingReason: string | undefined;

    for (let failover = 0; failover < this.maxProviderFailovers; failover += 1) {
      const snapshot = this.monitor.getSnapshot();
      const decision = this.router.reroute(
        this.toRoutingRequest(task),
        attemptedProviders,
        snapshot
      );
      routingReason = decision.reason;

      if (!decision.providerId) {
        // Preserve the underlying execution failure if we already have one;
        // "no provider left" is a symptom, not the root cause.
        lastError ??= new Error(`No eligible provider: ${decision.reason}`);
        break;
      }

      const providerId = decision.providerId;
      attemptedProviders.push(providerId);
      if (failover > 0) {
        this.stats.totalFailovers += 1;
      }

      // Admission control: wait out transient pressure before committing.
      const admission = await this.backpressure.waitForCapacity(
        providerId,
        {
          priority: task.priority,
          estimatedInputTokens: task.estimatedInputTokens ?? 0,
          estimatedOutputTokens: task.estimatedOutputTokens ?? 0,
        },
        { maxWaitMs: this.maxCapacityWaitMs, sleep: this.sleep }
      );

      // Account for time spent waiting even when admission ultimately failed.
      waitedMs += admission.waitedMs;
      this.stats.totalThrottledMs += admission.waitedMs;

      if (admission.action === 'reject') {
        lastError = new Error(`Admission rejected for ${providerId}: ${admission.reason}`);
        continue;
      }

      try {
        const outcome = await this.runWithRetry(task, providerId, snapshot);
        attempts += outcome.attempts;
        waitedMs += outcome.waitedMs;
        costUsd += outcome.costUsd;

        this.stats.tasksSucceeded += 1;
        this.stats.totalCostUsd += outcome.costUsd;

        if (task.cacheKey) {
          this.router.recordCacheAffinity(task.cacheKey, providerId);
        }

        return {
          taskId: task.id,
          success: true,
          value: outcome.value,
          providerId,
          attemptedProviders,
          attempts,
          durationMs: this.clock.now() - startedAt,
          waitedMs,
          costUsd,
          routingReason,
        };
      } catch (error) {
        attempts += this.retry.maxAttempts;
        lastError = error instanceof Error ? error : new Error(String(error));
        // Loop continues: the failed provider is now excluded, so the next
        // iteration routes elsewhere.
      }
    }

    this.stats.tasksFailed += 1;
    return {
      taskId: task.id,
      success: false,
      error: lastError ?? new Error('Task failed for an unknown reason'),
      attemptedProviders,
      attempts,
      durationMs: this.clock.now() - startedAt,
      waitedMs,
      costUsd,
      routingReason,
    };
  }

  /**
   * Executes many tasks with parallelism that follows measured congestion.
   * The snapshot is re-read between waves, so a provider degrading mid-batch
   * narrows the remaining work automatically.
   */
  async executeAll<T>(tasks: OrchestrationTask<T>[]): Promise<TaskResult<T>[]> {
    const results: TaskResult<T>[] = [];
    if (tasks.length === 0) return results;

    // Priority ordering happens once up front; the queue applies aging.
    for (const task of tasks) {
      this.pending.enqueue(task as OrchestrationTask<unknown>, task.priority ?? 'normal');
    }

    while (!this.pending.isEmpty()) {
      const parallelism = Math.max(1, this.monitor.getSnapshot().recommendedParallelism);
      const wave: OrchestrationTask<T>[] = [];

      for (let i = 0; i < parallelism && !this.pending.isEmpty(); i += 1) {
        const entry = this.pending.dequeue();
        if (entry) {
          wave.push(entry.payload as OrchestrationTask<T>);
        }
      }

      const waveResults = await Promise.all(wave.map((task) => this.execute(task)));
      results.push(...waveResults);
    }

    return results;
  }

  /** Queue statistics for pending batch work. */
  getQueueStats(): ReturnType<PriorityQueue<OrchestrationTask<unknown>>['getStats']> {
    return this.pending.getStats();
  }

  /** Clears monitor state, breakers, queue and counters. */
  reset(): void {
    this.monitor.reset();
    this.breakers.resetAll();
    this.pending.clear();
    this.router.clearCacheAffinity();
    this.stats = {
      tasksSubmitted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      totalRetries: 0,
      totalFailovers: 0,
      totalThrottledMs: 0,
      totalCostUsd: 0,
    };
  }

  /**
   * Runs a task against one provider with retry, keeping the monitor and
   * circuit breaker in sync on every attempt.
   */
  private async runWithRetry<T>(
    task: OrchestrationTask<T>,
    providerId: ProviderId,
    snapshot: InfrastructureSnapshot
  ): Promise<{ value: T; attempts: number; waitedMs: number; costUsd: number }> {
    let costUsd = 0;
    let waitedMs = 0;

    const outcome = await this.retry.execute(
      async (attempt) => {
        const breaker = this.breakers.get(providerId);
        if (!breaker.acquire()) {
          throw new Error(`Circuit ${breaker.getState()} for provider '${providerId}'`);
        }

        const queueId = this.monitor.enqueue(providerId);
        const ticket = this.monitor.startRequest(
          providerId,
          task.estimatedInputTokens ?? 0,
          queueId
        );

        try {
          const output = await task.run({ providerId, attempt, snapshot });
          const usage: RequestUsage = output.usage ?? {
            inputTokens: task.estimatedInputTokens ?? 0,
            outputTokens: task.estimatedOutputTokens ?? 0,
          };

          this.monitor.completeRequest(ticket, usage);
          this.breakers.recordSuccess(providerId);
          costUsd += this.monitor.projectCost(providerId, usage.inputTokens, usage.outputTokens);

          return output.value;
        } catch (error) {
          this.monitor.failRequest(ticket, {
            retryAfterMs: extractRetryAfterMs(error),
            tokensConsumed: task.estimatedInputTokens ?? 0,
          });
          this.breakers.recordFailure(providerId);
          throw error;
        }
      },
      (context) => {
        this.stats.totalRetries += 1;
        waitedMs += context.delayMs;
      }
    );

    return {
      value: outcome.value,
      attempts: outcome.attempts,
      waitedMs: waitedMs + outcome.totalDelayMs,
      costUsd,
    };
  }

  private toRoutingRequest(task: OrchestrationTask<unknown>) {
    return {
      estimatedInputTokens: task.estimatedInputTokens ?? 0,
      estimatedOutputTokens: task.estimatedOutputTokens ?? 0,
      priority: task.priority,
      sla: task.sla ?? this.defaultSla,
      cacheKey: task.cacheKey,
      exclude: task.exclude,
      restrictTo: task.restrictTo,
    };
  }
}
