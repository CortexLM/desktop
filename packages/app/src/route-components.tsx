import { onMount, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { useAccount } from './state/session-context.tsx';
import {
  ConnectGitHubScreen,
  SshConnectScreen,
  WorkspaceSetupScreen,
  type FlowStep,
} from './screens/onboarding/flow-screens.tsx';
import { ReviewScreen } from './screens/review/review-screen.tsx';
import { UsageScreen } from './screens/usage/usage-screen.tsx';
import { SignInScreen } from './screens/auth/sign-in-screen.tsx';
import { DeviceCodeScreen } from './screens/auth/device-code-screen.tsx';
import { createDeviceFlow } from './screens/auth/device-flow.ts';

/**
 * Route components.
 *
 * Each one adapts the account context and the router to a screen's props. They hold no data
 * of their own: until the orchestrator lands, every list is genuinely empty and the screens
 * show their own empty states rather than placeholder rows. Fake data here would make an
 * unfinished app look finished, and would be the first thing to rot.
 */

const ONBOARDING_STEPS: readonly FlowStep[] = [
  { id: 'account', label: 'Account', done: true },
  { id: 'github', label: 'GitHub', done: false },
  { id: 'workspace', label: 'Workspace', done: false },
];

export function UsageRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  return (
    <UsageScreen
      capabilities={account.capabilities()}
      period="this month"
      stats={[]}
      rows={[]}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function ReviewRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  return (
    <ReviewScreen
      capabilities={account.capabilities()}
      items={[]}
      onOpen={(id) => navigate(`/sessions/${id}`)}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function SignInRoute(): JSX.Element {
  const navigate = useNavigate();

  return (
    <SignInScreen
      onContinueWithGitHub={() => navigate('/sign-in/device')}
      onContinueWithGoogle={() => navigate('/sign-in/device')}
      onContinueWithEmail={() => navigate('/sign-in/device')}
      // The anonymous route is the only one that lands somewhere usable today, which is
      // consistent with it being the path that needs no backend at all.
      onContinueWithoutAccount={() => navigate('/')}
    />
  );
}

/**
 * Auth Device Code, driven by the real flow.
 *
 * The state machine lives in `device-flow.ts`; this only binds it to the screen and the
 * router. On approval it goes straight to Home — the account context is corrected by the
 * account-changed event, so the workspace it lands on is already the signed-in one.
 */
export function DeviceCodeRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  const flow = createDeviceFlow({ host: account.host, onAuthorized: () => navigate('/') });

  onMount(() => void flow.start());

  return (
    <DeviceCodeScreen
      userCode={flow.userCode()}
      verificationUri={flow.verificationUri()}
      status={flow.status()}
      secondsRemaining={flow.secondsRemaining()}
      errorMessage={flow.errorMessage()}
      onOpenBrowser={() => void flow.openBrowser()}
      onCopyCode={() => void flow.copyCode()}
      onCancel={() => {
        void flow.cancel();
        navigate('/sign-in');
      }}
      onRetry={() => void flow.start()}
    />
  );
}

export function ConnectGitHubRoute(): JSX.Element {
  const navigate = useNavigate();

  return (
    <ConnectGitHubScreen
      steps={ONBOARDING_STEPS}
      onConnect={() => undefined}
      onSkip={() => navigate('/sign-in/workspace')}
    />
  );
}

export function WorkspaceSetupRoute(): JSX.Element {
  const navigate = useNavigate();

  return <WorkspaceSetupScreen steps={ONBOARDING_STEPS} onCreate={() => navigate('/')} />;
}

export function SshConnectRoute(): JSX.Element {
  const navigate = useNavigate();

  return <SshConnectScreen onConnect={() => undefined} onCancel={() => navigate('/')} />;
}

export { HomeRoute, SessionsRoute, SessionDetailRoute } from './routes/run-routes.tsx';
export { SettingsRoute, IntegrationsRoute } from './routes/settings-routes.tsx';
export { AutomationsRoute, NewAutomationRoute } from './routes/automation-routes.tsx';
export { SecretsRoute } from './routes/secrets-routes.tsx';
