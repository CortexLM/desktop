/**
 * DocumentationViewer - Rendu markdown/MDX depuis workspace
 * 
 * Features:
 * - Render markdown files depuis workspace
 * - Table of contents auto-générée
 * - Syntax highlighting paresseux (components/code/markdown-code-components) ;
 *   le thème suit la classe `.dark` en CSS, pas d'observer ici
 * - Links internes
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

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface DocumentationViewerProps {
  workspaceId: string;
  className?: string;
}

// `workspaceId` is part of the props contract but not needed yet: docs are
// addressed by absolute path.
export function DocumentationViewer({
  workspaceId: _workspaceId,
  className,
}: DocumentationViewerProps) {
  const [content, setContent] = React.useState('');
  // Only written (to track what's open); the header renders `fileName`.
  const [, setFilePath] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [headings, setHeadings] = React.useState<Heading[]>([]);
  const [showToc, setShowToc] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  const contentRef = React.useRef<HTMLDivElement>(null);

  // Extraire les headings du contenu markdown
  React.useEffect(() => {
    const extractedHeadings: Heading[] = [];
    const lines = content.split('\n');

    lines.forEach((line) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');

        extractedHeadings.push({ level, text, id });
      }
    });

    setHeadings(extractedHeadings);
  }, [content]);

  // Charger un fichier
  const handleLoadFile = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      // `ipc.fs`, not `ipc.filesystem`, and the request is an object.
      const result = await ipc.fs.readFile({ path });
      setContent(result.content);
      setFilePath(path);
      setFileName(path.split('/').pop() || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
      setContent('');
    } finally {
      setLoading(false);
    }
  };

  // Scroller vers un heading
  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Rechercher dans le document
  const filteredHeadings = searchQuery
    ? headings.filter((h) => h.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : headings;

  return (
    <div className={cn('flex h-full bg-background', className)}>
      {/* Sidebar - Table of Contents */}
      {showToc && (
        <div className="w-64 border-r border-border flex flex-col">
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text">Contents</h3>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-border">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search headings..."
              className="h-8 text-xs"
            />
          </div>

          {/* TOC List */}
          <div className="flex-1 overflow-y-auto py-2">
            {filteredHeadings.length === 0 ? (
              <div className="px-4 py-8 text-xs text-text-secondary text-center">
                {headings.length === 0 ? 'No headings found' : 'No matches'}
              </div>
            ) : (
              <nav>
                {filteredHeadings.map((heading, index) => (
                  <button
                    key={`${heading.id}-${index}`}
                    onClick={() => scrollToHeading(heading.id)}
                    className={cn(
                      'w-full text-left px-4 py-1.5 text-xs hover:bg-tint transition-colors',
                      'text-text-secondary hover:text-text'
                    )}
                    style={{ paddingLeft: `${heading.level * 12}px` }}
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowToc(!showToc)}
              title="Toggle table of contents"
            >
              <TocIcon />
            </Button>
            <h2 className="text-sm font-semibold text-text">
              {fileName || 'Documentation'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => handleLoadFile('')} disabled>
              Open File
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-soft text-red text-xs border-b border-red/20">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : content ? (
            <div ref={contentRef} className="max-w-4xl mx-auto px-8 py-8">
              <MarkdownContent content={content} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <EmptyDocIcon />
              <div>
                <h3 className="text-sm font-semibold text-text mb-1">No document loaded</h3>
                <p className="text-xs text-text-secondary max-w-xs">
                  Open a markdown file from your workspace to view formatted documentation
                </p>
              </div>
              <Button size="sm" onClick={() => handleLoadFile('')} disabled>
                Browse Files
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Markdown Content Component
// ============================================================================

interface MarkdownContentProps {
  content: string;
}

function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="max-w-none text-sm text-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings avec IDs pour navigation
          h1: ({ node, children, ...props }) => {
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            return (
              <h1 id={id} className="scroll-mt-4" {...props}>
                {children}
              </h1>
            );
          },
          h2: ({ node, children, ...props }) => {
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            return (
              <h2 id={id} className="scroll-mt-4" {...props}>
                {children}
              </h2>
            );
          },
          h3: ({ node, children, ...props }) => {
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            return (
              <h3 id={id} className="scroll-mt-4" {...props}>
                {children}
              </h3>
            );
          },
          h4: ({ node, children, ...props }) => {
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            return (
              <h4 id={id} className="scroll-mt-4" {...props}>
                {children}
              </h4>
            );
          },
          h5: ({ node, children, ...props }) => {
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            return (
              <h5 id={id} className="scroll-mt-4" {...props}>
                {children}
              </h5>
            );
          },
          h6: ({ node, children, ...props }) => {
            const text = String(children);
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/\s+/g, '-');
            return (
              <h6 id={id} className="scroll-mt-4" {...props}>
                {children}
              </h6>
            );
          },

          // Code blocks: lazily-highlighted, shared with NotesView and chat.
          ...markdownCodeComponents,

          // Links - support des liens internes
          a: ({ node, href, children, ...props }) => {
            const isInternal = href && (href.startsWith('#') || href.startsWith('./') || href.startsWith('../'));
            
            return (
              <a
                href={href}
                className="text-accent hover:underline"
                target={isInternal ? undefined : '_blank'}
                rel={isInternal ? undefined : 'noopener noreferrer'}
                {...props}
              >
                {children}
              </a>
            );
          },

          // Tables
          table: ({ node, children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-border" {...props}>
                {children}
              </table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function TocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyDocIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="text-text-tertiary">
      <path
        d="M28 6H12a2 2 0 00-2 2v32a2 2 0 002 2h24a2 2 0 002-2V16l-10-10z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M28 6v10h10M18 24h12M18 30h12M18 36h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
