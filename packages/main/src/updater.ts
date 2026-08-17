/**
 * Auto-update manager using electron-updater
 * Handles checking, downloading, and installing updates
 */

import electronUpdater from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import electronLog from 'electron-log';

const { autoUpdater } = electronUpdater;
const log = electronLog;

// Configure logger
autoUpdater.logger = log;
log.transports.file.level = 'info';

export interface UpdaterConfig {
  checkOnStart: boolean;
  checkInterval: number; // in milliseconds
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
}

const DEFAULT_CONFIG: UpdaterConfig = {
  checkOnStart: true,
  checkInterval: 4 * 60 * 60 * 1000, // 4 hours
  autoDownload: true,
  autoInstallOnAppQuit: true,
};

export class UpdateManager {
  private config: UpdaterConfig;
  private mainWindow: BrowserWindow | null = null;
  private checkIntervalId: NodeJS.Timeout | null = null;

  constructor(config: Partial<UpdaterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupAutoUpdater();
  }

  /**
   * Initialize the update manager with the main window
   */
  initialize(window: BrowserWindow): void {
    this.mainWindow = window;

    if (this.config.checkOnStart) {
      // Check for updates 3 seconds after app start
      setTimeout(() => {
        this.checkForUpdates();
      }, 3000);
    }

    // Set up periodic checks
    if (this.config.checkInterval > 0) {
      this.checkIntervalId = setInterval(() => {
        this.checkForUpdates();
      }, this.config.checkInterval);
    }
  }

  /**
   * Setup auto-updater event handlers
   */
  private setupAutoUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = this.config.autoDownload;
    autoUpdater.autoInstallOnAppQuit = this.config.autoInstallOnAppQuit;

    // When checking for updates
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
      this.sendToRenderer('update:checking');
    });

    // When update is available
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      this.sendToRenderer('update:available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes,
      });
    });

    // When no update is available
    autoUpdater.on('update-not-available', (info) => {
      log.info('Update not available. Current version:', info.version);
      this.sendToRenderer('update:not-available', {
        version: info.version,
      });
    });

    // When error occurs
    autoUpdater.on('error', (error) => {
      log.error('Error in auto-updater:', error);
      this.sendToRenderer('update:error', {
        message: error.message,
      });
    });

    // Download progress
    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      log.info(logMessage);
      
      this.sendToRenderer('update:download-progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    });

    // When update is downloaded
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      this.sendToRenderer('update:downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseName: info.releaseName,
      });

      // Show notification to user
      this.notifyUpdateDownloaded(info.version);
    });
  }

  /**
   * Manually check for updates
   */
  async checkForUpdates(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      log.info('Skipping update check in development mode');
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error('Failed to check for updates:', error);
    }
  }

  /**
   * Download update manually
   */
  async downloadUpdate(): Promise<void> {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      log.error('Failed to download update:', error);
      throw error;
    }
  }

  /**
   * Install update and restart app
   */
  quitAndInstall(): void {
    // setImmediate ensures the app quits after the event loop finishes
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
  }

  /**
   * Show native dialog for update downloaded
   */
  private notifyUpdateDownloaded(version: string): void {
    if (!this.mainWindow) return;

    dialog
      .showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${version}) has been downloaded.`,
        detail: 'The update will be installed when you quit and restart the application.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 1,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          this.quitAndInstall();
        }
      });
  }

  /**
   * Send update event to renderer process
   */
  private sendToRenderer(channel: string, data?: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    this.mainWindow = null;
  }
}

// Export singleton instance
export const updateManager = new UpdateManager();
