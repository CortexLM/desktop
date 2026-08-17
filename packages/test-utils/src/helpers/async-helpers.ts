/**
 * Async test helpers for timing, waiting, and polling
 */

/**
 * Wait for a condition to be true with timeout and polling
 */
export async function waitFor<T>(
  callback: () => T | Promise<T>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<T> {
  const { timeout = 5000, interval = 50, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await callback();
      if (result) {
        return result;
      }
    } catch (error) {
      // Continue polling on error
    }
    await sleep(interval);
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wait for next tick
 */
export function nextTick(): Promise<void> {
  return new Promise(resolve => process.nextTick(resolve));
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await nextTick();
  await nextTick();
}

/**
 * Wait until a value becomes stable (doesn't change)
 */
export async function waitForStable<T>(
  getValue: () => T | Promise<T>,
  options: {
    timeout?: number;
    stableTime?: number;
    interval?: number;
  } = {}
): Promise<T> {
  const { timeout = 5000, stableTime = 200, interval = 50 } = options;
  const startTime = Date.now();
  let lastValue: T | undefined;
  let lastChangeTime = startTime;

  while (Date.now() - startTime < timeout) {
    const currentValue = await getValue();
    
    if (JSON.stringify(currentValue) !== JSON.stringify(lastValue)) {
      lastValue = currentValue;
      lastChangeTime = Date.now();
    }

    if (Date.now() - lastChangeTime >= stableTime) {
      return currentValue;
    }

    await sleep(interval);
  }

  throw new Error(`Value did not stabilize within ${timeout}ms`);
}

/**
 * Retry a function until it succeeds
 */
export async function retry<T>(
  fn: () => T | Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { attempts = 3, delay = 100, backoff = 2, onRetry } = options;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      
      if (onRetry) {
        onRetry(error as Error, i + 1);
      }

      await sleep(delay * Math.pow(backoff, i));
    }
  }

  throw new Error('Retry failed');
}

/**
 * Run function with timeout
 */
export async function withTimeout<T>(
  fn: () => T | Promise<T>,
  timeoutMs: number,
  message = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    fn(),
    sleep(timeoutMs).then(() => {
      throw new Error(message);
    })
  ]);
}
