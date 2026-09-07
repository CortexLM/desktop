import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrowserWindow } from 'electron';

import { DEFAULT_UPDATE_FEED_URL, STAGING_UPDATE_FEED_URL } from '../update-policy';
import { UpdateManager, type AutoUpdaterPort, type UpdateLogger } from '../updater';

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    transports: { file: { level: 'info' } },
  },
}));

vi.mock('electron-updater', () => ({
  default: {
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      on: vi.fn(),
      removeListener: vi.fn(),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstall: vi.fn(),
      setFeedURL: vi.fn(),
    },
  },
}));

class FakeUpdater extends EventEmitter implements AutoUpdaterPort {
  autoDownload = false;
  autoInstallOnAppQuit = false;
  logger: unknown;
  forceDevUpdateConfig = false;
  checkForUpdates = vi.fn(async () => undefined);
  downloadUpdate = vi.fn(async () => undefined);
  quitAndInstall = vi.fn();
  setFeedURL = vi.fn();
}

function fakeWindow() {
  const send = vi.fn();
  const window = {
    isDestroyed: () => false,
    webContents: { send },
  } as unknown as BrowserWindow;
  return { window, send };
}

function testLog(): UpdateLogger {
  return { info: vi.fn(), error: vi.fn() };
}

function deferredScheduler() {
  const delayed: Array<() => void> = [];
  return {
    scheduler: {
      delay: (fn: () => void) => {
        delayed.push(fn);
        return { clear: vi.fn() };
      },
      interval: () => ({ clear: vi.fn() }),
    },
    flush: () => {
      for (const fn of delayed.splice(0)) fn();
    },
  };
}

describe('UpdateManager', () => {
  let updater: FakeUpdater;
  let log: UpdateLogger;

  beforeEach(() => {
    updater = new FakeUpdater();
    log = testLog();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([DEFAULT_UPDATE_FEED_URL, STAGING_UPDATE_FEED_URL])('preserves the packaged feed %s', async (url) => {
    let effectiveFeed = url;
    updater.setFeedURL.mockImplementation((options) => { effectiveFeed = options.url; });
    const manager = new UpdateManager(
      { checkOnStart: false, checkInterval: 0 },
      { autoUpdater: updater, log, isPackaged: () => true, env: {} },
    );
    const { window } = fakeWindow();

    manager.initialize(window);

    await manager.checkForUpdates();
    expect(updater.setFeedURL).not.toHaveBeenCalled();
    expect(effectiveFeed).toBe(url);
    expect(updater.checkForUpdates).toHaveBeenCalledOnce();
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
  });

  it('honours a local feed override without changing the production channel', () => {
    const manager = new UpdateManager(
      {},
      {
        autoUpdater: updater,
        log,
        isPackaged: () => true,
        feedUrl: 'http://127.0.0.1:4780/',
        env: { CORTEX_FORCE_UPDATE_CHECK: '1' },
      },
    );

    manager.initialize(fakeWindow().window);

    expect(updater.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'http://127.0.0.1:4780/',
    });
    expect(updater.forceDevUpdateConfig).toBe(true);
  });

  it('skips the feed in development and when unpackaged', async () => {
    const unpackaged = new UpdateManager(
      { checkOnStart: false, checkInterval: 0 },
      { autoUpdater: updater, log, isPackaged: () => false, env: { NODE_ENV: 'production' } },
    );
    await unpackaged.checkForUpdates();

    const development = new UpdateManager(
      { checkOnStart: false, checkInterval: 0 },
      { autoUpdater: updater, log, isPackaged: () => true, env: { NODE_ENV: 'development' } },
    );
    await development.checkForUpdates();

    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it.each(['not a URL', 'http://example.com/'])('disables an invalid override without blocking startup: %s', async (url) => {
    const manager = new UpdateManager(
      { checkOnStart: false, checkInterval: 0 },
      { autoUpdater: updater, log, isPackaged: () => true, env: { CORTEX_UPDATE_FEED_URL: url } },
    );
    manager.initialize(fakeWindow().window);
    await manager.checkForUpdates();
    await expect(manager.downloadUpdate()).rejects.toThrow('Update configuration is unavailable.');
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    expect(updater.setFeedURL).not.toHaveBeenCalled();
    expect(updater.logger).toBeNull();
  });

  it('checks the feed when packaged, and when a test feed is forced', async () => {
    const packaged = new UpdateManager(
      { checkOnStart: false, checkInterval: 0 },
      { autoUpdater: updater, log, isPackaged: () => true, env: { NODE_ENV: 'production' } },
    );
    await packaged.checkForUpdates();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);

    const forced = new UpdateManager(
      { checkOnStart: false, checkInterval: 0 },
      {
        autoUpdater: updater,
        log,
        isPackaged: () => false,
        env: { NODE_ENV: 'development', CORTEX_FORCE_UPDATE_CHECK: '1' },
      },
    );
    await forced.checkForUpdates();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('schedules a check after start', async () => {
    const { scheduler, flush } = deferredScheduler();
    const manager = new UpdateManager(
      { checkInterval: 0 },
      {
        autoUpdater: updater,
        log,
        isPackaged: () => true,
        env: { NODE_ENV: 'production' },
        scheduler,
      },
    );

    manager.initialize(fakeWindow().window);
    expect(updater.checkForUpdates).not.toHaveBeenCalled();

    flush();
    await Promise.resolve();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('swallows a feed error so startup is not blocked', async () => {
    updater.checkForUpdates.mockRejectedValueOnce(new Error('ENOTFOUND'));
    const manager = new UpdateManager(
      { checkOnStart: false, checkInterval: 0 },
      { autoUpdater: updater, log, isPackaged: () => true, env: { NODE_ENV: 'production' } },
    );

    await expect(manager.checkForUpdates()).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalled();
  });

  it('forwards download progress and a ready update to the renderer', () => {
    const manager = new UpdateManager({ checkOnStart: false, checkInterval: 0 }, { autoUpdater: updater, log });
    const { window, send } = fakeWindow();
    manager.initialize(window);

    updater.emit('checking-for-update');
    updater.emit('update-available', {
      version: '1.2.3',
      releaseDate: '2026-08-28',
      releaseName: '1.2.3',
    });
    updater.emit('download-progress', {
      percent: 41.6,
      transferred: 416,
      total: 1000,
      bytesPerSecond: 50,
    });
    updater.emit('update-downloaded', { version: '1.2.3', releaseDate: '2026-08-28' });

    expect(send).toHaveBeenCalledWith('update:checking');
    expect(send).toHaveBeenCalledWith('update:available', expect.objectContaining({ version: '1.2.3' }));
    expect(send).toHaveBeenCalledWith('update:download-progress', {
      percent: 42,
      transferred: 416,
      total: 1000,
      bytesPerSecond: 50,
    });
    expect(send).toHaveBeenCalledWith(
      'update:downloaded',
      expect.objectContaining({ version: '1.2.3' }),
    );
  });

  it('forwards not-available and error events', () => {
    const manager = new UpdateManager({ checkOnStart: false, checkInterval: 0 }, { autoUpdater: updater, log });
    const { window, send } = fakeWindow();
    manager.initialize(window);

    updater.emit('update-not-available', { version: '0.1.0' });
    updater.emit('error', new Error('https://example.com/?credential=test-secret sha512 mismatch'));

    expect(send).toHaveBeenCalledWith('update:not-available', { version: '0.1.0' });
    expect(send).toHaveBeenCalledWith('update:error', {
      message: 'Cortex could not check or download an update. Try again in a few minutes.',
    });
    expect(JSON.stringify(send.mock.calls)).not.toContain('test-secret');
    expect(JSON.stringify((log.error as ReturnType<typeof vi.fn>).mock.calls)).not.toContain('test-secret');
  });

  it('does not send to a destroyed window', () => {
    const send = vi.fn();
    const window = {
      isDestroyed: () => true,
      webContents: { send },
    } as unknown as BrowserWindow;
    const manager = new UpdateManager({ checkOnStart: false, checkInterval: 0 }, { autoUpdater: updater, log });
    manager.initialize(window);

    updater.emit('update-downloaded', { version: '1.2.3' });
    expect(send).not.toHaveBeenCalled();
  });

  it('rethrows a failed manual download', async () => {
    updater.downloadUpdate.mockRejectedValueOnce(new Error('disk full'));
    const manager = new UpdateManager({ checkOnStart: false, checkInterval: 0 }, { autoUpdater: updater, log });

    await expect(manager.downloadUpdate()).rejects.toThrow('Cortex could not download the update.');
  });

  it('installs the downloaded update on the next turn', async () => {
    const manager = new UpdateManager({ checkOnStart: false, checkInterval: 0 }, { autoUpdater: updater, log });

    manager.quitAndInstall();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    expect(updater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('clears timers and listeners on destroy', () => {
    const clearDelay = vi.fn();
    const clearInterval = vi.fn();
    const manager = new UpdateManager(
      {},
      {
        autoUpdater: updater,
        log,
        isPackaged: () => true,
        scheduler: {
          delay: () => ({ clear: clearDelay }),
          interval: () => ({ clear: clearInterval }),
        },
      },
    );
    const { window, send } = fakeWindow();
    manager.initialize(window);
    manager.destroy();

    expect(clearDelay).toHaveBeenCalled();
    expect(clearInterval).toHaveBeenCalled();

    updater.emit('update-downloaded', { version: '9.9.9' });
    expect(send).not.toHaveBeenCalled();
  });
});
