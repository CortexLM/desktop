/**
 * Secrets.
 *
 * The value goes one way. It is sent once, at creation, and the list that comes
 * back carries a name, a scope and a last-used date — never the value, and not
 * even a mask of it: a secret is identified by its name, so a mask would give away
 * four characters and tell the user nothing they did not already know.
 */

import { createMemo, createResource, createSignal, type JSX } from 'solid-js';

import type { SecretView } from '@cortex-ide/shared';

import { useAccount } from '../state/session-context.tsx';
import { resolveSecretsHost } from '../state/secrets-host.ts';
import { formatAge } from '../state/session-view.ts';
import { SecretsScreen, type Secret } from '../screens/secrets/secrets-screen.tsx';

function toRow(secret: SecretView): Secret {
  return {
    id: secret.id,
    name: secret.name,
    scope: secret.scope,
    ...(secret.lastUsedAt ? { lastUsed: formatAge(secret.lastUsedAt) } : {}),
  };
}

export function SecretsRoute(): JSX.Element {
  const account = useAccount();
  const host = resolveSecretsHost();

  const [secrets, { mutate, refetch }] = createResource(
    async () => {
      try {
        return await host.list();
      } catch {
        return [];
      }
    },
    { initialValue: [] as SecretView[] },
  );

  const [error, setError] = createSignal<string>();

  const create = async (name: string, value: string) => {
    setError(undefined);
    try {
      await host.create(name, value);
      // Refetched rather than appended: creating a secret whose name already exists
      // replaces it, so the list can shrink relative to what an append would show.
      void refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const remove = async (id: string) => {
    setError(undefined);
    try {
      await host.remove(id);
      mutate((current) => current.filter((secret) => secret.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const rows = createMemo(() => secrets().map(toRow));

  return (
    <SecretsScreen
      capabilities={account.capabilities()}
      secrets={rows()}
      onCreate={(name, value) => void create(name, value)}
      onDelete={(id) => void remove(id)}
      {...(error() ? { error: error()! } : {})}
    />
  );
}
