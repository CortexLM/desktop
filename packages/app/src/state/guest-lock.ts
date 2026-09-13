/**
 * Code needs a Cortex account. Chat still works unsigned.
 *
 * Surfaces stay shown and locked — this raises the sign-in modal rather than
 * hiding Code or silently starting a session.
 */

import { productHome, type Product } from '../routes.ts';
import { requestUpgrade, type UpgradeReason } from '../shell/overlay-host.tsx';

export const GUEST_CODE: UpgradeReason = {
  title: 'Sign in to use Code',
  body: 'Code sessions need a Cortex account. Chat still works unsigned.',
  benefits: [
    'This PC, Cloud and SSH sessions',
    'Review, automations and usage',
    'Connect GitHub to open pull requests',
  ],
};

/** Leftover `/bot` create is locked the same way; Bot is a separate app. */
export const GUEST_CODE_BOT: UpgradeReason = {
  title: 'Sign in for Code and Bot',
  body: 'Code and leftover Bot screens need a Cortex account. Chat still works unsigned.',
  benefits: [
    'This PC, Cloud and SSH Code sessions',
    'Bots with their own cloud computer',
    'Cloud models and usage across your team',
  ],
};

/** True when an account-gated action must not proceed. The modal is already up. */
export function guestBlocked(signedIn: boolean, reason: UpgradeReason = GUEST_CODE): boolean {
  if (signedIn) return false;
  requestUpgrade(reason);
  return true;
}

/**
 * Navigate to a product. Code and leftover Bot raise the sign-in modal; the
 * surface still opens so it is shown and locked rather than hidden.
 */
export function enterProduct(
  product: Product,
  signedIn: boolean,
  go: (path: string) => void,
): void {
  if (product === 'code' && !signedIn) {
    requestUpgrade(GUEST_CODE);
  }
  if (product === 'bot' && !signedIn) {
    requestUpgrade(GUEST_CODE_BOT);
  }
  go(productHome(product));
}
