/**
 * Security configuration and utilities for Cortex Code
 *
 * Most of this file exists because of `<webview>`: the one construct that renders arbitrary
 * web content inside the application. Everything a `<webview>` gets is declared by the
 * *renderer* through HTML attributes, and the renderer is the least-trusted process.
 * `will-attach-webview` is the only point where the main process can overrule those
 * attributes, so that is where the guest's security posture is decided — not in the markup.
 *
 * This matters because webview attributes are enabled *by presence*, not by value:
 * `nodeintegration="false"` turned Node integration ON in the guest. The React renderer that
 * carried that attribute has been deleted, and the current renderer mounts no `<webview>` at
 * all — but a renderer-side fix only ever held until the next edit, and the guards below hold
 * regardless of what any future renderer writes. They are kept for that reason: the class of
 * bug is closed here, not downstream.
 */

import { app, session } from 'electron';
import type { WebPreferences } from 'electron';

/**
 * Permissions whitelist
 *
 * Applies to the *application's own* session. Webview guests run in
 * `WEBVIEW_PARTITION` and are governed by `denyAllPermissions` instead —
 * arbitrary web content gets no camera, no microphone, no notifications.
 */
const ALLOWED_PERMISSIONS = [
  'clipboard-read',
  'clipboard-write',
  'media',
  'notifications',
] as const;

/**
 * Safe domains for external navigation
 */
const SAFE_DOMAINS = [
  'github.com',
  'www.github.com',
  'docs.github.com',
  'api.github.com',
  'cortex-ide.com',
  'www.cortex-ide.com',
  // The device flow sends the user to `auth.cortex.foundation/device` to approve
  // the code, and `api.cortex.foundation` is the API itself. Matched via the
  // `.endsWith('.' + domain)` rule below, so both subdomains are covered.
  'cortex.foundation',
] as const;

/**
 * Dedicated session for webview guests.
 *
 * Without an explicit partition a `<webview>` shares the application's default
 * session: its cookies, its localStorage, its granted permissions, and its
 * HTTP cache. Remote content would then sit in the same jar as the IDE's own
 * credentials. The partition is forced at attach time, so the renderer cannot
 * opt back into the app session by omitting or changing the attribute.
 */
export const WEBVIEW_PARTITION = 'persist:cortex-webview-preview';

// ---------------------------------------------------------------------------
// URL policy
//
// The webview doubles as the development preview (localhost, LAN addresses,
// local HTML files), so the policy is written around "local vs remote" rather
// than a domain allowlist. A blanket block would break the feature it protects.
// ---------------------------------------------------------------------------

/** Strip the brackets IPv6 authorities carry in `URL.hostname` (`[::1]`). */
function bareHostname(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

/**
 * Hosts that are unambiguously the developer's own machine or local network.
 *
 * Loopback, link-local, and the three RFC 1918 ranges. `*.localhost` is
 * included because it resolves to loopback per RFC 6761 and dev tooling uses it
 * for per-app subdomains.
 */
export function isLocalHostname(hostname: string): boolean {
  const host = bareHostname(hostname).toLowerCase();

  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return true;
  if (host.endsWith('.localhost')) return true;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const octets = ipv4.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) return false;

  const [a, b] = octets;

  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC 1918
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 169 && b === 254) return true; // link-local

  return false;
}

/**
 * Is this URL the local development preview?
 *
 * `http:` is accepted only here. Dev servers do not serve TLS, so requiring
 * https would break the preview outright.
 */
export function isLocalPreviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return isLocalHostname(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Navigation policy for a webview guest.
 *
 * Allowed:
 * - `about:blank` — the component's initial `src` and its Home button. Blocking
 *   it would prevent the webview from ever attaching.
 * - local http/https — the development preview.
 * - remote https — ordinary browsing.
 * - `file:` — previewing a built HTML file on disk, a documented use of the view.
 *
 * Refused: remote cleartext `http:` (no plaintext third-party content), and
 * every other scheme — `data:`, `javascript:`, `blob:`, custom protocol
 * handlers. Those are the schemes used to smuggle script into a privileged
 * origin, and none of them is reachable from the component's address bar, which
 * normalises input to http/https/file only.
 */
export function isWebviewUrlAllowed(url: string): boolean {
  if (url === 'about:blank' || url === 'about:srcdoc') return true;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'file:') return true;

  if (parsed.protocol === 'https:') return true;

  if (parsed.protocol === 'http:') {
    // Cleartext only for the local preview.
    return isLocalHostname(parsed.hostname);
  }

  return false;
}

/**
 * Navigation policy for the application's own windows.
 *
 * The renderer is loaded from `file:` in production and from the Vite dev
 * server in development. Both must be allowed or the app cannot run; anything
 * else navigating the *app* window is an escape and is refused.
 *
 * Previously only `file:` passed, which meant a dev-mode navigation back to the
 * dev server origin (a Vite full reload, for instance) was blocked. The dev
 * server is admitted explicitly rather than by allowing all of localhost, so
 * production behaviour is unchanged when `VITE_DEV_SERVER_URL` is unset.
 */
export function isAppWindowUrlAllowed(
  url: string,
  devServerUrl = process.env.VITE_DEV_SERVER_URL
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'file:') return true;

  if (devServerUrl) {
    try {
      if (parsed.origin === new URL(devServerUrl).origin) return true;
    } catch {
      // Malformed VITE_DEV_SERVER_URL: fall through to refusal.
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Webview attach hardening
// ---------------------------------------------------------------------------

/**
 * The `params` bag handed to `will-attach-webview`: the guest's HTML attributes
 * as the renderer wrote them. Values are attribute strings, which is exactly
 * why `"false"` is dangerous here — it is a present value, and presence is what
 * enables a webview flag.
 */
export interface WillAttachWebviewParams {
  src?: string;
  partition?: string;
  preload?: string;
  nodeintegration?: unknown;
  nodeintegrationinsubframes?: unknown;
  disablewebsecurity?: unknown;
  allowpopups?: unknown;
  webpreferences?: unknown;
  blinkfeatures?: unknown;
  disableblinkfeatures?: unknown;
  [key: string]: unknown;
}

/**
 * Overwrite a webview guest's preferences with the safe set.
 *
 * Mutates in place — that is the contract of `will-attach-webview`: Electron
 * uses the objects after the handler returns.
 *
 * Both bags are sanitised. `webPreferences` is the one Electron documents as
 * authoritative and carries every security-critical flag; `params` is scrubbed
 * as well so a stray attribute cannot be re-read downstream. Correctness does
 * not depend on the `params` half.
 *
 * Assignments are unconditional. Reading the renderer's value and "correcting"
 * it would reintroduce the original bug class, where a truthy `"false"` reads
 * as enabled.
 */
export function hardenWebviewPreferences(
  webPreferences: WebPreferences & Record<string, unknown>,
  params: WillAttachWebviewParams
): void {
  // No Node in the guest, at any depth.
  webPreferences.nodeIntegration = false;
  webPreferences.nodeIntegrationInWorker = false;
  webPreferences.nodeIntegrationInSubFrames = false;

  // Isolate and sandbox the guest renderer.
  webPreferences.contextIsolation = true;
  webPreferences.sandbox = true;

  // Same-origin policy stays on; no mixed content.
  webPreferences.webSecurity = true;
  webPreferences.allowRunningInsecureContent = false;

  // No experimental surface, no nested webviews.
  webPreferences.experimentalFeatures = false;
  webPreferences.webviewTag = false;

  // A preload runs with the guest and is the classic path to a privileged
  // bridge inside untrusted content. The renderer must not be able to supply
  // one: deleted rather than emptied, since '' is still a value Electron would
  // try to resolve.
  delete webPreferences.preload;
  delete params.preload;

  // Blink feature toggles can re-enable what the flags above just turned off.
  delete webPreferences.enableBlinkFeatures;
  delete params.blinkfeatures;

  // Session isolation: never the app's default session.
  webPreferences.partition = WEBVIEW_PARTITION;
  params.partition = WEBVIEW_PARTITION;

  // Attributes are enabled by presence, so removal — not `= false` — is what
  // disables them.
  delete params.nodeintegration;
  delete params.nodeintegrationinsubframes;
  delete params.disablewebsecurity;
  delete params.allowpopups;

  // The `webpreferences` attribute is a free-form string the renderer controls.
  // Electron has already parsed it into `webPreferences` above, where the safe
  // values now win; dropping it keeps the two from disagreeing.
  delete params.webpreferences;
}

/**
 * WebContents known to be webview guests, recorded from `did-attach-webview` on
 * the embedder.
 *
 * `contents.getType()` is the obvious way to tell a guest from a window, and it
 * is used too — but relying on it alone puts the whole local-vs-remote
 * navigation policy behind one string comparison. If it ever returned something
 * unexpected for a guest, the guest would silently be judged by the *app window*
 * policy, which allows only `file:`, and the localhost preview would break with
 * no test noticing. The two signals are independent and either one is enough.
 *
 * A `WeakSet` so a closed guest is collectable.
 */
const webviewGuests = new WeakSet<object>();

/** Deny every permission request in a session. Used for the webview partition. */
function denyAllPermissions(partitionSession: Electron.Session): void {
  partitionSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    console.warn(`[Security] Webview permission request denied: ${permission}`);
    callback(false);
  });

  partitionSession.setPermissionCheckHandler((_webContents, permission) => {
    console.warn(`[Security] Webview permission check denied: ${permission}`);
    return false;
  });
}

/**
 * Initialize security settings for the application
 */
export function initializeSecurity(): void {
  // Set permission request handler
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowed = (ALLOWED_PERMISSIONS as readonly string[]).includes(permission);
      
      if (!allowed) {
        console.warn(`[Security] Denied permission request: ${permission}`);
      }
      
      callback(allowed);
    }
  );

  // Set permission check handler
  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission, _requestingOrigin, _details) => {
      const allowed = (ALLOWED_PERMISSIONS as readonly string[]).includes(permission);
      
      if (!allowed) {
        console.warn(
          `[Security] Denied permission check: ${permission}`
        );
      }
      
      return allowed;
    }
  );

  // Lock down the webview session up front, so the first guest to attach is
  // already covered rather than being the request that installs the handler.
  denyAllPermissions(session.fromPartition(WEBVIEW_PARTITION));

  app.on('web-contents-created', (_event, contents) => {
    /**
     * Is this a webview guest rather than one of the app's own windows?
     *
     * Evaluated lazily, at navigation time, not here: `did-attach-webview` fires
     * *after* `web-contents-created`, so the guest registry is still empty at
     * this point. Reading it now would classify every guest as a window.
     */
    const isGuest = (): boolean => {
      if (webviewGuests.has(contents)) return true;
      return typeof contents.getType === 'function' && contents.getType() === 'webview';
    };

    // The decisive control point. Fires on the *embedder* before the guest
    // exists, and is the only place the renderer's webview attributes can be
    // overruled from the main process.
    // The listener signature follows Electron's own typing (`params` is declared
    // `Record<string, string>` there) and is narrowed inside. Declaring the
    // narrower type directly makes the listener unassignable to the overload.
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      const guestParams = params as unknown as WillAttachWebviewParams;

      hardenWebviewPreferences(
        webPreferences as WebPreferences & Record<string, unknown>,
        guestParams
      );

      // A guest whose initial `src` is already outside the policy is refused
      // attachment outright.
      if (typeof guestParams.src === 'string' && !isWebviewUrlAllowed(guestParams.src)) {
        console.warn(`[Security] Blocked webview attach to: ${guestParams.src}`);
        event.preventDefault();
      }
    });

    // Record guests as they attach, so the navigation policy below can identify
    // them without depending solely on `getType()`.
    contents.on('did-attach-webview', (_attachEvent, guestContents) => {
      webviewGuests.add(guestContents);
    });

    contents.on('will-navigate', (event, navigationUrl) => {
      const allowed = isGuest()
        ? isWebviewUrlAllowed(navigationUrl)
        : isAppWindowUrlAllowed(navigationUrl);

      if (allowed) {
        return;
      }

      console.warn(`[Security] Blocked navigation to: ${navigationUrl}`);
      event.preventDefault();
    });

    // A redirect is a navigation the page did not have to ask for, so it needs
    // the same check: http -> file: or http -> data: would otherwise slip past
    // the will-navigate decision made on the original URL.
    contents.on('will-redirect', (event, navigationUrl) => {
      const allowed = isGuest()
        ? isWebviewUrlAllowed(navigationUrl)
        : isAppWindowUrlAllowed(navigationUrl);

      if (allowed) {
        return;
      }

      console.warn(`[Security] Blocked redirect to: ${navigationUrl}`);
      event.preventDefault();
    });

    // Prevent new window creation
    contents.setWindowOpenHandler(({ url }) => {
      console.warn(`[Security] Blocked window.open to: ${url}`);
      return { action: 'deny' };
    });
  });
}

/**
 * Validate if a URL is safe to open externally
 */
export function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow https
    if (parsed.protocol !== 'https:') {
      return false;
    }
    
    // Check against whitelist
    return SAFE_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Safely open an external URL
 */
export async function openExternalSafe(url: string): Promise<boolean> {
  const { shell } = await import('electron');
  
  if (!isSafeExternalUrl(url)) {
    console.error(`[Security] Blocked unsafe external URL: ${url}`);
    return false;
  }
  
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error(`[Security] Failed to open external URL:`, error);
    return false;
  }
}
