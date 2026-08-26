import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';

import { Icon, type IconName } from '@cortex-ide/ui';

import { Scrim } from './scrim.tsx';

import './overlay.css';

export interface PaletteCommand {
  id: string;
  label: string;
  /** Group heading, e.g. "Navigate" or "Session". */
  section: string;
  icon?: IconName;
  /** Keyboard shortcut or context shown on the right. */
  hint?: string;
  /** Extra words the query should match, e.g. a repo name behind a friendly label. */
  keywords?: readonly string[];
  disabled?: boolean;
}

export interface CommandPaletteProps {
  commands: readonly PaletteCommand[];
  onRun: (id: string) => void;
  onDismiss: () => void;
  placeholder?: string;
}

/**
 * Scores a command against the query.
 *
 * Substring matching rather than fuzzy: the command set here is small and the labels are
 * short, so fuzzy matching mostly produces surprising hits ("sss" reaching "Settings") in
 * exchange for saving nobody any keystrokes. A prefix match ranks above a mid-string one,
 * and a label match above a keyword one, so typing "se" puts Sessions above Settings only
 * if Sessions is what the label starts with.
 */
function score(command: PaletteCommand, query: string): number | null {
  if (query === '') return 0;

  const needle = query.toLowerCase();
  const label = command.label.toLowerCase();

  if (label.startsWith(needle)) return 3;
  if (label.includes(needle)) return 2;
  if (command.keywords?.some((keyword) => keyword.toLowerCase().includes(needle))) return 1;
  return null;
}

interface Section {
  name: string;
  commands: PaletteCommand[];
}

function PaletteOption(props: {
  command: PaletteCommand;
  highlighted: boolean;
  onRun: (id: string) => void;
}): JSX.Element {
  return (
    <li>
      <button
        type="button"
        class="cx-palette__option"
        data-highlighted={props.highlighted}
        disabled={props.command.disabled}
        onClick={() => props.onRun(props.command.id)}
      >
        <Show when={props.command.icon}>{(name) => <Icon name={name()} size={13} />}</Show>
        <span class="cx-palette__option-label">{props.command.label}</span>
        <Show when={props.command.hint}>
          {(hint) => <span class="cx-palette__option-hint">{hint()}</span>}
        </Show>
      </button>
    </li>
  );
}

/**
 * Groups matches under their section, preserving the order the commands were declared in.
 */
function toSections(commands: readonly PaletteCommand[]): Section[] {
  const grouped: Section[] = [];

  for (const command of commands) {
    const existing = grouped.find((section) => section.name === command.section);
    if (existing) existing.commands.push(command);
    else grouped.push({ name: command.section, commands: [command] });
  }

  return grouped;
}

/**
 * The command palette.
 *
 * Highlight is tracked as an index into the flattened, filtered list rather than as a
 * command id, so arrowing past the end can wrap without looking anything up. It resets to 0
 * whenever the query changes: keeping a stale index would leave the highlight on whatever
 * happened to land in that position after filtering.
 */
/**
 * Filtering and keyboard selection, separated from rendering.
 *
 * The highlight is an index into the flattened selectable list rather than a command id, so
 * wrapping past either end is arithmetic rather than a lookup. Disabled commands are absent
 * from that list entirely, which is why arrowing can never land on one.
 */
function createPaletteSelection(
  commands: () => readonly PaletteCommand[],
  query: () => string,
  onRun: (id: string) => void,
) {
  const [highlighted, setHighlighted] = createSignal(0);

  const matches = createMemo(() => {
    const needle = query().trim();

    return commands()
      .map((command) => ({ command, rank: score(command, needle) }))
      .filter((entry): entry is { command: PaletteCommand; rank: number } => entry.rank !== null)
      .sort((a, b) => b.rank - a.rank)
      .map((entry) => entry.command);
  });

  const selectable = createMemo(() => matches().filter((command) => !command.disabled));

  const move = (offset: number) => {
    const count = selectable().length;
    if (count === 0) return;
    setHighlighted((current) => (current + offset + count) % count);
  };

  return {
    matches,
    sections: createMemo(() => toSections(matches())),
    isHighlighted: (command: PaletteCommand) => selectable()[highlighted()]?.id === command.id,
    resetHighlight: () => setHighlighted(0),
    onKeyDown: (event: KeyboardEvent) => {
      const handlers: Record<string, () => void> = {
        ArrowDown: () => move(1),
        ArrowUp: () => move(-1),
        Enter: () => {
          const command = selectable()[highlighted()];
          if (command) onRun(command.id);
        },
      };

      const handler = handlers[event.key];
      if (!handler) return;
      event.preventDefault();
      handler();
    },
  };
}

export function CommandPalette(props: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = createSignal('');
  const selection = createPaletteSelection(() => props.commands, query, (id) => props.onRun(id));

  return (
    <Scrim label="Command palette" onDismiss={props.onDismiss}>
      <div class="cx-palette">
        <div class="cx-palette__search">
          <Icon name="search" size={15} />
          <input
            type="text"
            class="cx-palette__input"
            placeholder={props.placeholder ?? 'Search commands, sessions and repositories'}
            value={query()}
            aria-label="Search commands"
            // The palette only exists while it is the focused surface, so taking focus on
            // mount is the whole point rather than a hijack.
            autofocus
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              // Reset rather than keep the index: a stale one would leave the highlight on
              // whatever happened to land in that position after filtering.
              selection.resetHighlight();
            }}
            onKeyDown={selection.onKeyDown}
          />
        </div>

        <Show
          when={selection.matches().length > 0}
          fallback={<p class="cx-palette__empty">No matches for “{query()}”.</p>}
        >
          <PaletteResults
            sections={selection.sections()}
            isHighlighted={selection.isHighlighted}
            onRun={props.onRun}
          />
        </Show>
      </div>
    </Scrim>
  );
}

function PaletteResults(props: {
  sections: Section[];
  isHighlighted: (command: PaletteCommand) => boolean;
  onRun: (id: string) => void;
}): JSX.Element {
  return (
    <ul class="cx-palette__results">
      <For each={props.sections}>
        {(section) => (
          <>
            <li class="cx-palette__section">{section.name}</li>
            <For each={section.commands}>
              {(command) => (
                <PaletteOption
                  command={command}
                  highlighted={props.isHighlighted(command)}
                  onRun={props.onRun}
                />
              )}
            </For>
          </>
        )}
      </For>
    </ul>
  );
}
