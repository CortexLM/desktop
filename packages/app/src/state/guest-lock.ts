/**
 * Cloud / SSH / leftover Bot create need an account. This PC Code and Chat
 * still work unsigned.
 *
 * Surfaces stay shown and locked — this raises the sign-in modal rather than
 * hiding the product or silently starting a Cloud session.
 */

import { productHome, type Product } from '../routes.ts';
import { requestUpgrade, type UpgradeReason } from '../shell/overlay-host.tsx';

export const GUEST_CODE_BOT: UpgradeReason = {
  title: 'Sign in for Cloud, SSH, and Bot',
  body: 'This PC Code sessions still work unsigned. Cloud, SSH and leftover Bot screens need a Cortex account.',
  benefits: [
    'Cloud and SSH Code sessions',
    'Bots with their own cloud computer',
    'Cloud models and usage across your team',
  ],
};

/** True when an account-gated action must not proceed. The modal is already up. */
export function guestBlocked(signedIn: boolean): boolean {
  if (signedIn) return false;
  requestUpgrade(GUEST_CODE_BOT);
  return true;
}

/**
 * Navigate to a product. Code Home stays usable unsigned (This PC). Leftover
 * `/bot` routes stay shown; creating a Bot is locked separately.
 */
export function enterProduct(
  product: Product,
  signedIn: boolean,
  go: (path: string) => void,
): void {
  if (product === 'bot' && !signedIn) {
    requestUpgrade(GUEST_CODE_BOT);
  }
  go(productHome(product));
}
