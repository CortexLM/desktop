/**
 * Account usage and credits.
 *
 * The Usage screen counted sessions from the local store and printed `—` for
 * credits, with a comment saying the API exposes no usage route. That was accurate
 * and it is also the reason the number never appeared: nothing asked. This reads
 * `GET /v1/code/usage`, and when the route is absent the signal stays `undefined`
 * so the screen shows what it has rather than a fabricated figure.
 */

import { createSignal } from 'solid-js';

import { getCodeUsage, type ApiCodeUsage } from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';

const [usage, setUsage] = createSignal<ApiCodeUsage | undefined>();
const [usageError, setUsageError] = createSignal('');

export { usage as accountUsage, usageError as accountUsageError };

export async function loadAccountUsage(): Promise<void> {
  const client = botClient();
  if (!client) {
    setUsage(undefined);
    return;
  }

  try {
    setUsage(await getCodeUsage(client));
    setUsageError('');
  } catch (error) {
    // Left undefined rather than zeroed. A billing figure that reads as precise and
    // is made up is worse than no figure.
    setUsage(undefined);
    setUsageError(error instanceof Error ? error.message : String(error));
  }
}

export function resetUsageForTests(): void {
  setUsage(undefined);
  setUsageError('');
}
