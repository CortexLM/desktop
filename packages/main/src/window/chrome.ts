/**
 * The window chrome, per platform.
 *
 * The app draws its own title bar — the native frame carries a File/Edit menu
 * strip and a system-styled bar that fights the design — but "no native frame"
 * means something different on every OS:
 *
 *   macOS    `hiddenInset`: the traffic lights stay (users aim at them by
 *            reflex; redrawing them reads as a knock-off) and sit inside the
 *            app's own bar. The application menu MUST remain: ⌘C/⌘V/⌘Q are
 *            menu accelerators on macOS, so a menu-less app breaks the
 *            clipboard. It lives in the system bar, never in the window.
 *   Windows  `titleBarStyle: 'hidden'` keeps the native resize borders and
 *            snap behaviour while the renderer draws the controls.
 *   Linux    there is no hidden-title-bar mode; `frame: false` removes the
 *            whole frame and the renderer draws the controls.
 *
 * The renderer learns the platform from the preload bridge and sizes its bar
 * accordingly (`data-platform` on the document element).
 */

import { Menu } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';

/** Options merged into the BrowserWindow for the current platform. */
export function windowChromeOptions(
  platform: NodeJS.Platform = process.platform,
): BrowserWindowConstructorOptions {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      // Vertically centred in the 38px bar the renderer draws.
      trafficLightPosition: { x: 16, y: 12 },
    };
  }

  if (platform === 'win32') {
    return { titleBarStyle: 'hidden' };
  }

  return { frame: false };
}

/**
 * Installs the application menu policy.
 *
 * Windows and Linux drop the menu entirely — that is the strip the custom bar
 * exists to remove, and Chromium handles the clipboard shortcuts natively
 * there. macOS keeps a minimal system-bar menu because its accelerators are
 * the keyboard shortcuts.
 */
export function installAppMenu(platform: NodeJS.Platform = process.platform): void {
  if (platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ]),
  );
}
