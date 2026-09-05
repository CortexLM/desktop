import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App, slugForPath } from '../app.tsx';
import { navigableRoutes } from '../routes.ts';

/**
 * Mounts the whole application.
 *
 * These are the only tests that exercise the router, the account provider and the theme
 * provider together, which is where wiring mistakes actually live - a screen can pass its
 * own suite and still never be reachable.
 */
describe('App', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    // jsdom has matchMedia but always reports no match, so the system theme resolves to
    // light. Stubbing it keeps that explicit rather than incidental.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it('mounts without a Cortex account', async () => {
    // Anonymous Chat is the default path, so the app has to come up with no credentials and
    // no successful network call.
    render(() => <App />);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    });
  });

  it('lands on the Chat home', async () => {
    render(() => <App />);

    await waitFor(() => {
      // The root is the Chat product: the greeting and the "ask anything" composer.
      expect(screen.getByRole('heading', { name: /Good (morning|afternoon|evening)/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('shows the composer on the landing screen', async () => {
    render(() => <App />);
    await waitFor(() => expect(screen.getByLabelText('Prompt')).toBeInTheDocument());
  });

  it('renders the Code sidebar with the five workspace destinations', async () => {
    render(() => <App initialPath="/code" />);

    await waitFor(() => {
      for (const label of ['Home', 'Sessions', 'Automations', 'Review', 'Usage']) {
        expect(screen.getByRole('button', { name: label }), label).toBeInTheDocument();
      }
    });
  });

  it('swaps the Chat sidebar for Code destinations after switching products', async () => {
    // Starts on Chat (the Electron landing path). A frozen ProductSections
    // would keep "New chat" after this click and hide Home / Sessions — which
    // is what the desktop e2e suite was asserting against.
    render(() => <App />);

    await waitFor(() => {
      expect(screen.getByText('New chat')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sessions' })).toBeInTheDocument();
    });
    expect(screen.queryByText('New chat')).toBeNull();
  });

  it('locks the Cortex-only destinations while signed out', async () => {
    render(() => <App initialPath="/code" />);

    await waitFor(() => {
      // `aria-disabled`, not `disabled` — see NavItem: a disabled button cannot be focused,
      // so the reason it is locked becomes unreachable for keyboard users.
      expect(screen.getByRole('button', { name: 'Usage' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Review' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
  });

  it('applies a theme to the document, so the dark palette can take effect', async () => {
    // The generated CSS scopes dark to :root[data-theme='dark']; without the attribute the
    // palette never applies.
    render(() => <App />);

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });
  });

  it('does not offer a local harness on the web', async () => {
    // jsdom is a browser surface. The Code harness never runs in the tab.
    render(() => <App initialPath="/code" />);

    await waitFor(() => {
      expect(screen.getByText(/Cloud only/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /This PC/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Local/ })).toBeNull();
  });

  it('does not pretend the web build can auto-update', async () => {
    render(() => <App />);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Restart now' })).toBeNull();
    expect(screen.queryByText(/ready to install/)).toBeNull();
  });

  it('does not offer Bot in the product switcher', async () => {
    render(() => <App />);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Code' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bot' })).toBeNull();
  });

  it('opens Bot create and mascot surfaces', async () => {
    const created = render(() => <App initialPath="/bot/new" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'New mascot' })).toBeInTheDocument());
    created.unmount();

    const chat = render(() => <App initialPath="/bot/mst_1" />);
    await waitFor(() => expect(screen.getByText(/Mascot not found|Conversation|Scout/)).toBeInTheDocument());
    chat.unmount();

    const computer = render(() => <App initialPath="/bot/mst_1/computer" />);
    await waitFor(() => expect(screen.getByText(/Computer|Mascot not found|cloud computer/)).toBeInTheDocument());
    computer.unmount();

    const memory = render(() => <App initialPath="/bot/mst_1/memory" />);
    await waitFor(() =>
      expect(screen.getAllByText(/Memory|Mascot not found|Backend too old/).length).toBeGreaterThan(0),
    );
    memory.unmount();

    const skills = render(() => <App initialPath="/bot/mst_1/skills" />);
    await waitFor(() =>
      expect(screen.getAllByText(/Skills|Mascot not found|Backend too old/).length).toBeGreaterThan(0),
    );
    skills.unmount();

    const routines = render(() => <App initialPath="/bot/mst_1/routines" />);
    await waitFor(() =>
      expect(screen.getAllByText(/Routines|Mascot not found|Backend too old/).length).toBeGreaterThan(0),
    );
    routines.unmount();

    const groups = render(() => <App initialPath="/bot/mst_1/groups" />);
    await waitFor(() => expect(screen.getByText(/Groups|Mascot not found|Backend too old/)).toBeInTheDocument());
    groups.unmount();

    const videos = render(() => <App initialPath="/bot/mst_1/videos" />);
    await waitFor(() => expect(screen.getByText(/Videos|Mascot not found/)).toBeInTheDocument());
    videos.unmount();

    const approvals = render(() => <App initialPath="/bot/approvals" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Approvals' })).toBeInTheDocument());
    approvals.unmount();

    const settings = render(() => <App initialPath="/bot/mst_1/settings" />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Mascot settings|Mascot not found/i })).toBeInTheDocument(),
    );
    settings.unmount();

    const messages = render(() => <App initialPath="/bot/mst_1/messages" />);
    await waitFor(() => expect(screen.getByText(/Messages|Mascot not found/)).toBeInTheDocument());
    messages.unmount();

    render(() => <App initialPath="/plugins" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Plugins' })).toBeInTheDocument());
  });

  it('mounts remaining product and Code destinations', async () => {
    const paths = [
      '/research',
      '/planning',
      '/projects',
      '/projects/p1',
      '/projects/p1/sources',
      '/library',
      '/settings',
      '/code/sessions',
      '/code/automations',
      '/code/review',
      '/code/usage',
      '/code/settings',
      '/code/settings/integrations',
      '/code/notifications',
      '/bot/approvals',
      '/code/automations/new',
      '/code/runtimes/ssh',
      '/onboarding',
      '/sign-in/device',
      '/sign-in/github',
      '/sign-in/workspace',
    ];
    for (const path of paths) {
      const view = render(() => <App initialPath={path} />);
      await Promise.resolve();
      expect(document.body.innerHTML.length, path).toBeGreaterThan(10);
      view.unmount();
    }
  });

  it('renders no Secrets page for the retired /code/secrets path', async () => {
    // Cortex Code has no Secrets screen (`.rules/06-product.md` § 6.2.1). The path is not
    // routed any more, so it falls through to the unknown-path handler rather than to a
    // form asking the user to paste values.
    render(() => <App initialPath="/code/secrets" />);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('heading', { name: 'Secrets' })).toBeNull();
    expect(screen.queryByLabelText('Value')).toBeNull();
  });

  it('renders the sign-in screen without the workspace shell', async () => {
    // A locked navigation rail beside a sign-in form is noise: there is no workspace to
    // navigate yet.
    render(() => <App initialPath="/sign-in" />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });

  it('offers the anonymous route from sign-in', async () => {
    render(() => <App initialPath="/sign-in" />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Continue without an account' }),
      ).toBeInTheDocument();
    });
  });

  it('survives an unreachable model catalogue', async () => {
    // /v1/models is public but the app must come up offline; the picker falls back to the
    // BYO providers, which is the anonymous path anyway.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );

    render(() => <App />);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    });
  });
});

describe('slugForPath', () => {
  it('resolves the root to Home', () => {
    expect(slugForPath('/')).toBe('home');
  });

  it('prefers the longest match, so a nested path is not shadowed by its parent', () => {
    // Sorting the other way round would highlight Settings for /code/settings/integrations
    // and Sessions for /code/sessions/:id.
    expect(slugForPath('/code/settings/integrations')).toBe('code-integrations');
    expect(slugForPath('/code/settings')).toBe('code-settings');
  });

  it('maps a session detail path to the session detail screen', () => {
    expect(slugForPath('/code/sessions/abc123')).toBe('code-session-detail');
    expect(slugForPath('/code/sessions')).toBe('code-sessions');
  });

  it('falls back to Home for a path it does not know', () => {
    expect(slugForPath('/nowhere')).toBe('home');
  });

  it('resolves every navigable route to a slug', () => {
    // A route whose own path did not resolve back to its slug would leave the sidebar
    // highlighting the wrong destination while the user was on it.
    for (const route of navigableRoutes()) {
      if (!route.path) continue;
      const concrete = route.path.replace(/:[^/]+/g, 'x');
      expect(slugForPath(concrete), route.path).toBe(route.slug);
    }
  });
});
