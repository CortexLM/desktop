/**
 * The one way to reach the workspace manager.
 *
 * `getWorkspaceManager(dataDir)` builds its singleton from whichever caller gets
 * there first and ignores every later `dataDir`. Two callers passing different
 * directories was a real race: `workspace-handlers` passes
 * `app.getPath('userData')`, and a second call passing `process.cwd()` would win
 * if it happened to run first — silently pointing the legacy-import path at the
 * repository root.
 *
 * It also has to be initialised before it answers. `getActiveWorkspace()` on an
 * uninitialised manager returns `null` even when a workspace is registered, which
 * reads exactly like "no folder is open" and is how the composer came to show an
 * empty repository picker.
 *
 * So: one accessor, one directory, initialised once, memoised.
 */

import { app } from 'electron';

import { getWorkspaceManager, type WorkspaceManager } from './workspace-manager';

let ready: Promise<WorkspaceManager> | null = null;

export function activeWorkspaceManager(): Promise<WorkspaceManager> {
  if (!ready) {
    ready = (async () => {
      const manager = getWorkspaceManager(app.getPath('userData'));
      await manager.initialize();
      return manager;
    })();

    // A failed initialisation is deliberately not memoised: the next call should be
    // able to retry, because the usual causes are transient (a directory created
    // since, permissions corrected).
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

/** The open folder, or `undefined` when the user has not chosen one yet. */
export async function activeWorkspacePath(): Promise<string | undefined> {
  try {
    const manager = await activeWorkspaceManager();
    return manager.getActiveWorkspace()?.path;
  } catch {
    // A manager that cannot initialise means no workspace, not a crash: the app is
    // usable without one, it just cannot run an agent against a folder.
    return undefined;
  }
}

/** Drops the memo. Used by the tests. */
export function resetActiveWorkspace(): void {
  ready = null;
}
