/**
 * Global `electron` mock — the single implementation, for vitest.
 *
 * Why a setup file rather than `vi.mock('electron')` inside each test: the
 * `electron` npm package's entry point exports a *string* (the path to the
 * Electron binary), so `import { ipcMain } from 'electron'` fails at link time
 * outside a real Electron runtime — before any in-test mock could run. Setup
 * files are fully evaluated before any test module is imported, so the mock is
 * already in the registry. It is wired through `setupFiles` in
 * `packages/main/vitest.config.ts` via `test/vitest-setup-main.ts`.
 *
 * Tests import `ipcMainMock` / `registeredHandlers` from this module to drive and
 * assert on IPC registration.
 *
 * History: this file was the `bun test` preload (built on `bun:test`'s `mock`)
 * and had a hand-maintained vitest twin at `electron-mock.vitest.ts`, with
 * `packages/main/vitest.config.ts` aliasing between them while the repo ran two
 * runners. The repo is on vitest only now, so the twin and the alias are gone and
 * this is the one file to edit.
 */

import { vi, type Mock } from 'vitest';

export type IpcHandler = (event: unknown, request: unknown) => Promise<unknown> | unknown;

/** Channel -> handler, populated by `ipcMain.handle()`. */
export const registeredHandlers = new Map<string, IpcHandler>();

/** Channel -> listeners, populated by `ipcMain.on()`. */
export const registeredListeners = new Map<string, Array<(...args: unknown[]) => void>>();

export const ipcMainMock = {
  handle: vi.fn((channel: string, handler: IpcHandler) => {
    registeredHandlers.set(channel, handler);
  }),
  handleOnce: vi.fn((channel: string, handler: IpcHandler) => {
    registeredHandlers.set(channel, handler);
  }),
  removeHandler: vi.fn((channel: string) => {
    registeredHandlers.delete(channel);
  }),
  on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
    const existing = registeredListeners.get(channel) ?? [];
    existing.push(listener);
    registeredListeners.set(channel, existing);
  }),
  removeAllListeners: vi.fn((channel?: string) => {
    if (channel) registeredListeners.delete(channel);
    else registeredListeners.clear();
  }),
  emit: vi.fn(() => false),
};

export const appMock = {
  getPath: vi.fn(() => '/tmp'),
  getName: vi.fn(() => 'Cortex IDE'),
  getVersion: vi.fn(() => '0.1.0'),
  getAppPath: vi.fn(() => '/app/cortex-ide'),
  on: vi.fn(() => appMock),
  once: vi.fn(() => appMock),
  whenReady: vi.fn(async () => undefined),
  quit: vi.fn(() => undefined),
  isPackaged: false,
};

export const dialogMock = {
  showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] as string[] })),
  showSaveDialog: vi.fn(async () => ({ canceled: true, filePath: undefined })),
  showMessageBox: vi.fn(async () => ({ response: 0 })),
};

export const shellMock = {
  openExternal: vi.fn(async () => undefined),
  openPath: vi.fn(async () => ''),
};

/**
 * `safeStorage` — chiffrement au repos des clés d'API.
 *
 * Absent de ce mock jusqu'ici, ce qui ne se voyait pas : aucun code ne
 * l'utilisait. `provider-settings-service` s'en sert pour ne pas écrire de clé
 * en clair sur le disque, et un `safeStorage` manquant faisait échouer le
 * *link* de tous les tests du package `main`
 * (`import { safeStorage } from 'electron'` -> `undefined`), pas seulement les
 * siens.
 *
 * Le chiffrement est simulé (préfixe + base64), pas réel : ce qu'on veut
 * pouvoir vérifier, c'est que la valeur posée sur disque n'est PAS la clé en
 * clair et que le tour aller-retour la restitue. `isEncryptionAvailable` est
 * pilotable par test : sur Linux sans keyring elle renvoie légitimement
 * `false`, et le service doit alors basculer sur un stockage en clair en
 * `0o600` — chemin qui a besoin d’être testé lui aussi.
 */
const ENCRYPTED_PREFIX = 'mock-enc:';

export const safeStorageMock = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((plain: string) =>
    Buffer.from(`${ENCRYPTED_PREFIX}${Buffer.from(plain, 'utf8').toString('base64')}`, 'utf8')
  ),
  decryptString: vi.fn((encrypted: Buffer) => {
    const text = encrypted.toString('utf8');
    if (!text.startsWith(ENCRYPTED_PREFIX)) {
      // Ce que fait le vrai `safeStorage` face à un blob qui ne vient pas de
      // lui (keyring changé, fichier copié depuis une autre machine).
      throw new Error('mock safeStorage: not encrypted by this keyring');
    }
    return Buffer.from(text.slice(ENCRYPTED_PREFIX.length), 'base64').toString('utf8');
  }),
};

/** OS notification banner — used by notify-handlers. */
export const notificationInstances: Array<{
  show: ReturnType<typeof vi.fn>;
  title: string;
  body: string;
}> = [];

/**
 * Annotated rather than inferred. `Object.assign` over a `vi.fn` infers a type that
 * names `@vitest/spy` through Bun's content-addressed store path, which `tsc` refuses
 * to emit as non-portable (TS2742). Naming `Mock` from `vitest` — a direct dependency
 * — keeps the spy methods callers use while staying portable.
 */
export const NotificationMock: Mock<(opts: { title: string; body: string }) => unknown> & {
  isSupported: Mock<() => boolean>;
} = Object.assign(
  vi.fn(function Notification(this: unknown, opts: { title: string; body: string }) {
    const instance = { show: vi.fn(), title: opts.title, body: opts.body };
    notificationInstances.push(instance);
    return instance;
  }),
  { isSupported: vi.fn(() => false) },
);

class BrowserWindowMock {
  static getAllWindows = vi.fn(() => [] as BrowserWindowMock[]);
  static getFocusedWindow = vi.fn(() => null);
  static fromWebContents = vi.fn((_contents: unknown): BrowserWindowMock | null => null);
  webContents = { send: vi.fn(() => {}), on: vi.fn(() => {}) };
  loadURL = vi.fn(async () => undefined);
  loadFile = vi.fn(async () => undefined);
  on = vi.fn(() => this);
  show = vi.fn(() => {});
  close = vi.fn(() => {});
  isDestroyed = vi.fn(() => false);
}

/** Clear every recorded electron interaction. */
export function resetElectronMock(): void {
  registeredHandlers.clear();
  registeredListeners.clear();
  ipcMainMock.handle.mockClear();
  ipcMainMock.removeHandler.mockClear();
  ipcMainMock.on.mockClear();
  ipcMainMock.removeAllListeners.mockClear();
  safeStorageMock.isEncryptionAvailable.mockClear();
  safeStorageMock.isEncryptionAvailable.mockReturnValue(true);
  safeStorageMock.encryptString.mockClear();
  safeStorageMock.decryptString.mockClear();
  notificationInstances.length = 0;
  NotificationMock.mockClear();
  NotificationMock.isSupported.mockReset();
  NotificationMock.isSupported.mockReturnValue(false);
}

vi.mock('electron', () => ({
  ipcMain: ipcMainMock,
  app: appMock,
  dialog: dialogMock,
  shell: shellMock,
  safeStorage: safeStorageMock,
  BrowserWindow: BrowserWindowMock,
  Notification: NotificationMock,
  Menu: { buildFromTemplate: vi.fn(() => ({})), setApplicationMenu: vi.fn(() => {}) },
  nativeTheme: { shouldUseDarkColors: false, on: vi.fn(() => {}) },
  default: {},
}));

export { BrowserWindowMock };
