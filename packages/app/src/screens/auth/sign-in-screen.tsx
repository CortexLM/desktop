import { createSignal, type JSX, Show } from 'solid-js';

import { Icon } from '@cortex-ide/ui';

import { BrandMark } from '../../shell/brand-mark.tsx';

import './auth.css';

export interface SignInScreenProps {
  onContinueWithGitHub: () => void;
  onContinueWithGoogle: () => void;
  onContinueWithEmail: (email: string) => void;
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

function ProviderButtons(props: {
  busy?: boolean;
  onGitHub: () => void;
  onGoogle: () => void;
}): JSX.Element {
  return (
    <div class="cx-auth__providers">
      <button
        type="button"
        class="cx-auth__provider cx-auth__provider--primary"
        disabled={props.busy}
        onClick={() => props.onGitHub()}
      >
        <Icon name="github" size={16} />
        Continue with GitHub
      </button>

      <button
        type="button"
        class="cx-auth__provider cx-auth__provider--outlined"
        disabled={props.busy}
        onClick={() => props.onGoogle()}
      >
        <Icon name="googleColour" size={16} />
        Continue with Google
      </button>
    </div>
  );
}

function EmailForm(props: { busy?: boolean; onSubmit: (email: string) => void }): JSX.Element {
  const [email, setEmail] = createSignal('');
  const canSubmit = () => !props.busy && looksLikeEmail(email());

  return (
    <form
      class="cx-auth__providers"
      style={{ 'margin-top': '0' }}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit()) props.onSubmit(email().trim());
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
          onInput={(event) => setEmail(event.currentTarget.value)}
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
 * Sits below the legal copy behind a rule, matching the design. That line governs the three
 * sign-in actions above it, so putting the anonymous path next to them would read as a
 * fourth sign-in method covered by the same terms.
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

/** Auth Sign In. */
export function SignInScreen(props: SignInScreenProps): JSX.Element {
  return (
    <div class="cx-auth">
      <div class="cx-auth__card">
        <span class="cx-auth__mark">
          <BrandMark width={34} height={17} />
        </span>

        <h1 class="cx-auth__title">Sign in</h1>
        <p class="cx-auth__subtitle">Continue to Cortex Code</p>

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
        />

        <div class="cx-auth__divider">
          <hr class="cx-auth__rule" />
          <span class="cx-auth__divider-label">or</span>
          <hr class="cx-auth__rule" />
        </div>

        <EmailForm busy={props.busy} onSubmit={props.onContinueWithEmail} />

        <p class="cx-auth__legal">
          By continuing, you agree to the Cortex Code Terms of Service and acknowledge the
          Privacy Policy.
        </p>

        <AnonymousRoute busy={props.busy} onContinue={props.onContinueWithoutAccount} />
      </div>
    </div>
  );
}
