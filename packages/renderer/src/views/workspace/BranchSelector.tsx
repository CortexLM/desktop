/**
 * BranchSelector - Switch branches avec dropdown
 */

import * as React from 'react';
import { Button } from '../../components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Input } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';
import { cn } from '../../lib/utils';

interface BranchSelectorProps {
  repoPath: string;
  currentBranch: string;
  onBranchChange: () => void;
  className?: string;
}

interface Branch {
  name: string;
  current: boolean;
  commit?: string;
}

// `repoPath` is unused until the git IPC calls flagged by the TODOs below are
// implemented; it stays in the props so callers already pass it.
export function BranchSelector({
  repoPath: _repoPath,
  currentBranch,
  onBranchChange,
  className,
}: BranchSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [newBranchName, setNewBranchName] = React.useState('');
  const [showCreateInput, setShowCreateInput] = React.useState(false);

  const loadBranches = async () => {
    setLoading(true);
    try {
      // TODO: Implémenter git.branches via IPC
      // Pour l'instant, mock data
      setBranches([
        { name: currentBranch, current: true },
        { name: 'main', current: false },
        { name: 'develop', current: false },
        { name: 'feature/test', current: false },
      ]);
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (open) {
      loadBranches();
    }
  }, [open]);

  const handleCheckout = async (branchName: string) => {
    if (branchName === currentBranch) {
      setOpen(false);
      return;
    }

    try {
      // TODO: Implémenter git.checkout via IPC
      console.log('Checkout branch:', branchName);
      setOpen(false);
      onBranchChange();
    } catch (err) {
      console.error('Failed to checkout branch:', err);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    try {
      // TODO: Implémenter git.createBranch via IPC
      console.log('Create branch:', newBranchName);
      setNewBranchName('');
      setShowCreateInput(false);
      setOpen(false);
      onBranchChange();
    } catch (err) {
      console.error('Failed to create branch:', err);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-2', className)}
          data-testid="branch-selector"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-text-secondary">
            <path
              d="M10 10.5C10 11.3284 9.32843 12 8.5 12C7.67157 12 7 11.3284 7 10.5C7 9.67157 7.67157 9 8.5 9C9.32843 9 10 9.67157 10 10.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M7 3.5C7 4.32843 6.32843 5 5.5 5C4.67157 5 4 4.32843 4 3.5C4 2.67157 4.67157 2 5.5 2C6.32843 2 7 2.67157 7 3.5Z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M5.5 5V10M7.5 9L5.5 10"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-sm font-medium">{currentBranch}</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-secondary">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        {/* Header */}
        <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-border">
          <span className="text-xs font-semibold text-text">Branches</span>
          <button
            onClick={() => setShowCreateInput(!showCreateInput)}
            className="text-xs text-accent hover:text-accent/80 transition-colors"
          >
            + New
          </button>
        </div>

        {/* Create Branch */}
        {showCreateInput && (
          <div className="mb-2 px-2">
            <Input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateBranch();
                if (e.key === 'Escape') {
                  setShowCreateInput(false);
                  setNewBranchName('');
                }
              }}
              placeholder="Branch name..."
              className="text-sm h-8"
              autoFocus
            />
          </div>
        )}

        {/* Branches List */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner className="w-4 h-4" />
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto" data-testid="branch-list">
            {branches.map((branch) => (
              <button
                key={branch.name}
                onClick={() => handleCheckout(branch.name)}
                data-testid="branch-item"
                data-branch={branch.name}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm transition-colors text-left',
                  branch.current
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'hover:bg-tint text-text'
                )}
              >
                {branch.current && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M10 3L4.5 8.5L2 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span className={cn(!branch.current && 'ml-5')}>{branch.name}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
