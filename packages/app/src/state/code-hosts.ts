/**
 * Cortex Code hosts and SSH runtimes on this account.
 *
 * This is the other half of "the web app is cloud-only *or* connected to a paired
 * PC". `pairCodeHost` and `heartbeatCodeHost` already existed in the client and
 * `requestHostPairing` already existed in this package — but nothing called it
 * from any screen, so the only way to point the browser at a machine was a text
 * field on Home that wrote a URL to `localStorage` and was never sent anywhere.
 *
 * Pairing is the real mechanism: the service issues a code, the machine running
 * Cortex Code redeems it, and from then on the account knows that host. The code
 * is shown once and held in memory only — `host-pairing.ts` owns that guarantee,
 * and this module does not persist it either.
 */

import {
  createCodeSshRuntime,
  deleteCodeSshRuntime,
  listCodeSshRuntimes,
  unpairCodeHost,
  type ApiCodeHost,
  type ApiCodeSshRuntime,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import { createHttpProductSurface } from '@cortex-ide/cortex-api';
import { createRemoteCollection } from './remote-collection.ts';
import { consumePairingCode, requestHostPairing } from './host-pairing.ts';
import { createSignal } from 'solid-js';

export type HostStatus = 'online' | 'offline' | 'unknown';

export interface CodeHost {
  id: string;
  name: string;
  status: HostStatus;
  url?: string;
}

export interface SshRuntime {
  id: string;
  label: string;
  status: HostStatus;
  fingerprint?: string;
}

/** Anything other than an explicit online/offline is `unknown`, not offline. */
function toStatus(value: string | undefined): HostStatus {
  if (value === 'online' || value === 'connected' || value === 'ready') return 'online';
  if (value === 'offline' || value === 'disconnected') return 'offline';
  return 'unknown';
}

export function toCodeHost(row: ApiCodeHost): CodeHost {
  const host: CodeHost = {
    id: row.id ?? row.name ?? 'host',
    name: row.name ?? row.id ?? 'Cortex Code host',
    status: toStatus(row.status),
  };
  if (row.url) host.url = row.url;
  return host;
}

export function toSshRuntime(row: ApiCodeSshRuntime): SshRuntime {
  const runtime: SshRuntime = {
    id: row.id,
    label: row.user && row.host ? `${row.user}@${row.host}` : (row.host ?? row.id),
    status: toStatus(row.status),
  };
  if (row.fingerprint) runtime.fingerprint = row.fingerprint;
  return runtime;
}

const hosts = createRemoteCollection<CodeHost>({
  label: 'Cortex Code hosts',
  load: async (client) =>
    (await createHttpProductSurface(client).listCodeHosts()).map(toCodeHost),
});

export const codeHosts = hosts.items;
export const codeHostsState = hosts.state;
export const codeHostsError = hosts.error;
export const loadCodeHosts = hosts.reload;

const runtimes = createRemoteCollection<SshRuntime>({
  label: 'SSH runtimes',
  load: async (client) => (await listCodeSshRuntimes(client)).map(toSshRuntime),
});

export const sshRuntimes = runtimes.items;
export const sshRuntimesState = runtimes.state;
export const sshRuntimesError = runtimes.error;
export const loadSshRuntimes = runtimes.reload;

/**
 * The pairing code currently on screen.
 *
 * A signal rather than a return value so the code survives a re-render while the
 * user is typing it into the other machine, and `clearPairingCode` is explicit —
 * it should leave the screen when the user is done with it, not linger.
 */
const [pairingCode, setPairingCode] = createSignal('');
const [pairingError, setPairingError] = createSignal('');

export { pairingCode, pairingError };

export async function startPairing(): Promise<void> {
  setPairingError('');
  try {
    const code = await requestHostPairing();
    if (!code) {
      // `undefined` means the control plane has no pairing route — distinct from a
      // failure, which arrives as a throw and gets the error's own message.
      setPairingError('This Cortex backend cannot pair a Code host yet.');
      return;
    }
    // Read it back out of the one-shot holder so it is not held in two places.
    setPairingCode(consumePairingCode() ?? code);
    await hosts.reload();
  } catch (error) {
    setPairingError(error instanceof Error ? error.message : String(error));
  }
}

export function clearPairingCode(): void {
  setPairingCode('');
}

export async function removeHost(id: string): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Cortex Code hosts need a connection to Cortex.');
  await unpairCodeHost(client, id);
  await hosts.reload();
}

/**
 * Registers an SSH runtime.
 *
 * Host, user and port only. No key and no password: the service completes the
 * handshake and reports a fingerprint, so nothing secret is typed into a browser
 * tab. The previous screen accepted the same three fields and discarded them.
 */
export function addSshRuntime(target: {
  host: string;
  user: string;
  port?: number;
}): Promise<void> {
  return runtimes.mutate((client) =>
    createCodeSshRuntime(client, {
      host: target.host,
      user: target.user,
      ...(target.port ? { port: target.port } : {}),
    }),
  );
}

export function removeSshRuntime(id: string): Promise<void> {
  return runtimes.mutate((client) => deleteCodeSshRuntime(client, id));
}

export function resetCodeHostsForTests(): void {
  hosts.reset();
  runtimes.reset();
  setPairingCode('');
  setPairingError('');
}
