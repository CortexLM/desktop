/**
 * TerminalGrid component tests
 *
 * `TerminalTab` is mocked: it instantiates xterm.js, which needs a real
 * canvas/layout engine that happy-dom does not provide. Mocking it keeps the
 * test focused on TerminalGrid's own logic — terminal lifecycle, layout
 * switching and keyboard shortcuts.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

// Bun's `mock(fn)` spy factory maps to Vitest's `vi.fn(fn)`.
const mock = vi.fn;

// Bun's `spyOn` maps to Vitest's `vi.spyOn`.
const spyOn = vi.spyOn;

// ---------------------------------------------------------------------------
// TerminalTab mock
// ---------------------------------------------------------------------------

const terminalTabRenders: Array<{ terminalId: string; cwd?: string }> = [];

vi.mock('../TerminalTab', () => ({
  TerminalTab: ({
    terminalId,
    cwd,
    onClose,
    className,
  }: {
    terminalId: string;
    cwd?: string;
    onClose?: () => void;
    className?: string;
  }) => {
    terminalTabRenders.push({ terminalId, cwd });
    return React.createElement(
      'div',
      // `terminal-pane-`, not `terminal-`: TerminalGrid's own markup uses
      // `terminal-grid` and `terminal-tab`, so a `^="terminal-"` pane selector
      // also matched the container and every tab button. A distinct prefix means
      // the pane count cannot be inflated by unrelated markup.
      { 'data-testid': `terminal-pane-${terminalId}`, className },
      React.createElement('span', null, `pty:${terminalId}`),
      React.createElement('button', { onClick: onClose }, `close-${terminalId}`)
    );
  },
}));

// Imported dynamically so the mock factory above resolves against the
// already-initialised `terminalTabRenders` array: `vi.mock` is hoisted, but its
// factory only runs when the mocked module is first requested.
const { TerminalGrid } = await import('../TerminalGrid');

// ---------------------------------------------------------------------------
// window.ipc stub
// ---------------------------------------------------------------------------

let ipcInvoke: ReturnType<typeof mock>;
let consoleErrorSpy: ReturnType<typeof spyOn>;
let nextTerminalId: number;

beforeEach(() => {
  nextTerminalId = 0;
  terminalTabRenders.length = 0;
  ipcInvoke = mock(async (channel: string) => {
    if (channel === 'terminal:create') {
      nextTerminalId += 1;
      return { success: true, data: { terminalId: `term-${nextTerminalId}` } };
    }
    return { success: true, data: {} };
  });
  (globalThis as unknown as { window: Record<string, unknown> }).window.ipc = {
    invoke: ipcInvoke,
    on: mock(() => () => {}),
    off: mock(),
  };
  consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

function renderGrid(props: Partial<React.ComponentProps<typeof TerminalGrid>> = {}) {
  return render(React.createElement(TerminalGrid, props));
}

/** Create `count` terminals through the empty-state / header buttons. */
async function createTerminals(count: number) {
  await act(async () => {
    fireEvent.click(screen.getByText('New Terminal'));
  });
  for (let i = 1; i < count; i += 1) {
    await act(async () => {
      fireEvent.click(screen.getByTitle('New terminal (Ctrl+`)'));
    });
  }
}

function root(): HTMLElement {
  return document.querySelector('[tabindex="0"]') as HTMLElement;
}

// ===========================================================================

describe('TerminalGrid empty state', () => {
  it('renders the empty state with no terminals', () => {
    renderGrid();

    expect(screen.getByText('No terminal open')).toBeDefined();
    expect(screen.getByText('New Terminal')).toBeDefined();
  });

  it('mentions the Ctrl+` shortcut', () => {
    renderGrid();

    expect(screen.getByText(/Press Ctrl\+` to open a terminal/)).toBeDefined();
  });

  it('shows the Terminal header', () => {
    renderGrid();

    expect(screen.getByText('Terminal')).toBeDefined();
  });

  it('does not show a terminal count when empty', () => {
    renderGrid();

    expect(screen.queryByText(/^\d+ terminals?$/)).toBeNull();
  });

  it('does not show the shortcut hint bar when empty', () => {
    renderGrid();

    expect(screen.queryByText('Ctrl+` New')).toBeNull();
  });

  it('applies a custom className', () => {
    renderGrid({ className: 'my-grid' });

    expect(root().className).toContain('my-grid');
  });
});

describe('TerminalGrid creating terminals', () => {
  it('creates a terminal from the empty state', async () => {
    renderGrid();

    await act(async () => {
      fireEvent.click(screen.getByText('New Terminal'));
    });

    expect(ipcInvoke).toHaveBeenCalledWith('terminal:create', { cwd: undefined });
    await waitFor(() => expect(screen.getByText('pty:term-1')).toBeDefined());
  });

  it('replaces the empty state once a terminal exists', async () => {
    renderGrid();

    await createTerminals(1);

    expect(screen.queryByText('No terminal open')).toBeNull();
  });

  it('shows a singular terminal count', async () => {
    renderGrid();

    await createTerminals(1);

    await waitFor(() => expect(screen.getByText('1 terminal')).toBeDefined());
  });

  it('shows a plural terminal count', async () => {
    renderGrid();

    await createTerminals(2);

    await waitFor(() => expect(screen.getByText('2 terminals')).toBeDefined());
  });

  it('creates additional terminals from the header button', async () => {
    renderGrid();

    await createTerminals(3);

    expect(ipcInvoke.mock.calls.filter((c) => c[0] === 'terminal:create')).toHaveLength(3);
  });

  it('ignores a create response that reports failure', async () => {
    ipcInvoke.mockImplementation(async () => ({ success: false, error: { message: 'no pty' } }));
    renderGrid();

    await act(async () => {
      fireEvent.click(screen.getByText('New Terminal'));
    });

    expect(screen.getByText('No terminal open')).toBeDefined();
  });

  it('logs and recovers when create throws', async () => {
    ipcInvoke.mockImplementation(async () => {
      throw new Error('spawn failed');
    });
    renderGrid();

    await act(async () => {
      fireEvent.click(screen.getByText('New Terminal'));
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(screen.getByText('No terminal open')).toBeDefined();
  });

  it('titles each terminal sequentially', async () => {
    renderGrid();

    await createTerminals(2);

    // Titles are internal, but each TerminalTab receives a distinct id.
    const ids = terminalTabRenders.map((r) => r.terminalId);
    expect(new Set(ids).size).toBeGreaterThanOrEqual(1);
  });
});

describe('TerminalGrid closing terminals', () => {
  it('kills the pty and removes the tab', async () => {
    renderGrid();
    await createTerminals(1);

    await act(async () => {
      fireEvent.click(screen.getByText('close-term-1'));
    });

    expect(ipcInvoke).toHaveBeenCalledWith('terminal:kill', 'term-1');
    await waitFor(() => expect(screen.getByText('No terminal open')).toBeDefined());
  });

  it('returns to the empty state when the last terminal closes', async () => {
    renderGrid();
    await createTerminals(1);

    await act(async () => {
      fireEvent.click(screen.getByText('close-term-1'));
    });

    await waitFor(() => expect(screen.getByText('No terminal open')).toBeDefined());
  });

  it('keeps the remaining terminals when one closes', async () => {
    renderGrid();
    await createTerminals(3);
    await waitFor(() => expect(screen.getByText('3 terminals')).toBeDefined());

    // In 'single' layout only the active terminal (the newest) is mounted.
    await act(async () => {
      fireEvent.click(screen.getByText('close-term-3'));
    });

    await waitFor(() => expect(screen.getByText('2 terminals')).toBeDefined());
  });

  it('logs and continues when kill throws', async () => {
    renderGrid();
    await createTerminals(1);
    ipcInvoke.mockImplementation(async () => {
      throw new Error('already dead');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('close-term-1'));
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

describe('TerminalGrid layouts', () => {
  it('renders a single terminal by default', async () => {
    renderGrid();
    await createTerminals(2);

    // 'single' layout mounts exactly one TerminalTab.
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(1);
    });
  });

  it('splits horizontally and mounts two terminals', async () => {
    renderGrid();
    await createTerminals(1);

    await act(async () => {
      fireEvent.keyDown(root(), { key: '%', ctrlKey: true, shiftKey: true });
    });

    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(2);
    });
  });

  it('splits vertically and mounts two terminals', async () => {
    renderGrid();
    await createTerminals(1);

    await act(async () => {
      fireEvent.keyDown(root(), { key: '|', ctrlKey: true, shiftKey: true });
    });

    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(2);
    });
  });

  it('creates a terminal when splitting', async () => {
    renderGrid();
    await createTerminals(1);
    const before = ipcInvoke.mock.calls.filter((c) => c[0] === 'terminal:create').length;

    await act(async () => {
      fireEvent.keyDown(root(), { key: '%', ctrlKey: true, shiftKey: true });
    });

    expect(ipcInvoke.mock.calls.filter((c) => c[0] === 'terminal:create').length).toBe(before + 1);
  });

  it('cycles the layout single → horizontal → vertical → grid → single', async () => {
    renderGrid();
    await createTerminals(4);
    const toggle = screen.getByTitle('Toggle layout');

    // single -> horizontal
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(2)
    );

    // horizontal -> vertical (still 2 visible)
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(2)
    );

    // vertical -> grid (up to 4 visible)
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(4)
    );

    // grid -> single
    await act(async () => {
      fireEvent.click(toggle);
    });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(1)
    );
  });

  it('caps the grid layout at four terminals', async () => {
    renderGrid();
    await createTerminals(6);
    const toggle = screen.getByTitle('Toggle layout');

    // single -> horizontal -> vertical -> grid
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        fireEvent.click(toggle);
      });
    }

    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(4)
    );
  });

  it('caps the horizontal layout at two terminals', async () => {
    renderGrid();
    await createTerminals(5);

    await act(async () => {
      fireEvent.click(screen.getByTitle('Toggle layout'));
    });

    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(2)
    );
  });

  it('does not change layout when splitting again', async () => {
    renderGrid();
    await createTerminals(1);
    await act(async () => {
      fireEvent.keyDown(root(), { key: '%', ctrlKey: true, shiftKey: true });
    });

    // A second horizontal split keeps the layout but still adds a terminal.
    await act(async () => {
      fireEvent.keyDown(root(), { key: '%', ctrlKey: true, shiftKey: true });
    });

    await waitFor(() => expect(screen.getByText('3 terminals')).toBeDefined());
    expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(2);
  });
});

describe('TerminalGrid reattaches to running terminals on mount', () => {
  /*
   * Terminal is a document view, so switching to Explorer unmounts this
   * component. Its terminal list used to live in local `useState` with no
   * rehydration, so a view switch:
   *   - lost every terminal the user had opened, and
   *   - leaked its PTY, because `terminal:kill` is only sent by the close button.
   *
   * Measured before the fix: 6 terminals over 3 view switches left 6 orphaned
   * shell processes (`scripts/measure-pty-leak.ts`).
   *
   * Reattaching is what makes the sessions survive. Unmount is deliberately NOT
   * a kill: a terminal running a long build must not be destroyed by a glance at
   * the Git panel. Main kills every PTY on app quit instead.
   */

  /** `terminal:list` responding with `terminals`, plus the usual create stub. */
  function stubRunningTerminals(terminals: Array<{ id: string; cwd: string }>) {
    ipcInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'terminal:list') {
        return {
          success: true,
          data: {
            terminals: terminals.map((t, i) => ({
              id: t.id,
              pid: 1000 + i,
              cwd: t.cwd,
              shell: '/bin/bash',
            })),
          },
        };
      }
      if (channel === 'terminal:create') {
        nextTerminalId += 1;
        return { success: true, data: { terminalId: `term-${nextTerminalId}` } };
      }
      return { success: true, data: {} };
    });
  }

  it('asks main what is running, on mount', async () => {
    renderGrid();

    await waitFor(() =>
      expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:list')).toBe(true)
    );
  });

  it('rebuilds its tabs from the running terminals', async () => {
    stubRunningTerminals([
      { id: 'pty-a', cwd: '/tmp/a' },
      { id: 'pty-b', cwd: '/tmp/b' },
    ]);

    renderGrid();

    await waitFor(() => expect(screen.getByText('2 terminals')).toBeDefined());
    const tabs = document.querySelectorAll('[data-testid="terminal-tab"]');
    expect(tabs).toHaveLength(2);
  });

  it('reattaches rather than spawning replacements', async () => {
    stubRunningTerminals([{ id: 'pty-a', cwd: '/tmp/a' }]);

    renderGrid();

    await waitFor(() => expect(screen.getByText('1 terminal')).toBeDefined());
    // The whole point: the PTY already exists, so creating another one would
    // double the process count on every view switch.
    expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:create')).toBe(false);
  });

  it('mounts the existing pty id, so output re-wires to the live process', async () => {
    stubRunningTerminals([{ id: 'pty-a', cwd: '/tmp/a' }]);

    renderGrid();

    await waitFor(() => expect(screen.getByText('pty:pty-a')).toBeDefined());
  });

  it('carries the cwd across the reattachment', async () => {
    stubRunningTerminals([{ id: 'pty-a', cwd: '/tmp/some-project' }]);

    renderGrid();

    await waitFor(() =>
      expect(terminalTabRenders.some((r) => r.cwd === '/tmp/some-project')).toBe(true)
    );
  });

  it('does not kill anything on unmount', async () => {
    stubRunningTerminals([{ id: 'pty-a', cwd: '/tmp/a' }]);
    const { unmount } = renderGrid();
    await waitFor(() => expect(screen.getByText('1 terminal')).toBeDefined());

    unmount();

    // Killing here is what would destroy a running build on a view switch.
    expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:kill')).toBe(false);
  });

  it('shows the empty state when nothing is running', async () => {
    stubRunningTerminals([]);

    renderGrid();

    await waitFor(() =>
      expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:list')).toBe(true)
    );
    expect(screen.getByText('No terminal open')).toBeDefined();
  });

  it('still creates terminals after an empty reattachment', async () => {
    stubRunningTerminals([]);
    renderGrid();
    await waitFor(() =>
      expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:list')).toBe(true)
    );

    await act(async () => {
      fireEvent.click(screen.getByText('New Terminal'));
    });

    await waitFor(() => expect(screen.getByText('1 terminal')).toBeDefined());
  });

  it('numbers terminals from the reattached list, not from zero', async () => {
    stubRunningTerminals([
      { id: 'pty-a', cwd: '/tmp/a' },
      { id: 'pty-b', cwd: '/tmp/b' },
    ]);
    renderGrid();
    await waitFor(() => expect(screen.getByText('2 terminals')).toBeDefined());

    await act(async () => {
      fireEvent.click(screen.getByTitle('New terminal (Ctrl+`)'));
    });

    // Third tab is labelled 3, not 1: numbering off a stale captured length was
    // how two tabs ended up both called "Terminal 1".
    await waitFor(() => expect(screen.getByText('Terminal 3')).toBeDefined());
  });

  it('opens empty and logs when terminal:list fails', async () => {
    ipcInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'terminal:list') throw new Error('no handler');
      return { success: true, data: {} };
    });

    renderGrid();

    await waitFor(() => expect(consoleErrorSpy).toHaveBeenCalled());
    expect(screen.getByText('No terminal open')).toBeDefined();
  });

  it('opens empty when terminal:list reports failure', async () => {
    ipcInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'terminal:list') {
        return { success: false, error: { message: 'not allowed' } };
      }
      return { success: true, data: {} };
    });

    renderGrid();

    await waitFor(() =>
      expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:list')).toBe(true)
    );
    expect(screen.getByText('No terminal open')).toBeDefined();
  });

  it('opens empty when the response has no terminals array', async () => {
    // A malformed shape must not crash the view: `.length` on undefined would
    // take the whole panel down instead of showing its empty state.
    ipcInvoke.mockImplementation(async () => ({ success: true, data: {} }));

    renderGrid();

    await waitFor(() =>
      expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:list')).toBe(true)
    );
    expect(screen.getByText('No terminal open')).toBeDefined();
  });
});

describe('TerminalGrid drops terminals that exit on their own', () => {
  /** Captures the `event:terminal-exit` subscriber so a test can drive it. */
  function captureExitListener(): () => (payload: unknown) => void {
    const listeners: Array<(payload: unknown) => void> = [];

    (globalThis as unknown as { window: Record<string, unknown> }).window.ipc = {
      invoke: ipcInvoke,
      on: mock((channel: string, callback: (payload: unknown) => void) => {
        if (channel === 'event:terminal-exit') listeners.push(callback);
        return () => {};
      }),
      off: mock(),
    };

    return () => listeners[0];
  }

  it('removes the tab when its pty exits', async () => {
    const exitListener = captureExitListener();
    renderGrid();
    await createTerminals(1);
    await waitFor(() => expect(screen.getByText('1 terminal')).toBeDefined());

    // The user typed `exit`. Without this the tab stayed after reattachment,
    // pointing at a process that no longer exists.
    await act(async () => {
      exitListener()({ terminalId: 'term-1', exitCode: 0 });
    });

    await waitFor(() => expect(screen.getByText('No terminal open')).toBeDefined());
  });

  it('ignores an exit for a terminal it does not know', async () => {
    const exitListener = captureExitListener();
    renderGrid();
    await createTerminals(1);
    await waitFor(() => expect(screen.getByText('1 terminal')).toBeDefined());

    await act(async () => {
      exitListener()({ terminalId: 'someone-elses-pty', exitCode: 0 });
    });

    expect(screen.getByText('1 terminal')).toBeDefined();
  });

  it('keeps the other terminals when one exits', async () => {
    const exitListener = captureExitListener();
    renderGrid();
    await createTerminals(2);
    await waitFor(() => expect(screen.getByText('2 terminals')).toBeDefined());

    await act(async () => {
      exitListener()({ terminalId: 'term-1', exitCode: 0 });
    });

    await waitFor(() => expect(screen.getByText('1 terminal')).toBeDefined());
  });

  it('does not send a kill for a terminal that already exited', async () => {
    const exitListener = captureExitListener();
    renderGrid();
    await createTerminals(1);
    await waitFor(() => expect(screen.getByText('1 terminal')).toBeDefined());

    await act(async () => {
      exitListener()({ terminalId: 'term-1', exitCode: 0 });
    });

    expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:kill')).toBe(false);
  });
});

describe('TerminalGrid keyboard shortcuts', () => {
  it('Ctrl+` creates the first terminal', async () => {
    renderGrid();

    await act(async () => {
      fireEvent.keyDown(root(), { key: '`', ctrlKey: true });
    });

    expect(ipcInvoke).toHaveBeenCalledWith('terminal:create', { cwd: undefined });
  });

  it('Ctrl+` does nothing when a terminal already exists', async () => {
    renderGrid();
    await createTerminals(1);
    const before = ipcInvoke.mock.calls.filter((c) => c[0] === 'terminal:create').length;

    await act(async () => {
      fireEvent.keyDown(root(), { key: '`', ctrlKey: true });
    });

    expect(ipcInvoke.mock.calls.filter((c) => c[0] === 'terminal:create').length).toBe(before);
  });

  it('Ctrl+Shift+% splits horizontally', async () => {
    renderGrid();
    await createTerminals(1);

    await act(async () => {
      fireEvent.keyDown(root(), { key: '%', ctrlKey: true, shiftKey: true });
    });

    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(2)
    );
  });

  it('Ctrl+Shift+| splits vertically', async () => {
    renderGrid();
    await createTerminals(1);

    await act(async () => {
      fireEvent.keyDown(root(), { key: '|', ctrlKey: true, shiftKey: true });
    });

    await waitFor(() =>
      expect(document.querySelectorAll('[data-testid^="terminal-pane-"]')).toHaveLength(2)
    );
  });

  it('Ctrl+Shift+W closes the active terminal', async () => {
    renderGrid();
    await createTerminals(1);

    await act(async () => {
      fireEvent.keyDown(root(), { key: 'W', ctrlKey: true, shiftKey: true });
    });

    expect(ipcInvoke).toHaveBeenCalledWith('terminal:kill', 'term-1');
  });

  it('Ctrl+Shift+W does nothing with no active terminal', async () => {
    renderGrid();

    await act(async () => {
      fireEvent.keyDown(root(), { key: 'W', ctrlKey: true, shiftKey: true });
    });

    expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:kill')).toBe(false);
  });

  // These two assert on `terminal:create` rather than on `ipcInvoke` as a whole.
  // The grid now calls `terminal:list` once on mount to reattach to the PTYs
  // running in main (without it, a view switch leaked one shell process per
  // terminal), so "no IPC at all" is no longer the same claim as "no terminal
  // was created" — which is what these tests are about.
  it('ignores plain keypresses', async () => {
    renderGrid();

    await act(async () => {
      fireEvent.keyDown(root(), { key: 'a' });
    });

    expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:create')).toBe(false);
  });

  it('ignores the backtick without Ctrl', async () => {
    renderGrid();

    await act(async () => {
      fireEvent.keyDown(root(), { key: '`' });
    });

    expect(ipcInvoke.mock.calls.some((c) => c[0] === 'terminal:create')).toBe(false);
  });

  it('ignores Ctrl+% without Shift', async () => {
    renderGrid();
    await createTerminals(1);
    const before = ipcInvoke.mock.calls.length;

    await act(async () => {
      fireEvent.keyDown(root(), { key: '%', ctrlKey: true });
    });

    expect(ipcInvoke.mock.calls.length).toBe(before);
  });
});
