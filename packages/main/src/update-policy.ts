/**
 * Auto-update feed URLs.
 *
 * Production packaged Electron reads `DEFAULT_UPDATE_FEED_URL` from
 * electron-builder.yml (`publish.url`) into `app-update.yml`. Staging
 * installers bake `STAGING_UPDATE_FEED_URL` at package time. Runtime must
 * leave that packaged configuration intact unless a test override is set.
 *
 * `CORTEX_UPDATE_FEED_URL` overrides the feed for a local test. That is a
 * test hook, not a third public channel.
 */
export const DEFAULT_UPDATE_FEED_URL = 'https://software.cortex.foundation/latest/';
export const STAGING_UPDATE_FEED_URL = 'https://software.cortex.foundation/staging/';
export const LATEST_CHANNEL_FEED_URL = 'https://software.cortex.foundation/latest/';

export function resolveUpdateFeedUrl(
  env: Record<string, string | undefined> = process.env,
): string | null | undefined {
  const override = env.CORTEX_UPDATE_FEED_URL?.trim();
  if (!override) return undefined;
  const url = URL.parse(override);
  if (!url) return null;
  const loopback = ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname);
  if ([url.username, url.password, url.search, url.hash].some(Boolean) ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    return null;
  }
  return url.href;
}

/**
 * Whether main should ask the feed for a newer build.
 *
 * The web UI has no updater. Unpackaged and development Electron skip the
 * check so a `file://` renderer never pretends a download is in flight.
 * `CORTEX_FORCE_UPDATE_CHECK=1` is the explicit escape hatch for pointing a
 * build at a test feed.
 */
export function shouldCheckForUpdates(
  env: Record<string, string | undefined> = process.env,
  packaged = false,
): boolean {
  if (env.CORTEX_FORCE_UPDATE_CHECK === '1') return true;
  if (env.NODE_ENV === 'development') return false;
  return packaged;
}
