/**
 * AgentDetail tests
 *
 * The view derives displayed metrics from SQL aggregates, so the fixtures below
 * use the shapes the database actually produces: `MIN`/`MAX`/`SUM` return NULL
 * over zero rows, and `metadata` is an unconstrained JSON TEXT column that can
 * be malformed.
 *
 * Helper-level tests cover the derivations exactly; component tests confirm the
 * derived value reaches the DOM.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import {
  AgentDetail,
  toFiniteNumber,
  deriveDuration,
  deriveEntryTokens,
  parseMetadata,
  formatTimestamp,
  formatDuration,
} from '../AgentDetail';

// ---------------------------------------------------------------------------
// window.cortex stub, routed per query
// ---------------------------------------------------------------------------

interface QueryRows {
  session?: Array<Record<string, unknown>>;
  usage?: Array<Record<string, unknown>>;
  messages?: Array<Record<string, unknown>>;
  history?: Array<Record<string, unknown>>;
}

let cortex: { db: { query: ReturnType<typeof vi.fn> } };
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let capturedQueries: Array<{ query: string; params: unknown[] }>;

const SESSION_ROW = { id: 's1', model: 'gpt-4', metadata: '{}' };
const USAGE_ROW = { tokens_input: 100, tokens_output: 200, cost: 0.5 };
const MESSAGES_ROW = { count: 4, min_time: 1_700_000_000_000, max_time: 1_700_000_060_000 };

/**
 * The view issues four queries. Dispatch is on SQL content, not call order, so a
 * reordering cannot silently pair a fixture with the wrong mapper.
 */
function stubQueries(rows: QueryRows) {
  const query = vi.fn(async (request: { query: string; params?: unknown[] }) => {
    capturedQueries.push({ query: request.query, params: request.params ?? [] });
    const sql = request.query;

    if (sql.includes('FROM sessions')) {
      return { success: true, data: { rows: rows.session ?? [SESSION_ROW] } };
    }
    if (sql.includes('FROM usage_logs')) {
      return { success: true, data: { rows: rows.usage ?? [USAGE_ROW] } };
    }
    if (sql.includes('COUNT(*)')) {
      return { success: true, data: { rows: rows.messages ?? [MESSAGES_ROW] } };
    }
    if (sql.includes('ORDER BY created_at DESC')) {
      return { success: true, data: { rows: rows.history ?? [] } };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  cortex = { db: { query } };
  (globalThis as unknown as { window: Record<string, unknown> }).window.cortex = cortex;
}

async function renderDetail(
  rows: QueryRows = {},
  props: Partial<React.ComponentProps<typeof AgentDetail>> = {}
) {
  stubQueries(rows);
  const result = render(
    React.createElement(AgentDetail, { sessionId: 's1', ...props })
  );
  await waitFor(() => expect(screen.queryByText('Loading agent details...')).toBeNull());
  return result;
}

/** The value rendered inside the metric card with the given label. */
function metricValue(label: string): string {
  const labelNode = screen.getByText(label);
  const card = labelNode.closest('.border');
  const value = card?.querySelector('.text-2xl');
  return value?.textContent?.trim() ?? '';
}

beforeEach(() => {
  capturedQueries = [];
  stubQueries({});
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
});

// ===========================================================================
// toFiniteNumber
// ===========================================================================

describe('toFiniteNumber', () => {
  it.each([
    ['null', null, 0],
    ['undefined', undefined, 0],
    ['NaN', NaN, 0],
    ['Infinity', Infinity, 0],
    ['-Infinity', -Infinity, 0],
    ['zero', 0, 0],
    ['a positive number', 42.5, 42.5],
    ['a negative number', -7, -7],
  ])('maps %s to %s', (_label, input, expected) => {
    expect(toFiniteNumber(input as number)).toBe(expected);
  });
});

// ===========================================================================
// deriveDuration
// ===========================================================================

describe('deriveDuration', () => {
  it('returns the span between the first and last message', () => {
    expect(deriveDuration(5_000, 1_000)).toBe(4_000);
  });

  it('returns 0 for a single message, where both bounds are equal', () => {
    expect(deriveDuration(1_000, 1_000)).toBe(0);
  });

  it('returns 0 when a session has no messages and both bounds are null', () => {
    // MIN/MAX over zero rows are both NULL. `null - null` is 0 in JS, so this
    // case was already safe — pinned so a "fix" cannot turn it into NaN.
    expect(deriveDuration(null, null)).toBe(0);
  });

  it.each([
    ['max undefined', undefined, 100],
    ['min undefined', 5_000, undefined],
    ['both undefined', undefined, undefined],
    ['max NaN', NaN, 100],
    ['min NaN', 5_000, NaN],
    ['max Infinity', Infinity, 100],
  ])('returns 0 when %s', (_label, max, min) => {
    const result = deriveDuration(max as number, min as number);
    expect(result).toBe(0);
    expect(Number.isNaN(result)).toBe(false);
  });

  /**
   * Coercing a missing bound to 0 before subtracting is worse than propagating
   * NaN: an epoch-millisecond `max` minus 0 is a ~53-year span that formats as a
   * plausible "473958h 20m" instead of anything visibly wrong.
   */
  it('does not report an epoch-sized duration when min is missing', () => {
    expect(deriveDuration(1_700_000_000_000, undefined)).toBe(0);
    expect(formatDuration(deriveDuration(1_700_000_000_000, undefined))).toBe('0s');
  });

  /**
   * The negative-duration regression: `null - 100` is `-100`, which is truthy,
   * so the view's `metrics?.duration || 0` guard did not catch it and
   * `formatDuration(-100)` rendered "-1s".
   */
  it('returns 0 rather than a negative span when max is null and min is set', () => {
    expect(deriveDuration(null, 100)).toBe(0);
  });

  it('returns 0 when the bounds are inverted', () => {
    expect(deriveDuration(1_000, 5_000)).toBe(0);
  });
});

// ===========================================================================
// deriveEntryTokens
// ===========================================================================

describe('deriveEntryTokens', () => {
  it('sums input and output when both are present', () => {
    expect(deriveEntryTokens({ input: 5, output: 7 })).toBe(12);
  });

  /**
   * The silent-drop regression: `metadata.tokens?.input + metadata.tokens?.output`
   * is NaN when either side is missing, and the badge renders under
   * `{entry.tokens && ...}` — so a message that recorded only its input tokens
   * displayed no token count at all.
   */
  it('returns the known half when only input is recorded', () => {
    expect(deriveEntryTokens({ input: 5 })).toBe(5);
  });

  it('returns the known half when only output is recorded', () => {
    expect(deriveEntryTokens({ output: 7 })).toBe(7);
  });

  it.each([
    ['no tokens object', undefined],
    ['null', null],
    ['an empty object', {}],
    ['both zero', { input: 0, output: 0 }],
    ['a string', 'nope'],
    ['non-numeric fields', { input: 'a', output: 'b' }],
  ])('returns undefined for %s so the badge is hidden', (_label, input) => {
    expect(deriveEntryTokens(input)).toBeUndefined();
  });

  it('never returns NaN', () => {
    for (const input of [{ input: 5 }, { output: 7 }, {}, null, undefined, { input: 'x' }]) {
      const result = deriveEntryTokens(input);
      expect(Number.isNaN(result)).toBe(false);
    }
  });
});

// ===========================================================================
// parseMetadata
// ===========================================================================

describe('parseMetadata', () => {
  it('parses a JSON object', () => {
    expect(parseMetadata('{"provider":"openai","temperature":0.7}')).toEqual({
      provider: 'openai',
      temperature: 0.7,
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['malformed JSON', '{not json'],
    ['a truncated object', '{"a":'],
    ['a JSON array', '[1,2,3]'],
    ['a bare number', '42'],
    ['a bare string', '"text"'],
    ['JSON null', 'null'],
  ])('returns an empty object for %s', (_label, input) => {
    expect(parseMetadata(input)).toEqual({});
  });

  /**
   * `metadata` has no CHECK constraint, so one malformed row is possible. A bare
   * `JSON.parse` threw inside the single shared `try` in `loadAgentData`, which
   * abandoned config, metrics *and* timeline — the whole view blanked because of
   * one bad row.
   */
  it('does not throw on malformed JSON', () => {
    expect(() => parseMetadata('{"unterminated')).not.toThrow();
  });
});

// ===========================================================================
// formatTimestamp / formatDuration
// ===========================================================================

describe('formatTimestamp', () => {
  it('formats a real timestamp', () => {
    const result = formatTimestamp(new Date(2026, 2, 10, 12, 0, 0).getTime());

    expect(result).toContain('2026');
    expect(result).not.toContain('Invalid');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['NaN', NaN],
    ['a date string', '2026-03-10'],
    ['Infinity', Infinity],
  ])('renders %s as a placeholder rather than "Invalid Date"', (_label, input) => {
    const result = formatTimestamp(input);

    expect(result).toBe('Unknown date');
    expect(result).not.toContain('Invalid Date');
    expect(result).not.toContain('1970');
  });
});

describe('formatDuration', () => {
  it.each([
    ['0ms', 0, '0s'],
    ['900ms', 900, '0s'],
    ['5 seconds', 5_000, '5s'],
    ['59 seconds', 59_000, '59s'],
    ['1 minute', 60_000, '1m 0s'],
    ['90 seconds', 90_000, '1m 30s'],
    ['1 hour', 3_600_000, '1h 0m'],
    ['90 minutes', 5_400_000, '1h 30m'],
  ])('formats %s as %s', (_label, ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it('never emits NaN for a NaN input', () => {
    // Defence in depth: deriveDuration should already have coerced this.
    expect(formatDuration(NaN)).not.toContain('NaN');
  });
});

// ===========================================================================
// Component: metrics
// ===========================================================================

describe('AgentDetail metrics', () => {
  it('renders token, cost and duration metrics from the aggregates', async () => {
    await renderDetail({
      usage: [{ tokens_input: 1_000, tokens_output: 2_000, cost: 0.1234 }],
      messages: [{ count: 4, min_time: 1_700_000_000_000, max_time: 1_700_000_060_000 }],
    });

    expect(metricValue('Total Tokens')).toBe('3,000');
    expect(metricValue('Total Cost')).toBe('$0.1234');
    expect(metricValue('Duration')).toBe('1m 0s');
    expect(screen.getByText('1,000 in / 2,000 out')).toBeDefined();
    expect(screen.getByText('4 messages')).toBeDefined();
  });

  it('renders zeros when every usage aggregate is null', async () => {
    await renderDetail({
      usage: [{ tokens_input: null, tokens_output: null, cost: null }],
      messages: [{ count: 0, min_time: null, max_time: null }],
    });

    expect(metricValue('Total Tokens')).toBe('0');
    expect(metricValue('Total Cost')).toBe('$0.0000');
    expect(metricValue('Duration')).toBe('0s');
    expect(document.body.textContent).not.toContain('NaN');
  });

  /**
   * The user-visible NaN: a missing bound makes `max_time - min_time` NaN, and
   * `NaN.toLocaleString()` is the string "NaN" — which is truthy, so a
   * `|| '0'` fallback downstream does not replace it.
   */
  it('renders no NaN when a message timestamp bound is missing', async () => {
    await renderDetail({
      messages: [{ count: 2, min_time: 1_700_000_000_000, max_time: undefined }],
    });

    expect(metricValue('Duration')).toBe('0s');
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('renders no negative duration when max_time is null', async () => {
    await renderDetail({
      messages: [{ count: 2, min_time: 1_700_000_000_000, max_time: null }],
    });

    const duration = metricValue('Duration');
    expect(duration).toBe('0s');
    expect(duration).not.toContain('-');
  });

  it('keeps a partial token count rather than dropping it', async () => {
    await renderDetail({
      usage: [{ tokens_input: 500, tokens_output: null, cost: null }],
    });

    expect(metricValue('Total Tokens')).toBe('500');
    expect(screen.getByText('500 in / 0 out')).toBeDefined();
  });
});

// ===========================================================================
// Component: configuration
// ===========================================================================

describe('AgentDetail configuration', () => {
  it('renders model and provider from the session metadata', async () => {
    await renderDetail({
      session: [{ id: 's1', model: 'claude-3-opus', metadata: '{"provider":"anthropic"}' }],
    });

    expect(screen.getByText('claude-3-opus')).toBeDefined();
    expect(screen.getByText('anthropic')).toBeDefined();
  });

  it('falls back to Unknown for a null model and absent provider', async () => {
    await renderDetail({ session: [{ id: 's1', model: null, metadata: null }] });

    expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(2);
  });

  it('renders temperature and max tokens when present', async () => {
    await renderDetail({
      session: [
        {
          id: 's1',
          model: 'gpt-4',
          metadata: '{"provider":"openai","temperature":0.7,"maxTokens":4096}',
        },
      ],
    });

    expect(screen.getByText('Temperature')).toBeDefined();
    expect(screen.getByText('0.7')).toBeDefined();
    expect(screen.getByText('Max Tokens')).toBeDefined();
    expect(screen.getByText('4,096')).toBeDefined();
  });

  it('omits the temperature row when it is absent', async () => {
    await renderDetail({ session: [{ id: 's1', model: 'gpt-4', metadata: '{}' }] });

    expect(screen.queryByText('Temperature')).toBeNull();
    expect(screen.queryByText('Max Tokens')).toBeNull();
  });

  it('renders a system prompt when present', async () => {
    await renderDetail({
      session: [
        { id: 's1', model: 'gpt-4', metadata: '{"systemPrompt":"You are a helpful assistant"}' },
      ],
    });

    expect(screen.getByText('System Prompt')).toBeDefined();
    expect(screen.getByText('You are a helpful assistant')).toBeDefined();
  });

  /**
   * One malformed metadata blob used to abandon the entire load: config, metrics
   * and timeline all blanked. The metrics must still be there.
   */
  it('still renders metrics when the session metadata is malformed', async () => {
    await renderDetail({
      session: [{ id: 's1', model: 'gpt-4', metadata: '{"provider":' }],
      usage: [{ tokens_input: 10, tokens_output: 20, cost: 0.5 }],
    });

    expect(metricValue('Total Tokens')).toBe('30');
    expect(screen.getByText('gpt-4')).toBeDefined();
  });

  it('renders a temperature of 0 rather than treating it as absent', async () => {
    await renderDetail({
      session: [{ id: 's1', model: 'gpt-4', metadata: '{"temperature":0}' }],
    });

    // `temperature !== undefined` is the correct check; a truthiness test would
    // hide a deliberate 0 (fully deterministic sampling).
    expect(screen.getByText('Temperature')).toBeDefined();
    expect(screen.getByText('0')).toBeDefined();
  });
});

// ===========================================================================
// Component: history timeline
// ===========================================================================

describe('AgentDetail history timeline', () => {
  it('renders one entry per message', async () => {
    await renderDetail({
      history: [
        { id: 'm1', role: 'user', content: 'First', created_at: 1_700_000_000_000, metadata: '{}' },
        { id: 'm2', role: 'assistant', content: 'Second', created_at: 1_700_000_001_000, metadata: '{}' },
      ],
    });

    expect(screen.getAllByText('message')).toHaveLength(2);
  });

  it('labels an entry with tool calls as a tool_call', async () => {
    await renderDetail({
      history: [
        {
          id: 'm1',
          role: 'assistant',
          content: 'Calling',
          created_at: 1_700_000_000_000,
          metadata: '{"toolCalls":[{"name":"read"}]}',
        },
      ],
    });

    expect(screen.getByText('tool_call')).toBeDefined();
  });

  it('renders a placeholder date for an entry with no timestamp', async () => {
    await renderDetail({
      history: [
        { id: 'm1', role: 'user', content: 'Undated', created_at: null, metadata: '{}' },
      ],
    });

    expect(screen.getByText('Unknown date')).toBeDefined();
    expect(document.body.textContent).not.toContain('Invalid Date');
  });

  it('shows a token badge built from a partial token record', async () => {
    await renderDetail({
      history: [
        {
          id: 'm1',
          role: 'assistant',
          content: 'Reply',
          created_at: 1_700_000_000_000,
          metadata: '{"tokens":{"input":1234}}',
        },
      ],
    });

    // Would have been silently hidden by the NaN sum.
    expect(screen.getByText('1,234')).toBeDefined();
  });

  it('survives a malformed metadata blob on one message', async () => {
    await renderDetail({
      history: [
        { id: 'm1', role: 'user', content: 'Good', created_at: 1_700_000_000_000, metadata: '{}' },
        { id: 'm2', role: 'user', content: 'Bad', created_at: 1_700_000_001_000, metadata: '{oops' },
      ],
    });

    // Both entries render; the bad one just has no metadata-derived extras.
    expect(screen.getAllByText('message')).toHaveLength(2);
  });

  it('tolerates a null content field', async () => {
    await renderDetail({
      history: [
        { id: 'm1', role: 'user', content: null, created_at: 1_700_000_000_000, metadata: '{}' },
      ],
    });

    // `null.slice(0, 100)` would have thrown and blanked the view.
    expect(screen.getByText('message')).toBeDefined();
  });

  it('truncates long content to 100 characters', async () => {
    const long = 'x'.repeat(250);
    await renderDetail({
      history: [
        { id: 'm1', role: 'user', content: long, created_at: 1_700_000_000_000, metadata: '{}' },
      ],
    });

    // Radix AccordionContent is not mounted until its trigger is activated, so
    // the body text does not exist in the DOM on first paint. AccordionTrigger
    // is a plain button and responds to click (unlike Radix TabsTrigger, which
    // only activates on mousedown).
    await act(async () => {
      fireEvent.click(screen.getByText('message'));
    });

    const shown = await waitFor(() => screen.getByText(/^x+\.\.\.$/));
    expect(shown.textContent).toBe('x'.repeat(100) + '...');
  });

  it('renders the cost of an entry once expanded', async () => {
    await renderDetail({
      history: [
        {
          id: 'm1',
          role: 'assistant',
          content: 'Reply',
          created_at: 1_700_000_000_000,
          metadata: '{"cost":0.001234}',
        },
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByText('message'));
    });

    await waitFor(() => expect(screen.getByText(/Cost: \$0\.001234/)).toBeDefined());
  });

  it('omits the cost line when metadata cost is not a number', async () => {
    await renderDetail({
      history: [
        {
          id: 'm1',
          role: 'assistant',
          content: 'Reply',
          created_at: 1_700_000_000_000,
          metadata: '{"cost":"free"}',
        },
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByText('message'));
    });

    // `"free".toFixed(6)` would throw; the row must simply have no cost line.
    await waitFor(() => expect(screen.getByText(/^Reply/)).toBeDefined());
    expect(document.body.textContent).not.toContain('Cost:');
  });

  it('renders an empty timeline without rows', async () => {
    await renderDetail({ history: [] });

    expect(screen.getByText('History Timeline')).toBeDefined();
    expect(screen.queryByText('message')).toBeNull();
  });
});

// ===========================================================================
// Component: shell behaviour
// ===========================================================================

describe('AgentDetail shell', () => {
  it('queries all four datasets for the session id', async () => {
    await renderDetail({}, { sessionId: 'session-77' });

    expect(capturedQueries).toHaveLength(4);
    for (const { params } of capturedQueries) {
      expect(params).toEqual(['session-77']);
    }
  });

  it('hides the back button when no onBack is given', async () => {
    await renderDetail();

    const backButton = document.querySelector('.lucide-arrow-left');
    expect(backButton).toBeNull();
  });

  it('calls onBack from the back button', async () => {
    const onBack = vi.fn();
    await renderDetail({}, { onBack });

    const backIcon = document.querySelector('.lucide-arrow-left');
    expect(backIcon).not.toBeNull();
    fireEvent.click((backIcon as Element).closest('button') as HTMLButtonElement);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('reloads every dataset when Refresh is pressed', async () => {
    await renderDetail();
    expect(capturedQueries).toHaveLength(4);

    await act(async () => {
      fireEvent.click(screen.getByText('Refresh'));
    });

    await waitFor(() => expect(capturedQueries).toHaveLength(8));
  });

  it('reloads when the sessionId prop changes', async () => {
    const { rerender } = await renderDetail({}, { sessionId: 'a' });
    expect(capturedQueries).toHaveLength(4);

    rerender(React.createElement(AgentDetail, { sessionId: 'b' }));

    await waitFor(() => expect(capturedQueries).toHaveLength(8));
    expect(capturedQueries[4].params).toEqual(['b']);
  });

  it('leaves the loading state when a query throws', async () => {
    stubQueries({});
    cortex.db.query.mockImplementation(async () => {
      throw new Error('db offline');
    });

    render(React.createElement(AgentDetail, { sessionId: 's1' }));

    // Stuck-on-loading is the failure mode this guards.
    await waitFor(() => expect(screen.queryByText('Loading agent details...')).toBeNull());
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('renders zeroed metrics when the session row is missing', async () => {
    await renderDetail({ session: [], usage: [], messages: [], history: [] });

    expect(metricValue('Total Cost')).toBe('$0.0000');
    expect(document.body.textContent).not.toContain('NaN');
  });
});
