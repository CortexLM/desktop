/**
 * FileExplorer - tree view of the workspace.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useEditorStore } from '../../store/editor-store';
import { detectLanguageFromPath } from '../../lib/language-detect';
import { Spinner } from '../../components/ui/spinner';
import { Button } from '../../components/ui/button';
import { Hint } from '../../components/ui/tooltip';
import { EmptyState, ErrorState } from '../../components/EmptyState';
import { useErrorHandler, toErrorMessage } from '../../hooks/use-error-handler';

interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory' | 'symlink';
  children?: FileNode[];
}

export const FileExplorer: React.FC<{ workspacePath?: string }> = ({ workspacePath = '/' }) => {
  const [data, setData] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Load failures are shown in place rather than only logged, so an empty tree
  // is never mistaken for an empty folder.
  const [loadError, setLoadError] = useState<string | null>(null);
  const { openTab } = useEditorStore();
  const { handleError } = useErrorHandler();

  const loadDirectory = useCallback(async (path: string) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await window.cortex.fs.readDir({ path, recursive: false });

      if (!response?.success) {
        throw new Error(response?.error?.message ?? 'Could not read this folder');
      }

      // `entry` is a `FileEntry` from the IPC response, not a `FileNode`; the
      // type is inferred now that `readDir` is typed.
      const nodes: FileNode[] = response.data.entries.map((entry) => ({
        id: entry.path,
        name: entry.name,
        path: entry.path,
        type: entry.type,
        children: entry.type === 'directory' ? [] : undefined,
      }));

      // Directories first, then alphabetical: scanning a mixed list for a
      // subfolder is much slower than scanning a grouped one.
      nodes.sort(compareNodes);
      setData(nodes);
    } catch (error) {
      // Inline only. A toast for the panel you're already looking at is noise.
      setLoadError(toErrorMessage(error));
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory(workspacePath);
  }, [workspacePath, loadDirectory]);

  const handleFileOpen = useCallback(
    async (node: FileNode) => {
      if (node.type !== 'file') return;

      try {
        const response = await window.cortex.editor.openFile({ path: node.path });

        if (!response?.success) {
          throw new Error(response?.error?.message ?? 'Could not read this file');
        }

        // The read's mtime is the baseline any later conflict is measured
        // against; the response already carries it, so there is no extra call.
        openTab(
          node.path,
          response.data.content,
          detectLanguageFromPath(node.path),
          response.data.stats?.mtime
        );
      } catch (error) {
        handleError(error, {
          title: `Could not open ${node.name}`,
          retry: () => void handleFileOpen(node),
        });
      }
    },
    [openTab, handleError]
  );

  const getFileIcon = (name: string, type: string) => {
    if (type === 'directory') return null;

    const extension = name.split('.').pop()?.toLowerCase() ?? '';

    if (['js', 'ts', 'jsx', 'tsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'cs', 'rb', 'php', 'swift', 'kt'].includes(extension)) {
      return <FileCode className="w-4 h-4 text-accent" aria-hidden="true" />;
    }

    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'avif'].includes(extension)) {
      return <FileImage className="w-4 h-4 text-purple" aria-hidden="true" />;
    }

    if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'ini', 'csv'].includes(extension)) {
      return <FileText className="w-4 h-4 text-amber" aria-hidden="true" />;
    }

    return <File className="w-4 h-4 text-text-tertiary" aria-hidden="true" />;
  };

  const Node: React.FC<NodeRendererProps<FileNode>> = ({ node, style, dragHandle }) => {
    const isDirectory = node.data.type === 'directory';

    return (
      <div
        ref={dragHandle}
        style={style}
        role="treeitem"
        aria-expanded={isDirectory ? node.isOpen : undefined}
        aria-selected={node.isSelected}
        tabIndex={0}
        data-testid={isDirectory ? 'directory-item' : 'file-item'}
        data-filename={node.data.name}
        data-filepath={node.data.path}
        className={cn(
          'flex items-center gap-1 px-2 py-1 cursor-pointer select-none rounded-sm transition-colors',
          'hover:bg-tint',
          node.isSelected && 'bg-accent-soft text-accent'
        )}
        onClick={() => {
          if (isDirectory) {
            node.toggle();
          } else {
            void handleFileOpen(node.data);
          }
        }}
        onKeyDown={(event) => {
          // Keyboard parity with the click handler: the tree is unusable
          // without a keyboard path to open a file.
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (isDirectory) {
              node.toggle();
            } else {
              void handleFileOpen(node.data);
            }
          }
        }}
      >
        {isDirectory ? (
          <>
            <span className="flex-shrink-0 text-text-tertiary">
              {node.isOpen ? (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </span>
            <span className="flex-shrink-0">
              {node.isOpen ? (
                <FolderOpen className="w-4 h-4 text-accent" aria-hidden="true" />
              ) : (
                <Folder className="w-4 h-4 text-accent" aria-hidden="true" />
              )}
            </span>
          </>
        ) : (
          <span className="flex-shrink-0 ml-[18px]">
            {getFileIcon(node.data.name, node.data.type)}
          </span>
        )}

        <span className="text-sm truncate">{node.data.name}</span>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-page">
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-border flex items-center justify-between gap-2">
        <span className="text-xs text-text-tertiary truncate" title={workspacePath}>
          {workspacePath}
        </span>

        <Hint content="Refresh">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => void loadDirectory(workspacePath)}
            disabled={isLoading}
            aria-label="Refresh file tree"
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')}
              aria-hidden="true"
            />
          </Button>
        </Hint>
      </div>

      <div className="flex-1 min-h-0 overflow-auto scrollbar-thin">
        <ExplorerBody
          isLoading={isLoading}
          loadError={loadError}
          data={data}
          onRetry={() => void loadDirectory(workspacePath)}
          nodeRenderer={Node}
        />
      </div>
    </div>
  );
};

function ExplorerBody({
  isLoading,
  loadError,
  data,
  onRetry,
  nodeRenderer,
}: {
  isLoading: boolean;
  loadError: string | null;
  data: FileNode[];
  onRetry: () => void;
  nodeRenderer: React.FC<NodeRendererProps<FileNode>>;
}) {
  if (isLoading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (loadError) {
    return <ErrorState title="Could not load folder" message={loadError} onRetry={onRetry} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Folder className="w-8 h-8" />}
        title="This folder is empty"
        description="Nothing to show here yet."
      />
    );
  }

  return (
    <div role="tree" aria-label="Workspace files">
      <Tree
        data={data}
        openByDefault={false}
        width="100%"
        height={1000}
        indent={16}
        rowHeight={26}
        overscanCount={10}
      >
        {nodeRenderer}
      </Tree>
    </div>
  );
}

/** Directories before files, then case-insensitive alphabetical. */
function compareNodes(a: FileNode, b: FileNode): number {
  const aIsDir = a.type === 'directory';
  const bIsDir = b.type === 'directory';
  if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}
