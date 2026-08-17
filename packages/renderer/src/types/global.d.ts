/**
 * Global augmentation for the `window.ipc` bridge.
 *
 * The channel contract itself lives in `./ipc-contract.ts` (a real module, so
 * components can import the payload types); this file only attaches it to
 * `Window`.
 */

import type { IPCApi } from './ipc-contract';

declare global {
  interface Window {
    ipc: IPCApi;
  }
}

export {};
