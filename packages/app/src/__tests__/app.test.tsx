import { render, screen, waitFor } from '@solidjs/testing-library';
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
    // Anonymous use is the default path, so the app has to come up with no credentials and
    // no successful network call.
    render(() => <App />);

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    });
  });

  it('lands on Home', async () => {
    render(() => <App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    });
  });

  it('shows the composer on the landing screen', async () => {
    render(() => <App />);
    await waitFor(() => expect(screen.getByLabelText('Prompt')).toBeInTheDocument());
  });

  it('renders the sidebar with the five destinations', async () => {
    render(() => <App />);

    await waitFor(() => {
      for (const label of ['Home', 'Sessions', 'Automations', 'Review', 'Usage']) {
        expect(screen.getByRole('button', { name: label }), label).toBeInTheDocument();
      }
    });
  });

  it('locks the Cortex-only destinations while signed out', async () => {
    render(() => <App />);

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

  it('defaults the draft runtime to one the user can actually reach', async () => {
    // Signed out there is only Local. A draft pointing at Cloud would fail on send.
    render(() => <App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Local/ })).toBeInTheDocument();
    });
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
    // Sorting the other way round would highlight Settings for /settings/integrations and
    // Sessions for /sessions/:id.
    expect(slugForPath('/settings/integrations')).toBe('settings-integrations');
    expect(slugForPath('/settings')).toBe('settings');
  });

  it('maps a session detail path to the session detail screen', () => {
    expect(slugForPath('/sessions/abc123')).toBe('session-detail');
    expect(slugForPath('/sessions')).toBe('sessions');
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
