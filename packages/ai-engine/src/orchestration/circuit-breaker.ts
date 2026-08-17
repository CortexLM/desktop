/**
 * CircuitBreaker - fail fast when a provider is down.
 *
 * Standard three-state breaker: closed (traffic flows), open (traffic blocked
 * for a cooldown), half-open (a limited number of probes decide whether to
 * close again). Prevents the orchestrator from burning retries and latency
 * budget on a provider that is not answering.
 */

import { type Clock, type CircuitState, type ProviderId, systemClock } from './types';

export interface CircuitBreakerConfig {
  /** Consecutive failures that trip the breaker open. */
  failureThreshold?: number;
  /** Ms to stay open before allowing probe traffic. */
  cooldownMs?: number;
  /** Consecutive probe successes required to close from half-open. */
  successThreshold?: number;
  /** Max concurrent probes allowed while half-open. */
  halfOpenMaxProbes?: number;
}

const BREAKER_DEFAULTS = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  successThreshold: 2,
  halfOpenMaxProbes: 1,
} as const;

/** Point-in-time breaker state, for diagnostics and UI. */
export interface CircuitSnapshot {
  state: CircuitState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  /** Ms until the breaker allows probe traffic; 0 when not open. */
  cooldownRemainingMs: number;
  /** Clock time of the failure that tripped the breaker. */
  openedAt?: number;
}

export class CircuitBreaker {
  private readonly clock: Clock;
  private readonly config: Required<CircuitBreakerConfig>;
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private openedAt?: number;
  private activeProbes = 0;

  constructor(config: CircuitBreakerConfig = {}, clock: Clock = systemClock) {
    this.clock = clock;
    this.config = {
      failureThreshold: config.failureThreshold ?? BREAKER_DEFAULTS.failureThreshold,
      cooldownMs: config.cooldownMs ?? BREAKER_DEFAULTS.cooldownMs,
      successThreshold: config.successThreshold ?? BREAKER_DEFAULTS.successThreshold,
      halfOpenMaxProbes: config.halfOpenMaxProbes ?? BREAKER_DEFAULTS.halfOpenMaxProbes,
    };
  }

  /**
   * True when a request may proceed. Transitions open -> half-open once the
   * cooldown has elapsed.
   */
  canRequest(): boolean {
    this.refresh();

    if (this.state === 'closed') return true;
    if (this.state === 'open') return false;
    return this.activeProbes < this.config.halfOpenMaxProbes;
  }

  /** Reserves a half-open probe slot. Call right before issuing the request. */
  acquire(): boolean {
    if (!this.canRequest()) return false;
    if (this.state === 'half-open') {
      this.activeProbes += 1;
    }
    return true;
  }

  /** Records a success, closing the breaker once enough probes pass. */
  recordSuccess(): void {
    this.refresh();
    this.releaseProbe();
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses += 1;

    if (this.state === 'half-open' && this.consecutiveSuccesses >= this.config.successThreshold) {
      this.close();
    }
  }

  /** Records a failure, tripping or re-tripping the breaker as needed. */
  recordFailure(): void {
    this.refresh();
    this.releaseProbe();
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures += 1;

    // A failed probe sends us straight back to open.
    if (this.state === 'half-open' || this.consecutiveFailures >= this.config.failureThreshold) {
      this.trip();
    }
  }

  /** Forces the breaker open, e.g. on an explicit provider outage signal. */
  trip(): void {
    this.state = 'open';
    this.openedAt = this.clock.now();
    this.activeProbes = 0;
    this.consecutiveSuccesses = 0;
  }

  /** Forces the breaker closed and clears counters. */
  close(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.activeProbes = 0;
    this.openedAt = undefined;
  }

  /** Current state, after applying any pending cooldown transition. */
  getState(): CircuitState {
    this.refresh();
    return this.state;
  }

  /** Full diagnostic snapshot. */
  getSnapshot(): CircuitSnapshot {
    this.refresh();
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      cooldownRemainingMs: this.cooldownRemainingMs(),
      openedAt: this.openedAt,
    };
  }

  private refresh(): void {
    if (this.state === 'open' && this.cooldownRemainingMs() === 0) {
      this.state = 'half-open';
      this.consecutiveSuccesses = 0;
      this.activeProbes = 0;
    }
  }

  private cooldownRemainingMs(): number {
    if (this.state !== 'open' || this.openedAt === undefined) return 0;
    const elapsed = this.clock.now() - this.openedAt;
    return Math.max(0, this.config.cooldownMs - elapsed);
  }

  private releaseProbe(): void {
    if (this.activeProbes > 0) {
      this.activeProbes -= 1;
    }
  }
}

/** Keeps one breaker per provider, created on first use. */
export class CircuitBreakerRegistry {
  private readonly breakers = new Map<ProviderId, CircuitBreaker>();

  constructor(
    private readonly config: CircuitBreakerConfig = {},
    private readonly clock: Clock = systemClock
  ) {}

  /** Breaker for a provider, created lazily. */
  get(providerId: ProviderId): CircuitBreaker {
    let breaker = this.breakers.get(providerId);
    if (!breaker) {
      breaker = new CircuitBreaker(this.config, this.clock);
      this.breakers.set(providerId, breaker);
    }
    return breaker;
  }

  /** True when the provider's breaker permits traffic. */
  canRequest(providerId: ProviderId): boolean {
    return this.get(providerId).canRequest();
  }

  /** Records a success for the provider. */
  recordSuccess(providerId: ProviderId): void {
    this.get(providerId).recordSuccess();
  }

  /** Records a failure for the provider. */
  recordFailure(providerId: ProviderId): void {
    this.get(providerId).recordFailure();
  }

  /** Breaker states keyed by provider id. */
  getStates(): Record<ProviderId, CircuitState> {
    const states: Record<ProviderId, CircuitState> = {};
    for (const [providerId, breaker] of this.breakers) {
      states[providerId] = breaker.getState();
    }
    return states;
  }

  /** Closes every breaker. */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.close();
    }
  }
}
