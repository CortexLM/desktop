/**
 * Webview confinement — regression guard.
 *
 * Why this file exists: a `<webview>` is configured entirely by HTML attributes
 * written in the *renderer*, the least-trusted process. This repo has already
 * shipped `nodeintegration="false"` on that element, which **enabled** Node in
 * the guest — webview attributes are enabled by presence, not by value, so the
 * string "false" turned on exactly what it appeared to turn off. A fix in the
 * JSX only holds until the next edit of the JSX.
 *
 * `will-attach-webview` is the one control point the renderer cannot reach: it
 * fires on the embedder, in the main process, before the guest exists, and lets
 * the main process overwrite the guest's `webPreferences` wholesale.
 *
 * The suite is deliberately *behavioural*, in the same shape as
 * `packages/preload/src/__tests__/ipc-allowlist.test.ts`: it captures the
 * listeners `initializeSecurity()` actually registers on Electron and invokes
 * them. It never re-implements the policy and never asserts on a constant.
 * Asserting on the constants would keep passing if `initializeSecurity` stopped
 * registering the handler at all — the exact failure mode being guarded against.
 *
 * `electron` is mocked locally rather than through `test/vitest-setup-main.ts`:
 * this suite needs `session.fromPartition` and a `web-contents-created` event it
 * can fire, which the shared mock does not provide.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// electron mock
//
// The mock records the functions handed to it. Every assertion below runs
// through one of those recorded functions, so a change that stops the code from
// consulting its own protection fails here.
// ---------------------------------------------------------------------------

type AppListener = (event: unknown, contents: unknown) => void;

/** event name -> listeners registered via `app.on`. */
const appListeners = new Map<string, AppListener[]>();

const appMock = {
  on: vi.fn((event: string, listener: AppListener) => {
    const existing = appListeners.get(event) ?? [];
    existing.push(listener);
    appListeners.set(event, existing);
    return appMock;
  }),
};

interface SessionMock {
  setPermissionRequestHandler: ReturnType<typeof vi.fn>;
  setPermissionCheckHandler: ReturnType<typeof vi.fn>;
}

function makeSessionMock(): SessionMock {
  return {
    setPermissionRequestHandler: vi.fn(),
    setPermissionCheckHandler: vi.fn(),
  };
}

const defaultSessionMock = makeSessionMock();
/** partition string -> session, as requested through `session.fromPartition`. */
const partitionSessions = new Map<string, SessionMock>();

const sessionMock = {
  get defaultSession() {
    return defaultSessionMock;
  },
  fromPartition: vi.fn((partition: string) => {
    const existing = partitionSessions.get(partition);
    if (existing) return existing;
    const created = makeSessionMock();
    partitionSessions.set(partition, created);
    return created;
  }),
};

vi.mock('electron', () => ({
  app: appMock,
  session: sessionMock,
  shell: { openExternal: vi.fn() },
  BrowserWindow: class {},
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn(), on: vi.fn() },
  default: {},
}));

// Imported after the mock is registered.
const {
  initializeSecurity,
  hardenWebviewPreferences,
  isWebviewUrlAllowed,
  isAppWindowUrlAllowed,
  isLocalPreviewUrl,
  isLocalHostname,
  WEBVIEW_PARTITION,
} = await import('../security');

// ---------------------------------------------------------------------------
// A fake WebContents that records what the production code attaches to it.
// ---------------------------------------------------------------------------

type ContentsListener = (...args: unknown[]) => void;

interface FakeContents {
  getType(): string;
  on(event: string, listener: ContentsListener): FakeContents;
  setWindowOpenHandler(handler: (details: { url: string }) => unknown): void;
  listeners: Map<string, ContentsListener[]>;
  windowOpenHandler?: (details: { url: string }) => unknown;
}

function makeContents(type: 'window' | 'webview'): FakeContents {
  const listeners = new Map<string, ContentsListener[]>();

  const contents: FakeContents = {
    getType: () => type,
    on(event, listener) {
      const existing = listeners.get(event) ?? [];
      existing.push(listener);
      listeners.set(event, existing);
      return contents;
    },
    setWindowOpenHandler(handler) {
      contents.windowOpenHandler = handler;
    },
    listeners,
  };

  return contents;
}

/**
 * Run the real `web-contents-created` listeners against a fresh fake contents.
 *
 * This is the seam that makes the suite mutation-sensitive: the listeners come
 * from `initializeSecurity()`, so deleting the registration leaves nothing to
 * invoke and the tests below fail rather than silently testing a copy.
 */
function createContents(type: 'window' | 'webview'): FakeContents {
  const contents = makeContents(type);
  const listeners = appListeners.get('web-contents-created') ?? [];

  expect(
    listeners.length,
    'initializeSecurity() must register a web-contents-created listener'
  ).toBeGreaterThan(0);

  for (const listener of listeners) listener({}, contents);
  return contents;
}

/** Fire one recorded listener, returning whether it called preventDefault(). */
function fire(
  contents: FakeContents,
  event: string,
  ...args: unknown[]
): { prevented: boolean } {
  const listeners = contents.listeners.get(event) ?? [];

  expect(listeners.length, `no ${event} listener was registered`).toBeGreaterThan(0);

  let prevented = false;
  const eventObject = {
    preventDefault: () => {
      prevented = true;
    },
  };

  for (const listener of listeners) listener(eventObject, ...args);
  return { prevented };
}

beforeEach(() => {
  appListeners.clear();
  partitionSessions.clear();
  sessionMock.fromPartition.mockClear();
  defaultSessionMock.setPermissionRequestHandler.mockClear();
  defaultSessionMock.setPermissionCheckHandler.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  initializeSecurity();
});

// ---------------------------------------------------------------------------
// 1. The handler exists at all
// ---------------------------------------------------------------------------

describe('will-attach-webview is registered', () => {
  it('registers a web-contents-created listener', () => {
    expect(appMock.on).toHaveBeenCalledWith(
      'web-contents-created',
      expect.any(Function)
    );
  });

  it('attaches a will-attach-webview listener to every new WebContents', () => {
    // The decisive control point. Without it the renderer alone decides the
    // guest's security configuration.
    const contents = createContents('window');
    expect(contents.listeners.get('will-attach-webview')?.length ?? 0).toBe(1);
  });

  it('attaches navigation and popup controls too', () => {
    const contents = createContents('window');
    expect(contents.listeners.has('will-navigate')).toBe(true);
    expect(contents.listeners.has('will-redirect')).toBe(true);
    expect(typeof contents.windowOpenHandler).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 2. What the handler forces, driven through the real listener
// ---------------------------------------------------------------------------

/**
 * The hostile case: a renderer that asks for everything dangerous, written the
 * way it was actually written in this repo — `"false"` as a string, which is a
 * *present* attribute value and therefore enabling.
 */
function hostileParams() {
  return {
    src: 'http://localhost:3000',
    nodeintegration: 'false',
    nodeintegrationinsubframes: 'true',
    disablewebsecurity: 'false',
    allowpopups: 'false',
    preload: '/tmp/evil-preload.js',
    partition: undefined as string | undefined,
    webpreferences: 'contextIsolation=no,sandbox=no,nodeIntegration=yes',
    blinkfeatures: 'CSSVariables',
  };
}

/** webPreferences as Electron would present them after parsing the attributes. */
function hostileWebPreferences() {
  return {
    nodeIntegration: true,
    nodeIntegrationInWorker: true,
    nodeIntegrationInSubFrames: true,
    contextIsolation: false,
    sandbox: false,
    webSecurity: false,
    allowRunningInsecureContent: true,
    experimentalFeatures: true,
    webviewTag: true,
    preload: '/tmp/evil-preload.js',
    enableBlinkFeatures: 'CSSVariables',
    partition: 'persist:app-session',
  } as Record<string, unknown>;
}

describe('will-attach-webview overrules a hostile renderer', () => {
  /** Attach a guest through the real listener and return the mutated bags. */
  function attach(
    overrides: Partial<ReturnType<typeof hostileParams>> = {}
  ) {
    const contents = createContents('window');
    const webPreferences = hostileWebPreferences();
    const params = { ...hostileParams(), ...overrides };

    const { prevented } = fire(contents, 'will-attach-webview', webPreferences, params);

    return { webPreferences, params, prevented };
  }

  it('forces nodeIntegration off despite nodeintegration="false" being present', () => {
    // The original bug, now unable to reach the guest.
    const { webPreferences } = attach();
    expect(webPreferences.nodeIntegration).toBe(false);
  });

  it('forces Node off in workers and subframes', () => {
    const { webPreferences } = attach();
    expect(webPreferences.nodeIntegrationInWorker).toBe(false);
    expect(webPreferences.nodeIntegrationInSubFrames).toBe(false);
  });

  it('forces contextIsolation and sandbox on', () => {
    const { webPreferences } = attach();
    expect(webPreferences.contextIsolation).toBe(true);
    expect(webPreferences.sandbox).toBe(true);
  });

  it('forces webSecurity on and refuses insecure content', () => {
    const { webPreferences } = attach();
    expect(webPreferences.webSecurity).toBe(true);
    expect(webPreferences.allowRunningInsecureContent).toBe(false);
  });

  it('refuses a renderer-supplied preload', () => {
    // A preload is the classic path to a privileged bridge inside untrusted
    // content. Deleted, not emptied: '' is still a value Electron resolves.
    const { webPreferences, params } = attach();
    expect('preload' in webPreferences).toBe(false);
    expect('preload' in params).toBe(false);
  });

  it('refuses blink feature toggles that could re-enable what was disabled', () => {
    const { webPreferences, params } = attach();
    expect('enableBlinkFeatures' in webPreferences).toBe(false);
    expect('blinkfeatures' in params).toBe(false);
  });

  it('disables experimental features and nested webviews', () => {
    const { webPreferences } = attach();
    expect(webPreferences.experimentalFeatures).toBe(false);
    expect(webPreferences.webviewTag).toBe(false);
  });

  it('forces the guest into the isolated partition, overriding the app session', () => {
    const { webPreferences, params } = attach();
    expect(webPreferences.partition).toBe(WEBVIEW_PARTITION);
    expect(params.partition).toBe(WEBVIEW_PARTITION);
    expect(WEBVIEW_PARTITION).not.toBe('');
  });

  it('strips the presence-enabled attributes rather than setting them to "false"', () => {
    // Setting them to false would be the same bug again: presence is what
    // enables a webview attribute, so only removal disables it.
    const { params } = attach();
    for (const attribute of [
      'nodeintegration',
      'nodeintegrationinsubframes',
      'disablewebsecurity',
      'allowpopups',
      'webpreferences',
    ]) {
      expect(attribute in params, `${attribute} must be removed, not set`).toBe(false);
    }
  });

  it('does not merely trust an already-safe renderer', () => {
    // Same assertions from an innocent starting point: the handler must assign
    // unconditionally, not "correct" what it reads.
    const contents = createContents('window');
    const webPreferences: Record<string, unknown> = {};
    const params = { src: 'about:blank' } as ReturnType<typeof hostileParams>;

    fire(contents, 'will-attach-webview', webPreferences, params);

    expect(webPreferences.nodeIntegration).toBe(false);
    expect(webPreferences.contextIsolation).toBe(true);
    expect(webPreferences.sandbox).toBe(true);
    expect(webPreferences.partition).toBe(WEBVIEW_PARTITION);
  });
});

// ---------------------------------------------------------------------------
// 3. Attach-time src policy
// ---------------------------------------------------------------------------

describe('will-attach-webview refuses an out-of-policy initial src', () => {
  function attachWith(src: unknown) {
    const contents = createContents('window');
    return fire(contents, 'will-attach-webview', hostileWebPreferences(), {
      ...hostileParams(),
      src,
    });
  }

  it.each([
    'about:blank',
    'http://localhost:3000',
    'http://127.0.0.1:5173/preview',
    'http://192.168.1.42:8080',
    'https://example.com',
    'file:///home/dev/project/dist/index.html',
  ])('allows %s', (src) => {
    expect(attachWith(src).prevented).toBe(false);
  });

  it.each([
    'javascript:fetch("/etc/passwd")',
    'data:text/html,<script>alert(1)</script>',
    'http://evil.example.com',
    'chrome://settings',
  ])('prevents attachment to %s', (src) => {
    expect(attachWith(src).prevented).toBe(true);
  });

  it('still hardens preferences when it refuses the src', () => {
    // Refusal and hardening are independent; a bypass of one must not carry the
    // other with it.
    const contents = createContents('window');
    const webPreferences = hostileWebPreferences();
    const params = { ...hostileParams(), src: 'data:text/html,<script>1</script>' };

    const { prevented } = fire(contents, 'will-attach-webview', webPreferences, params);

    expect(prevented).toBe(true);
    expect(webPreferences.nodeIntegration).toBe(false);
    expect(webPreferences.sandbox).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Navigation policy, per contents type
// ---------------------------------------------------------------------------

describe('webview navigation policy', () => {
  function navigate(url: string) {
    return fire(createContents('webview'), 'will-navigate', url).prevented;
  }

  // The regression that matters most: the webview is the development preview.
  it.each([
    'http://localhost:3000',
    'http://localhost:5173/some/route?x=1',
    'http://127.0.0.1:8080',
    'http://[::1]:3000',
    'http://192.168.1.50:4000',
    'http://10.0.0.7:3000',
    'http://172.16.4.9:9000',
    'http://app.localhost:3000',
  ])('still allows the local preview at %s', (url) => {
    expect(navigate(url)).toBe(false);
  });

  it.each(['https://example.com', 'https://docs.rs/x'])('allows remote https %s', (url) => {
    expect(navigate(url)).toBe(false);
  });

  it.each([
    'http://evil.example.com',
    'data:text/html,<script>alert(1)</script>',
    'javascript:alert(1)',
    'chrome://settings',
    'not a url',
  ])('blocks %s', (url) => {
    expect(navigate(url)).toBe(true);
  });

  it('applies the same policy to redirects', () => {
    // A redirect is a navigation the page never had to request.
    const contents = createContents('webview');
    expect(fire(contents, 'will-redirect', 'http://evil.example.com').prevented).toBe(true);
    expect(fire(contents, 'will-redirect', 'http://localhost:3000').prevented).toBe(false);
  });
});

describe('guest identification does not rest on getType() alone', () => {
  // If `getType()` were the only signal and it ever returned something
  // unexpected for a guest, the guest would be judged by the app-window policy
  // (file: only) and the localhost preview would break silently. The registry
  // fed by `did-attach-webview` is the independent second signal.
  it('treats a contents registered via did-attach-webview as a guest', () => {
    const embedder = createContents('window');

    // A guest whose getType() lies — reports 'window' though it is a guest.
    const guest = makeContents('window');
    createContents('window'); // ensure listeners exist for the guest too

    // Register the guest through the embedder's did-attach-webview, exactly as
    // Electron would.
    fire(embedder, 'did-attach-webview', guest);

    // Now run the security listeners over that same guest object.
    const listeners = appListeners.get('web-contents-created') ?? [];
    for (const listener of listeners) listener({}, guest);

    // Remote https is allowed for a guest and refused for a window, so it
    // distinguishes which policy was applied.
    expect(fire(guest, 'will-navigate', 'https://example.com').prevented).toBe(false);
    expect(fire(guest, 'will-navigate', 'http://localhost:3000').prevented).toBe(false);
  });

  it('still identifies a guest by getType() when it was never registered', () => {
    const guest = createContents('webview');
    expect(fire(guest, 'will-navigate', 'https://example.com').prevented).toBe(false);
  });

  it('registers a did-attach-webview listener', () => {
    const contents = createContents('window');
    expect(contents.listeners.has('did-attach-webview')).toBe(true);
  });
});

describe('app window navigation policy', () => {
  it('keeps the app window on file:', () => {
    const contents = createContents('window');
    expect(fire(contents, 'will-navigate', 'file:///app/index.html').prevented).toBe(false);
  });

  it('blocks the app window from navigating to remote content', () => {
    // The app window holds the privileged preload bridge; it must never end up
    // on a remote origin, even one the webview may visit.
    const contents = createContents('window');
    expect(fire(contents, 'will-navigate', 'https://example.com').prevented).toBe(true);
  });

  it('does not apply the webview policy to the app window', () => {
    // Distinct policies. If one policy were used for both, remote https would
    // be allowed in the privileged window.
    expect(isWebviewUrlAllowed('https://example.com')).toBe(true);
    expect(isAppWindowUrlAllowed('https://example.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Session isolation
// ---------------------------------------------------------------------------

describe('webview session isolation', () => {
  it('uses a partition that is not the default session', () => {
    expect(WEBVIEW_PARTITION).toMatch(/^persist:/);
    expect(sessionMock.fromPartition).toHaveBeenCalledWith(WEBVIEW_PARTITION);
  });

  it('denies every permission in the webview partition', () => {
    // Driven through the handler actually installed on that session, so a
    // handler that stopped denying would fail here.
    const partitionSession = partitionSessions.get(WEBVIEW_PARTITION);
    expect(partitionSession, 'no session was created for the webview partition').toBeDefined();

    const requestHandler = partitionSession!.setPermissionRequestHandler.mock.calls[0]?.[0];
    expect(typeof requestHandler).toBe('function');

    for (const permission of ['media', 'geolocation', 'notifications', 'clipboard-read']) {
      const callback = vi.fn();
      requestHandler({}, permission, callback);
      expect(callback, `${permission} must be denied for a guest`).toHaveBeenCalledWith(false);
    }

    const checkHandler = partitionSession!.setPermissionCheckHandler.mock.calls[0]?.[0];
    expect(checkHandler({}, 'media')).toBe(false);
  });

  it('does not weaken the application session', () => {
    // The app keeps its own whitelist; hardening the guest must not have
    // widened or narrowed it.
    const appCheck = defaultSessionMock.setPermissionCheckHandler.mock.calls[0]?.[0];
    expect(appCheck({}, 'clipboard-read', '', {})).toBe(true);
    expect(appCheck({}, 'geolocation', '', {})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Popups
// ---------------------------------------------------------------------------

describe('popup handling', () => {
  it('denies window.open from a webview guest', () => {
    const contents = createContents('webview');
    expect(contents.windowOpenHandler!({ url: 'https://evil.example.com' })).toEqual({
      action: 'deny',
    });
  });

  it('denies window.open from the app window as well', () => {
    const contents = createContents('window');
    expect(contents.windowOpenHandler!({ url: 'https://example.com' })).toEqual({
      action: 'deny',
    });
  });
});

// ---------------------------------------------------------------------------
// 7. URL policy edge cases
//
// These target the helpers directly. They are the one place where doing so is
// right: hostname classification is where an off-by-one silently widens the
// policy, and driving each case through a listener would not add signal.
// ---------------------------------------------------------------------------

describe('local hostname classification', () => {
  it.each(['localhost', '127.0.0.1', '127.1.2.3', '::1', 'app.localhost', '10.1.2.3',
    '192.168.0.1', '172.16.0.1', '172.31.255.255', '169.254.1.1'])(
    'treats %s as local',
    (host) => {
      expect(isLocalHostname(host)).toBe(true);
    }
  );

  it.each(['example.com', '8.8.8.8', '172.15.0.1', '172.32.0.1', '193.168.0.1',
    'localhost.evil.com', 'notlocalhost'])('treats %s as remote', (host) => {
    expect(isLocalHostname(host)).toBe(false);
  });

  it('is not fooled by a hostname merely containing localhost', () => {
    // `localhost.evil.com` resolves wherever the attacker wants.
    expect(isLocalHostname('localhost.evil.com')).toBe(false);
    expect(isLocalPreviewUrl('http://localhost.evil.com/')).toBe(false);
  });

  it('rejects octets out of range', () => {
    expect(isLocalHostname('999.0.0.1')).toBe(false);
  });

  it('identifies the local preview only over http/https', () => {
    expect(isLocalPreviewUrl('http://localhost:3000')).toBe(true);
    expect(isLocalPreviewUrl('https://localhost:3000')).toBe(true);
    expect(isLocalPreviewUrl('file:///tmp/x.html')).toBe(false);
  });
});

describe('app window policy and the dev server', () => {
  it('admits the configured dev server origin', () => {
    // Dev mode loads the renderer over http from Vite; blocking it would break
    // development reloads.
    expect(isAppWindowUrlAllowed('http://localhost:5173/', 'http://localhost:5173')).toBe(true);
  });

  it('admits only that origin, not all of localhost', () => {
    expect(isAppWindowUrlAllowed('http://localhost:9999/', 'http://localhost:5173')).toBe(false);
  });

  it('admits nothing but file: when no dev server is configured', () => {
    expect(isAppWindowUrlAllowed('http://localhost:5173/', undefined)).toBe(false);
    expect(isAppWindowUrlAllowed('file:///app/index.html', undefined)).toBe(true);
  });

  it('survives a malformed dev server URL', () => {
    expect(isAppWindowUrlAllowed('http://localhost:5173/', 'not-a-url')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. The hardening function on its own
// ---------------------------------------------------------------------------

describe('hardenWebviewPreferences', () => {
  it('is exhaustive over the security-relevant preferences', () => {
    // A new dangerous default arriving in a future Electron would not be caught
    // by this suite, so the set being forced is pinned explicitly.
    const webPreferences: Record<string, unknown> = {};
    hardenWebviewPreferences(webPreferences, {});

    expect(webPreferences).toEqual({
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      partition: WEBVIEW_PARTITION,
    });
  });

  it('mutates in place rather than returning a new object', () => {
    // `will-attach-webview` reads the same objects after the handler returns; a
    // copy would be silently discarded and harden nothing.
    const webPreferences: Record<string, unknown> = { nodeIntegration: true };
    const result = hardenWebviewPreferences(webPreferences, {});

    expect(result).toBeUndefined();
    expect(webPreferences.nodeIntegration).toBe(false);
  });
});
