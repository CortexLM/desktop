/**
 * GitPanel component tests
 *
 * GitPanel talks to the main process through `lib/ipc`, which calls
 * `window.electron.ipcRenderer.invoke`. Stubbing that single seam exercises the
 * real ipc client, the real component and its real children (BranchSelector,
 * EmptyState, ErrorState, FileItem).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;

// Bun's `spyOn` maps to Vitest's `vi.spyOn`.
const spyOn = vi.spyOn;
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import { IPC_CHANNELS } from '@cortex-ide/shared';
import { GitPanel } from '../GitPanel';

/**
 * Portable replacement for Bun's `Bun.sleep(ms)`: resolves after `ms` real
 * milliseconds. No test in this suite uses fake timers, so real-time waits
 * keep the original semantics.
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// window.electron stub
// ---------------------------------------------------------------------------

let invoke: ReturnType<typeof mock>;
let consoleLogSpy: ReturnType<typeof spyOn>;
let consoleErrorSpy: ReturnType<typeof spyOn>;

interface FileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
}

function status(
  overrides: Partial<{
    branch: string;
    ahead: number;
    behind: number;
    files: FileStatus[];
    isClean: boolean;
  }> = {}
) {
  const files = overrides.files ?? [];
  return {
    branch: 'main',
    ahead: 0,
    behind: 0,
    isClean: files.length === 0,
    ...overrides,
    files,
  };
}

/**
 * Everything `console.error` was called with, joined.
 *
 * Typed rather than inlined per call site: the inline
 * `consoleErrorSpy.mock.calls.map((c) => ...)` form left `c` implicitly `any`,
 * which `tsc` reports as TS7006 under this package's `noImplicitAny`.
 */
function loggedErrors(): string {
  return (consoleErrorSpy.mock.calls as unknown[][])
    .map((call) => String(call[0]))
    .join('\n');
}

/** Respond with success envelopes from a channel map. */
function respondWith(map: Partial<Record<string, unknown>>) {
  invoke.mockImplementation(async (channel: string) => {
    if (channel in map) return { success: true, data: map[channel] };
    return { success: true, data: {} };
  });
}

/** Respond to GIT_STATUS with a failure envelope carrying `message`. */
function failStatusWith(message: string) {
  invoke.mockImplementation(async (channel: string) => {
    if (channel === IPC_CHANNELS.GIT_STATUS) {
      return { success: false, error: { code: 'GIT_ERROR', message } };
    }
    return { success: true, data: {} };
  });
}

beforeEach(() => {
  invoke = mock(async () => ({ success: true, data: status() }));
  // The preload exposes a flat `invoke` (see packages/preload/src/index.ts), so
  // that is the seam `lib/ipc` calls — there is no `ipcRenderer` object.
  (globalThis as unknown as { window: Record<string, unknown> }).window.electron = {
    invoke,
    on: mock(),
    off: mock(),
  };
  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
  consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleLogSpy.mockRestore();
  consoleErrorSpy.mockRestore();
});

async function renderPanel(props: Partial<React.ComponentProps<typeof GitPanel>> = {}) {
  const result = render(React.createElement(GitPanel, { repoPath: '/repo', ...props }));
  await waitFor(() => expect(invoke).toHaveBeenCalled());
  return result;
}

/** Wait for the panel chrome to be on screen. */
async function waitForPanel() {
  await waitFor(() => expect(screen.getByText('Git')).toBeDefined());
}

// ===========================================================================

describe('GitPanel loading and error states', () => {
  it('requests the status for the given repo on mount', async () => {
    await renderPanel({ repoPath: '/my/project' });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_STATUS, { repoPath: '/my/project' });
  });

  it('shows a spinner before the first response resolves', async () => {
    invoke.mockImplementation(() => new Promise(() => {}));

    render(React.createElement(GitPanel, { repoPath: '/repo' }));

    await waitFor(() => expect(screen.getByRole('status')).toBeDefined());
    expect(screen.queryByText('Git')).toBeNull();
  });

  it('renders the error state with a retry button for a genuine failure', async () => {
    failStatusWith('index.lock exists');

    await renderPanel();

    await waitFor(() => expect(screen.getByText('Could not read Git status')).toBeDefined());
    expect(screen.getByText('index.lock exists')).toBeDefined();
  });

  it.each([
    'fatal: not a git repository',
    'ENOENT: no such file or directory',
    'no such file',
  ])('shows the no-repository empty state for "%s"', async (message) => {
    failStatusWith(message);

    await renderPanel();

    await waitFor(() => expect(screen.getByText('No Git repository')).toBeDefined());
    expect(screen.getByText('Check again')).toBeDefined();
  });

  it('retries loading from the no-repository state', async () => {
    failStatusWith('fatal: not a git repository');
    await renderPanel();
    await waitFor(() => expect(screen.getByText('Check again')).toBeDefined());

    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ branch: 'develop' }) });
    await act(async () => {
      fireEvent.click(screen.getByText('Check again'));
    });

    await waitFor(() => expect(screen.getByText('develop')).toBeDefined());
  });

  it('retries loading from the error state', async () => {
    failStatusWith('index.lock exists');
    await renderPanel();
    await waitFor(() => expect(screen.getByText('Could not read Git status')).toBeDefined());
    const before = invoke.mock.calls.length;

    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status() });
    const retry = screen.getByRole('button', { name: /retry|try again/i });
    await act(async () => {
      fireEvent.click(retry);
    });

    expect(invoke.mock.calls.length).toBeGreaterThan(before);
    await waitForPanel();
  });

  it('extracts a message from a thrown plain object', async () => {
    invoke.mockImplementation(async () => {
      throw { message: 'structured failure' };
    });

    await renderPanel();

    await waitFor(() => expect(screen.getByText('structured failure')).toBeDefined());
  });

  it('extracts a message from a thrown string', async () => {
    invoke.mockImplementation(async () => {
      throw 'plain string failure';
    });

    await renderPanel();

    await waitFor(() => expect(screen.getByText('plain string failure')).toBeDefined());
  });
});

describe('GitPanel header', () => {
  it('shows the Git title and current branch', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ branch: 'feature/login' }) });

    await renderPanel();

    await waitForPanel();
    expect(screen.getByText('feature/login')).toBeDefined();
  });

  it('shows an ahead badge when commits are unpushed', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ ahead: 3 }) });

    await renderPanel();

    await waitForPanel();
    expect(screen.getByText('3')).toBeDefined();
  });

  it('shows a behind badge', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ behind: 2 }) });

    await renderPanel();

    await waitForPanel();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('shows both counters together', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ ahead: 1, behind: 4 }) });

    await renderPanel();

    await waitForPanel();
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('hides both counters when in sync', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ ahead: 0, behind: 0 }) });

    await renderPanel();

    await waitForPanel();
    // Only the refresh control remains on the right-hand side.
    expect(screen.queryByText('0')).toBeNull();
  });

  it('exposes an accessible refresh control', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status() });

    await renderPanel();

    await waitForPanel();
    expect(screen.getByLabelText('Refresh Git status')).toBeDefined();
  });

  it('refreshes on demand', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status() });
    await renderPanel();
    await waitForPanel();
    const before = invoke.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Refresh Git status'));
    });

    expect(invoke.mock.calls.length).toBeGreaterThan(before);
  });
});

describe('GitPanel file lists', () => {
  const staged: FileStatus = { path: 'src/staged.ts', status: 'modified', staged: true };
  const unstaged: FileStatus = { path: 'src/unstaged.ts', status: 'modified', staged: false };

  it('shows the clean empty state when there are no changes', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ branch: 'main', isClean: true }) });

    await renderPanel();

    await waitFor(() => expect(screen.getByText('No changes')).toBeDefined());
    expect(screen.getByText('Everything on main is committed.')).toBeDefined();
  });

  it('groups staged changes with a count', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [staged], isClean: false }) });

    await renderPanel();

    await waitFor(() => expect(screen.getByText('Staged Changes (1)')).toBeDefined());
    expect(screen.getByText('src/staged.ts')).toBeDefined();
  });

  it('groups unstaged changes with a count', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });

    await renderPanel();

    await waitFor(() => expect(screen.getByText('Changes (1)')).toBeDefined());
  });

  it('shows both groups at once', async () => {
    respondWith({
      [IPC_CHANNELS.GIT_STATUS]: status({ files: [staged, unstaged], isClean: false }),
    });

    await renderPanel();

    await waitFor(() => expect(screen.getByText('Staged Changes (1)')).toBeDefined());
    expect(screen.getByText('Changes (1)')).toBeDefined();
  });

  it.each([
    ['modified', 'M', 'Modified'],
    ['added', 'A', 'Added'],
    ['deleted', 'D', 'Deleted'],
    ['renamed', 'R', 'Renamed'],
    ['untracked', 'U', 'Untracked'],
  ] as const)('renders the %s status as %s labelled "%s"', async (fileStatus, label, title) => {
    respondWith({
      [IPC_CHANNELS.GIT_STATUS]: status({
        files: [{ path: 'a.ts', status: fileStatus, staged: false }],
        isClean: false,
      }),
    });

    await renderPanel();

    await waitFor(() => expect(screen.getByText(label)).toBeDefined());
    expect(screen.getByLabelText(title)).toBeDefined();
  });

  it('exposes the staging checkbox with its checked state', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [staged], isClean: false }) });

    await renderPanel();

    await waitFor(() => expect(screen.getByRole('checkbox')).toBeDefined());
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Unstage staged.ts')).toBeDefined();
  });

  it('labels an unstaged checkbox as "Stage"', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });

    await renderPanel();

    await waitFor(() => expect(screen.getByLabelText('Stage unstaged.ts')).toBeDefined());
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
  });

  it('reloads the status after toggling stage', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });
    await renderPanel();
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeDefined());
    const before = invoke.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox'));
    });

    expect(invoke.mock.calls.length).toBeGreaterThan(before);
  });

  it('offers Discard for unstaged tracked files', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });

    await renderPanel();

    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );
  });

  it('hides Discard for untracked files', async () => {
    respondWith({
      [IPC_CHANNELS.GIT_STATUS]: status({
        files: [{ path: 'new.ts', status: 'untracked', staged: false }],
        isClean: false,
      }),
    });

    await renderPanel();

    await waitFor(() => expect(screen.getByText('new.ts')).toBeDefined());
    expect(screen.queryByLabelText('Discard changes to new.ts')).toBeNull();
  });

  it('hides Discard for staged files', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [staged], isClean: false }) });

    await renderPanel();

    await waitFor(() => expect(screen.getByText('src/staged.ts')).toBeDefined());
    expect(screen.queryByLabelText('Discard changes to staged.ts')).toBeNull();
  });

  it('aborts a discard when the confirmation is declined', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });
    (globalThis as unknown as { window: Record<string, unknown> }).window.confirm = mock(
      () => false
    );
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );
    const before = invoke.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });

    expect(invoke.mock.calls.length).toBe(before);
  });

  it('reloads after a confirmed discard', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });
    (globalThis as unknown as { window: Record<string, unknown> }).window.confirm = mock(
      () => true
    );
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );
    const before = invoke.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });

    expect(invoke.mock.calls.length).toBeGreaterThan(before);
  });

  it('shows only the file basename in accessible labels', async () => {
    respondWith({
      [IPC_CHANNELS.GIT_STATUS]: status({
        files: [{ path: 'deep/nested/path/file.ts', status: 'modified', staged: false }],
        isClean: false,
      }),
    });

    await renderPanel();

    await waitFor(() => expect(screen.getByLabelText('Stage file.ts')).toBeDefined());
    // The full path is still what's displayed.
    expect(screen.getByText('deep/nested/path/file.ts')).toBeDefined();
  });
});

// ===========================================================================
// Staging
//
// `toggleStage` used to be a stub that logged the path and re-read the status,
// so the checkbox looked interactive while nothing was ever staged. The
// neighbouring test above ("reloads the status after toggling stage") could not
// see that: the stub *did* call `git:status`, so the invoke count still went up.
// These assert the staging channel and its payload, which is what the stub
// never sent.
// ===========================================================================

describe('GitPanel staging', () => {
  const unstaged: FileStatus = { path: 'src/unstaged.ts', status: 'modified', staged: false };
  const stagedFile: FileStatus = { path: 'src/staged.ts', status: 'modified', staged: true };
  const untracked: FileStatus = { path: 'new.ts', status: 'untracked', staged: false };

  /** Calls made on `channel`, as payloads. */
  function payloadsFor(channel: string): unknown[] {
    return invoke.mock.calls.filter((call) => call[0] === channel).map((call) => call[1]);
  }

  it('stages an unstaged file through git:stage', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Stage unstaged.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Stage unstaged.ts'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_STAGE, {
      repoPath: '/repo',
      files: ['src/unstaged.ts'],
    });
  });

  it('unstages a staged file through git:unstage', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [stagedFile], isClean: false }) });
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Unstage staged.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Unstage staged.ts'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_UNSTAGE, {
      repoPath: '/repo',
      files: ['src/staged.ts'],
    });
  });

  it('does not send the opposite channel', async () => {
    // A swapped pair type-checks perfectly and would make every checkbox a
    // no-op in one direction.
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Stage unstaged.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Stage unstaged.ts'));
    });

    expect(payloadsFor(IPC_CHANNELS.GIT_UNSTAGE)).toEqual([]);
  });

  it('stages an untracked file like any other', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [untracked], isClean: false }) });
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Stage new.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Stage new.ts'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_STAGE, {
      repoPath: '/repo',
      files: ['new.ts'],
    });
  });

  it('re-reads the status immediately after staging', async () => {
    // The panel also polls every 5s. Relying on that tick would leave the
    // checkbox disagreeing with the index for up to five seconds, so the refresh
    // has to be part of the action.
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [unstaged], isClean: false }) });
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Stage unstaged.ts')).toBeDefined());
    const statusCallsBefore = payloadsFor(IPC_CHANNELS.GIT_STATUS).length;

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Stage unstaged.ts'));
    });

    // Ordering matters: the status re-read must come *after* the stage call,
    // otherwise it reports the pre-stage index.
    const channels = invoke.mock.calls.map((call) => call[0]);
    const stageAt = channels.indexOf(IPC_CHANNELS.GIT_STAGE);
    expect(stageAt).toBeGreaterThan(-1);
    expect(channels.slice(stageAt + 1)).toContain(IPC_CHANNELS.GIT_STATUS);
    expect(payloadsFor(IPC_CHANNELS.GIT_STATUS).length).toBeGreaterThan(statusCallsBefore);
  });

  it('refreshes even when staging fails, and reports the failure', async () => {
    // A failed stage leaves the UI unable to vouch for what it shows, so it must
    // still re-read rather than keep a stale optimistic state.
    invoke.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.GIT_STAGE) {
        return { success: false, error: { code: 'GIT_ERROR', message: 'index.lock exists' } };
      }
      return { success: true, data: status({ files: [unstaged], isClean: false }) };
    });
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Stage unstaged.ts')).toBeDefined());
    const statusCallsBefore = payloadsFor(IPC_CHANNELS.GIT_STATUS).length;

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Stage unstaged.ts'));
    });

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    const logged = loggedErrors();
    expect(logged).toContain('Could not stage file');
    expect(payloadsFor(IPC_CHANNELS.GIT_STATUS).length).toBeGreaterThan(statusCallsBefore);
  });

  it('reports an unstage failure with its own title', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.GIT_UNSTAGE) {
        return { success: false, error: { code: 'GIT_ERROR', message: 'nope' } };
      }
      return { success: true, data: status({ files: [stagedFile], isClean: false }) };
    });
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Unstage staged.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Unstage staged.ts'));
    });

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    const logged = loggedErrors();
    expect(logged).toContain('Could not unstage file');
  });
});

describe('GitPanel stage all', () => {
  const a: FileStatus = { path: 'a.ts', status: 'modified', staged: false };
  const b: FileStatus = { path: 'dir/b.ts', status: 'untracked', staged: false };
  const alreadyStaged: FileStatus = { path: 'c.ts', status: 'modified', staged: true };

  it('stages every unstaged file in a single call', async () => {
    // One `git add` with N pathspecs rather than N calls: a single index lock,
    // and the UI does not traverse N intermediate states.
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [a, b], isClean: false }) });
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('stage-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('stage-all-button'));
    });

    const stageCalls = invoke.mock.calls.filter((c) => c[0] === IPC_CHANNELS.GIT_STAGE);
    expect(stageCalls).toHaveLength(1);
    expect(stageCalls[0][1]).toEqual({ repoPath: '/repo', files: ['a.ts', 'dir/b.ts'] });
  });

  it('leaves already-staged files out of the request', async () => {
    respondWith({
      [IPC_CHANNELS.GIT_STATUS]: status({ files: [a, alreadyStaged], isClean: false }),
    });
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('stage-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('stage-all-button'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_STAGE, {
      repoPath: '/repo',
      files: ['a.ts'],
    });
  });

  it('is disabled when nothing is unstaged', async () => {
    // An enabled button here would send `files: []`, which the handler's schema
    // rejects — an error toast for a no-op.
    respondWith({
      [IPC_CHANNELS.GIT_STATUS]: status({ files: [alreadyStaged], isClean: false }),
    });
    await renderPanel();

    await waitFor(() =>
      expect((screen.getByTestId('stage-all-button') as HTMLButtonElement).disabled).toBe(true)
    );
  });

  it('is enabled as soon as one file is unstaged', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [a], isClean: false }) });
    await renderPanel();

    await waitFor(() =>
      expect((screen.getByTestId('stage-all-button') as HTMLButtonElement).disabled).toBe(false)
    );
  });

  it('re-reads the status after staging everything', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [a, b], isClean: false }) });
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('stage-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('stage-all-button'));
    });

    const channels = invoke.mock.calls.map((call) => call[0]);
    const stageAt = channels.indexOf(IPC_CHANNELS.GIT_STAGE);
    expect(channels.slice(stageAt + 1)).toContain(IPC_CHANNELS.GIT_STATUS);
  });

  it('reports a bulk failure through the error handler', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.GIT_STAGE) {
        return { success: false, error: { code: 'GIT_ERROR', message: 'permission denied' } };
      }
      return { success: true, data: status({ files: [a, b], isClean: false }) };
    });
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('stage-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('stage-all-button'));
    });

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    const logged = loggedErrors();
    expect(logged).toContain('Could not stage all files');
  });
});

describe('GitPanel actions', () => {
  const staged: FileStatus = { path: 'a.ts', status: 'modified', staged: true };

  it('disables Commit with nothing staged', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status() });

    await renderPanel();

    await waitForPanel();
    expect((screen.getByText('Commit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Commit once something is staged', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [staged], isClean: false }) });

    await renderPanel();

    await waitFor(() =>
      expect((screen.getByText('Commit') as HTMLButtonElement).disabled).toBe(false)
    );
  });

  it('opens the commit dialog', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ files: [staged], isClean: false }) });
    await renderPanel();
    await waitFor(() =>
      expect((screen.getByText('Commit') as HTMLButtonElement).disabled).toBe(false)
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Commit'));
    });

    await waitFor(() => expect(document.querySelector('textarea')).not.toBeNull());
  });

  it('disables Push when there is nothing ahead', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status({ ahead: 0 }) });

    await renderPanel();

    await waitForPanel();
    expect((screen.getByText('Push') as HTMLButtonElement).disabled).toBe(true);
  });

  it('pushes when ahead', async () => {
    respondWith({
      [IPC_CHANNELS.GIT_STATUS]: status({ ahead: 2 }),
      [IPC_CHANNELS.GIT_PUSH]: { pushed: 2 },
    });
    await renderPanel();
    await waitFor(() =>
      expect((screen.getByText('Push') as HTMLButtonElement).disabled).toBe(false)
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Push'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_PUSH, { repoPath: '/repo' });
  });

  it('reports a push failure through the error handler', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.GIT_PUSH) {
        return { success: false, error: { code: 'GIT_ERROR', message: 'rejected' } };
      }
      return { success: true, data: status({ ahead: 1 }) };
    });
    await renderPanel();
    await waitFor(() =>
      expect((screen.getByText('Push') as HTMLButtonElement).disabled).toBe(false)
    );

    await act(async () => {
      fireEvent.click(screen.getByText('Push'));
    });

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    const logged = loggedErrors();
    expect(logged).toContain('Push failed');
  });

  it('pulls and reloads', async () => {
    respondWith({
      [IPC_CHANNELS.GIT_STATUS]: status(),
      [IPC_CHANNELS.GIT_PULL]: { success: true, filesChanged: 0 },
    });
    await renderPanel();
    await waitForPanel();

    await act(async () => {
      fireEvent.click(screen.getByText('Pull'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_PULL, { repoPath: '/repo' });
  });

  it('reports a pull failure through the error handler', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.GIT_PULL) {
        return { success: false, error: { code: 'GIT_ERROR', message: 'conflict' } };
      }
      return { success: true, data: status() };
    });
    await renderPanel();
    await waitForPanel();

    await act(async () => {
      fireEvent.click(screen.getByText('Pull'));
    });

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    const logged = loggedErrors();
    expect(logged).toContain('Pull failed');
  });

  it('renders no actions until a status arrives', async () => {
    invoke.mockImplementation(() => new Promise(() => {}));

    render(React.createElement(GitPanel, { repoPath: '/repo' }));

    expect(screen.queryByText('Push')).toBeNull();
    expect(screen.queryByText('Pull')).toBeNull();
  });
});

describe('GitPanel diff viewer', () => {
  function respondForDiff(path: string) {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.GIT_DIFF) {
        return { success: true, data: { diff: '', hunks: [] } };
      }
      return {
        success: true,
        data: status({
          files: [{ path, status: 'modified', staged: false }],
          isClean: false,
        }),
      };
    });
  }

  it('opens the diff viewer from the diff button', async () => {
    respondForDiff('a.ts');
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('View diff for a.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('View diff for a.ts'));
    });

    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[0] === IPC_CHANNELS.GIT_DIFF)).toBe(true)
    );
  });

  it('opens the diff viewer by clicking the file name', async () => {
    respondForDiff('b.ts');
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('View changes in b.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('View changes in b.ts'));
    });

    await waitFor(() =>
      expect(invoke.mock.calls.some((c) => c[0] === IPC_CHANNELS.GIT_DIFF)).toBe(true)
    );
  });
});

describe('GitPanel polling', () => {
  it('polls the status on an interval', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status() });
    await renderPanel();
    const initial = invoke.mock.calls.length;

    // The panel refreshes every 5s.
    await act(async () => {
      await sleep(5_100);
    });

    expect(invoke.mock.calls.length).toBeGreaterThan(initial);
  }, 20_000);

  it('stops polling after unmount', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status() });
    const { unmount } = await renderPanel();

    unmount();
    const afterUnmount = invoke.mock.calls.length;
    await act(async () => {
      await sleep(5_100);
    });

    expect(invoke.mock.calls.length).toBe(afterUnmount);
  }, 20_000);

  it('restarts polling when repoPath changes', async () => {
    respondWith({ [IPC_CHANNELS.GIT_STATUS]: status() });
    const { rerender } = await renderPanel({ repoPath: '/a' });

    rerender(React.createElement(GitPanel, { repoPath: '/b' }));

    await waitFor(() =>
      expect(
        invoke.mock.calls.some(
          (c) =>
            c[0] === IPC_CHANNELS.GIT_STATUS && (c[1] as { repoPath: string }).repoPath === '/b'
        )
      ).toBe(true)
    );
  });
});

// ===========================================================================
// Discard — the only destructive action in the panel
//
// `discardChanges` used to be a stub that confirmed, logged, and re-read the
// status. The two older tests above ("aborts a discard when the confirmation is
// declined" / "reloads after a confirmed discard") could not see that: the stub
// *did* call `git:status`, so the invoke count still moved. What they never
// checked is that `git:discard` is sent at all, with which payload, and with
// which confirmation text.
//
// Two things are asserted here that no other test can cover:
//
//   - the confirmation says WHICH of the two operations will happen. "Discard
//     changes" and "delete permanently" are not the same message, and a user who
//     reads the wrong one loses a file.
//   - `deleteUntracked` is only ever true on the single-file delete path.
// ===========================================================================

describe('GitPanel discard', () => {
  const trackedUnstaged: FileStatus = {
    path: 'src/unstaged.ts',
    status: 'modified',
    staged: false,
  };
  const untrackedFile: FileStatus = { path: 'new.ts', status: 'untracked', staged: false };
  const deletedFile: FileStatus = { path: 'gone.ts', status: 'deleted', staged: false };

  let confirmMock: ReturnType<typeof mock>;

  /** Installs a `confirm` that returns `answer` and records its message. */
  function stubConfirm(answer: boolean) {
    confirmMock = mock(() => answer);
    (globalThis as unknown as { window: Record<string, unknown> }).window.confirm = confirmMock;
    return confirmMock;
  }

  /** The message passed to the most recent `confirm` call. */
  function confirmMessage(): string {
    const calls = confirmMock.mock.calls as unknown[][];
    return String(calls[calls.length - 1]?.[0] ?? '');
  }

  function payloadsFor(channel: string): unknown[] {
    return invoke.mock.calls.filter((call) => call[0] === channel).map((call) => call[1]);
  }

  /** Respond to GIT_DISCARD with a given result, GIT_STATUS with `files`. */
  function respondForDiscard(
    files: FileStatus[],
    discardResult: {
      restored?: string[];
      deleted?: string[];
      skipped?: Array<{ path: string; reason: string }>;
    } = {}
  ) {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.GIT_DISCARD) {
        return {
          success: true,
          data: {
            restored: discardResult.restored ?? [],
            deleted: discardResult.deleted ?? [],
            skipped: discardResult.skipped ?? [],
          },
        };
      }
      return { success: true, data: status({ files, isClean: files.length === 0 }) };
    });
  }

  // -------------------------------------------------------------------------
  // The channel actually gets called
  // -------------------------------------------------------------------------

  it('sends git:discard for a tracked file', async () => {
    stubConfirm(true);
    respondForDiscard([trackedUnstaged], { restored: ['src/unstaged.ts'] });
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_DISCARD, {
      repoPath: '/repo',
      files: ['src/unstaged.ts'],
      deleteUntracked: false,
    });
  });

  it('sends deleteUntracked: false for a tracked file', async () => {
    // The flag is what separates "restore" from "delete", so a tracked discard
    // must never carry permission to delete.
    stubConfirm(true);
    respondForDiscard([trackedUnstaged]);
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });

    const payload = payloadsFor(IPC_CHANNELS.GIT_DISCARD)[0] as { deleteUntracked: boolean };
    expect(payload.deleteUntracked).toBe(false);
  });

  it('sends deleteUntracked: true only for an untracked file', async () => {
    stubConfirm(true);
    respondForDiscard([untrackedFile], { deleted: ['new.ts'] });
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Delete new.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Delete new.ts'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_DISCARD, {
      repoPath: '/repo',
      files: ['new.ts'],
      deleteUntracked: true,
    });
  });

  // -------------------------------------------------------------------------
  // The confirmation, and its exact wording
  // -------------------------------------------------------------------------

  it('does not send git:discard when the confirmation is declined', async () => {
    // The mutation that matters on a destructive operation: if the `confirm`
    // guard is removed, this goes red.
    stubConfirm(false);
    respondForDiscard([trackedUnstaged]);
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });

    expect(payloadsFor(IPC_CHANNELS.GIT_DISCARD)).toEqual([]);
  });

  it('does not delete an untracked file when the confirmation is declined', async () => {
    stubConfirm(false);
    respondForDiscard([untrackedFile]);
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Delete new.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Delete new.ts'));
    });

    expect(payloadsFor(IPC_CHANNELS.GIT_DISCARD)).toEqual([]);
  });

  it('says the file will be RESTORED for a tracked file', async () => {
    stubConfirm(false);
    respondForDiscard([trackedUnstaged]);
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });

    const message = confirmMessage();
    expect(message).toContain('src/unstaged.ts');
    expect(message).toContain('restored to its last committed version');
    // And it must NOT threaten deletion: that is the other operation.
    expect(message).not.toContain('removed from disk');
  });

  it('says the file will be DELETED for an untracked file', async () => {
    // "Discard changes" would be a lie here: there is no previous version, and
    // the file is about to be removed for good.
    stubConfirm(false);
    respondForDiscard([untrackedFile]);
    await renderPanel();
    await waitFor(() => expect(screen.getByLabelText('Delete new.ts')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Delete new.ts'));
    });

    const message = confirmMessage();
    expect(message).toContain('new.ts');
    expect(message).toContain('never been committed');
    expect(message).toContain('removed from disk permanently');
    expect(message).toContain('cannot be recovered');
  });

  it('uses different confirmation text for the two operations', async () => {
    // Guards against a refactor collapsing them back into one message.
    stubConfirm(false);
    respondForDiscard([trackedUnstaged, untrackedFile]);
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });
    const trackedMessage = confirmMessage();

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Delete new.ts'));
    });
    const untrackedMessage = confirmMessage();

    expect(trackedMessage).not.toBe(untrackedMessage);
  });

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  it('offers Delete, not Discard, for an untracked file', async () => {
    respondForDiscard([untrackedFile]);
    await renderPanel();

    await waitFor(() => expect(screen.getByLabelText('Delete new.ts')).toBeDefined());
    expect(screen.queryByLabelText('Discard changes to new.ts')).toBeNull();
  });

  it('offers Discard, not Delete, for a tracked file', async () => {
    respondForDiscard([trackedUnstaged]);
    await renderPanel();

    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );
    expect(screen.queryByLabelText('Delete unstaged.ts')).toBeNull();
  });

  it('offers Discard for a deleted tracked file', async () => {
    // A deleted tracked file is restorable from HEAD, so it belongs on the
    // restore path rather than the delete one.
    respondForDiscard([deletedFile]);
    await renderPanel();

    await waitFor(() => expect(screen.getByLabelText('Discard changes to gone.ts')).toBeDefined());
    expect(screen.queryByLabelText('Delete gone.ts')).toBeNull();
  });

  it('reloads the status after a discard', async () => {
    stubConfirm(true);
    respondForDiscard([trackedUnstaged], { restored: ['src/unstaged.ts'] });
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });

    // Ordering: the re-read must follow the discard, or it reports pre-discard
    // state.
    const channels = invoke.mock.calls.map((call) => call[0]);
    const discardAt = channels.indexOf(IPC_CHANNELS.GIT_DISCARD);
    expect(discardAt).toBeGreaterThan(-1);
    expect(channels.slice(discardAt + 1)).toContain(IPC_CHANNELS.GIT_STATUS);
  });

  it('refreshes and reports the failure when a discard fails', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === IPC_CHANNELS.GIT_DISCARD) {
        return { success: false, error: { code: 'GIT_ERROR', message: 'index.lock exists' } };
      }
      return { success: true, data: status({ files: [trackedUnstaged], isClean: false }) };
    });
    stubConfirm(true);
    await renderPanel();
    await waitFor(() =>
      expect(screen.getByLabelText('Discard changes to unstaged.ts')).toBeDefined()
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Discard changes to unstaged.ts'));
    });

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(loggedErrors()).toContain('Could not discard changes');
  });

  // -------------------------------------------------------------------------
  // Discard All
  // -------------------------------------------------------------------------

  it('discards every unstaged TRACKED file in one call', async () => {
    stubConfirm(true);
    const second: FileStatus = { path: 'b.ts', status: 'modified', staged: false };
    respondForDiscard([trackedUnstaged, second]);
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-all-button'));
    });

    expect(invoke).toHaveBeenCalledWith(IPC_CHANNELS.GIT_DISCARD, {
      repoPath: '/repo',
      files: ['src/unstaged.ts', 'b.ts'],
      deleteUntracked: false,
    });
  });

  it('EXCLUDES untracked files from Discard All', async () => {
    // The decision this test pins: a bulk action is the one where the user does
    // not read each name, so it must not carry irreversible deletions.
    stubConfirm(true);
    respondForDiscard([trackedUnstaged, untrackedFile]);
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-all-button'));
    });

    const payload = payloadsFor(IPC_CHANNELS.GIT_DISCARD)[0] as {
      files: string[];
      deleteUntracked: boolean;
    };
    expect(payload.files).toEqual(['src/unstaged.ts']);
    expect(payload.files).not.toContain('new.ts');
    expect(payload.deleteUntracked).toBe(false);
  });

  it('excludes staged files from Discard All', async () => {
    stubConfirm(true);
    const stagedOne: FileStatus = { path: 'staged.ts', status: 'modified', staged: true };
    respondForDiscard([trackedUnstaged, stagedOne]);
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-all-button'));
    });

    const payload = payloadsFor(IPC_CHANNELS.GIT_DISCARD)[0] as { files: string[] };
    expect(payload.files).toEqual(['src/unstaged.ts']);
  });

  it('names the file count in the Discard All confirmation', async () => {
    stubConfirm(false);
    const second: FileStatus = { path: 'b.ts', status: 'modified', staged: false };
    respondForDiscard([trackedUnstaged, second]);
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-all-button'));
    });

    const message = confirmMessage();
    expect(message).toContain('2 files');
    // The names too: a count alone does not let the user check the blast radius.
    expect(message).toContain('src/unstaged.ts');
    expect(message).toContain('b.ts');
  });

  it('distinguishes tracked from untracked in the Discard All confirmation', async () => {
    stubConfirm(false);
    respondForDiscard([trackedUnstaged, untrackedFile]);
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-all-button'));
    });

    const message = confirmMessage();
    expect(message).toContain('1 file');
    expect(message).toContain('1 untracked file');
    expect(message).toContain('left alone');
  });

  it('does not send git:discard when Discard All is declined', async () => {
    stubConfirm(false);
    respondForDiscard([trackedUnstaged]);
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-all-button'));
    });

    expect(payloadsFor(IPC_CHANNELS.GIT_DISCARD)).toEqual([]);
  });

  it('disables Discard All when only untracked files are unstaged', async () => {
    // An enabled button that provably cannot act would be a trap.
    respondForDiscard([untrackedFile]);
    await renderPanel();

    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());
    expect(
      (screen.getByTestId('discard-all-button') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('disables Discard All when there is nothing unstaged', async () => {
    respondForDiscard([{ path: 'staged.ts', status: 'modified', staged: true }]);
    await renderPanel();

    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());
    expect(
      (screen.getByTestId('discard-all-button') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('enables Discard All when a tracked file is unstaged', async () => {
    respondForDiscard([trackedUnstaged]);
    await renderPanel();

    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());
    expect(
      (screen.getByTestId('discard-all-button') as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('does not confirm at all when Discard All has nothing to act on', async () => {
    const confirmSpy = stubConfirm(true);
    respondForDiscard([untrackedFile]);
    await renderPanel();
    await waitFor(() => expect(screen.getByTestId('discard-all-button')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTestId('discard-all-button'));
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(payloadsFor(IPC_CHANNELS.GIT_DISCARD)).toEqual([]);
  });
});
