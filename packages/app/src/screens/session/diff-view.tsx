import { createSignal, For, type JSX, Show } from 'solid-js';

import { Icon } from '@cortex-ide/ui';

import './diff-view.css';

export type DiffRowKind = 'context' | 'added' | 'removed' | 'hunk';

export interface DiffRow {
  kind: DiffRowKind;
  /** Line number in the new file, or in the old file for a removed line. */
  line?: number;
  text: string;
}

export interface DiffFile {
  path: string;
  added: number;
  removed: number;
  rows: readonly DiffRow[];
}

export interface DiffViewProps {
  files: readonly DiffFile[];
}

/** The marker column, which is what makes a diff readable when copied out as text. */
const MARKERS: Record<DiffRowKind, string> = {
  added: '+',
  removed: '-',
  context: ' ',
  hunk: ' ',
};

/**
 * Parses a unified diff into rows.
 *
 * Line numbers are tracked from the hunk headers rather than counted from the top of the
 * file, because a diff only contains the hunks it touches - counting would number the
 * second hunk as though it followed the first.
 */
export function parseUnifiedDiff(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let newLine = 0;
  let oldLine = 0;

  for (const raw of patch.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      rows.push({ kind: 'hunk', text: raw });
      continue;
    }

    // File headers carry no code, and showing them would put `+++ b/path` in the added
    // colour directly under the path the card already names.
    if (/^(diff |index |--- |\+\+\+ )/.test(raw)) continue;

    if (raw.startsWith('+')) {
      rows.push({ kind: 'added', line: newLine, text: raw.slice(1) });
      newLine += 1;
      continue;
    }

    if (raw.startsWith('-')) {
      rows.push({ kind: 'removed', line: oldLine, text: raw.slice(1) });
      oldLine += 1;
      continue;
    }

    // A trailing empty string from the final newline is not a context line.
    if (raw === '' && rows.length > 0) continue;

    rows.push({ kind: 'context', line: newLine, text: raw.startsWith(' ') ? raw.slice(1) : raw });
    newLine += 1;
    oldLine += 1;
  }

  return rows;
}

function DiffFileCard(props: { file: DiffFile }): JSX.Element {
  const [collapsed, setCollapsed] = createSignal(false);

  return (
    <div class={collapsed() ? 'cx-diff__file cx-diff__file--collapsed' : 'cx-diff__file'}>
      <button
        type="button"
        class="cx-diff__header"
        aria-expanded={!collapsed()}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span class="cx-diff__chevron">
          <Icon name="chevronDownBold" size={10} />
        </span>
        {/* The path is bidi-reversed by CSS so it truncates from the left; the override keeps
            the rendered characters in logical order. */}
        <span class="cx-diff__path">
          <bdi>{props.file.path}</bdi>
        </span>
        <span class="cx-diff__count cx-diff__count--added">+{props.file.added}</span>
        <span class="cx-diff__count cx-diff__count--removed">
          {'\u2212'}
          {props.file.removed}
        </span>
      </button>

      <Show when={!collapsed()}>
        <div class="cx-diff__body">
          <For each={props.file.rows}>
            {(row) => (
              <div class={`cx-diff__row cx-diff__row--${row.kind}`}>
                <span class="cx-diff__gutter">{row.kind === 'hunk' ? '' : row.line}</span>
                <span class="cx-diff__marker" aria-hidden="true">
                  {MARKERS[row.kind]}
                </span>
                <span class="cx-diff__code">{row.text}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

/**
 * The Changes tab.
 *
 * Each file is independently collapsible, because a session that touched twelve files is
 * unreadable as one continuous scroll.
 */
export function DiffView(props: DiffViewProps): JSX.Element {
  return (
    <div class="cx-diff">
      <Show
        when={props.files.length > 0}
        fallback={<p class="cx-diff__empty">No file changes yet.</p>}
      >
        <For each={props.files}>{(file) => <DiffFileCard file={file} />}</For>
      </Show>
    </div>
  );
}
