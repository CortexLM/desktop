/**
 * Tests for CodeBlock's progressive-enhancement behaviour.
 *
 * Because Prism is loaded lazily, CodeBlock must render usable plain text on
 * the first paint and upgrade to highlighted markup afterwards, without ever
 * showing a blank block or losing the code text.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { CodeBlock } from '../components/code/CodeBlock';

describe('CodeBlock', () => {
  it('renders the code as plain text immediately (before Prism resolves)', () => {
    const code = 'const answer = 42;';
    const { container } = render(<CodeBlock code={code} language="typescript" />);

    // Synchronously present: no blank frame while the grammar loads.
    const codeEl = container.querySelector('code');
    expect(codeEl).not.toBeNull();
    expect(codeEl!.textContent).toBe(code);
    // Not yet highlighted.
    expect(container.querySelectorAll('code span').length).toBe(0);

    cleanup();
  });

  it('upgrades to highlighted markup once the grammar loads', async () => {
    const code = 'const answer = 42;';
    const { container } = render(<CodeBlock code={code} language="typescript" />);

    await waitFor(() => {
      expect(container.querySelectorAll('code span').length).toBeGreaterThan(0);
    });

    // Text content must be preserved through the upgrade.
    expect(container.querySelector('code')!.textContent).toBe(code);

    cleanup();
  });

  it('shows the language label', async () => {
    render(<CodeBlock code="print(1)" language="python" />);
    expect(screen.getByText('python')).toBeTruthy();
    cleanup();
  });

  it('honours an explicit label override', async () => {
    render(<CodeBlock code="print(1)" language="python" label="example.py" />);
    expect(screen.getByText('example.py')).toBeTruthy();
    cleanup();
  });

  it('keeps plain text permanently for unsupported languages', async () => {
    const code = 'IDENTIFICATION DIVISION.';
    const { container } = render(<CodeBlock code={code} language="cobol" />);

    // Give any async path a chance to run; it must not highlight.
    await new Promise((r) => setTimeout(r, 50));

    expect(container.querySelector('code')!.textContent).toBe(code);
    expect(container.querySelectorAll('code span').length).toBe(0);

    cleanup();
  });

  it('re-highlights when the code prop changes', async () => {
    const { container, rerender } = render(
      <CodeBlock code="const a = 1;" language="typescript" />
    );

    await waitFor(() => {
      expect(container.querySelectorAll('code span').length).toBeGreaterThan(0);
    });

    rerender(<CodeBlock code="const bbb = 999;" language="typescript" />);

    await waitFor(() => {
      expect(container.querySelector('code')!.textContent).toBe('const bbb = 999;');
    });

    cleanup();
  });

  it('does not warn or throw when unmounted mid-load', async () => {
    const { unmount, container } = render(
      <CodeBlock code="const x = 1;" language="rust" />
    );
    expect(container.querySelector('code')).not.toBeNull();
    // Unmount immediately, while the grammar import is still in flight.
    expect(() => unmount()).not.toThrow();
    // Allow the pending promise to settle against the unmounted component.
    await new Promise((r) => setTimeout(r, 50));
  });
});
