/**
 * Code and Bot need an account. Chat still works unsigned.
 *
 * Surfaces stay shown and locked — this raises the sign-in modal rather than
 * hiding the product or silently starting a Cloud session.
 */

import { productHome, type Product } from '../routes.ts';
import { requestUpgrade, type UpgradeReason } from '../shell/overlay-host.tsx';

export const GUEST_CODE_BOT: UpgradeReason = {
  title: 'Sign in to use Cortex Code and Cortex Bot',
  body: 'Code and Bot need a Cortex account. Chat still works unsigned — pick a provider in Settings and start a conversation.',
  benefits: [
    'This PC, Cloud and SSH Code sessions',
    'Bots with their own computer',
    'Cloud models and usage across your team',
  ],
};

/** True when the action must not proceed. The modal is already up. */
export function guestBlocked(signedIn: boolean): boolean {
  if (signedIn) return false;
  requestUpgrade(GUEST_CODE_BOT);
  return true;
}

/** Navigate to a product; lock Code/Bot for guests without hiding the surface. */
export function enterProduct(
  product: Product,
  signedIn: boolean,
  go: (path: string) => void,
): void {
  if ((product === 'code' || product === 'bot') && !signedIn) {
    requestUpgrade(GUEST_CODE_BOT);
  }
  go(productHome(product));
}
