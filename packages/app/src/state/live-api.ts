/**
 * When the renderer should talk to api.cortex.foundation itself.
 *
 * Electron still goes through main (file:// fails CORS). The web app may call
 * the API directly only on a cortex.foundation origin, or when
 * `VITE_CORTEX_API_BASE_URL` is set. Tests and `localhost` stay detached so
 * they never open a guest session against production.
 */

import { CORTEX_API_BASE_URL } from '@cortex-ide/cortex-api';

import { chromePlatform } from './platform.ts';

export function liveApiBase(): string | undefined {
  const fromEnv = readViteBase();
  if (fromEnv) return fromEnv;
  if (chromePlatform() !== 'browser') return undefined;
  if (typeof location === 'undefined') return undefined;
  if (location.hostname.endsWith('cortex.foundation')) return CORTEX_API_BASE_URL;
  return undefined;
}

function readViteBase(): string | undefined {
  try {
    const value = (import.meta as { env?: { VITE_CORTEX_API_BASE_URL?: string } }).env
      ?.VITE_CORTEX_API_BASE_URL;
    const trimmed = value?.trim();
    return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
  } catch {
    return undefined;
  }
}
