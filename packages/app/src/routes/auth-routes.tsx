/**
 * Sign in, and the device code screen.
 *
 * The only screens in the app that run before there is an account, so they depend on
 * the account context and nothing else.
 */

import { onMount, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { useAccount } from '../state/session-context.tsx';
import { SignInScreen } from '../screens/auth/sign-in-screen.tsx';
import { DeviceCodeScreen } from '../screens/auth/device-code-screen.tsx';
import { createDeviceFlow } from '../screens/auth/device-flow.ts';

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
