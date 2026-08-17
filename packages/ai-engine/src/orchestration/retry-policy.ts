/**
 * RetryPolicy - exponential backoff with jitter and Retry-After awareness.
 *
 * Distinguishes retryable infrastructure failures (429, 5xx, timeouts, network
 * resets) from permanent ones (400, 401, 403, 404) so the orchestrator does not
 * spend latency budget retrying requests that cannot succeed.
 */

import { AIProviderError } from '../providers/base';

export interface RetryConfig {
  /** Max attempts including the first. */
  maxAttempts?: number;
  /** Delay before the first retry, in ms. */
  initialDelayMs?: number;
  /** Multiplier applied per attempt. */
  backoffMultiplier?: number;
  /** Ceiling for a single delay, in ms. */
  maxDelayMs?: number;
  /** Jitter fraction in [0, 1] applied to each delay. */
  jitterFactor?: number;
  /** Honour a provider's Retry-After over the computed backoff. */
  respectRetryAfter?: boolean;
}

const RETRY_DEFAULTS = {
  maxAttempts: 3,
  initialDelayMs: 500,
  backoffMultiplier: 2,
  maxDelayMs: 30_000,
  jitterFactor: 0.2,
  respectRetryAfter: true,
} as const;

/** HTTP statuses worth retrying. */
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

/** Error codes that indicate a transient transport failure. */
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'EAI_AGAIN',
  'ENOTFOUND',
  'rate_limit_exceeded',
  'overloaded_error',
  'server_error',
  'timeout',
]);

/** Context passed to the retry callback. */
export interface RetryAttempt {
  /** 1-based attempt number that just failed. */
  attempt: number;
  /** Delay before the next attempt, in ms. */
  delayMs: number;
  error: unknown;
}

/** Outcome of a retried operation. */
export interface RetryResult<T> {
  value: T;
  /** Total attempts made, including the successful one. */
  attempts: number;
  /** Cumulative time spent sleeping between attempts, in ms. */
  totalDelayMs: number;
}

/** Thrown when every attempt fails. */
export class RetryExhaustedError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: unknown
  ) {
    super(message);
    this.name = 'RetryExhaustedError';
  }
}

export class RetryPolicy {
  private readonly config: Required<RetryConfig>;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(
    config: RetryConfig = {},
    deps: { sleep?: (ms: number) => Promise<void>; random?: () => number } = {}
  ) {
    this.config = {
      maxAttempts: config.maxAttempts ?? RETRY_DEFAULTS.maxAttempts,
      initialDelayMs: config.initialDelayMs ?? RETRY_DEFAULTS.initialDelayMs,
      backoffMultiplier: config.backoffMultiplier ?? RETRY_DEFAULTS.backoffMultiplier,
      maxDelayMs: config.maxDelayMs ?? RETRY_DEFAULTS.maxDelayMs,
      jitterFactor: config.jitterFactor ?? RETRY_DEFAULTS.jitterFactor,
      respectRetryAfter: config.respectRetryAfter ?? RETRY_DEFAULTS.respectRetryAfter,
    };
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.random = deps.random ?? Math.random;
  }

  /**
   * Runs `operation`, retrying transient failures with backoff.
   * `onRetry` fires before each sleep, letting callers record the attempt.
   */
  async execute<T>(
    operation: (attempt: number) => Promise<T>,
    onRetry?: (context: RetryAttempt) => void
  ): Promise<RetryResult<T>> {
    let lastError: unknown;
    let totalDelayMs = 0;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt += 1) {
      try {
        const value = await operation(attempt);
        return { value, attempts: attempt, totalDelayMs };
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error) || attempt === this.config.maxAttempts) {
          break;
        }

        const delayMs = this.delayFor(attempt, error);
        onRetry?.({ attempt, delayMs, error });
        await this.sleep(delayMs);
        totalDelayMs += delayMs;
      }
    }

    throw new RetryExhaustedError(
      `Operation failed after ${this.config.maxAttempts} attempt(s): ${errorMessage(lastError)}`,
      this.config.maxAttempts,
      lastError
    );
  }

  /**
   * True when the error looks transient. Unknown errors are treated as
   * retryable, since provider SDKs surface transport faults inconsistently.
   */
  isRetryable(error: unknown): boolean {
    const status = extractStatus(error);
    if (status !== undefined) {
      return RETRYABLE_STATUS.has(status);
    }

    const code = extractCode(error);
    if (code && RETRYABLE_CODES.has(code)) {
      return true;
    }

    const message = errorMessage(error).toLowerCase();
    if (/(timeout|timed out|socket hang up|network|econn|overloaded|temporarily)/.test(message)) {
      return true;
    }

    // Explicit client errors are never retryable.
    if (/(invalid|unauthorized|forbidden|not found|bad request)/.test(message)) {
      return false;
    }

    return code === undefined && status === undefined;
  }

  /** Backoff delay for an attempt, honouring Retry-After when present. */
  delayFor(attempt: number, error?: unknown): number {
    if (this.config.respectRetryAfter && error !== undefined) {
      const retryAfterMs = extractRetryAfterMs(error);
      if (retryAfterMs !== undefined) {
        return Math.min(retryAfterMs, this.config.maxDelayMs);
      }
    }

    const exponential =
      this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const capped = Math.min(exponential, this.config.maxDelayMs);

    // Full-spectrum jitter around the capped delay avoids thundering herds.
    const jitterRange = capped * this.config.jitterFactor;
    const jitter = (this.random() * 2 - 1) * jitterRange;
    return Math.max(0, Math.round(capped + jitter));
  }

  /** Configured max attempts. */
  get maxAttempts(): number {
    return this.config.maxAttempts;
  }
}

/** Reads a Retry-After hint from common provider error shapes. */
export function extractRetryAfterMs(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as Record<string, unknown>;

  const direct = candidate.retryAfterMs ?? candidate.retry_after_ms;
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return Math.max(0, direct);
  }

  const seconds = candidate.retryAfter ?? candidate.retry_after;
  if (typeof seconds === 'number' && Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }
  if (typeof seconds === 'string') {
    const parsed = Number.parseFloat(seconds);
    if (Number.isFinite(parsed)) return Math.max(0, parsed * 1_000);
  }

  const headers = candidate.headers;
  if (headers && typeof headers === 'object') {
    const header = (headers as Record<string, unknown>)['retry-after'];
    if (typeof header === 'string') {
      const parsed = Number.parseFloat(header);
      if (Number.isFinite(parsed)) return Math.max(0, parsed * 1_000);
    }
  }

  return undefined;
}

function extractStatus(error: unknown): number | undefined {
  if (error instanceof AIProviderError) {
    return error.statusCode;
  }
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as Record<string, unknown>;
  const status = candidate.status ?? candidate.statusCode;
  return typeof status === 'number' ? status : undefined;
}

function extractCode(error: unknown): string | undefined {
  if (error instanceof AIProviderError) {
    return error.code;
  }
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as Record<string, unknown>;
  const code = candidate.code ?? candidate.type;
  return typeof code === 'string' ? code : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}
