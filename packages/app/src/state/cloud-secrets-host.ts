/**
 * Secrets host for the web app.
 *
 * The asymmetry the desktop host is built around holds here too: `create` carries
 * a value once and nothing ever reads one back. The service stores it and answers
 * with a name; the route that returns values is only reachable by the runtime
 * executing a session, and that the browser cannot reach it is the point.
 *
 * `scope: 'account'` rather than `'local'` — a secret held by the service is
 * available to every runtime on the account, which is the honest description and
 * also the difference a user needs to see when they have both.
 */

import {
  createCodeSecret,
  deleteCodeSecret,
  isCortexApiError,
  listCodeSecrets,
  type ApiCodeSecret,
  type CortexApiClient,
} from '@cortex-ide/cortex-api';
import type { SecretView } from '@cortex-ide/shared';

import type { SecretsHost } from './secrets-host.ts';

const NO_ROUTE = 'This Cortex backend does not store account secrets yet.';

function isRouteMissing(error: unknown): boolean {
  return isCortexApiError(error) && (error.code === 'not_found' || error.status === 404);
}

function explain(error: unknown): never {
  if (isRouteMissing(error)) throw new Error(NO_ROUTE);
  throw error;
}

function toSecretView(row: ApiCodeSecret): SecretView {
  const view: SecretView = { id: row.id, name: row.name ?? row.id, scope: 'account' };
  if (row.last_used_at) {
    const used = Date.parse(row.last_used_at);
    if (!Number.isNaN(used)) view.lastUsedAt = used;
  }
  return view;
}

export function createCloudSecretsHost(client: CortexApiClient): SecretsHost {
  return {
    /**
     * A missing route reads as an empty list rather than an error.
     *
     * The create path still refuses, so nobody can add a secret that goes nowhere
     * — but a Secrets screen that renders its empty state on a backend without the
     * route is more useful than one that shows a failure for having nothing.
     */
    list: async () => {
      try {
        const rows = await listCodeSecrets(client);
        return rows.map(toSecretView);
      } catch (error) {
        if (isRouteMissing(error)) return [];
        throw error;
      }
    },

    create: async (name, value) => {
      try {
        return toSecretView(await createCodeSecret(client, { name, value }));
      } catch (error) {
        return explain(error);
      }
    },

    remove: async (id) => {
      try {
        await deleteCodeSecret(client, id);
      } catch (error) {
        explain(error);
      }
    },
  };
}
