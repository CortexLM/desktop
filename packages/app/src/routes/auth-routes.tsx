/**
 * Sign in, and the device code screen.
 *
 * Google, GitHub, Apple and SSO open the system browser. Email stays on this
 * form. The device-code route remains as a fallback. None of these paths put
 * a token in the renderer. Privacy and Terms are opened by main; this route
 * never sends a URL.
 */

import { createSignal, onCleanup, onMount, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { describeSignInError, type BrowserLoginProvider, type LegalPage } from '@cortex-ide/cortex-api';

import { useAccount } from '../state/session-context.tsx';
import type { CortexHost } from '../state/host.ts';
import { forgetPluginConnect, pendingPluginConnect } from '../state/pending-connect.ts';
import { SignInScreen } from '../screens/auth/sign-in-screen.tsx';
import { DeviceCodeScreen } from '../screens/auth/device-code-screen.tsx';
import { createDeviceFlow } from '../screens/auth/device-flow.ts';

const BROWSER_CLOSED = 'Could not open the browser. Try again, or continue without an account.';

function afterAccount(): string {
  return pendingPluginConnect()?.returnTo ?? '/';
}

async function withBusy(
  setBusy: (value: boolean) => void,
  setError: (value: string | undefined) => void,
  work: () => Promise<void>,
): Promise<void> {
  setBusy(true);
  setError(undefined);
  try {
    await work();
  } catch (caught) {
    setError(describeSignInError(caught));
  } finally {
    setBusy(false);
  }
}

function startBrowser(
  host: CortexHost,
  provider: BrowserLoginProvider,
  setBusy: (value: boolean) => void,
  setError: (value: string | undefined) => void,
): void {
  void withBusy(setBusy, setError, async () => {
    const opened = await host.startBrowserLogin(provider);
    if (!opened) setError(BROWSER_CLOSED);
  });
}

export function SignInRoute(): JSX.Element {
  const navigate = useNavigate();
  const account = useAccount();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  onMount(() => {
    if (account.user()) navigate(afterAccount());
    onCleanup(listenForAuth(account.host, navigate, setError));
  });

  const openLegal = (page: LegalPage) => {
    void account.host.openLegalPage(page);
  };

  return (
    <SignInScreen
      busy={busy()}
      error={error()}
      onContinueWithGitHub={() => startBrowser(account.host, 'github', setBusy, setError)}
      onContinueWithGoogle={() => startBrowser(account.host, 'google', setBusy, setError)}
      onContinueWithApple={() => startBrowser(account.host, 'apple', setBusy, setError)}
      onContinueWithSso={() => startBrowser(account.host, 'sso', setBusy, setError)}
      onContinueWithEmail={(address, password) =>
        void withBusy(setBusy, setError, async () => {
          await account.host.signInWithEmail(address, password);
          navigate(afterAccount());
        })
      }
      onOpenLegal={openLegal}
      onContinueWithoutAccount={() => {
        forgetPluginConnect();
        navigate('/');
      }}
    />
  );
}

function listenForAuth(
  host: CortexHost,
  navigate: (path: string) => void,
  setError: (message: string | undefined) => void,
): () => void {
  return host.onAuthComplete((event) => {
    if (event.ok) navigate(afterAccount());
    else setError(event.message ?? 'Sign-in did not complete. Try again from the Cortex app.');
  });
}

/**
 * Auth Device Code, driven by the real flow.
 *
 * The state machine lives in `device-flow.ts`; this only binds it to the screen and the
 * router. On approval it goes to Home — the account context is corrected by the
 * account-changed event, so the workspace it lands on is already the signed-in one —
 * unless something sent the user here mid-task, in which case it goes back to that
 * screen so the task can finish rather than leaving the user to find it again.
 */
export function DeviceCodeRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  const flow = createDeviceFlow({
    host: account.host,
    onAuthorized: () => navigate(afterAccount()),
  });

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
