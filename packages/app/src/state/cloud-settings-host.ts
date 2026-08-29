/**
 * Settings host for the web app.
 *
 * The desktop host goes through main because a provider key must not be readable
 * by the renderer and a run permission must be enforced where it is stored. On
 * the web the same reasoning points at the account: the service holds the key and
 * answers with a mask, so the browser never has the value either. What it must
 * not do is fall back to `localStorage` — a permission the page can rewrite is a
 * suggestion, not a permission.
 *
 * `/v1/code/settings` was not on the public deployment when this was written. A
 * 404 surfaces as an error the screen shows, which is why reads do not silently
 * substitute the defaults: a browser that quietly displayed defaults would look
 * like it had loaded the account's settings.
 */

import {
  getCodeSettings,
  isCortexApiError,
  listCodeProviders,
  putCodeProvider,
  putCodeSettings,
  type CortexApiClient,
} from '@cortex-ide/cortex-api';
import type {
  ProviderSettingsView,
  SetProviderRequest,
  WorkspaceRunSettings,
} from '@cortex-ide/shared';

import { toRunSettings, toSettingsPatch } from './cloud-code-map.ts';
import { DEFAULT_RUN_SETTINGS, type SettingsHost } from './settings-host.ts';

const NO_ROUTE = 'This Cortex backend does not expose Code settings yet.';

function isRouteMissing(error: unknown): boolean {
  return isCortexApiError(error) && (error.code === 'not_found' || error.status === 404);
}

/** Re-throws with copy the screen can show, so a bare 404 is never surfaced raw. */
function explain(error: unknown): never {
  if (isRouteMissing(error)) throw new Error(NO_ROUTE);
  throw error;
}

/**
 * Projects a provider row onto the view the screen renders.
 *
 * `envVar` / `envKeyPresent` are absent on the web on purpose: environment
 * variables are a property of the machine running the harness, and a browser has
 * no standing to report what is set on it.
 */
function toProviderView(row: {
  id: string;
  configured?: boolean;
  masked_key?: string;
  source?: string;
  base_url?: string;
}): ProviderSettingsView {
  const view = {
    id: row.id,
    enabled: row.configured === true,
    credentialSource: row.source === 'env' ? 'env' : 'settings',
    envKeyPresent: row.source === 'env',
    active: row.configured === true,
  } as ProviderSettingsView;
  if (row.masked_key) view.maskedApiKey = row.masked_key;
  if (row.base_url) view.baseUrl = row.base_url;
  return view;
}

export function createCloudSettingsHost(client: CortexApiClient): SettingsHost {
  const readProviders = async (): Promise<ProviderSettingsView[]> => {
    const rows = await listCodeProviders(client);
    return rows.map(toProviderView);
  };

  return {
    getProviders: async () => {
      try {
        return { providers: await readProviders(), precedence: 'settings-over-env' };
      } catch (error) {
        return explain(error);
      }
    },

    /**
     * Saves a key and re-reads the list.
     *
     * The response is the re-read rather than an echo, for the same reason the IPC
     * channel works that way: persisting a credential without the service
     * accepting it is the failure this shape makes visible.
     */
    setProvider: async (request: SetProviderRequest) => {
      try {
        await putCodeProvider(client, request.id, {
          ...(request.apiKey === undefined ? {} : { api_key: request.apiKey }),
          ...(request.baseUrl === undefined ? {} : { base_url: request.baseUrl }),
        });
        const providers = await readProviders();
        return {
          providers,
          activeProviders: providers.filter((row) => row.active).map((row) => row.id),
        };
      } catch (error) {
        return explain(error);
      }
    },

    getWorkspace: async (): Promise<WorkspaceRunSettings> => {
      try {
        return toRunSettings(await getCodeSettings(client), DEFAULT_RUN_SETTINGS);
      } catch (error) {
        return explain(error);
      }
    },

    setWorkspace: async (request) => {
      try {
        return toRunSettings(
          await putCodeSettings(client, toSettingsPatch(request)),
          DEFAULT_RUN_SETTINGS,
        );
      } catch (error) {
        return explain(error);
      }
    },
  };
}
