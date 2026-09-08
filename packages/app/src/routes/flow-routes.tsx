/**
 * The onboarding flows, and SSH.
 *
 * Connect GitHub starts the GitHub App install in the system browser. A
 * missing install route fails closed — it does not open a folder and pretend
 * the app was installed. Skip is still This PC / local repositories. SSH
 * registers the server; a missing route says so instead of accepting input
 * and dropping it.
 */

import { createMemo, createSignal, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { describeGitHubInstallError, describeSshConnectError } from '@cortex-ide/cortex-api';

import { hasElectronHost } from '../state/electron-bridge.ts';
import { useAccount } from '../state/session-context.tsx';
import { useSessions } from '../state/sessions-context.tsx';
import { addSshRuntime } from '../state/code-hosts.ts';
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
 * *not* been done. GitHub stays undone until the service can say the app is installed.
 */
function useSteps(): () => FlowStep[] {
  const account = useAccount();
  const runs = useSessions();

  return createMemo(() => [
    { id: 'account', label: 'Account', done: account.capabilities().authenticated },
    { id: 'github', label: 'GitHub', done: false },
    { id: 'workspace', label: 'Workspace', done: (runs.repositories() ?? []).length > 0 },
  ]);
}

/**
 * Auth Connect GitHub.
 *
 * Install opens the GitHub App in the system browser. There is no PAT field.
 * Opening a local folder is a separate action — it is not the install.
 * Skip still means local / This PC. A missing install route is an honest
 * failure, not a folder picker.
 */
export function ConnectGitHubRoute(): JSX.Element {
  const account = useAccount();
  const runs = useSessions();
  const navigate = useNavigate();
  const steps = useSteps();

  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const install = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const opened = await account.host.startGitHubInstall();
      if (!opened) {
        setError('Could not start GitHub. Open a folder on This PC, or try again.');
      }
    } catch (caught) {
      setError(describeGitHubInstallError(caught));
    } finally {
      setBusy(false);
    }
  };

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
      onConnect={() => void install()}
      onOpenFolder={hasElectronHost() ? () => void openFolder() : undefined}
      onSkip={() => navigate('/code')}
      busy={busy()}
      {...(error() ? { error: error()! } : {})}
    />
  );
}

/**
 * Auth Workspace Setup.
 *
 * This PC is the folder the user picks. There is no name field — the directory
 * already has one, and the renderer never sees the path. Web says so instead of
 * offering a picker that cannot run.
 */
export function WorkspaceSetupRoute(): JSX.Element {
  const runs = useSessions();
  const navigate = useNavigate();
  const steps = useSteps();
  const thisPcAvailable = hasElectronHost();

  const [busy, setBusy] = createSignal(false);

  const create = async () => {
    if (!thisPcAvailable) return;
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
      thisPcAvailable={thisPcAvailable}
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
      setError(describeSshConnectError(caught));
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
