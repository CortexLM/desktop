import { type JSX } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { BrandMark } from '../../shell/brand-mark.tsx';
import { chromePlatform } from '../../state/platform.ts';

import './welcome.css';

const WELCOME_SEEN_KEY = 'cortex.welcome-seen';

export function readWelcomeSeen(): boolean {
  try {
    return globalThis.localStorage?.getItem(WELCOME_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen(): void {
  try {
    globalThis.localStorage?.setItem(WELCOME_SEEN_KEY, '1');
  } catch {
    // No store; this launch still proceeds.
  }
}

function productLine(): string {
  const platform = chromePlatform();
  if (platform === 'darwin') return 'Cortex for Mac';
  if (platform === 'win32') return 'Cortex for Windows';
  if (platform === 'linux') return 'Cortex for Linux';
  return 'Cortex';
}

export interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSkip: () => void;
}

/** First-launch splash. Get started goes to sign-in; skip enters the workspace. */
export function WelcomeScreen(props: WelcomeScreenProps): JSX.Element {
  return (
    <div class="cx-welcome">
      <span class="cx-welcome__mark">
        <BrandMark width={48} height={24} />
      </span>
      <p class="cx-welcome__product">{productLine()}</p>
      <h1 class="cx-welcome__title">Chat, Code and Bot — on this machine.</h1>
      <p class="cx-welcome__body">
        Sign in for Cortex models and cloud runtimes, or continue on This PC with your own
        provider keys.
      </p>
      <div class="cx-welcome__actions">
        <Button variant="primary" onClick={() => props.onGetStarted()}>
          Get started
        </Button>
        <Button variant="ghost" onClick={() => props.onSkip()}>
          Continue without an account
        </Button>
      </div>
    </div>
  );
}
