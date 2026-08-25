import { For, type JSX, Show } from 'solid-js';

import { TextField } from '@cortex-ide/ui';
import type { Capabilities } from '@cortex-ide/cortex-api';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { SettingGroup, SettingRow, Select, Toggle, type SelectOption } from './controls.tsx';

import './settings.css';

export interface ProviderCredential {
  id: string;
  name: string;
  /** True once a key is stored. The key itself is never read back out of the main process. */
  configured: boolean;
  /** Placeholder showing the shape of the key, e.g. "sk-…". */
  placeholder?: string;
}

export interface WorkspaceDefaults {
  model: string;
  repository: string;
  baseBranch: string;
  branchPrefix: string;
  createPullRequests: string;
}

export interface WorkspacePermissions {
  runShellCommands: boolean;
  applyDatabaseMigrations: boolean;
  slackNotifications: boolean;
  networkAccess: string;
}

export interface SettingsScreenProps {
  capabilities: Capabilities;
  defaults: WorkspaceDefaults;
  onDefaultChange: <K extends keyof WorkspaceDefaults>(
    key: K,
    value: WorkspaceDefaults[K],
  ) => void;
  permissions: WorkspacePermissions;
  onPermissionChange: <K extends keyof WorkspacePermissions>(
    key: K,
    value: WorkspacePermissions[K],
  ) => void;
  modelOptions: readonly SelectOption[];
  repositoryOptions: readonly SelectOption[];
  /** BYO provider keys. Present signed in or out; signed out they are the only way to run. */
  providers: readonly ProviderCredential[];
  onProviderKeyChange: (id: string, key: string) => void;
  networkOptions: readonly SelectOption[];
  pullRequestOptions: readonly SelectOption[];
  /**
   * A save that did not take.
   *
   * Shown rather than swallowed: every control on this screen writes through the
   * main process, so a rejected write leaves the UI showing a value nothing
   * stored. Without this the toggle would simply spring back with no explanation.
   */
  error?: string;
}

const ACCOUNT_ONLY = 'Sign in to Cortex to change this';

/**
 * A settings row as data.
 *
 * These groups are declarative lists, so they are described rather than written out: the
 * screen reads as the settings it offers, and adding one is a line rather than a block.
 */
interface RowSpec {
  title: string;
  description: string;
  control: JSX.Element;
  /** Set when the row needs an account the user does not have. */
  lockedReason?: string;
}

/* eslint-disable max-lines-per-function -- The row builders below return declarative lists.
   Their length is proportional to the number of settings offered, not to any branching, so
   the rule measures the wrong thing here: splitting a four-entry array in half to get under
   50 lines would make the screen harder to read, not simpler. */

function defaultsRows(props: SettingsScreenProps): RowSpec[] {
  return [
    {
      title: 'Default model',
      description: 'Used when no model is specified',
      control: (
        <Select
          label="Default model"
          value={props.defaults.model}
          options={props.modelOptions}
          onValueChange={(value) => props.onDefaultChange('model', value)}
        />
      ),
    },
    {
      title: 'Default repository',
      description: 'Used when no repository is specified',
      control: (
        <Select
          label="Default repository"
          value={props.defaults.repository}
          options={props.repositoryOptions}
          onValueChange={(value) => props.onDefaultChange('repository', value)}
        />
      ),
    },
    {
      title: 'Base branch',
      description: 'When empty, sessions use the repository default branch',
      control: (
        <TextField
          label=""
          placeholder="Branch name…"
          value={props.defaults.baseBranch}
          containerClass="cx-provider__field"
          onInput={(event) => props.onDefaultChange('baseBranch', event.currentTarget.value)}
        />
      ),
    },
    {
      title: 'Branch prefix',
      description: 'Prefix for branch names created by Cortex',
      control: (
        <TextField
          label=""
          value={props.defaults.branchPrefix}
          containerClass="cx-provider__field"
          onInput={(event) => props.onDefaultChange('branchPrefix', event.currentTarget.value)}
        />
      ),
    },
  ];
}

function pullRequestRows(props: SettingsScreenProps): RowSpec[] {
  return [
    {
      title: 'Create PRs',
      description: 'Automatically open a pull request when a session completes',
      control: (
        <Select
          label="Create PRs"
          value={props.defaults.createPullRequests}
          options={props.pullRequestOptions}
          onValueChange={(value) => props.onDefaultChange('createPullRequests', value)}
        />
      ),
    },
  ];
}

function permissionRows(props: SettingsScreenProps): RowSpec[] {
  const accountLock = props.capabilities.authenticated ? undefined : ACCOUNT_ONLY;

  return [
    {
      title: 'Run shell commands',
      description: 'Allow sessions to execute commands in the sandbox',
      control: (
        <Toggle
          label="Run shell commands"
          checked={props.permissions.runShellCommands}
          onChange={(value) => props.onPermissionChange('runShellCommands', value)}
        />
      ),
    },
    {
      title: 'Network access',
      description: 'Control which destinations sessions can reach',
      control: (
        <Select
          label="Network access"
          value={props.permissions.networkAccess}
          options={props.networkOptions}
          onValueChange={(value) => props.onPermissionChange('networkAccess', value)}
        />
      ),
    },
    {
      title: 'Apply database migrations',
      description: 'Require approval before running migrations',
      control: (
        <Toggle
          label="Apply database migrations"
          checked={props.permissions.applyDatabaseMigrations}
          onChange={(value) => props.onPermissionChange('applyDatabaseMigrations', value)}
        />
      ),
    },
    {
      title: 'Slack notifications',
      description: 'Get notified in Slack when a session completes a task',
      lockedReason: accountLock,
      control: (
        <Toggle
          label="Slack notifications"
          checked={props.permissions.slackNotifications}
          disabled={!props.capabilities.authenticated}
          onChange={(value) => props.onPermissionChange('slackNotifications', value)}
        />
      ),
    },
  ];
}

/* eslint-enable max-lines-per-function */

function RowGroup(props: { label: string; rows: RowSpec[] }): JSX.Element {
  return (
    <SettingGroup label={props.label}>
      <For each={props.rows}>
        {(row) => (
          <SettingRow
            title={row.title}
            description={row.description}
            lockedReason={row.lockedReason}
            control={row.control}
          />
        )}
      </For>
    </SettingGroup>
  );
}

/**
 * Provider keys.
 *
 * The stored key is never read back: the main process holds it and reports only whether one
 * exists. So the field is always empty and its placeholder says what shape a key takes -
 * showing a masked value would imply it could be recovered from here.
 */
function ProviderKeys(props: {
  providers: readonly ProviderCredential[];
  onChange: (id: string, key: string) => void;
}): JSX.Element {
  return (
    <SettingGroup label="Provider keys">
      <Show
        when={props.providers.length > 0}
        fallback={
          <div class="cx-setting">
            <div class="cx-setting__text">
              <span class="cx-setting__title">No providers available</span>
              <span class="cx-setting__description">
                Cortex Code ships with no provider configured. Add a key to run sessions
                without an account.
              </span>
            </div>
          </div>
        }
      >
        <For each={props.providers}>
          {(provider) => (
            <div class="cx-provider">
              <span class="cx-provider__name">{provider.name}</span>
              <TextField
                label=""
                type="password"
                autocomplete="off"
                placeholder={provider.placeholder ?? 'Paste a key to enable this provider'}
                containerClass="cx-provider__field"
                aria-label={`${provider.name} API key`}
                onInput={(event) => props.onChange(provider.id, event.currentTarget.value)}
              />
              <span
                class={
                  provider.configured
                    ? 'cx-provider__state cx-provider__state--configured'
                    : 'cx-provider__state'
                }
              >
                {provider.configured ? 'Configured' : 'Not set'}
              </span>
            </div>
          )}
        </For>
      </Show>
    </SettingGroup>
  );
}

/**
 * Settings.
 *
 * Provider keys sit here whether or not anyone is signed in, and that is the point: with no
 * account, a key entered on this screen is the only thing that makes the composer able to
 * run. Signed in, it is a fallback and an escape hatch to a model Cortex does not host.
 *
 * Settings that need an account are shown locked rather than hidden, for the same reason the
 * sidebar and the model picker do it - a hidden setting is indistinguishable from one that
 * does not exist.
 */
export function SettingsScreen(props: SettingsScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Defaults and permissions for sessions in this workspace."
      />

      <PageBody width="settings">
        <div class="cx-settings">
          {/* `role="alert"` so a failed save is announced: the control it belongs to
              has already reverted, and a silent revert is indistinguishable from
              never having clicked. */}
          <Show when={props.error}>
            {(message) => (
              <p class="cx-settings__error" role="alert">
                {message()}
              </p>
            )}
          </Show>
          <RowGroup label="Defaults" rows={defaultsRows(props)} />
          <RowGroup label="Pull requests" rows={pullRequestRows(props)} />
          <RowGroup label="Permissions & tools" rows={permissionRows(props)} />
          <ProviderKeys providers={props.providers} onChange={props.onProviderKeyChange} />
        </div>
      </PageBody>
    </>
  );
}
