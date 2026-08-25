/**
 * Settings, and the integrations sub-screen.
 *
 * Both write through main. The provider keys in particular are the one payload in
 * the app that carries a secret across IPC, and only in that direction — what
 * comes back is a mask.
 */

import { createMemo, createResource, createSignal, type JSX } from 'solid-js';

import type { ProviderSettingsView, WorkspaceRunSettings } from '@cortex-ide/shared';

import { useAccount } from '../state/session-context.tsx';
import { useSessions } from '../state/sessions-context.tsx';
import {
  DEFAULT_RUN_SETTINGS,
  resolveSettingsHost,
  type SettingsHost,
} from '../state/settings-host.ts';
import { IntegrationsScreen } from '../screens/settings/integrations-screen.tsx';
import {
  SettingsScreen,
  type WorkspaceDefaults,
  type WorkspacePermissions,
} from '../screens/settings/settings-screen.tsx';
import type { ProviderCredential } from '../screens/settings/settings-screen.tsx';

/** Display names for the providers the registry can build. */
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  grok: 'Grok',
};

/**
 * Projects a provider onto the row the screen draws.
 *
 * `placeholder` carries the mask when one exists, so the field shows *which* key
 * is stored without revealing it. When a key comes from the environment instead,
 * the placeholder says so — a field that looks empty while the service is working
 * is the trap this data was added to avoid.
 */
function toCredential(view: ProviderSettingsView): ProviderCredential {
  const configured = view.credentialSource !== 'none';

  let placeholder = 'Not configured';
  if (view.maskedApiKey && view.credentialSource === 'env') {
    placeholder = `${view.maskedApiKey} (from ${view.envVar ?? 'the environment'})`;
  } else if (view.maskedApiKey) {
    placeholder = view.maskedApiKey;
  } else if (view.id === 'ollama' && configured) {
    // Ollama has no API key; it is configured by reachability alone.
    placeholder = view.baseUrl ?? 'Local';
  }

  return {
    id: view.id,
    name: PROVIDER_NAMES[view.id] ?? view.id,
    configured,
    placeholder,
  };
}

/**
 * Fills in whatever the first read has not delivered yet.
 *
 * Spread over the shared defaults rather than field-by-field `??`: the screen
 * renders before the read resolves, and an empty branch prefix for a frame looks
 * like a setting the user cleared.
 */
function toDefaults(settings: WorkspaceRunSettings | null): WorkspaceDefaults {
  return { ...DEFAULT_RUN_SETTINGS.defaults, ...settings?.defaults };
}

function toPermissions(settings: WorkspaceRunSettings | null): WorkspacePermissions {
  return { ...DEFAULT_RUN_SETTINGS.permissions, ...settings?.permissions };
}

const NETWORK_OPTIONS = [
  { value: 'allowlist', label: 'Allowlist only' },
  { value: 'all', label: 'All destinations' },
  { value: 'none', label: 'No network' },
];

const PULL_REQUEST_OPTIONS = [
  { value: 'draft', label: 'As drafts' },
  { value: 'ready', label: 'Ready for review' },
  { value: 'never', label: 'Never' },
];

/** Reads the two stores this screen edits, each degrading to empty on its own. */
function createSettingsSources(host: SettingsHost) {
  const [providers, { refetch: refetchProviders }] = createResource(
    async () => {
      try {
        return (await host.getProviders()).providers;
      } catch {
        return [];
      }
    },
    { initialValue: [] as ProviderSettingsView[] },
  );

  const [settings, { mutate: mutateSettings }] = createResource(
    async () => {
      try {
        return await host.getWorkspace();
      } catch {
        return null;
      }
    },
    { initialValue: null as WorkspaceRunSettings | null },
  );

  return { providers, refetchProviders, settings, mutateSettings };
}

/**
 * The write half.
 *
 * Both writers adopt what main returns rather than their own optimistic value,
 * which is what makes a rejected or normalised setting visible: main decides, and
 * a UI that kept its guess would show a state nothing stored.
 */
function createSettingsWriters(
  host: SettingsHost,
  sources: ReturnType<typeof createSettingsSources>,
  setError: (message: string | undefined) => void,
) {
  const report = (error: unknown) =>
    setError(error instanceof Error ? error.message : String(error));

  return {
    patch: async (
      section: 'defaults' | 'permissions',
      key: string,
      value: string | boolean,
    ): Promise<void> => {
      setError(undefined);
      try {
        sources.mutateSettings(await host.setWorkspace({ [section]: { [key]: value } }));
      } catch (error) {
        report(error);
      }
    },

    saveProviderKey: async (id: string, key: string): Promise<void> => {
      setError(undefined);
      try {
        // `enabled: true` alongside the key: entering one and leaving the provider
        // disabled would store a credential the registry never uses, which reads
        // as "saved but nothing happened".
        await host.setProvider({ id: id as never, enabled: true, apiKey: key });
        void sources.refetchProviders();
      } catch (error) {
        report(error);
      }
    },
  };
}

export function SettingsRoute(): JSX.Element {
  const account = useAccount();
  const runs = useSessions();
  const host = resolveSettingsHost();

  const sources = createSettingsSources(host);
  const { providers, settings } = sources;
  const [saveError, setSaveError] = createSignal<string>();
  const { patch, saveProviderKey } = createSettingsWriters(host, sources, setSaveError);

  const defaults = createMemo(() => toDefaults(settings()));
  const permissions = createMemo(() => toPermissions(settings()));

  // The catalogue loads signed out, so a locked Cortex model still appears in the
  // picker — which explains what an account adds far better than an empty list.
  const modelOptions = createMemo(() =>
    account.catalogue().map((entry) => ({
      value: entry.model.id,
      label: entry.model.display_name ?? entry.model.id,
      disabled: !entry.selectable,
    })),
  );

  const repositoryOptions = createMemo(() =>
    (runs.repositories() ?? []).map((repo) => ({ value: repo.id, label: repo.name })),
  );

  return (
    <SettingsScreen
      capabilities={account.capabilities()}
      defaults={defaults()}
      onDefaultChange={(key, value) => void patch('defaults', key, value)}
      permissions={permissions()}
      onPermissionChange={(key, value) => void patch('permissions', key, value)}
      modelOptions={modelOptions()}
      repositoryOptions={repositoryOptions()}
      providers={providers().map(toCredential)}
      onProviderKeyChange={(id, key) => void saveProviderKey(id, key)}
      networkOptions={NETWORK_OPTIONS}
      pullRequestOptions={PULL_REQUEST_OPTIONS}
      {...(saveError() ? { error: saveError()! } : {})}
    />
  );
}

export function IntegrationsRoute(): JSX.Element {
  const account = useAccount();

  return (
    <IntegrationsScreen
      capabilities={account.capabilities()}
      integrations={[
        {
          id: 'github',
          name: 'GitHub',
          description: 'Read repositories and open pull requests',
          icon: 'github',
          connected: false,
          requiresAccount: true,
        },
      ]}
      onConnect={() => undefined}
      onDisconnect={() => undefined}
      apiKeys={[]}
      onCreateKey={() => undefined}
      onRevokeKey={() => undefined}
    />
  );
}
