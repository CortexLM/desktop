/**
 * Auto-update manager using electron-updater against the production feed.
 *
 * Checks and downloads happen in main. The renderer is told on
 * `update:*` so it can show a restart toast — a log line is not enough.
 */

import { app, type BrowserWindow } from 'electron';
import electronLog from 'electron-log';
import electronUpdater from 'electron-updater';

import { resolveUpdateFeedUrl, shouldCheckForUpdates } from './update-policy';

export interface UpdaterConfig {
  checkOnStart: boolean;
  checkInterval: number;
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
}

export interface AutoUpdaterPort {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  logger?: unknown;
  forceDevUpdateConfig?: boolean;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener?(event: string, listener: (...args: unknown[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  setFeedURL?(options: { provider: 'generic'; url: string }): void;
}

export interface UpdateLogger {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  transports?: { file: { level: string } };
}

export interface UpdateScheduler {
  delay: (fn: () => void, ms: number) => { clear: () => void };
  interval: (fn: () => void, ms: number) => { clear: () => void };
}

export interface UpdateManagerDeps {
  autoUpdater?: AutoUpdaterPort;
  log?: UpdateLogger;
  isPackaged?: () => boolean;
  feedUrl?: string;
  env?: Record<string, string | undefined>;
  scheduler?: UpdateScheduler;
}

const DEFAULT_CONFIG: UpdaterConfig = {
  checkOnStart: true,
  checkInterval: 4 * 60 * 60 * 1000,
  autoDownload: true,
  autoInstallOnAppQuit: true,
};

const defaultScheduler: UpdateScheduler = {
  delay: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return { clear: () => clearTimeout(id) };
  },
  interval: (fn, ms) => {
    const id = setInterval(fn, ms);
    return { clear: () => clearInterval(id) };
  },
};

function defaultLogger(): UpdateLogger {
  const log = electronLog as UpdateLogger;
  if (log.transports?.file) log.transports.file.level = 'info';
  return log;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' ? value : 0;
}

export class UpdateManager {
  private readonly config: UpdaterConfig;
  private readonly autoUpdater: AutoUpdaterPort;
  private readonly log: UpdateLogger;
  private readonly isPackaged: () => boolean;
  private readonly feedUrl: string | undefined;
  private readonly env: Record<string, string | undefined>;
  private readonly scheduler: UpdateScheduler;
  private readonly subscriptions: Array<() => void> = [];
  private mainWindow: BrowserWindow | null = null;
  private startDelay: { clear: () => void } | null = null;
  private checkInterval: { clear: () => void } | null = null;

  constructor(config: Partial<UpdaterConfig> = {}, deps: UpdateManagerDeps = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.autoUpdater = deps.autoUpdater ?? electronUpdater.autoUpdater;
    this.log = deps.log ?? defaultLogger();
    this.isPackaged = deps.isPackaged ?? (() => app.isPackaged);
    this.feedUrl = deps.feedUrl ?? resolveUpdateFeedUrl(deps.env);
    this.env = deps.env ?? process.env;
    this.scheduler = deps.scheduler ?? defaultScheduler;
    this.setupAutoUpdater();
  }

  initialize(window: BrowserWindow): void {
    this.mainWindow = window;
    this.applyFeedUrl();

    if (this.config.checkOnStart) {
      this.startDelay = this.scheduler.delay(() => {
        void this.checkForUpdates();
      }, 3000);
    }

    if (this.config.checkInterval > 0) {
      this.checkInterval = this.scheduler.interval(() => {
        void this.checkForUpdates();
      }, this.config.checkInterval);
    }
  }

  private setupAutoUpdater(): void {
    this.autoUpdater.autoDownload = this.config.autoDownload;
    this.autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit;
    this.autoUpdater.logger = this.log;
    this.listen('checking-for-update', () => this.onChecking());
    this.listen('update-available', (info) => this.onAvailable(info));
    this.listen('update-not-available', (info) => this.onNotAvailable(info));
    this.listen('error', (error) => this.onError(error));
    this.listen('download-progress', (progress) => this.onProgress(progress));
    this.listen('update-downloaded', (info) => this.onDownloaded(info));
  }

  private listen(event: string, handler: (...args: unknown[]) => void): void {
    this.autoUpdater.on(event, handler);
    this.subscriptions.push(() => {
      this.autoUpdater.removeListener?.(event, handler);
    });
  }

  private applyFeedUrl(): void {
    if (this.feedUrl) {
      this.autoUpdater.setFeedURL?.({ provider: 'generic', url: this.feedUrl });
    }
    if (this.env.CORTEX_FORCE_UPDATE_CHECK === '1') {
      this.autoUpdater.forceDevUpdateConfig = true;
    }
    this.log.info('Update feed:', this.feedUrl ?? 'packaged configuration');
  }

  private onChecking(): void {
    this.log.info('Checking for updates...');
    this.sendToRenderer('update:checking');
  }

  private onAvailable(info: unknown): void {
    const payload = this.updatePayload(info);
    this.log.info('Update available:', payload.version);
    this.sendToRenderer('update:available', payload);
  }

  private onNotAvailable(info: unknown): void {
    const payload = this.updatePayload(info);
    this.log.info('Update not available. Current version:', payload.version);
    this.sendToRenderer('update:not-available', { version: payload.version });
  }

  private onError(error: unknown): void {
    const message = 'Cortex could not check or download an update. Try again in a few minutes.';
    this.log.error('Error in auto-updater:', error instanceof Error ? error.name : typeof error);
    this.sendToRenderer('update:error', { message });
  }

  private onProgress(progress: unknown): void {
    const record = asRecord(progress);
    const payload = {
      percent: Math.round(readNumber(record, 'percent')),
      transferred: readNumber(record, 'transferred'),
      total: readNumber(record, 'total'),
      bytesPerSecond: readNumber(record, 'bytesPerSecond'),
    };
    this.log.info(`Downloaded ${payload.percent}%`);
    this.sendToRenderer('update:download-progress', payload);
  }

  private onDownloaded(info: unknown): void {
    const payload = this.updatePayload(info);
    this.log.info('Update downloaded:', payload.version);
    this.sendToRenderer('update:downloaded', payload);
  }

  private updatePayload(info: unknown): {
    version: string;
    releaseDate?: string;
    releaseName?: string;
    releaseNotes?: unknown;
  } {
    const record = asRecord(info);
    return {
      version: readString(record, 'version') ?? 'unknown',
      releaseDate: readString(record, 'releaseDate'),
      releaseName: readString(record, 'releaseName'),
      releaseNotes: record.releaseNotes,
    };
  }

  async checkForUpdates(): Promise<void> {
    if (!shouldCheckForUpdates(this.env, this.isPackaged())) {
      this.log.info('Skipping update check (unpackaged or development)');
      return;
    }

    try {
      await this.autoUpdater.checkForUpdates();
    } catch (error) {
      this.log.error('Failed to check for updates:', error);
    }
  }

  async downloadUpdate(): Promise<void> {
    try {
      await this.autoUpdater.downloadUpdate();
    } catch (error) {
      this.log.error('Failed to download update:', error);
      throw error;
    }
  }

  quitAndInstall(): void {
    setImmediate(() => {
      this.autoUpdater.quitAndInstall(false, true);
    });
  }

  private sendToRenderer(channel: string, data?: unknown): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
    if (data === undefined) {
      this.mainWindow.webContents.send(channel);
      return;
    }
    this.mainWindow.webContents.send(channel, data);
  }

  destroy(): void {
    this.startDelay?.clear();
    this.checkInterval?.clear();
    this.startDelay = null;
    this.checkInterval = null;
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions.length = 0;
    this.mainWindow = null;
  }
}

export const updateManager = new UpdateManager();
