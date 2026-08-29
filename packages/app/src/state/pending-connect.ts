/**
 * The app the user asked to connect before there was an account to connect it to.
 *
 * Connecting a plugin is refused for a guest: a guest session cannot be signed
 * back into, so the connection could never be revoked. Rather than surface that
 * as an error, Plugins sends the user to sign in and leaves the slug here, so
 * the connection they picked is the one that happens when they come back.
 *
 * Held in memory rather than in `localStorage`. Sign-in is the device flow,
 * which runs inside this app — the user code is approved in a browser tab and
 * the app itself is never reloaded — so persisting the slug would only let it
 * outlive the intent it records, and fire a connection the user had forgotten
 * asking for.
 */

import { createSignal } from 'solid-js';

export interface PendingPluginConnect {
  /** A catalogue slug, e.g. `gmail`. Not validated here: the catalogue owns it. */
  slug: string;
  /** Where to land once there is an account, so the retry has a screen to run on. */
  returnTo: string;
}

const [pending, setPending] = createSignal<PendingPluginConnect | undefined>();

export const pendingPluginConnect = pending;

export function rememberPluginConnect(slug: string, returnTo = '/plugins'): void {
  setPending({ slug, returnTo });
}

/** Reads and clears in one step, so a resume cannot run twice. */
export function takePendingPluginConnect(): PendingPluginConnect | undefined {
  const current = pending();
  setPending(undefined);
  return current;
}

/** Declining the account drops the connection that asked for it. */
export function forgetPluginConnect(): void {
  setPending(undefined);
}
