import * as React from 'react';
import { ipc } from '../../lib/ipc';
import { DiffViewer } from '../workspace/DiffViewer';

export function ReviewView({ workspacePath }: { workspacePath: string | null }) {
  const [files, setFiles] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workspacePath) return;
    void ipc.git.status({ repoPath: workspacePath }).then((status) => {
      setFiles(status.files.map((file) => file.path));
    });
  }, [workspacePath]);

  return (
    <div className="h-full flex" data-testid="review-view">
      <div className="w-64 border-r border-border p-3 overflow-auto">
        <h1 className="text-sm font-medium mb-3">Review</h1>
        {files.length === 0 ? (
          <p className="text-sm text-text-tertiary">No changes to review.</p>
        ) : (
          files.map((file) => (
            <button
              key={file}
              type="button"
              onClick={() => setSelected(file)}
              className="block w-full text-left text-xs font-mono py-1 truncate"
            >
              {file}
            </button>
          ))
        )}
      </div>
      <div className="flex-1 min-w-0">
        {selected && workspacePath ? (
          <DiffViewer repoPath={workspacePath} filePath={selected} onClose={() => setSelected(null)} />
        ) : (
          <p className="p-6 text-sm text-text-secondary">Pick a changed file.</p>
        )}
      </div>
    </div>
  );
}
