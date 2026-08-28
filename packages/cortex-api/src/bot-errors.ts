/**
 * Honest Bot errors. A 404 on a Grok-core route means the backend is too old.
 * A 503 on plugins means Composio is not configured. Neither is an empty list.
 */

import { CortexApiError, isCortexApiError } from './errors.ts';

export const BACKEND_TOO_OLD = 'backend_too_old';
export const PLUGIN_UNAVAILABLE = 'plugin_unavailable';

export function isNotFound(error: unknown): boolean {
  return isCortexApiError(error) && (error.code === 'not_found' || error.status === 404);
}

export function isServiceUnavailable(error: unknown): boolean {
  return isCortexApiError(error) && error.status === 503;
}

export function classifyBotError(error: unknown): CortexApiError {
  if (isServiceUnavailable(error) && isCortexApiError(error)) {
    return new CortexApiError(
      PLUGIN_UNAVAILABLE,
      error.message || 'Plugins are not configured on this backend.',
      { status: error.status, requestId: error.requestId, route: error.route },
    );
  }
  if (isNotFound(error) && isCortexApiError(error)) {
    return new CortexApiError(
      BACKEND_TOO_OLD,
      'This backend is too old for this Bot surface.',
      { status: error.status, requestId: error.requestId, route: error.route },
    );
  }
  if (isCortexApiError(error)) return error;
  return new CortexApiError('UNKNOWN_ERROR', String(error), { status: 0 });
}

export function backendTooOldCopy(surface: string): { title: string; body: string } {
  return {
    title: 'Backend too old',
    body: `${surface} needs a newer Cortex API. This client will not invent a local copy.`,
  };
}

export function farmOfflineCopy(): { title: string; body: string } {
  return {
    title: 'Computer offline',
    body: 'The farm or local daemon is not connected. This is not a live desktop.',
  };
}
