/**
 * CommandPalette - keyboard-first access to files and commands.
 *
 *   Cmd+P        files
 *   Cmd+Shift+P  commands
 *
 * Typing `>` as the first character switches to commands, so both live behind
 * one control and either is reachable without remembering which shortcut you
 * pressed.
 *
 * The list is a single-select listbox: the input keeps focus (so typing keeps
 * filtering) while arrow keys move the active option, and aria-activedescendant
 * tells assistive tech which option that is.
 */

import * as React from 'react';
import { ArrowRight, CornerDownLeft, File, Terminal } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Spinner } from './ui/spinner';
import { cn } from '../lib/utils';
import { fuzzyFilter, highlightSegments, type ScoredItem } from '../lib/fuzzy';
import { type IndexedFile } from '../hooks/use-workspace-files';

export interface Command {
  id: string;
  label: string;
  description?: string;
  /** Synonyms searched alongside the label, e.g. ['sidebar'] for "Toggle Panel". */
  keywords?: string[];
  /** Accelerator shown on the right, already platform-formatted. */
  shortcut?: string;
  icon?: React.ReactNode;
  action: () => void;
}

export type PaletteMode = 'files' | 'commands';

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PaletteMode;
  onModeChange: (mode: PaletteMode) => void;
  commands: Command[];
  files: IndexedFile[];
  isIndexing?: boolean;
  /** True when the file index hit its limits, surfaced as a hint in the footer. */
  filesTruncated?: boolean;
  onSelectFile: (file: IndexedFile) => void;
}

const MAX_VISIBLE_RESULTS = 50;

export function CommandPalette({
  open,
  onOpenChange,
  mode,
  onModeChange,
  commands,
  files,
  isIndexing = false,
  filesTruncated = false,
  onSelectFile,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Start from a clean slate each time it opens; a stale query from last time
  // is never what you want.
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open, mode]);

  // A leading `>` means "commands", mirroring the convention users know. The
  // sigil is stripped before matching so it doesn't skew the scores.
  const isCommandQuery = query.startsWith('>');
  const effectiveMode: PaletteMode = isCommandQuery ? 'commands' : mode;
  const searchTerm = isCommandQuery ? query.slice(1).trimStart() : query;

  const commandResults = React.useMemo(
    () =>
      effectiveMode === 'commands'
        ? fuzzyFilter(
            commands,
            searchTerm,
            (command) => ({
              primary: command.label,
              extra: [...(command.keywords ?? []), command.description ?? ''].filter(Boolean),
            }),
            MAX_VISIBLE_RESULTS
          )
        : [],
    [commands, searchTerm, effectiveMode]
  );

  const fileResults = React.useMemo(
    () =>
      effectiveMode === 'files'
        ? fuzzyFilter(
            files,
            searchTerm,
            (file) => ({ primary: file.name, extra: [file.relativePath] }),
            MAX_VISIBLE_RESULTS
          )
        : [],
    [files, searchTerm, effectiveMode]
  );

  const resultCount = effectiveMode === 'commands' ? commandResults.length : fileResults.length;

  // Clamp when the result set shrinks under the cursor, otherwise Enter would
  // fire on an option that is no longer rendered.
  React.useEffect(() => {
    setActiveIndex((current) => (current >= resultCount ? 0 : current));
  }, [resultCount]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const runActive = () => {
    if (effectiveMode === 'commands') {
      const selected = commandResults[activeIndex]?.item;
      if (!selected) return;
      onOpenChange(false);
      // After the dialog closes, so a command that moves focus isn't fighting
      // the dialog's own focus restoration.
      queueMicrotask(() => selected.action());
      return;
    }

    const selected = fileResults[activeIndex]?.item;
    if (!selected) return;
    onOpenChange(false);
    queueMicrotask(() => onSelectFile(selected));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((current) => (resultCount === 0 ? 0 : (current + 1) % resultCount));
        break;

      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) =>
          resultCount === 0 ? 0 : (current - 1 + resultCount) % resultCount
        );
        break;

      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;

      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(resultCount - 1, 0));
        break;

      case 'Enter':
        event.preventDefault();
        runActive();
        break;

      case 'Tab':
        // Swap modes without reaching for the other shortcut.
        event.preventDefault();
        onModeChange(effectiveMode === 'files' ? 'commands' : 'files');
        setQuery('');
        break;

      // Escape is handled by the Dialog primitive.
      default:
        break;
    }
  };

  const activeOptionId = resultCount > 0 ? `palette-option-${activeIndex}` : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 gap-0 overflow-hidden top-[15%] translate-y-0"
        data-testid="command-palette"
        aria-label={effectiveMode === 'files' ? 'Search files' : 'Search commands'}
      >
        {/* Radix requires a title for labelling; visually redundant with the input. */}
        <DialogTitle className="sr-only">
          {effectiveMode === 'files' ? 'Search files' : 'Search commands'}
        </DialogTitle>

        <div className="flex items-center gap-2 px-4 h-12 border-b border-border">
          {effectiveMode === 'files' ? (
            <File className="w-4 h-4 text-text-tertiary flex-shrink-0" aria-hidden="true" />
          ) : (
            <Terminal className="w-4 h-4 text-text-tertiary flex-shrink-0" aria-hidden="true" />
          )}

          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- a palette that
            // doesn't accept typing the instant it opens defeats its purpose.
            autoFocus
            type="text"
            role="combobox"
            aria-expanded
            aria-controls="palette-results"
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-label={effectiveMode === 'files' ? 'Search files' : 'Search commands'}
            placeholder={
              effectiveMode === 'files'
                ? 'Search files by name...   (type > for commands)'
                : 'Search commands...'
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 h-full bg-transparent text-sm text-text placeholder:text-text-tertiary focus:outline-none"
            data-testid="command-palette-input"
          />

          {isIndexing && effectiveMode === 'files' && <Spinner size="sm" />}
        </div>

        <div
          ref={listRef}
          id="palette-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[420px] overflow-y-auto scrollbar-thin py-1"
        >
          {resultCount === 0 ? (
            <EmptyResults
              mode={effectiveMode}
              query={searchTerm}
              isIndexing={isIndexing}
              hasFiles={files.length > 0}
            />
          ) : effectiveMode === 'commands' ? (
            commandResults.map((result, index) => (
              <CommandRow
                key={result.item.id}
                id={`palette-option-${index}`}
                result={result}
                isActive={index === activeIndex}
                onHover={() => setActiveIndex(index)}
                onSelect={() => {
                  onOpenChange(false);
                  queueMicrotask(() => result.item.action());
                }}
              />
            ))
          ) : (
            fileResults.map((result, index) => (
              <FileRow
                key={result.item.path}
                id={`palette-option-${index}`}
                result={result}
                isActive={index === activeIndex}
                onHover={() => setActiveIndex(index)}
                onSelect={() => {
                  onOpenChange(false);
                  queueMicrotask(() => onSelectFile(result.item));
                }}
              />
            ))
          )}
        </div>

        <div className="h-9 px-4 flex items-center justify-between border-t border-border bg-wash text-xs text-text-tertiary">
          <div className="flex items-center gap-3">
            <Legend keys="↑↓" label="Navigate" />
            <Legend icon={<CornerDownLeft className="w-3 h-3" />} label="Open" />
            <Legend keys="Tab" label="Switch mode" />
            <Legend keys="Esc" label="Close" />
          </div>

          <span>
            {filesTruncated && effectiveMode === 'files'
              ? 'Showing first 20,000 files'
              : `${resultCount} result${resultCount === 1 ? '' : 's'}`}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Legend({
  keys,
  icon,
  label,
}: {
  keys?: string;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="px-1.5 py-0.5 rounded-xs border border-border bg-elevated text-[10px] font-sans flex items-center">
        {icon ?? keys}
      </kbd>
      {label}
    </span>
  );
}

function EmptyResults({
  mode,
  query,
  isIndexing,
  hasFiles,
}: {
  mode: PaletteMode;
  query: string;
  isIndexing: boolean;
  hasFiles: boolean;
}) {
  if (mode === 'files' && isIndexing && !hasFiles) {
    return (
      <div className="px-4 py-10 flex flex-col items-center gap-3 text-sm text-text-secondary">
        <Spinner size="sm" />
        Indexing workspace files...
      </div>
    );
  }

  if (mode === 'files' && !hasFiles) {
    return (
      <p className="px-4 py-10 text-center text-sm text-text-secondary">
        No folder open. Open a folder to search its files.
      </p>
    );
  }

  return (
    <p className="px-4 py-10 text-center text-sm text-text-secondary" data-testid="palette-no-results">
      {query ? (
        <>
          No {mode === 'files' ? 'files' : 'commands'} match{' '}
          <span className="text-text font-medium">&ldquo;{query}&rdquo;</span>
        </>
      ) : (
        `No ${mode} available`
      )}
    </p>
  );
}

function CommandRow({
  id,
  result,
  isActive,
  onHover,
  onSelect,
}: {
  id: string;
  result: ScoredItem<Command>;
  isActive: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const { item, indices } = result;

  return (
    <Row id={id} isActive={isActive} onHover={onHover} onSelect={onSelect}>
      <span className="w-5 flex-shrink-0 flex items-center justify-center text-text-tertiary">
        {item.icon ?? <Terminal className="w-4 h-4" aria-hidden="true" />}
      </span>

      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text truncate">
          <Highlighted text={item.label} indices={indices} />
        </span>
        {item.description && (
          <span className="block text-xs text-text-tertiary truncate">{item.description}</span>
        )}
      </span>

      {item.shortcut ? (
        <kbd className="px-1.5 py-0.5 rounded-xs border border-border bg-elevated text-[10px] font-sans text-text-secondary flex-shrink-0">
          {item.shortcut}
        </kbd>
      ) : (
        <ArrowRight className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" aria-hidden="true" />
      )}
    </Row>
  );
}

function FileRow({
  id,
  result,
  isActive,
  onHover,
  onSelect,
}: {
  id: string;
  result: ScoredItem<IndexedFile>;
  isActive: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const { item, indices } = result;

  return (
    <Row id={id} isActive={isActive} onHover={onHover} onSelect={onSelect}>
      <File className="w-4 h-4 flex-shrink-0 text-text-tertiary" aria-hidden="true" />

      <span className="flex-1 min-w-0">
        <span className="block text-sm text-text truncate">
          <Highlighted text={item.name} indices={indices} />
        </span>
        <span className="block text-xs text-text-tertiary truncate" dir="rtl">
          {item.relativePath}
        </span>
      </span>
    </Row>
  );
}

function Row({
  id,
  isActive,
  onHover,
  onSelect,
  children,
}: {
  id: string;
  isActive: boolean;
  onHover: () => void;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={isActive}
      data-active={isActive}
      onMouseMove={onHover}
      onClick={onSelect}
      className={cn(
        'mx-1 px-3 h-11 rounded-sm flex items-center gap-3 cursor-pointer transition-colors',
        isActive ? 'bg-accent-soft' : 'hover:bg-tint'
      )}
    >
      {children}
    </div>
  );
}

/** Renders matched characters with emphasis so the ranking is explainable. */
function Highlighted({ text, indices }: { text: string; indices: number[] }) {
  const segments = React.useMemo(() => highlightSegments(text, indices), [text, indices]);

  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <mark key={index} className="bg-transparent text-accent font-semibold">
            {segment.text}
          </mark>
        ) : (
          <React.Fragment key={index}>{segment.text}</React.Fragment>
        )
      )}
    </>
  );
}
