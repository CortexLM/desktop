/**
 * useErrorHandler - one place to turn a caught error into user-visible feedback.
 *
 * Before this existed, failures were swallowed by bare `console.error` calls:
 * the operation silently did nothing and the user got no signal at all. Route
 * caught errors through `handleError` so every failure produces a toast (and,
 * where a `retry` is supplied, a way out of it).
 */

import { useCallback } from 'react';
import { useOptionalToast } from '../components/ui/toast';

export interface ErrorHandlerOptions {
  /** Short summary shown as the toast heading. */
  title?: string;
  /** Set false for expected/handled failures that shouldn't interrupt the user. */
  showToast?: boolean;
  /** When provided, the toast offers a "Retry" button that invokes this. */
  retry?: () => void;
  /** Extra side effect, e.g. storing the message for inline display. */
  onError?: (error: Error) => void;
}

export interface HandledError {
  title: string;
  message: string;
  error: unknown;
}

/** Pulls a human-readable message out of whatever was thrown. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  // IPC rejections often arrive as plain objects shaped like { message } or
  // { error }, which would otherwise stringify to a useless "[object Object]".
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; error?: unknown };
    if (typeof candidate.message === 'string') return candidate.message;
    if (typeof candidate.error === 'string') return candidate.error;
  }

  return String(error);
}

export function useErrorHandler() {
  // Optional: error reporting must not itself throw in trees without a provider.
  const toast = useOptionalToast();

  const handleError = useCallback(
    (error: unknown, options: ErrorHandlerOptions = {}): HandledError => {
      const { title = 'An error occurred', showToast = true, retry, onError } = options;

      const message = toErrorMessage(error);

      // Kept for the devtools/debug panel; the toast is what the user sees.
      console.error(`[ErrorHandler] ${title}:`, error);

      onError?.(error instanceof Error ? error : new Error(message));

      if (showToast && toast) {
        toast.error(title, message, {
          action: retry ? { label: 'Retry', onClick: retry } : undefined,
        });
      }

      return { title, message, error };
    },
    [toast]
  );

  return { handleError };
}

export interface RetryOptions {
  /** Total attempts, including the first. */
  maxRetries?: number;
  /** Delay before the second attempt, ms. Doubles each attempt. */
  initialDelay?: number;
  /** Ceiling for the backoff delay, ms. */
  maxDelay?: number;
  /** Called before each retry with the 1-based attempt number about to run. */
  onRetry?: (attempt: number) => void;
  /** Return false to fail immediately, e.g. for a 404 that retrying can't fix. */
  shouldRetry?: (error: unknown) => boolean;
  /** Aborts pending waits so a cancelled operation stops retrying. */
  signal?: AbortSignal;
}

/**
 * Runs `fn`, retrying transient failures with exponential backoff.
 *
 * Delays grow initialDelay * 2^n, capped at maxDelay: 1s, 2s, 4s... This
 * spaces out retries against a service that is rate-limiting or restarting,
 * instead of hammering it.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onRetry,
    shouldRetry,
    signal,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // An aborted operation was cancelled on purpose; retrying would fight
      // the user's intent.
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (shouldRetry && !shouldRetry(error)) throw error;

      const isLastAttempt = attempt === maxRetries - 1;
      if (isLastAttempt) break;

      const delay = Math.min(initialDelay * 2 ** attempt, maxDelay);
      onRetry?.(attempt + 1);
      await sleep(delay, signal);
    }
  }

  throw lastError;
}

/** Promisified setTimeout that rejects early if `signal` aborts. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
