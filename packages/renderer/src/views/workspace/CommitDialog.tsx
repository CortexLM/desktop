/**
 * CommitDialog - UI pour créer des commits
 */

import * as React from 'react';
import { ipc } from '../../lib/ipc';
import type { GitFileStatus } from '@cortex-ide/shared';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Spinner } from '../../components/ui/spinner';
import { cn } from '../../lib/utils';

interface CommitDialogProps {
  repoPath: string;
  files: GitFileStatus[];
  onClose: () => void;
  onCommit: () => void;
  className?: string;
}

export function CommitDialog({ repoPath, files, onClose, onCommit, className }: CommitDialogProps) {
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleCommit = async () => {
    if (!message.trim()) {
      setError('Commit message is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await ipc.git.commit({
        repoPath,
        message: message.trim(),
        files: files.map(f => f.path),
      });
      onCommit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <div
      className={cn('fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4', className)}
      data-testid="commit-dialog"
    >
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text">Commit Changes</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text transition-colors"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Files List */}
          <div className="mb-4">
            <p className="text-xs text-text-secondary mb-2">
              {files.length} file{files.length !== 1 ? 's' : ''} staged
            </p>
            <div className="max-h-32 overflow-y-auto border border-border rounded-md bg-surface">
              {files.map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0"
                >
                  <span className={cn(
                    'font-mono font-semibold',
                    file.status === 'modified' && 'text-yellow-500',
                    file.status === 'added' && 'text-green-500',
                    file.status === 'deleted' && 'text-red',
                  )}>
                    {file.status === 'modified' ? 'M' : file.status === 'added' ? 'A' : 'D'}
                  </span>
                  <span className="text-text truncate">{file.path}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Commit Message */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-text mb-2">
              Commit message
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter commit message..."
              rows={6}
              className="resize-none font-mono text-sm"
              autoFocus
              disabled={loading}
              data-testid="commit-message"
            />
            <p className="text-xs text-text-secondary mt-1">
              Press {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to commit
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 px-3 py-2 bg-red/10 border border-red rounded-md">
              <p className="text-xs text-red">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCommit}
              disabled={loading || !message.trim()}
            >
              {loading ? (
                <>
                  <Spinner className="w-3 h-3 mr-2" />
                  Committing...
                </>
              ) : (
                'Commit'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
