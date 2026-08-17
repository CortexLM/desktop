/**
 * Shared react-markdown component overrides for code.
 *
 * Both NotesView and DocumentationViewer render markdown and need identical
 * fenced-code behaviour, so the overrides live here rather than being copied
 * into each view.
 *
 * Why `pre` is overridden too: a markdown fence produces `<pre><code>`, and
 * CodeBlock renders its own `<pre>`. Without collapsing the outer one we would
 * nest `<pre>` inside `<pre>` (invalid markup, doubled padding). The `pre`
 * override renders its children directly and lets CodeBlock own the block.
 */

import type { Components } from 'react-markdown';
import { CodeBlock } from './CodeBlock';

/** Extract the language tag from react-markdown's `language-xxx` class. */
function languageFromClassName(className: string | undefined): string {
  return /language-(\w[\w+-]*)/.exec(className ?? '')?.[1] ?? '';
}

/**
 * Overrides mapping markdown fences onto the lazy-loading CodeBlock.
 *
 * Spread into `<ReactMarkdown components={{ ...markdownCodeComponents }} />`.
 * The header is suppressed so previews keep the plain look they had before,
 * while chat keeps its language badge.
 */
export const markdownCodeComponents: Components = {
  // Collapse the fence's wrapper; CodeBlock supplies the real <pre>.
  pre: ({ children }) => <>{children}</>,

  code: ({ node: _node, className, children, ...props }) => {
    const language = languageFromClassName(className);

    // No language class means inline code (`like this`), which stays inline.
    if (!language) {
      return (
        <code
          className="px-1 py-0.5 rounded-xs bg-tint font-mono text-xs"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <CodeBlock
        code={String(children).replace(/\n$/, '')}
        language={language}
        showHeader={false}
      />
    );
  },
};
