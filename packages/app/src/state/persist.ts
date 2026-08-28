/**
 * JSON in localStorage. Shared by web and desktop for product lists that are
 * not yet a SQLite domain (Planning, projects, library, bots, inbox).
 *
 * Reads and writes fail silent: tests and locked-down browsers have no store,
 * and a missing store must not take a screen down.
 */

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // No store; the value lasts for this launch only (already in the signal).
  }
}
