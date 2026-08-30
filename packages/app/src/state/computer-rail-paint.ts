/**
 * Computer rail paint for the Bot workbench.
 *
 * Screenshot and stream are module-global. The rail only shows them when the
 * route mascot id owns both the live attachment and the mascot object on
 * screen. A stale teammate object must not paint another computer.
 */

import { screenshotSrc, shotFor } from './bot-computer-live.ts';
import { streamUrlFor } from './vnc-ticket.ts';

export function liveRailPaint(
  routeMascotId: string | undefined,
  mascot: { id: string } | undefined,
): { screenshotUrl: string | undefined; streamUrl: string | undefined } {
  if (!routeMascotId) {
    return { screenshotUrl: undefined, streamUrl: undefined };
  }
  if (mascot && mascot.id !== routeMascotId) {
    return { screenshotUrl: undefined, streamUrl: undefined };
  }
  return {
    screenshotUrl: screenshotSrc(shotFor(routeMascotId)),
    streamUrl: streamUrlFor(routeMascotId),
  };
}
