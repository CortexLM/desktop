import * as React from 'react';
import { GitBranch, Pencil, RefreshCw, RotateCcw } from 'lucide-react';
import { ipc } from '../../lib/ipc';
import type { GitFileStatus, GitStatusResponse } from '@cortex-ide/shared';
import { GitStashPanel } from '../git/GitStashPanel';

export function GitContextPanel({ repoPath }: { repoPath: string | null }) {
  const [status, setStatus] = React.useState<GitStatusResponse | null>(null);
  const [message, setMessage] = React.useState('feat: harden upload validation across surface');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!repoPath) return;
    try {
      setStatus(await ipc.git.status({ repoPath }));
    } catch {
      setStatus(null);
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
          Git
          <button type="button" onClick={() => void load()} aria-label="Refresh git">
            <RefreshCw className="w-3.5 h-3.5 text-text-tertiary" />
          </button>
        </div>
      </div>

      <div className="h-[38px] px-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] min-w-0">
          <GitBranch className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-mono truncate">{status?.branch ?? 'main'}</span>
          <Pencil className="w-3 h-3 text-text-tertiary flex-shrink-0" />
        </div>
        <button
          type="button"
          className="h-6 px-2 rounded-md border border-border text-[12px] flex items-center gap-1"
          onClick={() => repoPath && void ipc.git.pull({ repoPath }).then(load)}
        >
          <RotateCcw className="w-3 h-3" />
          sync
        </button>
      </div>

      <div className="px-3 flex-1 min-h-0 overflow-auto scrollbar-thin">
        {clean ? (
          <p className="text-[13px] text-text-tertiary py-6" data-testid="git-clean">
            Working tree clean
          </p>
        ) : (
          <>
            <FileGroup title="Staged" count={staged.length} files={staged} />
            <FileGroup title="Changes" count={unstaged.length} files={unstaged} />
            {staged.length > 0 && (
              <button type="button" className="text-[12px] text-red py-2">
                revert all
              </button>
            )}
          </>
        )}
        {repoPath && <GitStashPanel repoPath={repoPath} />}
      </div>

      <div className="flex-shrink-0 border-t border-border p-3 flex flex-col gap-2">
        <div className="text-[13px] font-medium">Commit</div>
        <div className="rounded-[10px] border border-border bg-elevated p-2 text-[12px] text-text-secondary space-y-1">
          <div className="text-text-tertiary">Highlights</div>
          <p>Adds a shared sanitize helper and updates presign, queue, and upload surfaces.</p>
        </div>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="h-[30px] px-2 rounded-md border border-border bg-page text-[12px] font-mono"
          aria-label="Commit message"
        />
        <div className="flex items-center gap-2">
          <button type="button" className="h-7 px-2 rounded-md border border-border text-[12px]">
            generate
          </button>
          <button
            type="button"
            disabled={busy || staged.length === 0}
            onClick={() => void commit(false)}
            className="h-7 px-2 rounded-md border border-border text-[12px]"
          >
            commit
          </button>
          <button
            type="button"
            disabled={busy || staged.length === 0}
            onClick={() => void commit(true)}
            className="h-7 px-2 rounded-md bg-accent text-page text-[12px]"
          >
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
}: {
  title: string;
  count: number;
  files: GitFileStatus[];
}) {
  if (count === 0) return null;
  return (
    <div className="py-1">
      <div className="h-7 flex items-center gap-2 text-[12px] text-text-secondary">
        <span>{title}</span>
        <span>{count}</span>
      </div>
      {files.map((file) => (
        <div key={file.path} className="h-[26px] flex items-center gap-2 text-[12px]">
          <span className="font-mono truncate flex-1">{file.path}</span>
          <span className="w-4 flex-shrink-0 text-text-tertiary uppercase">{file.status[0]}</span>
          <span className="font-mono flex-shrink-0 text-green">+</span>
          <span className="font-mono flex-shrink-0 text-red">-</span>
        </div>
      ))}
    </div>
  );
}
