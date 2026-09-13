/**
 * Starts a Code run from the Home composer draft.
 *
 * This PC refuses to start until a folder is open. Cloud and SSH never fall
 * back to a local path. Guests get the sign-in modal rather than a session.
 */

import {
  describeWorkspaceError,
  isCortexApiError,
  type RuntimeKind,
} from '@cortex-ide/cortex-api';

import type { useSessions } from '../state/sessions-context.tsx';
import { composerDraft, resetComposerDraft, setComposerDraft } from '../state/composer-draft.ts';
import { guestBlocked } from '../state/guest-lock.ts';

export const THIS_PC_NEEDS_FOLDER =
  'Open a folder on this computer first. This PC runs against that tree, not a cloud workspace.';

interface StartRunOptions {
  runs: ReturnType<typeof useSessions>;
  navigate: (path: string) => void;
  setError: (message: string | undefined) => void;
  signedIn: () => boolean;
}

export type StartDraft = {
  prompt: string;
  runtime: RuntimeKind;
  repo?: string;
  branch?: string;
  model?: string;
  mode?: 'ask' | 'plan' | 'agent';
};

/** Native-module and path fragments stay in main's logs, not on the screen. */
export function userFacingStartError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/node_modules|self-register|NODE_MODULE_VERSION|\.node\b|better-sqlite/i.test(raw)) {
    return 'This workspace could not be opened. Try restarting Cortex.';
  }
  if (raw === THIS_PC_NEEDS_FOLDER) return raw;
  if (isCortexApiError(error)) return describeWorkspaceError(error);
  return raw;
}

export function createStartRun(options: StartRunOptions): (draft?: StartDraft) => Promise<void> {
  let inFlight = false;

  return async (override) => {
    if (override) {
      setComposerDraft((current) => ({ ...current, ...override }));
    }
    const draft = composerDraft();
    if (!draft.prompt.trim() || inFlight) return;
    if (guestBlocked(options.signedIn())) return;

    inFlight = true;
    options.setError(undefined);
    try {
      await startDraft(options, draft.runtime);
    } catch (error) {
      options.setError(userFacingStartError(error));
    } finally {
      inFlight = false;
    }
  };
}

async function startDraft(options: StartRunOptions, runtime: RuntimeKind): Promise<void> {
  const draft = composerDraft();
  const repo = await resolveThisPcRepo(draft.runtime, draft.repo, options.runs);
  const session = await options.runs.start({
    prompt: draft.prompt.trim(),
    runtime: draft.runtime,
    ...(repo ? { repo } : {}),
    ...(draft.branch ? { branch: draft.branch } : {}),
    ...(draft.model ? { model: draft.model } : {}),
    ...(draft.mode ? { mode: draft.mode } : {}),
  });
  resetComposerDraft(runtime);
  options.navigate(`/code/sessions/${session.id}`);
}

async function resolveThisPcRepo(
  runtime: RuntimeKind,
  repo: string | undefined,
  runs: ReturnType<typeof useSessions>,
): Promise<string | undefined> {
  if (runtime !== 'local') return repo;
  const open = repo ?? runs.repositories()?.[0]?.id;
  if (open) return open;
  const picked = await runs.openWorkspace();
  const next = runs.repositories()?.[0]?.id;
  if (!picked || !next) throw new Error(THIS_PC_NEEDS_FOLDER);
  return next;
}

/** Advances the runtime chip. A single allowed runtime is a label, not a picker. */
export function cycleRuntime(allowed: readonly RuntimeKind[]): void {
  if (allowed.length < 2) return;
  const current = composerDraft().runtime;
  const index = allowed.indexOf(current);
  const next = allowed[(index + 1) % allowed.length] ?? allowed[0];
  setComposerDraft((draft) => ({ ...draft, runtime: next }));
}

export function cycleDraftField(field: 'repo' | 'branch' | 'worktree', options: readonly string[]): void {
  if (options.length === 0) return;
  const current = composerDraft()[field] ?? '';
  const next = options[(options.indexOf(current) + 1) % options.length];
  setComposerDraft((draft) => ({ ...draft, [field]: next }));
}

export function pickRepo(names: readonly string[], openFolder: () => void): void {
  if (names.length === 0) {
    openFolder();
    return;
  }
  cycleDraftField('repo', names);
}
