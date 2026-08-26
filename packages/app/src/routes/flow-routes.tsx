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
 * `onConnect` opens a folder instead of starting an OAuth dance, and the copy is
 * carried by the screen's own error slot to say why.
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

  const openFolder = async () => {
    setBusy(true);
    try {
      const opened = await runs.openWorkspace();
      if (opened) navigate('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConnectGitHubScreen
      steps={steps()}
      onConnect={() => void openFolder()}
      onSkip={() => navigate('/')}
      busy={busy()}
      error="Connecting a GitHub account is not available yet. Open a local repository instead — an agent needs nothing else to read and edit code."
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
 * Reports that it cannot connect, rather than accepting a host and doing nothing.
 * A remote runtime needs an agent process on the far end and a transport to it;
 * neither exists yet, and a form that takes credentials and discards them is worse
 * than one that says so — it invites the user to type a password.
 */
export function SshConnectRoute(): JSX.Element {
  const navigate = useNavigate();
  const [error, setError] = createSignal<string>();

  return (
    <SshConnectScreen
      onConnect={() =>
        setError(
          'Remote runtimes are not available yet. Sessions run on this machine; the runtime picker on Home shows what is reachable.',
        )
      }
      onCancel={() => navigate('/')}
      {...(error() ? { error: error()! } : {})}
    />
  );
}
