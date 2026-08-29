/**
 * The `connect-src` the built page is allowed to talk to.
 *
 * Computed at build time because the hardcoded value was wrong twice:
 *
 *   - **The realtime socket was blocked.** `connect-src https://api.cortex.foundation`
 *     does not authorise `wss://api.cortex.foundation`; CSP matches the scheme, so a
 *     `wss:` origin has to be listed in its own right. The web app therefore could
 *     never open `/v1/realtime` — it silently fell back to the read-only SSE stream,
 *     which meant Bot turns and Code turns sent over the socket went nowhere.
 *   - **`VITE_CORTEX_API_BASE_URL` did nothing.** The override is documented, and the
 *     staging workflow passes it, but any origin other than `api.cortex.foundation`
 *     was refused by the policy — so a build pointed at staging could not reach it.
 *
 * Kept as a pure function so both are covered by a unit test rather than only being
 * observable by loading the built page and reading the console.
 */

/** Where the app talks when nothing overrides it. Mirrors `CORTEX_API_BASE_URL`. */
export const DEFAULT_API_ORIGIN = 'https://api.cortex.foundation';

/**
 * The WebSocket origin for an HTTP one.
 *
 * Returns `undefined` for anything that is not http(s): a caller that passed a
 * `ws://` URL already has what it needs, and inventing a scheme for something else
 * would widen the policy on a guess.
 */
export function socketOrigin(origin: string): string | undefined {
  if (origin.startsWith('https://')) return `wss://${origin.slice('https://'.length)}`;
  if (origin.startsWith('http://')) return `ws://${origin.slice('http://'.length)}`;
  return undefined;
}

/** The scheme and host of a URL, without a path or a trailing slash. */
function toOrigin(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return new URL(trimmed).origin;
  } catch {
    return undefined;
  }
}

/**
 * Builds the directive value.
 *
 * `'self'` stays first so the bundle's own assets keep working under `file://`.
 * The API origin and its socket form are added; anything unparseable is dropped
 * rather than concatenated, because a malformed entry makes CSP ignore the whole
 * source list and would quietly open the page up.
 */
export function connectSrc(apiBaseUrl?: string): string {
  const origin = toOrigin(apiBaseUrl ?? '') ?? DEFAULT_API_ORIGIN;
  const sources = ['\'self\'', origin];

  const socket = socketOrigin(origin);
  if (socket) sources.push(socket);

  // A build pointed at a non-default origin still needs production to work in the
  // same bundle when the override is absent, so the default is always allowed.
  if (origin !== DEFAULT_API_ORIGIN) {
    sources.push(DEFAULT_API_ORIGIN);
    const defaultSocket = socketOrigin(DEFAULT_API_ORIGIN);
    if (defaultSocket) sources.push(defaultSocket);
  }

  return sources.join(' ');
}

/**
 * Replaces the `connect-src` directive in the page's CSP meta tag.
 *
 * Scoped to the tag rather than run over the whole document: the first `connect-src`
 * in `index.html` is the one in the comment explaining this rewrite, and replacing
 * that instead spliced the policy into a comment and left the real tag untouched —
 * a broken document that still parsed.
 */
export function withConnectSrc(html: string, apiBaseUrl?: string): string {
  return html.replace(
    /<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i,
    (tag) => tag.replace(/connect-src[^";]*/, `connect-src ${connectSrc(apiBaseUrl)}`),
  );
}
