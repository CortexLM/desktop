/**
 * CodeBlock - renders a fenced code block, upgrading to syntax highlighting
 * once Prism has been lazily loaded.
 *
 * Renders readable plain text immediately (no layout shift, no blank frame),
 * then swaps in highlighted markup when the grammar resolves. If highlighting
 * is unavailable or fails, the plain-text rendering is the permanent fallback.
 *
 * Block chrome (background, border, padding) is plain Tailwind rather than part
 * of the lazily-loaded theme stylesheet, so the fallback is fully styled on the
 * first paint.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '../ui/badge';
import { highlightCode, isLanguageSupported } from '../../lib/syntax-highlight';
import { cn } from '../../lib/utils';

export interface CodeBlockProps {
  code: string;
  language: string;
  /** Rendered in the header; defaults to the language tag. */
  label?: string;
  /**
   * Show the language header bar. On in chat, where the badge helps scan a long
   * transcript; off in markdown previews, where a badge on every fence competes
   * with the prose.
   */
  showHeader?: boolean;
  className?: string;
}

/**
 * Asynchronously highlight `code`, guarding against races and unmounts.
 * Returns null until (and unless) highlighted HTML is available.
 */
function useHighlightedCode(code: string, language: string): string | null {
  const [html, setHtml] = useState<string | null>(null);
  // Identifies the latest request so out-of-order resolutions are discarded.
  const requestRef = useRef(0);

  useEffect(() => {
    // Skip the async work entirely when we have no grammar for this language.
    if (!isLanguageSupported(language)) {
      setHtml(null);
      return;
    }

    const requestId = ++requestRef.current;
    let cancelled = false;

    highlightCode(code, language)
      .then((result) => {
        // Ignore if unmounted or superseded by a newer code/language change.
        if (cancelled || requestRef.current !== requestId) return;
        setHtml(result.html);
      })
      .catch(() => {
        if (cancelled || requestRef.current !== requestId) return;
        setHtml(null);
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return html;
}

export const CodeBlock: React.FC<CodeBlockProps> = React.memo(
  ({ code, language, label, showHeader = true, className }) => {
    const html = useHighlightedCode(code, language);

    return (
      <div className={cn('my-3', className)}>
        {showHeader && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-elevated border border-border-strong border-b-0 rounded-t-sm">
            <Badge variant="secondary" className="text-xs font-mono">
              {label ?? language}
            </Badge>
          </div>
        )}
        <pre
          className={cn(
            'my-0 p-3 overflow-x-auto bg-elevated border border-border-strong text-xs',
            showHeader ? 'rounded-t-none rounded-b-sm' : 'rounded-sm'
          )}
        >
          {html === null ? (
            // Plain-text fallback: shown before Prism loads and whenever
            // highlighting is unsupported or failed.
            <code className={`language-${language}`}>{code}</code>
          ) : (
            <code
              className={`language-${language}`}
              // Sanitized by highlightCode() via DOMPurify before it reaches here.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </pre>
      </div>
    );
  }
);

CodeBlock.displayName = 'CodeBlock';
