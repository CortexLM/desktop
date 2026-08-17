import * as React from 'react';
import { ArrowUp, ChevronDown, FileText, GitBranch, Globe, Pencil, RefreshCw, RotateCcw } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import type { GitFileStatus, GitStatusResponse } from '@cortex-ide/shared';
import { GitStashPanel } from '../git/GitStashPanel';

type DiffStats = Record<string, { additions: number; deletions: number }>;

export function GitContextPanel({ repoPath }: { repoPath: string | null }) {
  const [status, setStatus] = React.useState<GitStatusResponse | null>(null);
  const [diffStats, setDiffStats] = React.useState<DiffStats>({});
  const [message, setMessage] = React.useState('feat: harden upload validation across surface');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!repoPath) return;
    try {
      setStatus(await ipc.git.status({ repoPath }));
    } catch {
      setStatus(null);
    }
    // Per-file +/- counts, as in Paper's file rows. Best effort: the rows
    // render without counts when the diff endpoint has nothing for a path.
    try {
      const diff = await ipc.git.diff({ repoPath });
      const stats: DiffStats = {};
      for (const entry of diff.diffs ?? []) {
        stats[entry.path] = { additions: entry.additions, deletions: entry.deletions };
      }
      setDiffStats(stats);
    } catch {
      setDiffStats({});
    }
  }, [repoPath]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const staged = status?.files.filter((file) => file.staged) ?? [];
  const unstaged = status?.files.filter((file) => !file.staged) ?? [];
  const clean = (status?.files.length ?? 0) === 0;

  const commit = async (andSync: boolean) => {
    if (!repoPath || !message.trim()) return;
    setBusy(true);
    try {
      await ipc.git.commit({ repoPath, message });
      if (andSync) {
        await ipc.git.push({ repoPath });
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside
      className="w-[var(--panel-context)] flex-shrink-0 border-l border-border bg-wash flex flex-col min-h-0"
      data-testid="git-context-panel"
      aria-label="Git"
    >
      <div className="h-10 px-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <GitBranch className="w-3.5 h-3.5 text-text-tertiary" />
          Git
        </div>
        <div className="flex items-center gap-2 text-text-tertiary">
          <button type="button" onClick={() => void load()} aria-label="Refresh git">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="h-[38px] px-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] min-w-0">
          <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-mono truncate">{status?.branch ?? 'main'}</span>
          <Pencil className="w-3 h-3 text-text-tertiary flex-shrink-0" />
        </div>
        <div className="flex items-center gap-1 text-text-tertiary">
          <Globe className="w-3.5 h-3.5" />
          <ChevronDown className="w-3 h-3" />
        </div>
      </div>

      <div className="h-[30px] px-3 flex items-center justify-between">
        {/* Ahead/behind slot; Paper shows "--" when in sync. */}
        <span className="font-mono text-[12px] text-text-tertiary">
          {status && (status.ahead > 0 || status.behind > 0)
            ? `↑${status.ahead} ↓${status.behind}`
            : '--'}
        </span>
        <button
          type="button"
          className="h-6 px-2 rounded-[6px] border border-border text-[12px] flex items-center gap-1"
          onClick={() => repoPath && void ipc.git.pull({ repoPath }).then(load)}
        >
          <RotateCcw className="w-3 h-3" />
          sync
          <ChevronDown className="w-2.5 h-2.5 text-text-tertiary" />
        </button>
      </div>

      <div className="px-3 flex-1 min-h-0 overflow-auto scrollbar-thin">
        {clean ? (
          <p className="text-[13px] text-text-tertiary py-6" data-testid="git-clean">
            Working tree clean
          </p>
        ) : (
          <>
            <FileGroup title="Staged" count={staged.length} files={staged} stats={diffStats} />
            <FileGroup title="Changes" count={unstaged.length} files={unstaged} stats={diffStats} />
            {staged.length > 0 && (
              <button type="button" className="w-full text-right text-[12px] text-red py-2">
                revert all
              </button>
            )}
          </>
        )}
        {repoPath && <GitStashPanel repoPath={repoPath} />}
      </div>

      <div className="flex-shrink-0 border-t border-border p-3 flex flex-col gap-2">
        <div className="text-[13px] font-medium">Commit</div>
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-medium text-text-secondary">Highlights</div>
          <ChevronDown className="w-3 h-3 text-text-tertiary" />
        </div>
        <div className="rounded-[10px] border border-border-soft bg-elevated p-2 text-[12px] text-text space-y-1">
          <p>Shared sanitize helper for upload surfaces.</p>
          <p>Presign and queue paths updated together.</p>
          <p>Validation covers empty and oversized files.</p>
        </div>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="h-[30px] px-2 rounded-md border border-border bg-elevated text-[12px] font-mono text-text"
          aria-label="Commit message"
        />
        <div className="flex items-center gap-2">
          <button type="button" className="h-7 px-2 rounded-[6px] border border-border text-[12px] flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            generate
          </button>
          <button
            type="button"
            disabled={busy || staged.length === 0}
            onClick={() => void commit(false)}
            className="h-7 px-2 rounded-[6px] border border-border text-[12px]"
          >
            commit
          </button>
          <button
            type="button"
            disabled={busy || staged.length === 0}
            onClick={() => void commit(true)}
            className="h-7 px-2 rounded-[6px] bg-tint-strong text-text text-[12px] font-medium flex-1 flex items-center justify-center gap-1 disabled:opacity-60"
          >
            <ArrowUp className="w-3 h-3" />
            commit & sync
          </button>
        </div>
      </div>
    </aside>
  );
}

function FileGroup({
  title,
  count,
  files,
  stats,
}: {
  title: string;
  count: number;
  files: GitFileStatus[];
  stats: DiffStats;
}) {
  if (count === 0) return null;
  return (
    <div className="py-1">
      <div className="h-7 flex items-center gap-1.5 text-[12px] text-text-secondary">
        <ChevronDown className="w-3 h-3 text-text-tertiary" />
        <span>{title}</span>
        <span>{count}</span>
      </div>
      {files.map((file) => {
        const stat = stats[file.path];
        return (
          <div key={file.path} className="h-[26px] flex items-center gap-2 text-[12px]">
            <span className={`w-3 flex-shrink-0 font-medium ${statusColor(file.status)}`}>
              {statusLetter(file.status)}
            </span>
            <FileText className="w-3 h-3 text-text-tertiary flex-shrink-0" />
            <span className="font-mono truncate flex-1">{file.path}</span>
            {stat && (
              <span className="font-mono flex-shrink-0">
                <span className="text-green">+{stat.additions}</span>{' '}
                <span className="text-red">-{stat.deletions}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function statusLetter(status: GitFileStatus['status']): string {
  if (status === 'added' || status === 'untracked') return 'A';
  if (status === 'deleted') return 'D';
  if (status === 'renamed') return 'R';
  return 'M';
}

function statusColor(status: GitFileStatus['status']): string {
  if (status === 'added' || status === 'untracked') return 'text-green';
  if (status === 'deleted') return 'text-red';
  return 'text-amber';
}
