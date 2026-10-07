// Bot call clock for Electron main (Task16). The protocol (`CallSession`) is the shared one in
// `@cortex/api-types`, also used by the web; main supplies only this clock and its transport
// (./remote-call.ts), so the bearer never reaches the renderer.
import type { CallEnv } from "@cortex/api-types";

/**
 * Main has no `online` event, so every resume attempt is the connectivity probe; the backoff
 * bounds how often it runs while offline.
 */
export const timerEnv: CallEnv = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  online: () => true,
  waitOnline: (ms) => new Promise((r) => setTimeout(r, ms)),
};
