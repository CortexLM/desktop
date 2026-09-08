import { createSignal, type JSX, Show } from 'solid-js';

import { LEGAL_PAGE_URLS, type LegalPage } from '@cortex-ide/cortex-api';
import { Icon } from '@cortex-ide/ui';

import { BrandMark } from '../../shell/brand-mark.tsx';
import { AppleMark, GoogleMark } from '../../shell/provider-marks.tsx';

import './auth.css';

export interface SignInScreenProps {
  onContinueWithGitHub: () => void;
  onContinueWithGoogle: () => void;
  onContinueWithApple: () => void;
  onContinueWithSso: () => void;
  onContinueWithEmail: (email: string, password: string) => void;
  onOpenLegal: (page: LegalPage) => void;
  /**
   * Enters the app with no account: local runtime and the user's own provider keys.
   *
   * Not optional. Anonymous use is a product requirement, and making this a maybe would let
   * a host ship a build where the only way in is an account.
   */
  onContinueWithoutAccount: () => void;
  /** Blocks every action while a flow is in flight. */
  busy?: boolean;
  error?: string;
}

/** Rough enough to catch a typo, loose enough not to reject a valid address. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function ProviderButton(props: {
  busy?: boolean;
  variant: 'primary' | 'outlined';
  label: string;
  onClick: () => void;
  children: JSX.Element;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`cx-auth__provider cx-auth__provider--${props.variant}`}
      disabled={props.busy}
      onClick={() => props.onClick()}
    >
      {props.children}
      {props.label}
    </button>
  );
}

function ProviderButtons(props: {
  busy?: boolean;
  onGitHub: () => void;
  onGoogle: () => void;
  onApple: () => void;
  onSso: () => void;
}): JSX.Element {
  return (
    <div class="cx-auth__providers">
      <ProviderButton busy={props.busy} variant="primary" label="Continue with GitHub" onClick={props.onGitHub}>
        <Icon name="github" size={16} />
      </ProviderButton>
      <ProviderButton busy={props.busy} variant="outlined" label="Continue with Google" onClick={props.onGoogle}>
        <GoogleMark size={16} />
      </ProviderButton>
      <ProviderButton busy={props.busy} variant="outlined" label="Continue with Apple" onClick={props.onApple}>
        <AppleMark size={16} />
      </ProviderButton>
      <ProviderButton busy={props.busy} variant="outlined" label="Continue with SSO" onClick={props.onSso}>
        <Icon name="lock" size={16} />
      </ProviderButton>
    </div>
  );
}

function EmailForm(props: {
  busy?: boolean;
  onSubmit: (email: string, password: string) => void;
}): JSX.Element {
  const [email, setEmail] = createSignal('');
  const [password, setPassword] = createSignal('');
  const canSubmit = () => !props.busy && looksLikeEmail(email()) && password().length > 0;

  return (
    <form
      class="cx-auth__providers"
      style={{ 'margin-top': '0' }}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit()) props.onSubmit(email().trim(), password());
      }}
    >
      <div class="cx-auth__email">
        <input
          type="email"
          class="cx-auth__email-input"
          placeholder="name@company.com"
          value={email()}
          disabled={props.busy}
          aria-label="Email address"
          autocomplete="username"
          onInput={(event) => setEmail(event.currentTarget.value)}
        />
      </div>
      <div class="cx-auth__email">
        <input
          type="password"
          class="cx-auth__email-input"
          placeholder="Password"
          value={password()}
          disabled={props.busy}
          aria-label="Password"
          autocomplete="current-password"
          onInput={(event) => setPassword(event.currentTarget.value)}
        />
      </div>
      <button
        type="submit"
        class="cx-auth__provider cx-auth__provider--muted"
        disabled={!canSubmit()}
      >
        Continue with email
      </button>
    </form>
  );
}

/**
 * The anonymous route.
 *
 * Sits below the legal copy behind a rule, matching the design. That line governs the
 * sign-in actions above it, so putting the anonymous path next to them would read as
 * another sign-in method covered by the same terms.
 *
 * The note states what it costs. "Continue without an account" on its own invites a user to
 * pick it and then wonder why the model picker is empty.
 */
function AnonymousRoute(props: { busy?: boolean; onContinue: () => void }): JSX.Element {
  return (
    <div class="cx-auth__anonymous">
      <hr class="cx-auth__rule" />
      <button
        type="button"
        class="cx-auth__anonymous-action"
        disabled={props.busy}
        onClick={() => props.onContinue()}
      >
        Continue without an account
      </button>
      <p class="cx-auth__anonymous-note">
        Local sessions with your own provider keys. Cortex models and cloud runtimes need an
        account.
      </p>
    </div>
  );
}

function LegalNotice(props: { onOpenLegal: (page: LegalPage) => void }): JSX.Element {
  const open = (page: LegalPage) => (event: MouseEvent) => {
    event.preventDefault();
    props.onOpenLegal(page);
  };

  return (
    <p class="cx-auth__legal">
      By continuing, you agree to the Cortex{' '}
      <a href={LEGAL_PAGE_URLS.terms} onClick={open('terms')}>
        Terms of Service
      </a>{' '}
      and acknowledge the{' '}
      <a href={LEGAL_PAGE_URLS.privacy} onClick={open('privacy')}>
        Privacy Policy
      </a>
      .
    </p>
  );
}

/** Auth Sign In. */
export function SignInScreen(props: SignInScreenProps): JSX.Element {
  return (
    <div class="cx-auth">
      <div class="cx-auth__card">
        <span class="cx-auth__mark">
          <BrandMark width={34} height={17} />
        </span>

        <h1 class="cx-auth__title">Sign in</h1>
        <p class="cx-auth__subtitle">Continue to Cortex</p>

        <Show when={props.error}>
          {(error) => (
            <p class="cx-auth__error" role="alert">
              {error()}
            </p>
          )}
        </Show>

        <ProviderButtons
          busy={props.busy}
          onGitHub={props.onContinueWithGitHub}
          onGoogle={props.onContinueWithGoogle}
          onApple={props.onContinueWithApple}
          onSso={props.onContinueWithSso}
        />

        <div class="cx-auth__divider">
          <hr class="cx-auth__rule" />
          <span class="cx-auth__divider-label">or</span>
          <hr class="cx-auth__rule" />
        </div>

        <EmailForm busy={props.busy} onSubmit={props.onContinueWithEmail} />

        <LegalNotice onOpenLegal={props.onOpenLegal} />

        <AnonymousRoute busy={props.busy} onContinue={props.onContinueWithoutAccount} />
      </div>
    </div>
  );
}
