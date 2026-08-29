import { afterEach, describe, expect, it, vi } from 'vitest';

import { detachedUpdateHost, hasUpdateBridge, resolveUpdateHost } from '../update-host.ts';

type Listener<T> = (event: T) => void;

function installBridge() {
  const available: Listener<{ version: string }>[] = [];
  const progress: Listener<{ percent: number }>[] = [];
  const downloaded: Listener<{ version: string }>[] = [];

  const update = {
    check: vi.fn(async () => ({ success: true })),
    download: vi.fn(async () => ({ success: true })),
    install: vi.fn(async () => ({ success: true })),
    onAvailable: vi.fn((callback: Listener<{ version: string }>) => {
      available.push(callback);
      return () => {};
    }),
    onDownloadProgress: vi.fn((callback: Listener<{ percent: number }>) => {
      progress.push(callback);
      return () => {};
    }),
    onDownloaded: vi.fn((callback: Listener<{ version: string }>) => {
      downloaded.push(callback);
      return () => {};
    }),
  };

  (globalThis as { cortex?: unknown }).cortex = { update };
  return { update, available, progress, downloaded };
}

afterEach(() => {
  delete (globalThis as { cortex?: unknown }).cortex;
});

describe('detecting the update bridge', () => {
  it('is absent in the browser and the suites', () => {
    expect(hasUpdateBridge()).toBe(false);
    expect(resolveUpdateHost().available).toBe(false);
  });

  it('finds the preload façade when Electron installed it', () => {
    installBridge();
    expect(hasUpdateBridge()).toBe(true);
    expect(resolveUpdateHost().available).toBe(true);
  });
});

describe('detachedUpdateHost', () => {
  it('refuses to pretend a web build can auto-update', async () => {
    const host = detachedUpdateHost();

    expect(host.available).toBe(false);
    await expect(host.check()).resolves.toEqual({
      success: false,
      error: 'Updates are only available in the desktop app',
    });
    await expect(host.install()).resolves.toMatchObject({ success: false });
    expect(host.onDownloaded(() => {})).toEqual(expect.any(Function));
  });
});

describe('electron update host', () => {
  it('forwards check, download, install, and events', async () => {
    const { update, downloaded } = installBridge();
    const host = resolveUpdateHost();
    const seen: string[] = [];

    host.onDownloaded((info) => seen.push(info.version));
    downloaded[0]?.({ version: '1.4.0' });

    await expect(host.check()).resolves.toEqual({ success: true });
    await expect(host.download()).resolves.toEqual({ success: true });
    await expect(host.install()).resolves.toEqual({ success: true });
    expect(update.install).toHaveBeenCalled();
    expect(seen).toEqual(['1.4.0']);
  });
});
