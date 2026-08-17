/**
 * GitStashPanel - UI pour gérer les stashes Git
 */

import { useState, useEffect, useCallback } from 'react';
import { Archive, Plus, Trash2, GitBranch, Download, RefreshCw } from 'lucide-react';
// Reuse the channel-map types so the panel and the IPC contract can't drift.
import type { StashEntry, StashDiff } from '../../types/ipc-contract';

export interface GitStashPanelProps {
  className?: string;
  repoPath?: string;
}

export function GitStashPanel({ className = '', repoPath }: GitStashPanelProps) {
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [selectedStash, setSelectedStash] = useState<number | null>(null);
  const [stashDiff, setStashDiff] = useState<StashDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stashMessage, setStashMessage] = useState('');
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);

  useEffect(() => {
    if (repoPath) {
      loadStashes();
    }
  }, [repoPath]);

  const loadStashes = useCallback(async () => {
    if (!repoPath) return;

    setIsLoading(true);
    try {
      const response = await window.ipc.invoke('git:stash-list', { repoPath });
      if (response.success) {
        setStashes(response.data?.stashes ?? []);
      }
    } catch (error) {
      console.error('Failed to load stashes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [repoPath]);

  const loadStashDiff = useCallback(async (stashIndex: number) => {
    if (!repoPath) return;

    try {
      const response = await window.ipc.invoke('git:stash-show', {
        repoPath,
        stashIndex,
      });
      if (response.success) {
        setStashDiff(response.data.diff);
      }
    } catch (error) {
      console.error('Failed to load stash diff:', error);
    }
  }, [repoPath]);

  const handleCreate = useCallback(async () => {
    if (!repoPath) return;

    try {
      const response = await window.ipc.invoke('git:stash-save', {
        repoPath,
        message: stashMessage || undefined,
        includeUntracked,
        keepIndex,
      });

      if (response.success) {
        setShowCreateDialog(false);
        setStashMessage('');
        setIncludeUntracked(false);
        setKeepIndex(false);
        loadStashes();
      }
    } catch (error) {
      console.error('Failed to create stash:', error);
    }
  }, [repoPath, stashMessage, includeUntracked, keepIndex, loadStashes]);

  const handleApply = useCallback(async (stashIndex: number) => {
    if (!repoPath) return;

    try {
      const response = await window.ipc.invoke('git:stash-apply', {
        repoPath,
        stashIndex,
      });

      if (response.success) {
        loadStashes();
      }
    } catch (error) {
      console.error('Failed to apply stash:', error);
    }
  }, [repoPath, loadStashes]);

  const handlePop = useCallback(async (stashIndex: number) => {
    if (!repoPath) return;

    try {
      const response = await window.ipc.invoke('git:stash-pop', {
        repoPath,
        stashIndex,
      });

      if (response.success) {
        loadStashes();
        setSelectedStash(null);
        setStashDiff(null);
      }
    } catch (error) {
      console.error('Failed to pop stash:', error);
    }
  }, [repoPath, loadStashes]);

  const handleDrop = useCallback(async (stashIndex: number) => {
    if (!confirm('Delete this stash? This action cannot be undone.')) {
      return;
    }

    if (!repoPath) return;

    try {
      const response = await window.ipc.invoke('git:stash-drop', {
        repoPath,
        stashIndex,
      });

      if (response.success) {
        loadStashes();
        if (selectedStash === stashIndex) {
          setSelectedStash(null);
          setStashDiff(null);
        }
      }
    } catch (error) {
      console.error('Failed to drop stash:', error);
    }
  }, [repoPath, selectedStash, loadStashes]);

  const handleCreateBranch = useCallback(async (stashIndex: number) => {
    const branchName = prompt('Branch name:');
    if (!branchName || !repoPath) return;

    try {
      const response = await window.ipc.invoke('git:stash-branch', {
        repoPath,
        branchName,
        stashIndex,
      });

      if (response.success) {
        loadStashes();
        setSelectedStash(null);
        setStashDiff(null);
      }
    } catch (error) {
      console.error('Failed to create branch from stash:', error);
    }
  }, [repoPath, loadStashes]);

  const handleSelectStash = useCallback((stashIndex: number) => {
    setSelectedStash(stashIndex);
    loadStashDiff(stashIndex);
  }, [loadStashDiff]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className={`flex h-full bg-[#0a0a0a] ${className}`}>
      {/* Stash list */}
      <div className="w-80 border-r border-neutral-800 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-neutral-400" />
            <h2 className="text-sm font-medium">Git Stashes</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={loadStashes}
              className="p-1.5 hover:bg-neutral-800 rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5 text-neutral-400" />
            </button>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="p-1.5 hover:bg-neutral-800 rounded transition-colors"
              title="Create stash"
            >
              <Plus className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
              Loading stashes...
            </div>
          )}

          {!isLoading && stashes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-neutral-500 text-sm">
              <Archive className="w-8 h-8 mb-2 opacity-50" />
              <p>No stashes</p>
              <button
                onClick={() => setShowCreateDialog(true)}
                className="mt-2 text-xs text-blue-400 hover:underline"
              >
                Create one
              </button>
            </div>
          )}

          {!isLoading && stashes.map((stash) => (
            <button
              key={stash.index}
              onClick={() => handleSelectStash(stash.index)}
              className={`w-full px-4 py-3 border-b border-neutral-800 hover:bg-neutral-900 transition-colors text-left ${
                selectedStash === stash.index ? 'bg-neutral-900' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-neutral-200 line-clamp-2">
                  {stash.message}
                </span>
                <span className="text-xs text-neutral-500 whitespace-nowrap">
                  {formatTimestamp(stash.timestamp)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <GitBranch className="w-3 h-3" />
                <span>{stash.branch}</span>
                <span>•</span>
                <span>stash@{'{'}{stash.index}{'}'}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Stash details */}
      <div className="flex-1 flex flex-col">
        {selectedStash === null ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500">
            <Archive className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Select a stash to view details</p>
          </div>
        ) : (
          <>
            {/* Actions bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
              <button
                onClick={() => handleApply(selectedStash)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Apply
              </button>
              <button
                onClick={() => handlePop(selectedStash)}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Pop
              </button>
              <button
                onClick={() => handleCreateBranch(selectedStash)}
                className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded transition-colors flex items-center gap-2"
              >
                <GitBranch className="w-3.5 h-3.5" />
                Branch
              </button>
              <div className="flex-1" />
              <button
                onClick={() => handleDrop(selectedStash)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>

            {/* Diff view */}
            <div className="flex-1 overflow-y-auto p-4">
              {stashDiff ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-neutral-400">
                      {stashDiff.files.length} {stashDiff.files.length === 1 ? 'file' : 'files'} changed
                    </span>
                    <span className="text-green-400">+{stashDiff.totalAdditions}</span>
                    <span className="text-red-400">-{stashDiff.totalDeletions}</span>
                  </div>

                  {/* Files */}
                  {stashDiff.files.map((file, idx) => (
                    <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-neutral-800">
                        <span className="text-sm font-mono">{file.path}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-400">+{file.additions}</span>
                          <span className="text-red-400">-{file.deletions}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
                  Loading diff...
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Create stash dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">Create Stash</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-2">
                  Message (optional)
                </label>
                <input
                  type="text"
                  value={stashMessage}
                  onChange={(e) => setStashMessage(e.target.value)}
                  placeholder="WIP: feature description"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUntracked}
                    onChange={(e) => setIncludeUntracked(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-neutral-300">Include untracked files</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepIndex}
                    onChange={(e) => setKeepIndex(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-neutral-300">Keep staged changes</span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <button
                  onClick={handleCreate}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                >
                  Create Stash
                </button>
                <button
                  onClick={() => {
                    setShowCreateDialog(false);
                    setStashMessage('');
                    setIncludeUntracked(false);
                    setKeepIndex(false);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
