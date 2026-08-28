/**
 * The only ProductSurface the renderer may use: the live HTTP client.
 *
 * Created from `liveSession()`, which itself requires `VITE_CORTEX_API_BASE_URL`
 * or a cortex.foundation origin. No mock host is constructed here.
 */

import { createHttpProductSurface, type ProductSurface } from '@cortex-ide/cortex-api';

import { liveSession } from './realtime-session.ts';

export function liveProductSurface(): ProductSurface | undefined {
  const live = liveSession();
  return live ? createHttpProductSurface(live.client) : undefined;
}
