/**
 * Which OS the window chrome belongs to.
 *
 * Read once from the preload bridge; 'browser' when there is no bridge (the
 * suites, the preview server, the parity captures), where no window chrome
 * should be drawn at all. Also stamped onto the document element so stylesheets
 * can size the title bar per platform.
 */

export type ChromePlatform = 'darwin' | 'win32' | 'linux' | 'browser';

interface WindowControlsBridge {
  minimize: () => Promise<unknown>;
  toggleMaximize: () => Promise<{ success: boolean; data?: { maximized: boolean } }>;
  close: () => Promise<unknown>;
  isMaximized: () => Promise<{ success: boolean; data?: { maximized: boolean } }>;
  onMaximizedChange: (callback: (event: { maximized: boolean }) => void) => () => void;
}

interface ChromeBridge {
  platform?: () => string;
  windowControls?: WindowControlsBridge;
}

function bridge(): ChromeBridge | undefined {
  return (globalThis as { cortex?: ChromeBridge }).cortex;
}

export function chromePlatform(): ChromePlatform {
  const raw = bridge()?.platform?.();
  if (raw === 'darwin' || raw === 'win32' || raw === 'linux') return raw;
  return 'browser';
}

export function windowControls(): WindowControlsBridge | undefined {
  return bridge()?.windowControls;
}

/** Lets CSS branch on the platform (`:root[data-platform='darwin'] …`). */
export function stampPlatform(): void {
  document.documentElement.dataset.platform = chromePlatform();
}
