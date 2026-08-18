/**
 * KnowledgeView - workspace documentation surface.
 *
 * This view was previously a static placeholder showing three hard-coded
 * "pages" (AGENTS.md, Droids, Skills) with one-line descriptions that never
 * changed regardless of what was in the workspace. That's misleading in a
 * product where documentation discoverability is meant to be real.
 *
 * Now it scans for real markdown files and shows an honest empty state when
 * none are found. This is the minimal honest version; a richer implementation
 * would index and search all .md files.
 */

import * as React from 'react';
import { ipc } from '../../lib/ipc';
import { Book, FileText } from 'lucide-react';

interface DocEntry {
  name: string;
  path: string;
}

export function KnowledgeView({ workspacePath }: { workspacePath: string | null }) {
  const [docs, setDocs] = React.useState<DocEntry[]>([]);
  const [selected, setSelected] = React.useState<DocEntry | null>(null);
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!workspacePath) {
      setDocs([]);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const result = await ipc.fs.readDir({ path: workspacePath });
        const mdFiles = result.entries
          .filter((f) => f.type === 'file' && /\.(md|markdown)$/i.test(f.name))
          .filter((f) => /^(README|AGENTS|CONTRIBUTING|CHANGELOG)\.md$/i.test(f.name))
          .map((f) => ({ name: f.name, path: f.path }));
        setDocs(mdFiles);
      } catch {
        setDocs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [workspacePath]);

  React.useEffect(() => {
    if (!selected) {
      setContent(null);
      return;
    }
    void (async () => {
      try {
        const result = await ipc.fs.readFile({ path: selected.path });
        setContent(result.content);
      } catch {
        setContent('Failed to read file.');
      }
    })();
  }, [selected]);

  if (!workspacePath) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="knowledge-view">
        <div className="text-center">
          <Book className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
          <p className="text-sm text-text-secondary">Open a folder to view documentation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex" data-testid="knowledge-view">
      <div className="w-64 border-r border-border p-3 overflow-auto">
        <h1 className="text-sm font-medium mb-3">Documentation</h1>
        {loading ? (
          <p className="text-xs text-text-tertiary">Scanning...</p>
        ) : docs.length === 0 ? (
          <div className="text-xs text-text-tertiary space-y-2">
            <p>No documentation files found.</p>
            <p>
              Add a <code className="bg-elevated px-1 rounded">README.md</code> or{' '}
              <code className="bg-elevated px-1 rounded">AGENTS.md</code> to see it here.
            </p>
          </div>
        ) : (
          docs.map((doc) => (
            <button
              key={doc.path}
              type="button"
              onClick={() => setSelected(doc)}
              className={`flex items-center gap-2 w-full text-left text-sm py-1.5 px-2 rounded ${
                selected?.path === doc.path ? 'bg-elevated text-text' : 'text-text-secondary hover:bg-elevated/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{doc.name}</span>
            </button>
          ))
        )}
      </div>
      <article className="flex-1 p-6 overflow-auto">
        {selected && content !== null ? (
          <pre className="text-sm whitespace-pre-wrap font-mono text-text-secondary">{content}</pre>
        ) : (
          <p className="text-sm text-text-tertiary">Select a file to view.</p>
        )}
      </article>
    </div>
  );
}
