/**
 * The renderer's view of desktop auto-update.
 *
 * Main owns electron-updater and the feed. This module is the seam: the toast
 * depends on `UpdateHost`, not on `window.cortex`, so the suites can drive it
 * and the web preview — which has no preload — cannot pretend a download is
 * happening.
 */

export interface AppUpdateInfo {
  version: string;
  releaseDate?: string;
  releaseName?: string;
}

export interface AppUpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export interface UpdateActionResult {
  success: boolean;
  error?: string;
}

export interface UpdateHost {
  /** False in the browser: no feed, no toast, no "check for updates". */
  available: boolean;
  check(): Promise<UpdateActionResult>;
  download(): Promise<UpdateActionResult>;
  install(): Promise<UpdateActionResult>;
  onAvailable(listener: (info: AppUpdateInfo) => void): () => void;
  onDownloadProgress(listener: (progress: AppUpdateProgress) => void): () => void;
  onDownloaded(listener: (info: AppUpdateInfo) => void): () => void;
}

interface UpdateBridge {
  check: () => Promise<UpdateActionResult>;
  download: () => Promise<UpdateActionResult>;
  install: () => Promise<{ success: boolean }>;
  onAvailable: (callback: (info: AppUpdateInfo) => void) => () => void;
  onDownloadProgress: (callback: (progress: AppUpdateProgress) => void) => () => void;
  onDownloaded: (callback: (info: AppUpdateInfo) => void) => () => void;
}

function bridge(): UpdateBridge | undefined {
  return (globalThis as { cortex?: { update?: UpdateBridge } }).cortex?.update;
}

export function hasUpdateBridge(): boolean {
  return bridge() !== undefined;
}

function electronUpdateHost(api: UpdateBridge): UpdateHost {
  return {
    available: true,
    check: () => api.check(),
    download: () => api.download(),
    install: async () => api.install(),
    onAvailable: (listener) => api.onAvailable(listener),
    onDownloadProgress: (listener) => api.onDownloadProgress(listener),
    onDownloaded: (listener) => api.onDownloaded(listener),
  };
}

const WEB_UPDATE_ERROR = 'Updates are only available in the desktop app';

export function detachedUpdateHost(): UpdateHost {
  return {
    available: false,
    check: async () => ({ success: false, error: WEB_UPDATE_ERROR }),
    download: async () => ({ success: false, error: WEB_UPDATE_ERROR }),
    install: async () => ({ success: false, error: WEB_UPDATE_ERROR }),
    onAvailable: () => () => {},
    onDownloadProgress: () => () => {},
    onDownloaded: () => () => {},
  };
}

export function resolveUpdateHost(): UpdateHost {
  const api = bridge();
  return api ? electronUpdateHost(api) : detachedUpdateHost();
}
