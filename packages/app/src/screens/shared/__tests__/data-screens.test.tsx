import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS_CAPABILITIES, AUTHENTICATED_CAPABILITIES } from '@cortex-ide/cortex-api';

import {
  AutomationsScreen,
  type Automation,
  type AutomationsScreenProps,
} from '../../automations/automations-screen.tsx';
import {
  SecretsScreen,
  type Secret,
  type SecretsScreenProps,
} from '../../secrets/secrets-screen.tsx';
import { UsageScreen, type UsageScreenProps } from '../../usage/usage-screen.tsx';
import { Stat, Table } from '../data.tsx';

const AUTOMATIONS: Automation[] = [
  {
    id: 'a1',
    title: 'Auto PR review',
    description: 'Reviews every pull request as it opens.',
    icon: 'pullRequest',
    trigger: 'On every pull request',
    enabled: true,
  },
];

const SUGGESTED: Automation[] = [
  {
    id: 'a2',
    title: 'Nightly test coverage',
    description: 'Runs the suite and reports coverage drift.',
    icon: 'chart',
    trigger: 'Runs nightly at 02:00',
    enabled: false,
  },
];

const SECRETS: Secret[] = [
  { id: 's1', name: 'STRIPE_KEY', scope: 'local', lastUsed: '3d ago' },
  { id: 's2', name: 'DEPLOY_TOKEN', scope: 'account' },
];

function renderUsage(overrides: Partial<UsageScreenProps> = {}) {
  const onSignIn = overrides.onSignIn ?? vi.fn();
  const { onSignIn: _s, ...rest } = overrides;

  const result = render(() => (
    <UsageScreen
      capabilities={AUTHENTICATED_CAPABILITIES}
      period="1–25 August"
      stats={[
        { label: 'Credits used', value: '18,420', delta: '+12% vs July', direction: 'up' },
        { label: 'Sessions', value: '96' },
      ]}
      rows={[
        { id: 'r1', model: 'Cortex Codex', sessions: 74, credits: '11,200', share: '61%' },
        { id: 'r2', model: 'Cortex Opus', sessions: 22, credits: '7,220', share: '39%' },
      ]}
      {...rest}
      onSignIn={onSignIn}
    />
  ));

  return { ...result, onSignIn };
}

function renderAutomations(overrides: Partial<AutomationsScreenProps> = {}) {
  const handlers = {
    onToggle: vi.fn(),
    onOpen: vi.fn(),
    onCreate: vi.fn(),
    onSignIn: vi.fn(),
  };

  const result = render(() => (
    <AutomationsScreen
      capabilities={AUTHENTICATED_CAPABILITIES}
      stats={[{ label: 'Runs this week', value: '34' }]}
      active={AUTOMATIONS}
      suggested={SUGGESTED}
      {...handlers}
      {...overrides}
    />
  ));

  return { ...result, ...handlers, ...overrides };
}

function renderSecrets(overrides: Partial<SecretsScreenProps> = {}) {
  const onCreate = overrides.onCreate ?? vi.fn();
  const onDelete = overrides.onDelete ?? vi.fn();
  const { onCreate: _c, onDelete: _d, ...rest } = overrides;

  const result = render(() => (
    <SecretsScreen
      capabilities={ANONYMOUS_CAPABILITIES}
      secrets={SECRETS}
      {...rest}
      onCreate={onCreate}
      onDelete={onDelete}
    />
  ));

  return { ...result, onCreate, onDelete };
}

describe('Stat', () => {
  it('shows the figure and its label', () => {
    render(() => <Stat label="Credits used" value="18,420" />);
    expect(screen.getByText('18,420')).toBeInTheDocument();
  });

  it('keeps direction separate from the delta, because up is not always good', () => {
    // More sessions is healthy, more errors is not; only the caller knows which.
    const { container } = render(() => (
      <Stat label="Errors" value="7" delta="+3" direction="down" />
    ));
    expect(container.querySelector('.cx-stat__delta--down')).not.toBeNull();
  });

  it('omits the delta when there is nothing to compare against', () => {
    const { container } = render(() => <Stat label="Sessions" value="96" />);
    expect(container.querySelector('.cx-stat__delta')).toBeNull();
  });
});

describe('Table', () => {
  it('uses a real table, so rows and columns are associated', () => {
    render(() => (
      <Table
        caption="Usage"
        columns={[{ key: 'a', label: 'Model' }]}
        rows={[{ a: <>Cortex Codex</> }]}
      />
    ));

    expect(screen.getByRole('table', { name: 'Usage' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Model' })).toBeInTheDocument();
  });

  it('replaces itself with a message when there are no rows', () => {
    // An empty table with headers reads as a failure to load rather than as no data.
    const { container } = render(() => (
      <Table
        caption="Usage"
        columns={[{ key: 'a', label: 'Model' }]}
        rows={[]}
        emptyMessage="No sessions ran."
      />
    ));

    expect(container.querySelector('table')).toBeNull();
    expect(screen.getByText('No sessions ran.')).toBeInTheDocument();
  });
});

describe('Usage gating', () => {
  it('explains the gate rather than showing zeroes when signed out', () => {
    // A table of zeroes would imply the user had run nothing, when the truth is that Cortex
    // has no meter to read.
    renderUsage({ capabilities: ANONYMOUS_CAPABILITIES });

    expect(screen.getByText('Usage is reported for Cortex accounts')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('says why, in terms of where the billing happens', () => {
    renderUsage({ capabilities: ANONYMOUS_CAPABILITIES });
    expect(screen.getByText(/billed by that provider/)).toBeInTheDocument();
  });

  it('offers the way through the gate', () => {
    const { onSignIn } = renderUsage({ capabilities: ANONYMOUS_CAPABILITIES });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to Cortex' }));
    expect(onSignIn).toHaveBeenCalledOnce();
  });

  it('shows the figures once signed in', () => {
    renderUsage();

    expect(screen.getByText('18,420')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Cortex Opus')).toBeInTheDocument();
  });
});

describe('Automations', () => {
  it('separates what is running from what else could run', () => {
    // Merging them would bury two live automations among a dozen templates.
    renderAutomations();

    expect(screen.getByRole('region', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Suggested' })).toBeInTheDocument();
  });

  it('offers Disable on an active automation and Enable on a suggestion', () => {
    renderAutomations();

    expect(screen.getByRole('button', { name: 'Disable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
  });

  it('reports a toggle with the new state', () => {
    const { onToggle } = renderAutomations();

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    expect(onToggle).toHaveBeenCalledWith('a1', false);

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(onToggle).toHaveBeenCalledWith('a2', true);
  });

  it('opens a card without the action button also opening it', () => {
    const { onOpen, onToggle } = renderAutomations();

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));

    expect(onToggle).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens a card from the keyboard, since it is a div with a button role', () => {
    const { onOpen } = renderAutomations();
    const card = screen.getByText('Auto PR review').closest('[role="button"]')!;

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledWith('a1');
  });

  it('says what to do when nothing is active yet', () => {
    renderAutomations({ active: [] });
    expect(screen.getByText(/Enable one of the suggestions below/)).toBeInTheDocument();
  });

  it('gates the whole screen without an account, and hides the create action', () => {
    renderAutomations({ capabilities: ANONYMOUS_CAPABILITIES });

    expect(screen.getByText('Automations need a Cortex account')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New automation' })).toBeNull();
  });

  it('explains the gate in terms of where the work has to run', () => {
    renderAutomations({ capabilities: ANONYMOUS_CAPABILITIES });
    expect(screen.getByText(/somewhere other than this machine/)).toBeInTheDocument();
  });
});

describe('Secrets', () => {
  it('lists names, scope and last use, and nothing else', () => {
    // A value is write-only: once stored it is never returned to the renderer, so there is
    // no reveal action and no masked display to imply otherwise.
    renderSecrets();

    expect(screen.getByText('STRIPE_KEY')).toBeInTheDocument();
    expect(screen.getByText('3d ago')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reveal/ })).toBeNull();
  });

  it('says where each secret is stored', () => {
    // A user who signs in later needs to know which secrets did not follow them.
    renderSecrets();

    expect(screen.getByText('This machine')).toBeInTheDocument();
    expect(screen.getByText('Cortex account')).toBeInTheDocument();
  });

  it('shows Never for a secret nothing has used', () => {
    renderSecrets();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('masks the value field and keeps the browser from saving it', () => {
    renderSecrets();
    const value = screen.getByLabelText('Value');

    expect(value).toHaveAttribute('type', 'password');
    expect(value).toHaveAttribute('autocomplete', 'off');
  });

  it('upper-cases the name as it is typed', () => {
    // So the field always shows the name the session will actually reference.
    renderSecrets();
    const name = screen.getByLabelText('Name');

    fireEvent.input(name, { target: { value: 'stripe_key2' } });
    expect(name).toHaveValue('STRIPE_KEY2');
  });

  it('rejects a name that is not a valid environment variable', () => {
    renderSecrets();

    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'my-key' } });
    expect(screen.getByText('Use uppercase letters, digits and underscores')).toBeInTheDocument();
  });

  it('rejects a name already in use', () => {
    renderSecrets();

    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'STRIPE_KEY' } });
    expect(screen.getByText('That name is taken')).toBeInTheDocument();
  });

  it('holds the add action until both fields are valid', () => {
    renderSecrets();
    const add = screen.getByRole('button', { name: 'Add secret' });

    expect(add).toBeDisabled();

    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'NEW_KEY' } });
    expect(add).toBeDisabled();

    fireEvent.input(screen.getByLabelText('Value'), { target: { value: 'v' } });
    expect(add).not.toBeDisabled();
  });

  it('creates the secret and clears the form', () => {
    const { onCreate } = renderSecrets();

    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'NEW_KEY' } });
    fireEvent.input(screen.getByLabelText('Value'), { target: { value: 'secret-value' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add secret' }));

    expect(onCreate).toHaveBeenCalledWith('NEW_KEY', 'secret-value');
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Value')).toHaveValue('');
  });

  it('says the secrets stay on this machine without an account', () => {
    renderSecrets({ capabilities: ANONYMOUS_CAPABILITIES });
    expect(screen.getByText('Stored on this machine only')).toBeInTheDocument();
  });

  it('says they sync once there is an account', () => {
    renderSecrets({ capabilities: AUTHENTICATED_CAPABILITIES });
    expect(screen.getByText('Synced to your Cortex account')).toBeInTheDocument();
  });

  it('deletes by id', () => {
    const { onDelete } = renderSecrets();
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]!);
    expect(onDelete).toHaveBeenCalledWith('s1');
  });
});
