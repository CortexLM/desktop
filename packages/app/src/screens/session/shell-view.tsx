import { createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

import { resolveTerminalHost, type TerminalHost } from '../../state/terminal-host.ts';

import '@xterm/xterm/css/xterm.css';
import './shell-view.css';

/**
 * The Shell tab: a real terminal on the session's workspace.
 *
 * The tab rendered nothing at all before this — the workbench declared it and passed
 * `undefined` as its content, so the design's four tabs were three.
 *
 * The PTY lives in main (`node-pty` needs an OS pseudo-terminal, and the renderer is
 * sandboxed with no Node integration). This is the emulator: it draws the bytes and
 * sends the keystrokes, and nothing more.
 */

export interface ShellViewProps {
  /** Scopes the terminal to the run's repository. */
  sessionId: string;
}

/**
 * Colours read from the design tokens rather than hardcoded.
 *
 * A terminal with its own palette is the one surface that would ignore the theme
 * toggle, and it is a large one — the mismatch is obvious the moment someone
 * switches to dark.
 */
function themeFromTokens(): { background: string; foreground: string; cursor: string } {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    background: read('--color-surface', '#ffffff'),
    foreground: read('--color-text', '#1a1a1a'),
    cursor: read('--color-primary', '#1a1a1a'),
  };
}

/**
 * Builds the emulator and attaches it.
 *
 * Separated from the wiring so the component reads as "connect this to that" rather
 * than as terminal configuration.
 */
function createEmulator(container: HTMLElement): { terminal: Terminal; fit: FitAddon } {
  const terminal = new Terminal({
    fontFamily: getComputedStyle(document.documentElement)
      .getPropertyValue('--font-mono-stack')
      .trim(),
    fontSize: 12,
    theme: themeFromTokens(),
    // Unbounded scrollback in a long-running agent session is a memory leak with a
    // scrollbar attached.
    scrollback: 5000,
    cursorBlink: true,
    allowProposedApi: true,
  });

  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(container);
  fit.fit();

  return { terminal, fit };
}

/**
 * Connects an emulator to a PTY in main, and returns the teardown.
 *
 * The id is the awkward part and the reason this is its own function: main assigns
 * it and only reports it once, at creation, so keystrokes typed in the first few
 * hundred milliseconds have nowhere to go. They are buffered rather than dropped.
 */
function connect(
  host: TerminalHost,
  terminal: Terminal,
  sessionId: string,
  setError: (message: string) => void,
): () => void {
  let terminalId = TERMINALS.get(sessionId);
  const pending: string[] = [];

  void host
    .create({ cols: terminal.cols, rows: terminal.rows })
    .then((id) => {
      terminalId = id;
      TERMINALS.set(sessionId, id);
      for (const data of pending.splice(0)) host.write(id, data);
    })
    .catch((caught: unknown) =>
      setError(caught instanceof Error ? caught.message : String(caught)),
    );

  const offData = host.onData((event) => {
    if (event.terminalId === terminalId) terminal.write(event.data);
  });
  const offExit = host.onExit((event) => {
    if (event.terminalId === terminalId) terminal.writeln('\r\n[process exited]');
  });

  terminal.onData((data) => {
    if (terminalId) host.write(terminalId, data);
    else pending.push(data);
  });
  terminal.onResize(({ cols, rows }) => {
    if (terminalId) host.resize(terminalId, cols, rows);
  });

  return () => {
    offData();
    offExit();
  };
}

/**
 * The terminal main assigned to each session.
 *
 * Module scope so reopening the tab reattaches to the same shell instead of spawning
 * a second one: main keeps the PTY alive across the unmount, but the id it chose is
 * only ever reported once, at creation.
 */
const TERMINALS = new Map<string, string>();

export function ShellView(props: ShellViewProps): JSX.Element {
  const host = resolveTerminalHost();
  const [error, setError] = createSignal<string>();

  let container: HTMLDivElement | undefined;

  onMount(() => {
    if (!container) return;

    if (!host.available) {
      // The preview server and the suites have no PTY to open. Said plainly rather
      // than rendering an empty black rectangle that looks like a hung shell.
      setError('A terminal is only available in the desktop app.');
      return;
    }

    const { terminal, fit } = createEmulator(container);

    onCleanup(connect(host, terminal, props.sessionId, setError));

    // The workbench pane is resizable, and xterm does not observe its own container.
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(container);

    onCleanup(() => {
      observer.disconnect();
      terminal.dispose();
      // The PTY is deliberately *not* killed. Leaving the tab should not kill a
      // build half way through, and main keeps it addressable by the same id.
    });
  });

  return (
    <div class="cx-shell">
      <Show when={error()}>
        {(message) => <p class="cx-shell__notice">{message()}</p>}
      </Show>
      <div
        class="cx-shell__surface"
        ref={(element) => {
          container = element;
        }}
      />
    </div>
  );
}
