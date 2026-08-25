import { render, screen, waitFor } from '@solidjs/testing-library';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../app.tsx';

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
      expect(screen.getByRole('button', { name: 'Usage' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
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
