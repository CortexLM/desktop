/**
 * Editor session persistence — pure logic behind the store's `persist` middleware.
 *
 * WHAT IS PERSISTED, AND WHY
 * --------------------------
 * The store tracks `isDirty` per tab, which means the user genuinely has unsaved
 * edits that live nowhere else. Persisting only paths and re-reading from disk on
 * boot would therefore *lose work*, and lose it more dangerously than today's
 * behaviour: right now the user knows a reload drops everything, whereas a
 * path-only restore would show the tab back with the disk content and let them
 * believe their edits survived. So unsaved content is persisted.
 *
 * Persisting content raises the question this module exists to answer: the file
 * may have changed on disk while the session was away. That is detected rather
 * than silently resolved — see `reconcileTabs`.
 *
 * Cursor and scroll positions are persisted too: the store already tracks them
 * per tab, they cost a handful of bytes, and losing them is immediately visible.
 *
 * `diskState` is deliberately NOT persisted: it is re-derived on every boot from
 * `baselineMtime` versus the file's current mtime, so a conflict left unresolved
 * is re-detected on the next boot instead of going stale in storage.
 *
 * COST PER KEYSTROKE
 * ------------------
 * `updateTabContent` runs on every Monaco change and every store write persists,
 * so the write cost is paid per keystroke. Measured, not assumed —
 * `scripts/measure-session-write-cost.ts` for the projection, and a real
 * `localStorage.setItem` in Chromium for the write:
 *
 *   file size   projection   setItem     total
 *      10 KB     0.007 ms    0.029 ms   ~0.04 ms
 *     100 KB     0.044 ms    0.115 ms   ~0.16 ms
 *     500 KB     0.078 ms    0.640 ms   ~0.72 ms
 *       2 MB     0.237 ms    3.450 ms   ~3.7 ms
 *
 * Negligible for ordinary files. At 2 MB it is ~22% of a 16 ms frame, which is
 * why the total budget is 2 MiB: it also bounds the per-keystroke cost. No
 * debounce, deliberately — a debounced write can be lost to the very reload this
 * feature exists to survive, and the measured cost does not justify that risk.
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware';

/** localStorage key holding the session. */
export const SESSION_STORAGE_KEY = 'cortex:editor-session';

/** Bumped when the persisted shape changes incompatibly. */
export const SESSION_VERSION = 1;

/**
 * Budgets for persisted content.
 *
 * localStorage gives roughly 5 MB per origin for the *whole* app, and the editor
 * session is only one of several things stored there (workspace path, onboarding
 * flags, theme...). 2 MiB keeps a comfortable margin.
 *
 * The per-tab cap applies to **clean tabs only**. A clean tab's content is
 * recoverable from disk, so refusing to store a large one costs nothing but a
 * read at boot. Unsaved content is the opposite: it exists nowhere else, so
 * capping it per tab would throw away the user's work while budget sat unused.
 * Dirty tabs are therefore limited by the total budget alone.
 */
export const MAX_CLEAN_CONTENT_BYTES_PER_TAB = 512 * 1024;
export const MAX_CONTENT_BYTES_TOTAL = 2 * 1024 * 1024;

/**
 * Outcome of comparing a restored tab against the file on disk.
 *
 * - `clean`        — tab agrees with disk, or is an ordinary unsaved edit on an
 *                    unchanged file.
 * - `conflict`     — the tab has unsaved edits AND the file changed on disk
 *                    underneath them. Both versions exist; nothing is
 *                    overwritten automatically.
 * - `missing`      — the file is gone, but the tab has unsaved edits worth
 *                    keeping. A clean tab whose file is gone is closed instead.
 * - `unsaved-lost` — the tab was dirty when the session was written, but its
 *                    content did not fit the storage budget. The edits are gone;
 *                    saying so is the whole point of the state.
 */
export type TabDiskState = 'clean' | 'conflict' | 'missing' | 'unsaved-lost';

/** A tab as it is written to storage. `content: null` means "not persisted". */
export interface PersistedTab {
  id: string;
  path: string;
  language: string;
  content: string | null;
  isDirty: boolean;
  isActive: boolean;
  cursorPosition?: { line: number; column: number };
  scrollPosition?: { top: number; left: number };
  baselineMtime?: number;
}

export interface PersistedSession {
  tabs: PersistedTab[];
  activeTabId: string | null;
}

/** The subset of `Storage` this module needs; makes the engine injectable. */
export interface RawStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** UTF-8 byte length, which is what a storage quota actually counts. */
export function byteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  // Fallback for exotic runtimes: over-estimates rather than under-estimates.
  return value.length * 3;
}

interface BudgetInput {
  id: string;
  content: string;
  isDirty: boolean;
}

/**
 * Decides which tabs keep their content in storage.
 *
 * Dirty tabs are served first, and among themselves smallest-first: when the
 * budget cannot hold every unsaved file, keeping four small ones beats keeping
 * one large one. Clean tabs take what is left, in tab order, and are the only
 * ones subject to the per-tab cap.
 *
 * Returns the set of ids allowed to keep content — callers must still emit tabs
 * in their original order, since that order is the tab strip's order.
 */
export function allocateContentBudget(
  tabs: readonly BudgetInput[],
  cleanPerTabLimit: number = MAX_CLEAN_CONTENT_BYTES_PER_TAB,
  totalLimit: number = MAX_CONTENT_BYTES_TOTAL
): Set<string> {
  const sized = tabs.map((tab) => ({ ...tab, size: byteLength(tab.content) }));

  const dirty = sized.filter((tab) => tab.isDirty).sort((a, b) => a.size - b.size);
  const clean = sized.filter((tab) => !tab.isDirty);

  const keep = new Set<string>();
  let remaining = totalLimit;

  // Unsaved work: no per-tab cap, since there is no other copy of it.
  for (const tab of dirty) {
    // `continue`, not `break`: a single huge file must not starve the smaller
    // tabs queued behind it.
    if (tab.size > remaining) continue;
    remaining -= tab.size;
    keep.add(tab.id);
  }

  for (const tab of clean) {
    if (tab.size > cleanPerTabLimit) continue;
    if (tab.size > remaining) continue;
    remaining -= tab.size;
    keep.add(tab.id);
  }

  return keep;
}

/** Shape `partialize` needs from a live tab. Keeps this module store-agnostic. */
export interface SessionTabInput {
  id: string;
  path: string;
  language: string;
  content: string;
  isDirty: boolean;
  isActive: boolean;
  cursorPosition?: { line: number; column: number };
  scrollPosition?: { top: number; left: number };
  baselineMtime?: number;
}

/** Projects live tabs into their persisted form, applying the content budget. */
export function toPersistedSession(
  tabs: readonly SessionTabInput[],
  activeTabId: string | null,
  cleanPerTabLimit: number = MAX_CLEAN_CONTENT_BYTES_PER_TAB,
  totalLimit: number = MAX_CONTENT_BYTES_TOTAL
): PersistedSession {
  const keep = allocateContentBudget(tabs, cleanPerTabLimit, totalLimit);

  return {
    tabs: tabs.map((tab) => ({
      id: tab.id,
      path: tab.path,
      language: tab.language,
      content: keep.has(tab.id) ? tab.content : null,
      isDirty: tab.isDirty,
      isActive: tab.isActive,
      cursorPosition: tab.cursorPosition,
      scrollPosition: tab.scrollPosition,
      baselineMtime: tab.baselineMtime,
    })),
    activeTabId,
  };
}

/**
 * Progressively cheaper versions of a session, tried in order when a write is
 * rejected for quota.
 *
 * Losing the whole session because one file was too big would be the worst
 * outcome: the paths alone are still a useful restore. Clean content goes first
 * (recoverable from disk), then dirty content (already flagged as lost on the
 * way back in), and metadata is kept to the end.
 */
export function degradeSession(session: PersistedSession): PersistedSession[] {
  const stripped = (predicate: (tab: PersistedTab) => boolean): PersistedSession => ({
    ...session,
    tabs: session.tabs.map((tab) => (predicate(tab) ? { ...tab, content: null } : tab)),
  });

  return [
    session,
    stripped((tab) => !tab.isDirty),
    stripped(() => true),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readPoint<K extends string>(
  value: unknown,
  keys: readonly [K, K]
): Record<K, number> | undefined {
  if (!isRecord(value)) return undefined;
  const [first, second] = keys;
  if (typeof value[first] !== 'number' || typeof value[second] !== 'number') return undefined;
  return { [first]: value[first], [second]: value[second] } as Record<K, number>;
}

/**
 * Validates one entry from storage.
 *
 * Storage is shared, user-writable and survives app upgrades, so anything in it
 * is untrusted input. A malformed entry is dropped rather than allowed to
 * produce a tab with `path: undefined` that throws on the first click.
 */
export function parsePersistedTab(value: unknown): PersistedTab | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || value.id === '') return null;
  if (typeof value.path !== 'string' || value.path === '') return null;

  return {
    id: value.id,
    path: value.path,
    language: typeof value.language === 'string' ? value.language : 'plaintext',
    content: typeof value.content === 'string' ? value.content : null,
    isDirty: value.isDirty === true,
    isActive: value.isActive === true,
    cursorPosition: readPoint(value.cursorPosition, ['line', 'column']),
    scrollPosition: readPoint(value.scrollPosition, ['top', 'left']),
    baselineMtime: typeof value.baselineMtime === 'number' ? value.baselineMtime : undefined,
  };
}

/** Validates a whole session, dropping malformed tabs and duplicate paths. */
export function parsePersistedSession(value: unknown): PersistedSession | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.tabs)) return null;

  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  const tabs: PersistedTab[] = [];

  for (const entry of value.tabs) {
    const tab = parsePersistedTab(entry);
    if (!tab) continue;
    // `openTab` guarantees one tab per path and unique ids; storage must not be
    // able to reintroduce duplicates that no action could ever produce.
    if (seenPaths.has(tab.path) || seenIds.has(tab.id)) continue;
    seenPaths.add(tab.path);
    seenIds.add(tab.id);
    tabs.push(tab);
  }

  return {
    tabs,
    activeTabId: typeof value.activeTabId === 'string' ? value.activeTabId : null,
  };
}

/**
 * A zustand `PersistStorage` that survives a full quota and refuses to trust
 * what it reads back.
 *
 * Implemented at the `PersistStorage` level rather than as a `StateStorage`
 * passed through `createJSONStorage` so that degradation happens on the object,
 * before serialisation, instead of by re-parsing a string zustand just built.
 */
export function createSessionStorage(
  engine: RawStorage,
  onWriteFailure?: (stage: number, error: unknown) => void
): PersistStorage<PersistedSession> {
  return {
    getItem: (name) => {
      let raw: string | null;
      try {
        raw = engine.getItem(name);
      } catch {
        // A storage that throws on read (disabled cookies, private mode) is a
        // missing session, not a crash on boot.
        return null;
      }
      if (raw === null) return null;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }

      if (!isRecord(parsed)) return null;
      const state = parsePersistedSession(parsed.state);
      if (!state) return null;

      return {
        state,
        version: typeof parsed.version === 'number' ? parsed.version : undefined,
      } as StorageValue<PersistedSession>;
    },

    setItem: (name, value) => {
      const candidates = degradeSession(value.state);

      for (let stage = 0; stage < candidates.length; stage += 1) {
        try {
          engine.setItem(name, JSON.stringify({ state: candidates[stage], version: value.version }));
          return;
        } catch (error) {
          onWriteFailure?.(stage, error);
        }
      }

      // Even metadata did not fit. Drop the key: a stale session is worse than
      // none, because it would restore tabs the user has since closed.
      try {
        engine.removeItem(name);
      } catch {
        // Nothing further to try; persistence is simply unavailable.
      }
    },

    removeItem: (name) => {
      try {
        engine.removeItem(name);
      } catch {
        // Idem.
      }
    },
  };
}

/** In-memory stand-in used when no DOM storage is available. */
export function createMemoryStorage(): RawStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** `window.localStorage` when usable, an in-memory store otherwise. */
export function resolveStorageEngine(): RawStorage {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as { localStorage?: RawStorage }).localStorage) {
      return (globalThis as unknown as { localStorage: RawStorage }).localStorage;
    }
  } catch {
    // Accessing localStorage can itself throw when storage is blocked.
  }
  return createMemoryStorage();
}

// ---------------------------------------------------------------------------
// Reconciliation with disk
// ---------------------------------------------------------------------------

export interface DiskFile {
  content: string;
  mtime: number;
}

export type DiskReadResult =
  | { ok: true; file: DiskFile }
  | { ok: false; missing: boolean };

export type DiskReader = (path: string) => Promise<DiskReadResult>;

/** Shape `reconcileTabs` works on. Structurally satisfied by `EditorTab`. */
export interface ReconcilableTab extends SessionTabInput {
  diskState?: TabDiskState;
  /** True when the tab was dirty but its content did not fit the budget. */
  unsavedContentDropped?: boolean;
}

export interface ReconcileResult<T extends ReconcilableTab> {
  tabs: T[];
  activeTabId: string | null;
  /** Paths of tabs closed because their file no longer exists. */
  closedPaths: string[];
}

/**
 * Enforces the store's two structural invariants after any list surgery.
 *
 * I1: at most one tab flagged `isActive`.
 * I2: `activeTabId` is null, or the id of a present tab that carries `isActive`.
 *
 * Restoring from storage and closing tabs whose file vanished both reshuffle the
 * list, and either could leave `activeTabId` pointing at nothing.
 */
export function withRepairedFocus<T extends { id: string; isActive: boolean }>(
  tabs: readonly T[],
  activeTabId: string | null
): { tabs: T[]; activeTabId: string | null } {
  if (tabs.length === 0) return { tabs: [], activeTabId: null };

  const requested = activeTabId !== null && tabs.some((tab) => tab.id === activeTabId)
    ? activeTabId
    : null;

  // Fall back to whichever tab claims to be active, then to the last tab, which
  // is where `openTab` leaves the focus.
  const resolved = requested ?? tabs.find((tab) => tab.isActive)?.id ?? tabs[tabs.length - 1].id;

  return {
    tabs: tabs.map((tab) => ({ ...tab, isActive: tab.id === resolved })),
    activeTabId: resolved,
  };
}

/**
 * Brings a restored session back in line with the filesystem.
 *
 * Per tab:
 *  - file gone, tab clean  → closed. A dead tab that fails on every click is
 *    worse than no tab; this is the same failure mode as a reattached terminal
 *    whose process had already exited.
 *  - file gone, tab dirty  → kept and flagged `missing`. The unsaved content is
 *    the only copy left; deleting it to keep the list tidy would be the one
 *    outcome the user cannot undo.
 *  - read failed otherwise → left untouched. A permission error or a transient
 *    IPC failure must never be allowed to close tabs.
 *  - tab clean             → content and baseline refreshed from disk, silently.
 *    The file on disk *is* the truth for a tab with no unsaved edits.
 *  - tab dirty, disk newer than the tab's baseline and content differs
 *                          → flagged `conflict`, user content kept, nothing
 *                            written. Detected and signalled, never resolved
 *                            behind the user's back.
 *  - tab dirty, disk unchanged → kept as an ordinary unsaved edit.
 */
export async function reconcileTabs<T extends ReconcilableTab>(
  tabs: readonly T[],
  activeTabId: string | null,
  read: DiskReader
): Promise<ReconcileResult<T>> {
  const closedPaths: string[] = [];
  const kept: T[] = [];

  const results = await Promise.all(tabs.map((tab) => read(tab.path).catch(() => ({ ok: false, missing: false }) as DiskReadResult)));

  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index];
    const result = results[index];

    if (!result.ok) {
      if (!result.missing) {
        // Transient / permission failure: change nothing.
        kept.push(tab);
        continue;
      }

      if (tab.isDirty) {
        kept.push({ ...tab, diskState: 'missing' });
      } else {
        closedPaths.push(tab.path);
      }
      continue;
    }

    const { content, mtime } = result.file;

    if (tab.unsavedContentDropped) {
      kept.push({
        ...tab,
        content,
        isDirty: false,
        baselineMtime: mtime,
        diskState: 'unsaved-lost',
        unsavedContentDropped: false,
      });
      continue;
    }

    if (!tab.isDirty) {
      kept.push({ ...tab, content, baselineMtime: mtime, diskState: 'clean' });
      continue;
    }

    const diskChanged =
      typeof tab.baselineMtime === 'number' && mtime > tab.baselineMtime && content !== tab.content;

    // Baseline is intentionally left alone on a conflict: it is the version the
    // unsaved edits were made against, and overwriting it here would make the
    // conflict undetectable on the next boot.
    kept.push({ ...tab, diskState: diskChanged ? 'conflict' : 'clean' });
  }

  const repaired = withRepairedFocus(kept, activeTabId);
  return { tabs: repaired.tabs, activeTabId: repaired.activeTabId, closedPaths };
}

/**
 * A `DiskReader` backed by the `editor:open-file` IPC channel, or null when no
 * preload bridge is present (unit tests, storybook).
 *
 * `FILE_NOT_FOUND` is what the main process maps ENOENT to, and is the only
 * error treated as "the file is gone" — everything else is transient by
 * assumption, which keeps a permission blip from closing tabs.
 */
export function createIpcDiskReader(): DiskReader | null {
  const bridge = (globalThis as {
    window?: {
      cortex?: {
        editor?: {
          openFile?: (request: { path: string }) => Promise<unknown>;
        };
      };
    };
  }).window?.cortex?.editor;

  if (typeof bridge?.openFile !== 'function') return null;
  const openFile = bridge.openFile.bind(bridge);

  return async (path) => {
    try {
      const response = (await openFile({ path })) as
        | { success: true; data: { content: string; stats?: { mtime?: number } } }
        | { success: false; error?: { code?: string } }
        | null
        | undefined;

      if (response && response.success) {
        return {
          ok: true,
          file: {
            content: response.data.content,
            mtime: typeof response.data.stats?.mtime === 'number' ? response.data.stats.mtime : 0,
          },
        };
      }

      return { ok: false, missing: response?.error?.code === 'FILE_NOT_FOUND' };
    } catch {
      return { ok: false, missing: false };
    }
  };
}
