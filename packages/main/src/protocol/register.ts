/**
 * Registers `cortex://` as the desktop app protocol and delivers auth
 * callbacks to the account service.
 *
 * macOS delivers the URL on `open-url`. Windows and Linux deliver it as an
 * argv entry on a second instance. First-launch argv is checked once the
 * window exists so a cold start from a bridge click still completes sign-in.
 *
 * The renderer never sees the URL. Main parses it and stores the session.
 */

import { app, BrowserWindow } from 'electron';
import path from 'node:path';

import { IPC_CHANNELS } from '@cortex-ide/shared';

import { getCortexAccountService } from '../services/cortex-account-service';
import { authCallbackFromArgv, isAuthCallbackUrl, PROTOCOL_SCHEME } from './callback';

export { PROTOCOL_SCHEME };

/**
 * Claims the `cortex` scheme for this process.
 *
 * In a unpackaged `electron .` launch the executable is Electron itself, so
 * the script path has to be passed through or the OS would reopen a bare
 * Electron window.
 */
export function registerProtocolClient(
  electronApp: Pick<Electron.App, 'setAsDefaultProtocolClient'> = app,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (typeof electronApp.setAsDefaultProtocolClient !== 'function') return false;

  if (process.defaultApp && process.argv.length >= 2 && process.argv[1]) {
    return electronApp.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }

  void platform;
  return electronApp.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

/**
 * Single-instance lock so a second launch on Windows/Linux forwards its argv
 * instead of opening another window. Missing on the test mock — treat as locked.
 */
export function acquireInstanceLock(
  electronApp: Pick<Electron.App, 'requestSingleInstanceLock' | 'quit'> = app,
): boolean {
  if (typeof electronApp.requestSingleInstanceLock !== 'function') return true;
  const gotLock = electronApp.requestSingleInstanceLock();
  if (!gotLock) electronApp.quit();
  return gotLock;
}

export interface ProtocolRuntime {
  getMainWindow: () => BrowserWindow | null;
  focusWindow: (window: BrowserWindow) => void;
}

/**
 * Listens for `open-url` / `second-instance` and completes a pending sign-in.
 */
export function listenForAuthCallbacks(runtime: ProtocolRuntime): () => void {
  const onOpenUrl = (event: { preventDefault: () => void }, url: string) => {
    event.preventDefault();
    void handleIncomingUrl(url, runtime);
  };

  const onSecondInstance = (_event: unknown, argv: string[]) => {
    const url = authCallbackFromArgv(argv);
    if (url) void handleIncomingUrl(url, runtime);
    const window = runtime.getMainWindow();
    if (window) runtime.focusWindow(window);
  };

  app.on('open-url', onOpenUrl);
  app.on('second-instance', onSecondInstance);

  return () => {
    app.removeListener('open-url', onOpenUrl);
    app.removeListener('second-instance', onSecondInstance);
  };
}

/** First-launch argv on Windows/Linux, where there is no `open-url`. */
export function consumeLaunchArgv(argv: readonly string[], runtime: ProtocolRuntime): void {
  const url = authCallbackFromArgv(argv);
  if (url) void handleIncomingUrl(url, runtime);
}

export async function handleIncomingUrl(url: string, runtime: ProtocolRuntime): Promise<void> {
  if (!isAuthCallbackUrl(url)) return;

  const window = runtime.getMainWindow();
  if (window) runtime.focusWindow(window);

  const service = getCortexAccountService();
  try {
    const state = await service.completeAuthCallback(url);
    broadcastAuth(state.user !== null, undefined, window);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sign-in did not complete.';
    broadcastAuth(false, message, window);
  }
}

export function focusMainWindow(window: BrowserWindow): void {
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function broadcastAuth(ok: boolean, message: string | undefined, window: BrowserWindow | null): void {
  const payload = message ? { ok, message } : { ok };
  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.EVENT_CORTEX_AUTH_COMPLETE, payload);
  }
}
