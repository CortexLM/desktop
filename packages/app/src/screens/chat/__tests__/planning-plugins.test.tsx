import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { PLANNING_TEMPLATES, type ScheduledTask } from '../../../state/planning.ts';
import type { PluginApp } from '../../../state/plugins.ts';
import { PlanningScreen } from '../planning-screen.tsx';
import { PluginsScreen } from '../library-plugins-screens.tsx';

const SCHEDULED: readonly ScheduledTask[] = [
  {
    id: 'todays-notes',
    title: "Today's notes",
    summary: 'Gather what you wrote today.',
    cadence: 'daily',
    status: 'active',
  },
];

function planningProps(overrides: Partial<Parameters<typeof PlanningScreen>[0]> = {}) {
  return {
    tasks: SCHEDULED,
    state: 'ready' as const,
    signedIn: true,
    templates: PLANNING_TEMPLATES.filter((template) => template.id !== 'todays-notes'),
    onToggle: vi.fn(),
    onRun: vi.fn(),
    onAdd: vi.fn(),
    onRetry: vi.fn(),
    onSignIn: vi.fn(),
    ...overrides,
  };
}

describe('PlanningScreen', () => {
  it('lists the account schedule alongside the jobs it can still add', () => {
    render(() => <PlanningScreen {...planningProps()} />);

    expect(screen.getByText("Today's notes")).toBeInTheDocument();
    expect(screen.getByText('Jobs you can add')).toBeInTheDocument();
    // The template order is the product lock, Subnet 100 last.
    expect(screen.getByText('Subnet 100 news')).toBeInTheDocument();
  });

  it('adds a template rather than seeding one locally', () => {
    const onAdd = vi.fn();
    render(() => <PlanningScreen {...planningProps({ onAdd })} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'unread-mentions' }),
    );
  });

  it('locks the Cortex-only job behind sign-in', () => {
    const onSignIn = vi.fn();
    render(() => (
      <PlanningScreen {...planningProps({ signedIn: false, tasks: [], onSignIn })} />
    ));

    // Signed out, the schedule cannot exist at all: it runs when the tab is shut.
    expect(screen.getByText('Planning needs a Cortex account')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cortex account' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('says a missing route is missing instead of showing an empty schedule', () => {
    render(() => (
      <PlanningScreen
        {...planningProps({
          state: 'unsupported',
          tasks: [],
          error: 'Planning is not available on this Cortex backend yet.',
        })}
      />
    ));

    expect(screen.getByText('Planning is not on this backend')).toBeInTheDocument();
    expect(screen.queryByText('No scheduled jobs')).not.toBeInTheDocument();
  });

  it('shows a loading state so the empty state does not flash first', () => {
    render(() => <PlanningScreen {...planningProps({ state: 'loading', tasks: [] })} />);
    expect(screen.getByText('Loading planning')).toBeInTheDocument();
  });
});

const CATALOGUE: readonly PluginApp[] = [
  {
    slug: 'gmail',
    name: 'Gmail',
    summary: "Google's email service.",
    category: 'email',
    toolCount: 61,
  },
  { slug: 'linear', name: 'Linear', summary: 'Issue tracking for modern teams.' },
];

function pluginProps(overrides: Partial<Parameters<typeof PluginsScreen>[0]> = {}) {
  return {
    apps: CATALOGUE,
    connected: [] as string[],
    onConnect: vi.fn(),
    signedIn: true,
    ...overrides,
  };
}

describe('PluginsScreen', () => {
  it('renders the catalogue the API returned and nothing else', () => {
    const onConnect = vi.fn();
    render(() => <PluginsScreen {...pluginProps({ onConnect })} />);

    expect(screen.getByText('Gmail')).toBeInTheDocument();
    expect(screen.getByText('Linear')).toBeInTheDocument();
    expect(screen.getByText('email · 61 tools')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Gmail' }));
    expect(onConnect).toHaveBeenCalledWith('gmail');
  });

  it('shows nothing at all when the marketplace is not live', () => {
    // The failure this guards: four hardcoded cards used to render here, so an
    // outage looked identical to a working page until the user clicked.
    render(() => (
      <PluginsScreen
        {...pluginProps({ apps: [], notLive: true, error: 'The marketplace did not answer.' })}
      />
    ));

    expect(screen.getByText('The marketplace is not answering')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Connect/ })).toBeNull();
    for (const brand of ['Gmail', 'Google Drive', 'Slack', 'GitHub']) {
      expect(screen.queryByText(brand), brand).toBeNull();
    }
  });

  it('says the catalogue is empty rather than filling it in', () => {
    render(() => <PluginsScreen {...pluginProps({ apps: [] })} />);

    expect(screen.getByText('No apps to connect')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Connect/ })).toBeNull();
  });

  it('explains that connecting needs an account, and offers both ways in', () => {
    const onSignIn = vi.fn();
    const onCreateAccount = vi.fn();
    render(() => (
      <PluginsScreen {...pluginProps({ signedIn: false, onSignIn, onCreateAccount })} />
    ));

    expect(screen.getByText('Connecting an app needs a Cortex account')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(onCreateAccount).toHaveBeenCalled();
  });

  it('leaves Connect live for a guest, because the click is what opens sign-in', () => {
    // Disabling it would state the gate without explaining it, and would strand
    // the user on a page whose only control does nothing.
    const onConnect = vi.fn();
    render(() => (
      <PluginsScreen
        {...pluginProps({ signedIn: false, onConnect, onSignIn: vi.fn(), onCreateAccount: vi.fn() })}
      />
    ));

    const connect = screen.getByRole('button', { name: 'Connect Gmail' });
    expect(connect).not.toBeDisabled();
    fireEvent.click(connect);
    expect(onConnect).toHaveBeenCalledWith('gmail');
  });
});
