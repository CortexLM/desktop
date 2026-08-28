/**
 * The CortexApiClient the Bot store may use. Tests inject one. Production
 * takes the live session (web fetch or Electron IPC). No client means the
 * screens show an honest empty state — they do not write localStorage.
 */

import type { CortexApiClient } from '@cortex-ide/cortex-api';

import { liveSession } from './realtime-session.ts';

let injected: CortexApiClient | undefined;

export function setBotClientForTests(client: CortexApiClient | undefined): void {
  injected = client;
}

export function botClient(): CortexApiClient | undefined {
  return injected ?? liveSession()?.client;
}

export function requireBotClient(): CortexApiClient {
  const client = botClient();
  if (!client) {
    throw new Error('The Bot API is not connected from this origin.');
  }
  return client;
}
