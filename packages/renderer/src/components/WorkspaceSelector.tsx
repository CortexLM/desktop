/**
 * WorkspaceSelector - the startup gate: pick a folder before the workbench opens.
 *
 * Previously the app booted straight into a hardcoded repository path, so it
 * only worked on the machine of whoever wrote that path. This asks once, checks
 * that the folder actually exists before accepting it, and remembers recent
 * choices so the question is a single click from then on.
 *
 * There is no native folder picker here on purpose: the main process exposes no
 * `dialog.showOpenDialog` channel, so a "Browse..." button would be a dead end.
 * A validated path field is honest about what the app can currently do.
 */

import * as React from 'react';
import { Clock, FolderOpen, GitBranch, X } from 'lucide-react';
import { Button } from './ui/button';
import { ValidatedInput, validators } from './ValidatedInput';
import { useToast } from './ui/toast';
import { cn } from '../lib/utils';

const RECENTS_STORAGE_KEY = 'cortex:recent-workspaces';
const MAX_RECENTS = 6;

export interface WorkspaceSelectorProps {
  onOpen: (path: string) => void;
}

interface FolderCheck {
  exists: boolean;
  isGitRepo: boolean;
}

export function WorkspaceSelector({ onOpen }: WorkspaceSelectorProps) {
  const [path, setPath] = React.useState('');
  const [isValid, setIsValid] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [recents, setRecents] = React.useState<string[]>(() => readRecents());
  const toast = useToast();

  const validate = React.useMemo(
    () =>
      validators.compose(
        validators.required('Enter the folder you want to work in'),
        validators.path('Enter an absolute path, e.g. /home/you/project')
      ),
    []
  );

  const openPath = async (candidate: string) => {
    const trimmed = candidate.trim();
    if (!trimmed) return;

    setIsChecking(true);
    try {
      const { exists, isGitRepo } = await checkFolder(trimmed);

      if (!exists) {
        toast.error('Folder not found', `Nothing readable at ${trimmed}`);
        return;
      }

      // Not a blocker: plenty of folders are worth editing without version
      // control. Say so once and carry on.
      if (!isGitRepo) {
        toast.info('No Git repository here', 'Source control features will be unavailable.');
      }

      setRecents(writeRecent(trimmed));
      onOpen(trimmed);
    } catch (error) {
      toast.error(
        'Could not open folder',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsChecking(false);
    }
  };

  const removeRecent = (candidate: string) => {
    setRecents(writeRecents(readRecents().filter((entry) => entry !== candidate)));
  };

  return (
    <div
      className="h-screen w-screen flex items-center justify-center bg-page text-text p-6 overflow-auto"
      data-testid="workspace-selector"
    >
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-md bg-accent text-white flex items-center justify-center text-base font-semibold"
            aria-hidden="true"
          >
            C
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Cortex IDE</h1>
            <p className="text-sm text-text-secondary">Open a folder to get started</p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (isValid) void openPath(path);
          }}
          className="space-y-4"
        >
          <ValidatedInput
            id="workspace-path"
            label="Folder path"
            placeholder="/home/you/projects/my-app"
            hint="Absolute path to the folder you want to open."
            value={path}
            validate={validate}
            onChange={(value, valid) => {
              setPath(value);
              setIsValid(valid);
            }}
            required
            autoComplete="off"
            spellCheck={false}
            data-testid="workspace-path-input"
          />

          <Button
            type="submit"
            disabled={!isValid || isChecking}
            className="w-full"
            data-testid="open-workspace"
          >
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
            {isChecking ? 'Checking folder...' : 'Open folder'}
          </Button>
        </form>

        {recents.length > 0 && (
          <section className="mt-10" aria-labelledby="recent-workspaces-heading">
            <h2
              id="recent-workspaces-heading"
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              Recent
            </h2>

            <ul className="space-y-1">
              {recents.map((recent) => (
                <li key={recent} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void openPath(recent)}
                    disabled={isChecking}
                    className={cn(
                      'flex-1 min-w-0 flex items-center gap-3 px-3 h-10 rounded-sm text-left transition-colors',
                      'hover:bg-tint disabled:opacity-50'
                    )}
                  >
                    <GitBranch
                      className="w-4 h-4 flex-shrink-0 text-text-tertiary"
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate">{basename(recent)}</span>
                      <span className="block text-xs text-text-tertiary truncate">{recent}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => removeRecent(recent)}
                    aria-label={`Remove ${basename(recent)} from recent folders`}
                    className="p-2 rounded-sm text-text-tertiary opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-text hover:bg-tint transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Confirms the path is a readable directory, and whether Git is set up in it.
 *
 * `readDir` is the check because it's the one filesystem call available that
 * fails cleanly for both a missing path and a plain file.
 */
async function checkFolder(path: string): Promise<FolderCheck> {
  const response = await window.cortex.fs.readDir({ path, recursive: false });

  if (!response?.success || !response.data?.entries) {
    return { exists: false, isGitRepo: false };
  }

  const entries = response.data.entries as Array<{ name: string; type: string }>;
  const isGitRepo = entries.some((entry) => entry.name === '.git');

  return { exists: true, isGitRepo };
}

function basename(path: string): string {
  const segments = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return segments[segments.length - 1] || path;
}

// --- Recents persistence -----------------------------------------------------

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((entry): entry is string => typeof entry === 'string').slice(0, MAX_RECENTS);
  } catch {
    // Corrupt or unavailable storage: an empty recents list is a fine fallback.
    return [];
  }
}

/** Moves `path` to the front of the recents list. */
function writeRecent(path: string): string[] {
  const next = [path, ...readRecents().filter((entry) => entry !== path)].slice(0, MAX_RECENTS);
  return writeRecents(next);
}

function writeRecents(next: string[]): string[] {
  try {
    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Recents won't persist; not worth interrupting the user over.
  }
  return next;
}
