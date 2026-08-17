/**
 * Tests for the shared react-markdown code overrides.
 *
 * These guard the two things that broke when react-syntax-highlighter was
 * removed: fenced blocks must still highlight (not silently fall back to plain
 * text), and the fence must not end up with a <pre> nested inside a <pre>.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import { markdownCodeComponents } from '../components/code/markdown-code-components';

function renderMarkdown(source: string) {
  return render(
    <ReactMarkdown components={markdownCodeComponents}>{source}</ReactMarkdown>
  );
}

describe('markdownCodeComponents', () => {
  afterEach(cleanup);

  it('renders a fenced block as a single <pre> (no nested pre)', async () => {
    const { container } = renderMarkdown('```typescript\nconst x: number = 1;\n```');

    const pres = container.querySelectorAll('pre');
    expect(pres.length).toBe(1);
    expect(pres[0].querySelector('pre')).toBeNull();
  });

  it('highlights a TypeScript fence', async () => {
    const { container } = renderMarkdown('```typescript\nconst x: number = 42;\n```');

    await waitFor(() => {
      expect(container.querySelectorAll('code span').length).toBeGreaterThan(0);
    });
    expect(container.querySelector('code')!.textContent).toContain('42');
  });

  it('highlights a Python fence', async () => {
    const { container } = renderMarkdown('```python\ndef f():\n    return 1\n```');

    await waitFor(() => {
      expect(container.querySelectorAll('code span').length).toBeGreaterThan(0);
    });
  });

  it('highlights a less common language (zig)', async () => {
    const { container } = renderMarkdown('```zig\nconst std = @import("std");\n```');

    await waitFor(() => {
      expect(container.querySelectorAll('code span').length).toBeGreaterThan(0);
    });
  });

  it('resolves a language alias on the fence tag', async () => {
    const { container } = renderMarkdown('```yml\nkey: value\n```');

    await waitFor(() => {
      expect(container.querySelectorAll('code span').length).toBeGreaterThan(0);
    });
  });

  it('keeps an unsupported language as readable plain text', async () => {
    const { container } = renderMarkdown('```cobol\nIDENTIFICATION DIVISION.\n```');

    // Give the async path a chance to run; it must not highlight.
    await new Promise((r) => setTimeout(r, 50));

    expect(container.querySelector('code')!.textContent).toContain(
      'IDENTIFICATION DIVISION.'
    );
    expect(container.querySelectorAll('code span').length).toBe(0);
  });

  it('renders inline code inline, without a code block wrapper', () => {
    const { container } = renderMarkdown('Some `inline` code.');

    expect(container.querySelector('pre')).toBeNull();
    const code = container.querySelector('code');
    expect(code).not.toBeNull();
    expect(code!.textContent).toBe('inline');
  });

  it('omits the language header in markdown previews', async () => {
    const { container } = renderMarkdown('```typescript\nconst x = 1;\n```');

    // Settle the async highlight first, so the assertion covers the final
    // markup rather than just the plain-text frame.
    await waitFor(() => {
      expect(container.querySelectorAll('code span').length).toBeGreaterThan(0);
    });

    // The badge shown in chat must not appear here.
    expect(container.textContent).not.toContain('typescript');
  });

  it('preserves the code text exactly, without a trailing newline', async () => {
    const { container } = renderMarkdown('```json\n{"a": 1}\n```');

    await waitFor(() => {
      expect(container.querySelectorAll('code span').length).toBeGreaterThan(0);
    });
    expect(container.querySelector('code')!.textContent).toBe('{"a": 1}');
  });
});
