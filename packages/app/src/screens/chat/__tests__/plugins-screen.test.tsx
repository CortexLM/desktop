/**
 * The Plugins page: the catalogue, the states that replace it, and the Chat /
 * Bot assignment each card carries.
 *
 * The assignment is the part worth testing hard. A switch that moves on click
 * would be the whole bug: the tools a Cortex Chat turn or a Cortex Bot turn may
 * reach are the account's, so until the service has agreed to the change the
 * page is describing something that is not true yet.
 */

import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import type { PluginApp } from '../../../state/plugins.ts';
import { PluginsScreen } from '../plugins-screen.tsx';

const CATALOGUE: readonly PluginApp[] = [
  {
    slug: 'gmail',
    name: 'Gmail',
    summary: "Google's email service.",
    category: 'email',
    toolCount: 61,
    surfaces: ['chat', 'bot'],
  },
  {
    slug: 'linear',
    name: 'Linear',
    summary: 'Issue tracking for modern teams.',
    surfaces: ['chat', 'bot'],
  },
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

const surfaceBox = (app: string, surface: 'Chat' | 'Bot') =>
  screen.getByRole('checkbox', { name: `Use ${app} in Cortex ${surface}` });

describe('PluginsScreen', () => {
  it('renders the catalogue the API returned and nothing else', () => {
    const onConnect = vi.fn();
    render(() => <PluginsScreen {...pluginProps({ onConnect })} />);

    expect(screen.getByText('Gmail')).toBeInTheDocument();
    expect(screen.getByText('Linear')).toBeInTheDocument();
    expect(screen.getByText('email · 61 tools')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Gmail' }));
    expect(onConnect).toHaveBeenCalledWith('gmail', ['chat', 'bot']);
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
    expect(onConnect).toHaveBeenCalledWith('gmail', ['chat', 'bot']);
  });

  it('covers loading, unavailable, error, and disconnect', () => {
    const gmail = CATALOGUE[0]!;
    const loading = render(() => (
      <PluginsScreen apps={[]} connected={[]} onConnect={vi.fn()} loading />
    ));
    expect(screen.getByText('Loading plugins')).toBeInTheDocument();
    loading.unmount();
    const down = render(() => (
      <PluginsScreen apps={[]} connected={[]} onConnect={vi.fn()} unavailable error="No marketplace" />
    ));
    expect(screen.getByText('Plugins unavailable')).toBeInTheDocument();
    down.unmount();
    const errored = render(() => (
      <PluginsScreen apps={[]} connected={[]} onConnect={vi.fn()} error="boom" />
    ));
    expect(screen.getByText('Could not load plugins')).toBeInTheDocument();
    errored.unmount();
    const onDisconnect = vi.fn();
    render(() => (
      <PluginsScreen
        apps={[gmail]}
        connected={['gmail']}
        onConnect={vi.fn()}
        onDisconnect={onDisconnect}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect Gmail' }));
    expect(onDisconnect).toHaveBeenCalledWith('gmail');
  });
});

describe('choosing Chat, Bot, or both', () => {
  it('connects on only the surface left switched on', () => {
    const onConnect = vi.fn();
    render(() => <PluginsScreen {...pluginProps({ onConnect })} />);

    // Nothing is connected yet, so the choice is still local and moves at once.
    fireEvent.click(surfaceBox('Gmail', 'Bot'));
    expect(surfaceBox('Gmail', 'Bot')).not.toBeChecked();
    expect(surfaceBox('Gmail', 'Chat')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Connect Gmail' }));
    expect(onConnect).toHaveBeenCalledWith('gmail', ['chat']);
  });

  it('leaves every other card alone when one card is changed', () => {
    render(() => <PluginsScreen {...pluginProps()} />);

    fireEvent.click(surfaceBox('Gmail', 'Chat'));

    expect(surfaceBox('Gmail', 'Chat')).not.toBeChecked();
    expect(surfaceBox('Linear', 'Chat')).toBeChecked();
    expect(surfaceBox('Linear', 'Bot')).toBeChecked();
  });

  it('shows the assignment a connected app already has', () => {
    const chatOnly: PluginApp = { ...CATALOGUE[0]!, surfaces: ['chat'] };
    render(() => (
      <PluginsScreen {...pluginProps({ apps: [chatOnly], connected: ['gmail'] })} />
    ));

    expect(surfaceBox('Gmail', 'Chat')).toBeChecked();
    expect(surfaceBox('Gmail', 'Bot')).not.toBeChecked();
  });

  it('asks the service to re-assign a connected app, and waits for it', () => {
    // The switch is driven by the account's assignment, so it must not move on
    // the click alone: a Cortex Bot turn would still be reaching those tools.
    const onSurfaces = vi.fn();
    render(() => (
      <PluginsScreen {...pluginProps({ connected: ['gmail'], onSurfaces })} />
    ));

    fireEvent.click(surfaceBox('Gmail', 'Bot'));

    expect(onSurfaces).toHaveBeenCalledWith('gmail', ['chat']);
    expect(surfaceBox('Gmail', 'Bot')).toBeChecked();
  });

  it('keeps a connection on at least one surface, and says where to go instead', () => {
    const onSurfaces = vi.fn();
    const botOnly: PluginApp = { ...CATALOGUE[0]!, surfaces: ['bot'] };
    render(() => (
      <PluginsScreen {...pluginProps({ apps: [botOnly], connected: ['gmail'], onSurfaces })} />
    ));

    fireEvent.click(surfaceBox('Gmail', 'Bot'));

    expect(onSurfaces).not.toHaveBeenCalled();
    expect(surfaceBox('Gmail', 'Bot')).toBeChecked();
    expect(
      screen.getByText('Gmail stays on Chat or Bot. Disconnect it to stop using it in both.'),
    ).toBeInTheDocument();
  });
});

describe('a write that failed', () => {
  it('says the assignment could not be saved, in Cortex words', () => {
    render(() => <PluginsScreen {...pluginProps({ writeError: 'assign' })} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Cortex could not save where that plugin is used.');
  });

  it('says a backend without the assignment cannot do it, and admits nothing moved', () => {
    render(() => <PluginsScreen {...pluginProps({ writeError: 'assign-unsupported' })} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Cortex cannot yet choose where a plugin is used');
    expect(alert).toHaveTextContent('stays connected');
  });

  it('names no supplier and no status code on any failure', () => {
    for (const failure of ['unavailable', 'connect', 'assign', 'assign-unsupported'] as const) {
      const view = render(() => <PluginsScreen {...pluginProps({ writeError: failure })} />);
      const text = screen.getByRole('alert').textContent ?? '';

      expect(text.toLowerCase(), failure).not.toContain('composio');
      expect(text, failure).not.toMatch(/\b[45]\d\d\b/);
      view.unmount();
    }
  });
});
