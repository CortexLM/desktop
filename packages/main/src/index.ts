import { app, BrowserWindow } from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { registerIPCHandlers, unregisterIPCHandlers } from './ipc/handlers/index';
import { startMCPEvents, stopMCPEvents } from './ipc/handlers/mcp-handlers';
import { updateManager } from './updater';
import { automationService } from './services/automation-service';
import { getCortexAccountService } from './services/cortex-account-service';
import { getDatabaseService } from './services/database-service';
import { debugService } from './services/debug-service';
import { ipcMonitor } from './services/ipc-monitor';
import { initializePerformance, cleanupPerformance } from './performance';
import { initializeSecurity } from './security';

// NOTE: must stay as bare `fileURLToPath(import.meta.url)`.
// Vite's asset pipeline rewrites the `new URL('<relative>', import.meta.url)`
// pattern into an inlined base64 `data:` URI at build time, which makes
// fileURLToPath throw ERR_INVALID_URL_SCHEME and kills the main process
// before app.whenReady() runs (no window is ever created).
const __dirname = dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

// Enable V8 code caching and GC exposure
app.commandLine.appendSwitch('js-flags', '--expose-gc');

function createWindow() {
  mainWindow = new BrowserWindow({
    // 1440x900 is the viewport every Paper artboard is drawn at, so the window
    // opens showing the layout as designed rather than a reflowed approximation.
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    // The design's light background. This colour is only visible for the frame or
    // two before the renderer paints, which is exactly why it matters: #0D0D0E
    // flashed near-black before a light UI. Light is the default theme, and a
    // renderer that resolves to dark repaints within the same frame.
    backgroundColor: '#FCFCFC',
    titleBarStyle: 'hiddenInset',
    // Matches where the artboards draw the traffic lights, so the sidebar's
    // reserved chrome row lines up with the real window buttons.
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      // Must match the preload build output. Vite emits CommonJS as `.cjs`
      // (see packages/preload/vite.config.ts + its package.json "main"), and a
      // sandboxed preload has to be CommonJS. Pointing at `.js` silently loads
      // nothing: `window.cortex` stays undefined and the renderer crashes into
      // its error boundary instead of rendering the workbench.
      preload: join(__dirname, '../../preload/dist/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Performance optimizations
      backgroundThrottling: false,
      v8CacheOptions: 'code'
    }
  });

  // Load the renderer: `packages/app`, the SolidJS UI built against the Paper
  // design. (The React renderer it replaced has been deleted.)
  //
  // The renderer routes on the URL hash, which is what makes this work at all: a
  // path like /sign-in/device is not a resolvable file, so a history router would
  // 404 on every route but the root under file:// — on first load and on reload.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../../app/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Setup automation service event forwarding to renderer
 */
function setupAutomationEvents() {
  // Forward automation events to renderer
  automationService.on('automation:started', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('event:automation-started', data);
    }
  });

  automationService.on('automation:completed', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('event:automation-completed', data);
    }
  });

  automationService.on('automation:failed', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('event:automation-failed', data);
    }
  });

  automationService.on('notification', (data) => {
    if (mainWindow) {
      mainWindow.webContents.send('event:notification', data);
    }
  });
}

/**
 * Runs a startup step without letting its failure abort the boot sequence.
 *
 * A broken service must degrade that feature only — it must never prevent the
 * window from opening. Failures are collected and pushed to the renderer so the
 * UI can tell the user which subsystem is unavailable.
 */
const degradedServices: { service: string; message: string }[] = [];

// The return value is awaited but discarded, so `unknown` lets steps return
// whatever their init function yields (e.g. `getDatabaseService().initialize()`
// resolves to a DatabaseManager).
async function startupStep(service: string, run: () => unknown) {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Main] ${service} initialization failed:`, error);
    degradedServices.push({ service, message });
  }
}

function reportDegradedServices() {
  if (!mainWindow || degradedServices.length === 0) return;

  const send = () => {
    mainWindow?.webContents.send('event:services-degraded', degradedServices);
  };

  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

app.whenReady().then(async () => {
  // Security and IPC must be in place before the renderer loads, otherwise the
  // renderer's first invoke() calls hit unregistered channels. Both are
  // synchronous and cheap; each is still guarded so a throw cannot block boot.
  await startupStep('Security', () => initializeSecurity());

  // Before `registerIPCHandlers()`: registration is what installs the
  // instrumentation that feeds this monitor, and the renderer can invoke as soon
  // as the handlers exist. Initializing after would reset the buffer and drop
  // the first messages.
  //
  // This call is also what makes `IPCMonitor.initialize()`'s own doc comment
  // ("Called during app startup") true — it was not called from anywhere, so the
  // IPC Inspector rendered empty.
  await startupStep('IPC monitor', () => ipcMonitor.initialize());

  await startupStep('IPC handlers', () => registerIPCHandlers());
  await startupStep('Automation events', () => setupAutomationEvents());
  await startupStep('MCP events', () => startMCPEvents());

  // Open the window before touching anything slow or fallible.
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Everything below is best-effort background initialization.
  await startupStep('Performance', () =>
    initializePerformance({
      enableV8Cache: true,
      enableProfiler: true,
      enableMemoryManager: true,
      enableIPCOptimizer: true,
      profilerEnabled: process.env.NODE_ENV === 'development'
    })
  );

  // Database (migrations included). Handlers re-initialize on demand if this
  // fails, so a failure here only degrades persistence.
  await startupStep('Database', () => getDatabaseService().initialize());

  await startupStep('Debug service', () => debugService.initialize());

  // After the window is open, deliberately: restoring the session verifies the
  // stored token against `/auth/me`, so it costs a network round trip. Blocking
  // the window on it would make every cold start as slow as the API is
  // reachable. The renderer starts anonymous and is corrected by
  // `event:cortex-account-changed` when this resolves.
  await startupStep('Cortex account', async () => {
    const service = getCortexAccountService();
    const state = await service.restore();
    if (state.user && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('event:cortex-account-changed', state);
    }
  });

  await startupStep('Updater', () => {
    if (mainWindow) {
      updateManager.initialize(mainWindow);
    }
  });

  reportDegradedServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // Each teardown step is independent: one failure must not leak the others
  // (watchers, DB handles, timers) by aborting the sequence.
  await startupStep('Performance cleanup', () => cleanupPerformance());
  await startupStep('IPC cleanup', () => unregisterIPCHandlers());
  await startupStep('MCP events cleanup', () => stopMCPEvents());
  // Automation service: watchers, schedulers, AI sessions, listeners.
  await startupStep('Automation cleanup', () => automationService.dispose());
  // Close database connection (checkpoint WAL).
  await startupStep('Database cleanup', () => getDatabaseService().close());
  await startupStep('Updater cleanup', () => updateManager.destroy());
  await startupStep('Debug cleanup', () => debugService.cleanup());
  // Aborts an in-flight device-flow poll loop, which would otherwise keep a
  // timer alive and hold the process open past quit.
  await startupStep('Cortex account cleanup', () => getCortexAccountService().dispose());
});
