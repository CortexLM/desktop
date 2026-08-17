import { BrowserWindow } from 'electron';

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();

  createMainWindow(): BrowserWindow {
    const window = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 600,
      backgroundColor: '#1a1a1a',
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    this.windows.set('main', window);

    window.on('closed', () => {
      this.windows.delete('main');
    });

    return window;
  }

  getMainWindow(): BrowserWindow | undefined {
    return this.windows.get('main');
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }

  closeAll(): void {
    this.windows.forEach(window => window.close());
    this.windows.clear();
  }
}
