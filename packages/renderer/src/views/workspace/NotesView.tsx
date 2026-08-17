/**
 * NotesView - Markdown editor avec preview live
 * 
 * Features:
 * - Editor markdown avec preview live (react-markdown)
 * - Toolbar formatage
 * - Save/load depuis filesystem via IPC
 * - Syntax highlighting paresseux pour les code blocks (voir
 *   components/code/markdown-code-components). Le thème suit la classe `.dark`
 *   en CSS, donc cette vue n'a pas à observer le thème elle-même.
 */

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ipc } from '../../lib/ipc';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Spinner } from '../../components/ui/spinner';
import { markdownCodeComponents } from '../../components/code/markdown-code-components';
import { cn } from '../../lib/utils';

interface NotesViewProps {
  workspaceId: string;
  className?: string;
}

// `workspaceId` is part of the props contract but not needed yet: notes are
// addressed by absolute path.
export function NotesView({ workspaceId: _workspaceId, className }: NotesViewProps) {
  const [content, setContent] = React.useState('');
  const [filePath, setFilePath] = React.useState('');
  const [fileName, setFileName] = React.useState('untitled.md');
  const [isDirty, setIsDirty] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<'edit' | 'preview' | 'split'>('split');

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Sauvegarder automatiquement
  React.useEffect(() => {
    if (!isDirty || !filePath) return;
    
    const timeout = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [content, isDirty, filePath]);

  // Sauvegarder le fichier
  const handleSave = async () => {
    if (!filePath) {
      setError('No file path specified');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // `ipc.fs`, not `ipc.filesystem`, and the request is an object.
      await ipc.fs.writeFile({ path: filePath, content });
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  // Charger un fichier
  const handleLoad = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await ipc.fs.readFile({ path });
      setContent(result.content);
      setFilePath(path);
      setFileName(path.split('/').pop() || 'untitled.md');
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  // Nouveau fichier
  const handleNew = () => {
    if (isDirty && !confirm('Discard unsaved changes?')) return;
    
    setContent('');
    setFilePath('');
    setFileName('untitled.md');
    setIsDirty(false);
  };

  // Insérer du texte formaté
  const insertFormatting = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selected + after + content.substring(end);

    setContent(newContent);
    setIsDirty(true);

    // Restaurer le focus et la sélection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text">Notes</h2>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="w-48 h-7 text-xs"
            placeholder="filename.md"
          />
          {isDirty && <span className="text-xs text-text-secondary">•</span>}
          {saving && <Spinner className="w-3 h-3" />}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleNew}>
            New
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleLoad('')} disabled>
            Open
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || !filePath || saving}
          >
            Save
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-wash">
        <ToolbarButton onClick={() => insertFormatting('**', '**')} title="Bold">
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => insertFormatting('*', '*')} title="Italic">
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => insertFormatting('~~', '~~')} title="Strikethrough">
          <StrikethroughIcon />
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton onClick={() => insertFormatting('# ')} title="Heading 1">
          H1
        </ToolbarButton>
        <ToolbarButton onClick={() => insertFormatting('## ')} title="Heading 2">
          H2
        </ToolbarButton>
        <ToolbarButton onClick={() => insertFormatting('### ')} title="Heading 3">
          H3
        </ToolbarButton>
        <div className="w-px h-4 bg-border mx-1" />
        <ToolbarButton onClick={() => insertFormatting('[', '](url)')} title="Link">
          <LinkIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => insertFormatting('```\n', '\n```')} title="Code block">
          <CodeIcon />
        </ToolbarButton>
        <ToolbarButton onClick={() => insertFormatting('`', '`')} title="Inline code">
          &lt;/&gt;
        </ToolbarButton>
        <ToolbarButton onClick={() => insertFormatting('- ')} title="List">
          <ListIcon />
        </ToolbarButton>
        <div className="flex-1" />
        
        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-background rounded px-1">
          <button
            onClick={() => setMode('edit')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              mode === 'edit' ? 'bg-tint text-text' : 'text-text-secondary hover:text-text'
            )}
          >
            Edit
          </button>
          <button
            onClick={() => setMode('split')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              mode === 'split' ? 'bg-tint text-text' : 'text-text-secondary hover:text-text'
            )}
          >
            Split
          </button>
          <button
            onClick={() => setMode('preview')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              mode === 'preview' ? 'bg-tint text-text' : 'text-text-secondary hover:text-text'
            )}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-soft text-red text-xs border-b border-red/20">
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          {(mode === 'edit' || mode === 'split') && (
            <div className={cn('flex-1 overflow-hidden', mode === 'split' && 'border-r border-border')}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full h-full p-4 bg-background text-text font-mono text-sm resize-none focus:outline-none"
                placeholder="Start writing in markdown..."
              />
            </div>
          )}

          {/* Preview */}
          {(mode === 'preview' || mode === 'split') && (
            <div className="flex-1 overflow-y-auto p-4">
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Toolbar Button
// ============================================================================

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, title, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 text-text-secondary hover:text-text hover:bg-tint rounded transition-colors text-xs font-semibold"
    >
      {children}
    </button>
  );
}

// ============================================================================
// Markdown Preview
// ============================================================================

interface MarkdownPreviewProps {
  content: string;
}

function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="max-w-none text-sm text-text">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownCodeComponents}>
        {content || '*No content*'}
      </ReactMarkdown>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function BoldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M3 2.5h4.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5H3V2.5zm0 5h5c1.38 0 2.5 1.12 2.5 2.5S9.38 12.5 8 12.5H3V7.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M6 2h5v2H9l-2 6h2v2H4v-2h2l2-6H6V2z" fill="currentColor" />
    </svg>
  );
}

function StrikethroughIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7h10M5 3h6c.55 0 1 .45 1 1v1M4 10c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M6.5 9l-1 1a2.5 2.5 0 01-3.54-3.54l2-2A2.5 2.5 0 017.5 4M7.5 5l1-1a2.5 2.5 0 013.54 3.54l-2 2A2.5 2.5 0 016.5 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M4.5 4l-2.5 3 2.5 3M9.5 4l2.5 3-2.5 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="3" cy="4" r="1" fill="currentColor" />
      <circle cx="3" cy="7" r="1" fill="currentColor" />
      <circle cx="3" cy="10" r="1" fill="currentColor" />
      <path d="M6 4h6M6 7h6M6 10h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
