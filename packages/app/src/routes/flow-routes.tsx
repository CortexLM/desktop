/**
 * The onboarding flows, and SSH.
 *
 * All three used to pass hardcoded steps and no-op actions. Two of them now do
 * something real. The third says plainly that it cannot yet, which is the honest
 * option and better than a form that accepts input and drops it.
 */

import { createMemo, createSignal, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { useAccount } from '../state/session-context.tsx';
import { useSessions } from '../state/sessions-context.tsx';
import { addSshRuntime } from '../state/code-hosts.ts';
import { hasElectronHost } from '../state/electron-bridge.ts';
import {
  ConnectGitHubScreen,
  SshConnectScreen,
  WorkspaceSetupScreen,
  type FlowStep,
} from '../screens/onboarding/flow-screens.tsx';

/**
 * The step indicator, from actual state.
 *
 * It used to be a constant with Account already ticked, which was a claim about the
 * user rather than a reading of anything. Signed out, "Account" is exactly what has
 * *not* been done.
 */
function useSteps(): () => FlowStep[] {
  const account = useAccount();
  const runs = useSessions();

  return createMemo(() => [
    { id: 'account', label: 'Account', done: account.capabilities().authenticated },
    // GitHub is not connectable yet, so it is never done. Marking it done because the
    // user clicked past it would be the checklist lying to make itself look finished.
    { id: 'github', label: 'GitHub', done: false },
    { id: 'workspace', label: 'Workspace', done: (runs.repositories() ?? []).length > 0 },
  ]);
}

/**
 * Auth Connect GitHub.
 *
 * The installation action stays unavailable until the service has a verified
 * repository authorization contract. Folder selection is a separate action.
 *
 * The reason is worth stating rather than hiding behind a spinner: connecting a
 * GitHub account needs a registered OAuth app and a callback the desktop app can
 * receive, and `api.cortex.foundation` exposes no endpoint for either — the device
 * flow it does expose signs you into Cortex, not into GitHub. Rather than a button
 * that appears to work, this offers the thing that does: opening a local repository,
 * which is all an agent needs to read and edit code.
 */
export function ConnectGitHubRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();
  const steps = useSteps();

  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const openFolder = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const opened = await runs.openWorkspace();
      if (opened) navigate('/code');
    } catch {
      setError('This repository could not be opened. Try choosing the folder again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConnectGitHubScreen
      steps={steps()}
      onOpenFolder={hasElectronHost() ? () => void openFolder() : undefined}
      onSkip={() => navigate('/code')}
      busy={busy()}
      error={error() ?? 'GitHub repository access is not available on this workspace yet. You can continue with a local repository in the Cortex desktop app.'}
    />
  );
}

/**
 * Auth Workspace Setup.
 *
 * Creating a workspace *is* choosing a folder, so the name field is not what does
 * the work — the native picker is. The name is accepted and ignored rather than
 * removed, because the design draws the field; what it would name is the folder,
 * which already has a name.
 */
export function WorkspaceSetupRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();
  const steps = useSteps();

  const [busy, setBusy] = createSignal(false);

  const create = async () => {
    setBusy(true);
    try {
      const opened = await runs.openWorkspace();
      if (opened) navigate('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <WorkspaceSetupScreen
      steps={steps()}
      onCreate={() => void create()}
      onSkip={() => navigate('/')}
      busy={busy()}
    />
  );
}

/**
 * SSH Connect.
 *
 * Registers the server with Cortex, which completes the handshake and reports a
 * fingerprint. The form still asks only for host, user and port: forwarding a
 * private key through a browser tab would be storing one there, so the service
 * holds the credential and this screen never sees it.
 *
 * On success it lands on Runtimes, where the new server is listed with its status —
 * so "did that work?" is answered by the list rather than by the form disappearing.
 * A backend without the route says so instead of accepting input and dropping it,
 * which is what this screen used to do for every submission.
 */
export function SshConnectRoute(): JSX.Element {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string>();
  const [busy, setBusy] = createSignal(false);

  const connect = async (target: { host: string; user: string; port: string }) => {
    setBusy(true);
    setError(undefined);
    try {
      const port = Number.parseInt(target.port, 10);
      await addSshRuntime({
        host: target.host,
        user: target.user,
        ...(Number.isFinite(port) ? { port } : {}),
      });
      navigate('/code/runtimes');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SshConnectScreen
      onConnect={(target) => void connect(target)}
      onCancel={() => navigate('/code/runtimes')}
      busy={busy()}
      {...(error() ? { error: error()! } : {})}
    />
  );
}
