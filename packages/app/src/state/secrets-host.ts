/**
 * The renderer's view of secrets.
 *
 * The asymmetry is the whole design: `create` carries a value once, and nothing
 * ever reads one back. The method that returns values lives in main and is called
 * only by the agent loop — that the renderer cannot reach it is the point.
 */

import type { IPCResponse, SecretView } from '@cortex-ide/shared';

export interface SecretsHost {
  list(): Promise<SecretView[]>;
  create(name: string, value: string): Promise<SecretView>;
  remove(id: string): Promise<void>;
}

interface SecretsBridge {
  list(): Promise<IPCResponse<{ secrets: SecretView[] }>>;
  create(request: { name: string; value: string }): Promise<IPCResponse<{ secret: SecretView }>>;
  remove(request: { id: string }): Promise<IPCResponse<{ deleted: true }>>;
}

function unwrap<T>(response: IPCResponse<T>): T {
  if (response.success) return response.data;
  throw new Error(response.error.message);
}

function bridge(): SecretsBridge | undefined {
  return (globalThis as { cortex?: { secrets?: SecretsBridge } }).cortex?.secrets;
}

export function detachedSecretsHost(): SecretsHost {
  const unavailable = () => new Error('Secrets are only stored by the desktop app');

  return {
    list: async () => [],
    create: () => Promise.reject(unavailable()),
    remove: () => Promise.reject(unavailable()),
  };
}

export function resolveSecretsHost(): SecretsHost {
  const api = bridge();
  if (!api) return detachedSecretsHost();

  return {
    list: async () => unwrap(await api.list()).secrets,
    create: async (name, value) => unwrap(await api.create({ name, value })).secret,
    remove: async (id) => {
      unwrap(await api.remove({ id }));
    },
  };
}
