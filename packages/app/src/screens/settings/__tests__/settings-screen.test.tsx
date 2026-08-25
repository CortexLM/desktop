import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS_CAPABILITIES, AUTHENTICATED_CAPABILITIES } from '@cortex-ide/cortex-api';

import { Select, Toggle } from '../controls.tsx';
import {
  SettingsScreen,
  type ProviderCredential,
  type SettingsScreenProps,
} from '../settings-screen.tsx';

const PROVIDERS: ProviderCredential[] = [
  { id: 'anthropic', name: 'Anthropic', configured: true, placeholder: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI', configured: false, placeholder: 'sk-…' },
];

function renderSettings(overrides: Partial<SettingsScreenProps> = {}) {
  const onDefaultChange = overrides.onDefaultChange ?? vi.fn();
  const onPermissionChange = overrides.onPermissionChange ?? vi.fn();
  const onProviderKeyChange = overrides.onProviderKeyChange ?? vi.fn();

  const {
    onDefaultChange: _d,
    onPermissionChange: _p,
    onProviderKeyChange: _k,
    ...rest
  } = overrides;

  const result = render(() => (
    <SettingsScreen
      capabilities={ANONYMOUS_CAPABILITIES}
      defaults={{
        model: 'cortex-codex',
        repository: 'forge/backend-api',
        baseBranch: '',
        branchPrefix: 'cortex/',
        createPullRequests: 'draft',
      }}
      permissions={{
        runShellCommands: true,
        applyDatabaseMigrations: false,
        slackNotifications: false,
        networkAccess: 'allowlist',
      }}
      modelOptions={[
        { value: 'cortex-codex', label: 'Cortex Codex' },
        { value: 'cortex-opus', label: 'Cortex Opus', disabled: true },
      ]}
      repositoryOptions={[{ value: 'forge/backend-api', label: 'forge/backend-api' }]}
      providers={PROVIDERS}
      networkOptions={[
        { value: 'allowlist', label: 'Allowlist only' },
        { value: 'all', label: 'All destinations' },
      ]}
      pullRequestOptions={[
        { value: 'draft', label: 'As drafts' },
        { value: 'never', label: 'Never' },
      ]}
      {...rest}
      onDefaultChange={onDefaultChange}
      onPermissionChange={onPermissionChange}
      onProviderKeyChange={onProviderKeyChange}
    />
  ));

  return { ...result, onDefaultChange, onPermissionChange, onProviderKeyChange };
}

describe('Toggle', () => {
  it('is a real checkbox, so it announces its state and answers to Space', () => {
    // A div with a click handler would have to reimplement focus, role and keyboard.
    render(() => <Toggle label="Run shell commands" checked onChange={vi.fn()} />);
    const input = screen.getByRole('checkbox', { name: 'Run shell commands' });

    expect(input).toBeChecked();
  });

  it('reports the new value rather than the event', () => {
    const onChange = vi.fn();
    render(() => <Toggle label="Slack" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('carries the disabled attribute, which is what stops the interaction', () => {
    // Asserted on the attribute rather than by firing a click: fireEvent dispatches the
    // event directly, bypassing the activation behaviour a real browser uses to suppress it,
    // so a click assertion here would be testing jsdom's fidelity rather than the component.
    const onChange = vi.fn();
    render(() => <Toggle label="Slack" checked={false} disabled onChange={onChange} />);

    expect(screen.getByRole('checkbox')).toBeDisabled();
  });
});

describe('Select', () => {
  it('reports the chosen value', () => {
    const onValueChange = vi.fn();
    render(() => (
      <Select
        label="Model"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        onValueChange={onValueChange}
      />
    ));

    fireEvent.change(screen.getByRole('combobox', { name: 'Model' }), { target: { value: 'b' } });
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('marks an unavailable option disabled rather than omitting it', () => {
    // A locked Cortex model should still appear, so the picker explains what an account adds.
    render(() => (
      <Select
        label="Model"
        value="a"
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
        ]}
        onValueChange={vi.fn()}
      />
    ));

    expect(screen.getByRole('option', { name: 'B' })).toBeDisabled();
  });
});

describe('Settings defaults', () => {
  it('reports a changed default by key', () => {
    const { onDefaultChange } = renderSettings();

    fireEvent.change(screen.getByRole('combobox', { name: 'Default model' }), {
      target: { value: 'cortex-opus' },
    });

    expect(onDefaultChange).toHaveBeenCalledWith('model', 'cortex-opus');
  });

  it('reports an edited branch prefix', () => {
    const { onDefaultChange } = renderSettings();

    fireEvent.input(screen.getByDisplayValue('cortex/'), { target: { value: 'agent/' } });
    expect(onDefaultChange).toHaveBeenCalledWith('branchPrefix', 'agent/');
  });
});

describe('Settings permissions', () => {
  it('reports a toggled permission by key', () => {
    const { onPermissionChange } = renderSettings();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Run shell commands' }));
    expect(onPermissionChange).toHaveBeenCalledWith('runShellCommands', false);
  });

  it('locks the account-only permission when signed out, and explains why', () => {
    // Hiding it would be indistinguishable from the setting not existing.
    renderSettings({ capabilities: ANONYMOUS_CAPABILITIES });

    expect(screen.getByRole('checkbox', { name: 'Slack notifications' })).toBeDisabled();
    expect(screen.getByText('Sign in to Cortex to change this')).toBeInTheDocument();
  });

  it('unlocks it once signed in, and restores its own description', () => {
    renderSettings({ capabilities: AUTHENTICATED_CAPABILITIES });

    expect(screen.getByRole('checkbox', { name: 'Slack notifications' })).not.toBeDisabled();
    expect(screen.queryByText('Sign in to Cortex to change this')).toBeNull();
    expect(screen.getByText(/Get notified in Slack/)).toBeInTheDocument();
  });

  it('leaves the permissions that work signed out enabled', () => {
    renderSettings({ capabilities: ANONYMOUS_CAPABILITIES });

    expect(screen.getByRole('checkbox', { name: 'Run shell commands' })).not.toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'Apply database migrations' }),
    ).not.toBeDisabled();
  });
});

describe('Settings provider keys', () => {
  it('offers the key fields whether or not anyone is signed in', () => {
    // Signed out, a key here is the only thing that makes the composer able to run.
    renderSettings({ capabilities: ANONYMOUS_CAPABILITIES });

    expect(screen.getByLabelText('Anthropic API key')).toBeInTheDocument();
    expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument();
  });

  it('never shows a stored key back, only whether one exists', () => {
    // The main process holds it and reports existence only; a masked value would imply it
    // could be recovered from here.
    renderSettings();

    expect(screen.getByLabelText('Anthropic API key')).toHaveValue('');
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });

  it('masks typing, since a key is a secret', () => {
    renderSettings();
    expect(screen.getByLabelText('OpenAI API key')).toHaveAttribute('type', 'password');
  });

  it('keeps the browser from offering to save a provider key', () => {
    renderSettings();
    expect(screen.getByLabelText('OpenAI API key')).toHaveAttribute('autocomplete', 'off');
  });

  it('shows the key shape as a placeholder', () => {
    renderSettings();
    expect(screen.getByPlaceholderText('sk-ant-…')).toBeInTheDocument();
  });

  it('reports a new key with its provider id', () => {
    const { onProviderKeyChange } = renderSettings();

    fireEvent.input(screen.getByLabelText('OpenAI API key'), { target: { value: 'sk-test-123' } });
    expect(onProviderKeyChange).toHaveBeenCalledWith('openai', 'sk-test-123');
  });

  it('explains the consequence when no provider is available at all', () => {
    renderSettings({ providers: [] });
    expect(screen.getByText(/Add a key to run sessions without an account/)).toBeInTheDocument();
  });
});
