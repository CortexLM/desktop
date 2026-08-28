/**
 * Telling "this backend has no such route" apart from other failures.
 *
 * Used across Chat, Code and Bot because all three talk to a service that is being
 * built alongside this client: several routes 404 today. That has to reach the UI
 * as its own state, because a 404 rendered as an empty list claims the account has
 * nothing, and a 404 rendered as a crash claims something broke.
 */

import { isCortexApiError } from '@cortex-ide/cortex-api';

export function isRouteMissing(error: unknown): boolean {
  return isCortexApiError(error) && (error.code === 'not_found' || error.status === 404);
}

/** The message a screen shows when a surface is not on this backend yet. */
export function missingRouteCopy(surface: string): string {
  return `${surface} is not available on this Cortex backend yet.`;
}
