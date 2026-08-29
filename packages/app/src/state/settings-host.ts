/**
 * The renderer's view of settings.
 *
 * Two asymmetries worth stating, because they are the reason this goes through
 * main at all rather than `localStorage`:
 *
 *   - **A provider key travels one way.** `setProvider` carries it in plaintext,
 *     once. `getProviders` answers with a mask (`sk-…4242`) and never the value.
 *     The renderer is the least-trusted process, so a key readable there is
 *     readable by anything running there.
 *   - **Run permissions are enforced where they are stored.** They govern whether
 *     the agent may run a shell command or apply a migration. A permission whose
 *     value is read from a store the renderer can write is a suggestion.
 */

import type {
  IPCResponse,
  ProviderSettingsView,
  SetProviderRequest,
  SetWorkspaceRunSettingsRequest,
  WorkspaceRunSettings,
} from '@cortex-ide/shared';

import { createCloudSettingsHost } from './cloud-settings-host.ts';
import { liveSession } from './realtime-session.ts';

export interface SettingsHost {
  /** Masked credentials plus where the effective key comes from. Never the key. */
  getProviders(): Promise<{ providers: ProviderSettingsView[]; precedence: string }>;
  /**
   * Saves a provider. Returns the providers the registry actually ended up with,
   * so success is measured rather than assumed — persisting a key without
   * rebuilding the registry is the bug this channel was built to fix.
   */
  setProvider(request: SetProviderRequest): Promise<{
    providers: ProviderSettingsView[];
    activeProviders: string[];
  }>;
  getWorkspace(): Promise<WorkspaceRunSettings>;
  setWorkspace(request: SetWorkspaceRunSettingsRequest): Promise<WorkspaceRunSettings>;
}

interface SettingsBridge {
  getProviders(): Promise<
    IPCResponse<{ providers: ProviderSettingsView[]; precedence: string }>
  >;
  setProvider(
    request: SetProviderRequest,
  ): Promise<IPCResponse<{ providers: ProviderSettingsView[]; activeProviders: string[] }>>;
  getWorkspace(): Promise<IPCResponse<WorkspaceRunSettings>>;
  setWorkspace(
    request: SetWorkspaceRunSettingsRequest,
  ): Promise<IPCResponse<WorkspaceRunSettings>>;
}

/**
 * The values main falls back to, mirrored here.
 *
 * Exported because the screen has to render before the first read resolves, and an
 * empty branch prefix for a frame looks like a setting the user cleared. One copy
 * rather than two so the two cannot drift.
 */
export const DEFAULT_RUN_SETTINGS: WorkspaceRunSettings = {
  defaults: {
    model: '',
    repository: '',
    baseBranch: '',
    branchPrefix: 'cortex/',
    createPullRequests: 'draft',
  },
  permissions: {
    runShellCommands: true,
    applyDatabaseMigrations: false,
    slackNotifications: false,
    networkAccess: 'allowlist',
  },
};

function unwrap<T>(response: IPCResponse<T>): T {
  if (response.success) return response.data;
  throw new Error(response.error.message);
}

function bridge(): SettingsBridge | undefined {
  return (globalThis as { cortex?: { settings?: SettingsBridge } }).cortex?.settings;
}

function electronSettingsHost(api: SettingsBridge): SettingsHost {
  return {
    getProviders: async () => unwrap(await api.getProviders()),
    setProvider: async (request) => unwrap(await api.setProvider(request)),
    getWorkspace: async () => unwrap(await api.getWorkspace()),
    setWorkspace: async (request) => unwrap(await api.setWorkspace(request)),
  };
}

/**
 * The host used when the bridge is absent.
 *
 * Reads answer with the same defaults main would produce, so Settings renders its
 * real layout under the preview server and in the suites. Writes reject: silently
 * accepting one would show a saved state that nothing stored.
 */
export function detachedSettingsHost(): SettingsHost {
  const unavailable = () => new Error('Settings are only editable in the desktop app');

  return {
    getProviders: async () => ({ providers: [], precedence: 'settings-over-env' }),
    setProvider: () => Promise.reject(unavailable()),
    getWorkspace: async () => DEFAULT_RUN_SETTINGS,
    setWorkspace: () => Promise.reject(unavailable()),
  };
}

/**
 * Electron, then the account over HTTP, then detached.
 *
 * The cloud host is not a downgrade: the service is a legitimate place for a
 * provider credential and a run permission, because it is where the run happens.
 * What would be a downgrade is `localStorage`, which is why there is no such
 * branch.
 */
export function resolveSettingsHost(): SettingsHost {
  const api = bridge();
  if (api) return electronSettingsHost(api);

  const live = liveSession();
  return live ? createCloudSettingsHost(live.client) : detachedSettingsHost();
}
