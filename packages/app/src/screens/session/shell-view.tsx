import { createSignal, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

import { resolveColor, THEME_ATTRIBUTE, type Theme } from '@cortex-ide/tokens';

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

export interface TerminalPalette {
  background: string;
  foreground: string;
  cursor: string;
}

/** The theme currently on `<html>`, which is what the token CSS is scoped to. */
function currentTheme(): Theme {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === 'dark' ? 'dark' : 'light';
}

/**
 * Colours read from the design tokens rather than hardcoded.
 *
 * A terminal owns its palette, so it is the one surface that can ignore the
 * theme — and it is a large one. Two things used to let it: the fallbacks were
 * `#ffffff` and `#1a1a1a` whatever the theme, so a terminal built before the
 * token stylesheet resolved came up as a white slab in dark mode; and this ran
 * once, at construction. Both are why the Shell tab stayed light after a toggle.
 *
 * The fallbacks now come from the palette for the theme in force, so an
 * unresolved custom property degrades to the right end of the ramp instead of
 * to white.
 */
export function themeFromTokens(theme: Theme = currentTheme()): TerminalPalette {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: '--color-surface' | '--color-text' | '--color-green') =>
    styles.getPropertyValue(name).trim() || resolveColor(name, theme);

  return {
    background: read('--color-surface'),
    foreground: read('--color-text'),
    // `--color-primary` is the legacy alias for the brand green; the palette is
    // keyed by the Paper name, which is what the fallback has to ask for.
    cursor: read('--color-green'),
  };
}

/**
 * Re-themes the terminal whenever `data-theme` changes on `<html>`.
 *
 * An observer rather than a Solid effect: the attribute is written by the theme
 * provider in `@cortex-ide/ui` directly onto the document, so there is no signal
 * in this module's scope to track.
 */
export function followTheme(terminal: Pick<Terminal, 'options'>): () => void {
  const observer = new MutationObserver(() => {
    terminal.options.theme = themeFromTokens();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [THEME_ATTRIBUTE],
  });
  return () => observer.disconnect();
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
    onCleanup(followTheme(terminal));

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
