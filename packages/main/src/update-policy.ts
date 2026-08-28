/**
 * Production auto-update feed.
 *
 * Packaged Electron reads this URL from electron-builder.yml (`publish.url`)
 * into `app-update.yml`. `CORTEX_UPDATE_FEED_URL` overrides it for a local
 * feed. That is a test hook, not a second production channel.
 */
export const DEFAULT_UPDATE_FEED_URL = 'https://releases.cortex-ide.com/';

export function resolveUpdateFeedUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const override = env.CORTEX_UPDATE_FEED_URL?.trim();
  return override ? override : DEFAULT_UPDATE_FEED_URL;
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
