import { For, type JSX, Show } from 'solid-js';

import { Button, Chip, type IconName } from '@cortex-ide/ui';
import type { Capabilities } from '@cortex-ide/cortex-api';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { Section, Table } from '../shared/data.tsx';
import { SettingGroup, SettingRow } from './controls.tsx';

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: IconName;
  connected: boolean;
  /** Which account or workspace it is connected as. */
  account?: string;
  /** True when connecting needs a Cortex account rather than just a local credential. */
  requiresAccount?: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  /** Last four characters, which is all the service returns after creation. */
  suffix: string;
  created: string;
  lastUsed?: string;
}

export interface IntegrationsScreenProps {
  capabilities: Capabilities;
  integrations: readonly Integration[];
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  apiKeys: readonly ApiKey[];
  onCreateKey: () => void;
  onRevokeKey: (id: string) => void;
}

/**
 * Settings Integrations: connected apps and API keys.
 *
 * An API key is shown as its last four characters only, because that is all the service
 * returns after creation. The row exists so a key can be identified and revoked, not so it
 * can be read back - a full value here would be a value worth stealing.
 */
function ConnectedApps(props: {
  integrations: readonly Integration[];
  authenticated: boolean;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}): JSX.Element {
  const lockReason = (integration: Integration) =>
    integration.requiresAccount && !props.authenticated
      ? 'Sign in to Cortex to connect this'
      : undefined;

  return (
    <SettingGroup label="Connected apps">
      <For each={props.integrations}>
        {(integration) => (
          <SettingRow
            title={integration.name}
            // Once connected, the account replaces the pitch: which account it is connected
            // as is the useful fact, and the description has already done its job.
            description={
              integration.connected && integration.account
                ? `Connected as ${integration.account}`
                : integration.description
            }
            lockedReason={lockReason(integration)}
            control={
              <Show
                when={integration.connected}
                fallback={
                  <Button
                    variant="secondary"
                    disabled={Boolean(lockReason(integration))}
                    onClick={() => props.onConnect(integration.id)}
                  >
                    Connect
                  </Button>
                }
              >
                <Button variant="ghost" onClick={() => props.onDisconnect(integration.id)}>
                  Disconnect
                </Button>
              </Show>
            }
          />
        )}
      </For>
    </SettingGroup>
  );
}

const KEY_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'key', label: 'Key', mono: true, muted: true },
  { key: 'created', label: 'Created', muted: true },
  { key: 'lastUsed', label: 'Last used', muted: true },
  { key: 'actions', label: '', numeric: true },
] as const;

function ApiKeys(props: {
  apiKeys: readonly ApiKey[];
  authenticated: boolean;
  onCreateKey: () => void;
  onRevokeKey: (id: string) => void;
}): JSX.Element {
  return (
    <Section
      title="API keys"
      action={
        <Button
          variant="secondary"
          icon="plusSmall"
          disabled={!props.authenticated}
          onClick={() => props.onCreateKey()}
        >
          New key
        </Button>
      }
    >
      <Table
        caption="API keys"
        emptyMessage={
          props.authenticated
            ? 'No keys yet. A key lets a script or CI job start Cortex sessions.'
            : 'API keys belong to a Cortex account. Sign in to create one.'
        }
        columns={KEY_COLUMNS}
        rows={props.apiKeys.map((key) => ({
          name: <>{key.name}</>,
          key: <Chip variant="outlined" mono>{`…${key.suffix}`}</Chip>,
          created: <>{key.created}</>,
          lastUsed: <>{key.lastUsed ?? 'Never'}</>,
          actions: (
            <Button variant="ghost" onClick={() => props.onRevokeKey(key.id)}>
              Revoke
            </Button>
          ),
        }))}
      />
    </Section>
  );
}

export function IntegrationsScreen(props: IntegrationsScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Apps Cortex Code can reach, and keys that can reach Cortex."
      />

      <PageBody width="settings">
        <div class="cx-settings">
          <ConnectedApps
            integrations={props.integrations}
            authenticated={props.capabilities.authenticated}
            onConnect={props.onConnect}
            onDisconnect={props.onDisconnect}
          />
          <ApiKeys
            apiKeys={props.apiKeys}
            authenticated={props.capabilities.authenticated}
            onCreateKey={props.onCreateKey}
            onRevokeKey={props.onRevokeKey}
          />
        </div>
      </PageBody>
    </>
  );
}
