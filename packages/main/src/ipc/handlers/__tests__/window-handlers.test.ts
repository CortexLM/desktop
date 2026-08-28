import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserWindowMock, registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';
import { registerWindowHandlers, unregisterWindowHandlers } from '../window-handlers';

const CHANNELS = [
  'window:minimize',
  'window:toggle-maximize',
  'window:close',
  'window:is-maximized',
] as const;

function fakeWindow(maximized = false) {
  return {
    minimize: vi.fn(),
    maximize: vi.fn(),
    unmaximize: vi.fn(),
    close: vi.fn(),
    isMaximized: vi.fn(() => maximized),
  };
}

async function invoke(channel: string) {
  const handler = registeredHandlers.get(channel);
  if (!handler) throw new Error(`no handler for ${channel}`);
  return handler({ sender: {} }, undefined);
}

beforeEach(() => {
  resetElectronMock();
  registerWindowHandlers();
});

afterEach(() => {
  unregisterWindowHandlers();
  vi.clearAllMocks();
});

describe('window handlers', () => {
  it('registers and unregisters the four channels', () => {
    for (const channel of CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(true);
    }
    unregisterWindowHandlers();
    for (const channel of CHANNELS) {
      expect(registeredHandlers.has(channel)).toBe(false);
    }
    registerWindowHandlers();
  });

  it('minimizes and closes the sender window', async () => {
    const window = fakeWindow();
    BrowserWindowMock.fromWebContents.mockReturnValue(window as never);
    await expect(invoke('window:minimize')).resolves.toEqual({
      success: true,
      data: { minimized: true },
    });
    expect(window.minimize).toHaveBeenCalled();
    await expect(invoke('window:close')).resolves.toEqual({
      success: true,
      data: { closed: true },
    });
    expect(window.close).toHaveBeenCalled();
  });

  it('toggles maximize and reports the current state', async () => {
    const window = fakeWindow(false);
    BrowserWindowMock.fromWebContents.mockReturnValue(window as never);
    await invoke('window:toggle-maximize');
    expect(window.maximize).toHaveBeenCalled();

    const maxed = fakeWindow(true);
    BrowserWindowMock.fromWebContents.mockReturnValue(maxed as never);
    await invoke('window:toggle-maximize');
    expect(maxed.unmaximize).toHaveBeenCalled();

    await expect(invoke('window:is-maximized')).resolves.toEqual({
      success: true,
      data: { maximized: true },
    });
  });

  it('does not throw when the sender has no window', async () => {
    BrowserWindowMock.fromWebContents.mockReturnValue(null);
    await expect(invoke('window:toggle-maximize')).resolves.toEqual({
      success: true,
      data: { maximized: false },
    });
    await expect(invoke('window:is-maximized')).resolves.toEqual({
      success: true,
      data: { maximized: false },
    });
    await expect(invoke('window:minimize')).resolves.toMatchObject({ success: true });
  });
});
