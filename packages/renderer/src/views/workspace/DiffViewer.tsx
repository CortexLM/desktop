/**
 * DiffViewer - Comparaison fichiers avec react-diff-view
 */

import * as React from 'react';
import { parseDiff, Diff, Hunk, tokenize } from 'react-diff-view';
// `unidiff` was imported here but never used, and it is not a dependency of
// this package — the import alone broke the typecheck.
import { ipc } from '../../lib/ipc';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { cn } from '../../lib/utils';
import 'react-diff-view/style/index.css';

interface DiffViewerProps {
  repoPath: string;
  filePath: string;
  staged?: boolean;
  onClose: () => void;
  className?: string;
}

export function DiffViewer({ repoPath, filePath, staged = false, onClose, className }: DiffViewerProps) {
  const [diffText, setDiffText] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadDiff();
  }, [repoPath, filePath, staged]);

  const loadDiff = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipc.git.diff({ repoPath, path: filePath, staged });
      
      if (result.diffs.length === 0) {
        setError('No changes to display');
        return;
      }

      setDiffText(result.diffs[0].diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diff');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center', className)}>
        <div className="bg-background border border-border rounded-lg p-8 shadow-lg">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center', className)}>
        <div className="bg-background border border-border rounded-lg p-6 shadow-lg max-w-md">
          <h3 className="text-sm font-semibold text-text mb-2">Error</h3>
          <p className="text-sm text-red mb-4">{error}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={loadDiff}>Retry</Button>
            <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!diffText) {
    return null;
  }

  const files = parseDiff(diffText);

  return (
    <div
      className={cn('fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4', className)}
      data-testid="diff-viewer"
    >
      <div className="bg-background border border-border rounded-lg shadow-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-text">{filePath}</h3>
            <p className="text-xs text-text-secondary">
              {staged ? 'Staged changes' : 'Unstaged changes'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Diff Content */}
        <div className="flex-1 overflow-auto p-4 bg-surface">
          {files.map((file, index) => (
            <DiffFile key={index} file={file} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DiffFile Component
// ============================================================================

/**
 * Un fichier tel que le renvoie `parseDiff`.
 *
 * `react-diff-view` n'expose pas ses types, donc seuls les champs réellement
 * lus ici sont déclarés — plutôt qu'un `any` sur toute la prop.
 */
type ParsedDiffFile = ReturnType<typeof parseDiff>[number];

interface DiffFileProps {
  file: ParsedDiffFile;
}

function DiffFile({ file }: DiffFileProps) {
  const tokens = tokenize(file.hunks, {
    highlight: false,
    enhancers: [],
  });

  return (
    <div className="font-mono text-xs bg-background border border-border rounded-lg overflow-hidden">
      <Diff
        viewType="split"
        diffType={file.type}
        hunks={file.hunks}
        tokens={tokens}
      >
        {(hunks) =>
          hunks.map((hunk) => (
            <Hunk key={hunk.content} hunk={hunk} />
          ))
        }
      </Diff>
    </div>
  );
}
