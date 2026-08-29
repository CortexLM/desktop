/**
 * Whether the preload bridge is installed.
 *
 * Its own module so `host.ts` can pick between the Electron, cloud, and detached
 * hosts while `realtime-session.ts` still decides how to fetch — importing this
 * from `host.ts` would make the two depend on each other in a cycle, and the
 * cycle resolves to `undefined` at module-evaluation time depending on which
 * side is loaded first.
 */

export function hasElectronHost(): boolean {
  return (globalThis as { cortex?: { cortex?: unknown } }).cortex?.cortex !== undefined;
}
