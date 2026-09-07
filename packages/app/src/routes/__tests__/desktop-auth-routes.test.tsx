import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { describe, expect, it, vi } from 'vitest';

import type { CortexAccountState, CortexUserView } from '@cortex-ide/shared';

import { AccountProvider } from '../../state/session-context.tsx';
import { SessionsProvider } from '../../state/sessions-context.tsx';
import { detachedHost, type CortexHost } from '../../state/host.ts';
import { detachedSessionHost } from '../../state/session-host.ts';
import { SignInRoute } from '../auth-routes.tsx';
import { ConnectGitHubRoute, WorkspaceSetupRoute } from '../flow-routes.tsx';
import { IntegrationsRoute } from '../settings-routes.tsx';

function accountHost(
  user: CortexUserView | null,
  overrides: Partial<CortexHost> = {},
): CortexHost {
  const state = (): CortexAccountState => ({
    user,
    reachable: true,
    credentialsEncrypted: false,
  });

  return {
    ...detachedHost(),
    getState: async () => state(),
    listModels: async () => ({ models: [] }),
    ...overrides,
  };
}

function mount(path: string, host: CortexHost) {
  const history = createMemoryHistory();
  history.set({ value: path, replace: true });

  return render(() => (
    <AccountProvider host={host}>
      <SessionsProvider host={detachedSessionHost()}>
        <MemoryRouter history={history}>
          <Route path="/sign-in" component={SignInRoute} />
          <Route path="/sign-in/github" component={ConnectGitHubRoute} />
          <Route path="/sign-in/workspace" component={WorkspaceSetupRoute} />
          <Route path="/code/settings/integrations" component={IntegrationsRoute} />
          <Route path="/" component={() => <p>Home</p>} />
        </MemoryRouter>
      </SessionsProvider>
    </AccountProvider>
  ));
}

describe('Sign in route', () => {
  it('starts Apple and SSO in the host, never a raw vendor error', async () => {
    const startBrowserLogin = vi.fn().mockResolvedValue(true);
    const openLegalPage = vi.fn().mockResolvedValue(true);
    mount(
      '/sign-in',
      accountHost(null, { startBrowserLogin, openLegalPage }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Continue with Apple/ }));
    await waitFor(() => expect(startBrowserLogin).toHaveBeenCalledWith('apple'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue with SSO/ })).not.toBeDisabled(),
    );

    fireEvent.click(screen.getByRole('button', { name: /Continue with SSO/ }));
    await waitFor(() => expect(startBrowserLogin).toHaveBeenCalledWith('sso'));

    fireEvent.click(screen.getByRole('link', { name: 'Privacy Policy' }));
    await waitFor(() => expect(openLegalPage).toHaveBeenCalledWith('privacy'));
  });
});

describe('Connect GitHub route', () => {
  it('starts the App install instead of opening a folder', async () => {
    const startGitHubInstall = vi.fn().mockResolvedValue(true);
    const openWorkspace = vi.fn();
    const host = accountHost({ id: 'usr_1', email: 'ada@example.com' }, { startGitHubInstall });

    mount('/sign-in/github', host);
    fireEvent.click(screen.getByRole('button', { name: /Install the Cortex GitHub app/ }));

    await waitFor(() => expect(startGitHubInstall).toHaveBeenCalledOnce());
    expect(openWorkspace).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByLabelText(/token|password|personal access/i)).toBeNull();
  });

  it('fails closed with This PC copy when install cannot start', async () => {
    const startGitHubInstall = vi.fn().mockRejectedValue(new Error('not_found'));
    mount('/sign-in/github', accountHost(null, { startGitHubInstall }));

    fireEvent.click(screen.getByRole('button', { name: /Install the Cortex GitHub app/ }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/This PC/);
    });
  });
});

describe('Workspace setup route', () => {
  it('never asks for a workspace name', () => {
    mount('/sign-in/workspace', accountHost(null));
    expect(screen.queryByLabelText('Workspace name')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText(/folder already has a name|desktop app/i)).toBeInTheDocument();
  });
});

describe('Integrations GitHub', () => {
  it('Connect starts the same install and never asks for a PAT', async () => {
    const startGitHubInstall = vi.fn().mockResolvedValue(true);
    mount(
      '/code/settings/integrations',
      accountHost({ id: 'usr_1', email: 'ada@example.com' }, { startGitHubInstall }),
    );

    const connect = await screen.findByRole('button', { name: 'Connect' });
    await waitFor(() => expect(connect).not.toBeDisabled());
    fireEvent.click(connect);
    await waitFor(() => expect(startGitHubInstall).toHaveBeenCalledOnce());
    expect(screen.queryByLabelText(/token|password|personal access/i)).toBeNull();
  });
});
