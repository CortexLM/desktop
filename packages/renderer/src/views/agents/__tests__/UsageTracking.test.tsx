/**
 * UsageTracking tests
 *
 * This view renders money and token counts read from `usage_logs`, whose
 * `cost`, `tokens_input` and `tokens_output` columns are all nullable — and
 * `SUM()` over zero matching rows returns NULL, not 0. Verified against the real
 * schema with better-sqlite3:
 *
 *   SUM(cost) over zero rows        -> null
 *   SUM(cost) over all-NULL costs   -> null
 *   GROUP BY provider               -> [{ provider: 'openai', cost: null, tokens: null }]
 *
 * The row fixtures below use `null` for exactly those fields, because that is
 * what the database hands the view. A fixture that used 0 would pass while the
 * dashboard crashed in production.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import { UsageTracking, getTimeRangeMs, generateCSV } from '../UsageTracking';

// ---------------------------------------------------------------------------
// window.cortex stub, keyed by which query is being issued
// ---------------------------------------------------------------------------

interface QueryRows {
  /** SUM(cost), SUM(tokens), COUNT(DISTINCT session_id) */
  total?: Array<Record<string, unknown>>;
  /** GROUP BY provider */
  provider?: Array<Record<string, unknown>>;
  /** GROUP BY model, provider */
  model?: Array<Record<string, unknown>>;
  /** GROUP BY date */
  timeline?: Array<Record<string, unknown>>;
}

let cortex: { db: { query: ReturnType<typeof vi.fn> } };
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let capturedQueries: Array<{ query: string; params: unknown[] }>;

/**
 * Route each of the view's four queries to its own fixture.
 *
 * Dispatch is on distinctive SQL fragments rather than call order: the view
 * issues them sequentially today, but a reordering would silently feed provider
 * rows to the totals mapper and the fixtures would stop meaning anything.
 */
function stubQueries(rows: QueryRows) {
  const query = vi.fn(async (request: { query: string; params?: unknown[] }) => {
    capturedQueries.push({ query: request.query, params: request.params ?? [] });
    const sql = request.query;

    if (sql.includes('total_cost')) {
      return { success: true, data: { rows: rows.total ?? [{ total_cost: null, total_tokens: null, total_sessions: 0 }] } };
    }
    if (sql.includes('GROUP BY provider')) {
      return { success: true, data: { rows: rows.provider ?? [] } };
    }
    if (sql.includes('GROUP BY model')) {
      return { success: true, data: { rows: rows.model ?? [] } };
    }
    if (sql.includes('GROUP BY date')) {
      return { success: true, data: { rows: rows.timeline ?? [] } };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  cortex = { db: { query } };
  (globalThis as unknown as { window: Record<string, unknown> }).window.cortex = cortex;
}

async function renderUsage(rows: QueryRows = {}) {
  stubQueries(rows);
  const result = render(React.createElement(UsageTracking));
  await waitFor(() => expect(screen.queryByText('Loading usage data...')).toBeNull());
  return result;
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
// getTimeRangeMs
// ===========================================================================

describe('getTimeRangeMs', () => {
  const DAY = 24 * 60 * 60 * 1000;

  it.each([
    ['day', 'day', DAY],
    ['week', 'week', 7 * DAY],
    ['month', 'month', 30 * DAY],
  ] as const)('returns the %s window', (_label, range, expected) => {
    expect(getTimeRangeMs(range)).toBe(expected);
  });

  it('returns a window large enough to cover all history', () => {
    expect(getTimeRangeMs('all')).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('gives strictly increasing windows for widening ranges', () => {
    // A regression that swapped two cases would keep every individual value
    // "a number" but break the ordering the UI implies.
    expect(getTimeRangeMs('day')).toBeLessThan(getTimeRangeMs('week'));
    expect(getTimeRangeMs('week')).toBeLessThan(getTimeRangeMs('month'));
    expect(getTimeRangeMs('month')).toBeLessThan(getTimeRangeMs('all'));
  });
});

// ===========================================================================
// Zero rows — the fresh-install path
// ===========================================================================

describe('UsageTracking with no usage at all', () => {
  it('renders zeroed summary cards rather than crashing', async () => {
    await renderUsage({
      total: [{ total_cost: null, total_tokens: null, total_sessions: 0 }],
      provider: [],
      model: [],
      timeline: [],
    });

    expect(screen.getByText('Usage & Billing')).toBeDefined();
    expect(screen.getByText('$0.00')).toBeDefined();
    // Total tokens and session count both read 0.
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
  });

  it('never renders NaN or the text null', async () => {
    await renderUsage({
      total: [{ total_cost: null, total_tokens: null, total_sessions: null }],
    });

    // `null.toFixed()` throws; `(null as number) + 1` renders NaN. Both were
    // reachable from this exact row shape.
    expect(document.body.textContent).not.toContain('NaN');
    expect(document.body.textContent).not.toContain('null');
    expect(document.body.textContent).not.toContain('undefined');
  });

  it('shows the empty chart state when there is no timeline', async () => {
    await renderUsage({ timeline: [] });

    expect(screen.getByText('No data available')).toBeDefined();
  });

  it('renders an empty model table without rows', async () => {
    await renderUsage({ model: [] });

    expect(screen.getByText('Usage by Model')).toBeDefined();
    expect(document.querySelectorAll('tbody tr')).toHaveLength(0);
  });

  it('reports a query failure and still leaves the loading state', async () => {
    stubQueries({});
    cortex.db.query.mockImplementation(async () => {
      throw new Error('db offline');
    });

    render(React.createElement(UsageTracking));

    await waitFor(() => expect(screen.queryByText('Loading usage data...')).toBeNull());
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('leaves the loading state when the query reports failure', async () => {
    stubQueries({});
    cortex.db.query.mockImplementation(async () => ({
      success: false,
      error: { message: 'nope' },
    }));

    render(React.createElement(UsageTracking));

    await waitFor(() => expect(screen.queryByText('Loading usage data...')).toBeNull());
    expect(screen.getByText('$0.00')).toBeDefined();
  });
});

// ===========================================================================
// Null-valued rows — the crash this view actually shipped
// ===========================================================================

describe('UsageTracking with null cost and token aggregates', () => {
  /**
   * The exact crash: a provider row whose SUM(cost) is NULL reached
   * `provider.cost.toFixed(2)`, throwing
   * "TypeError: Cannot read properties of null (reading 'toFixed')" and blanking
   * the entire dashboard — not just the one row.
   */
  it('renders a provider row whose cost and tokens are both null', async () => {
    await renderUsage({
      total: [{ total_cost: null, total_tokens: null, total_sessions: 1 }],
      provider: [{ provider: 'openai', cost: null, tokens: null }],
    });

    expect(screen.getByText('openai')).toBeDefined();
    // Coerced to 0, formatted, and shown with a 0% share.
    expect(screen.getByText('$0.00 (0.0%)')).toBeDefined();
    expect(screen.getByText('0 tokens')).toBeDefined();
  });

  it('renders a model row whose cost, tokens and sessions are all null', async () => {
    await renderUsage({
      total: [{ total_cost: null, total_tokens: null, total_sessions: null }],
      model: [{ model: 'gpt-4', provider: 'openai', cost: null, tokens: null, sessions: null }],
    });

    const cells = Array.from(document.querySelectorAll('tbody tr td')).map((c) =>
      c.textContent?.trim()
    );
    expect(cells).toContain('gpt-4');
    expect(cells).toContain('$0.0000');
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('renders a timeline entry whose cost is null', async () => {
    await renderUsage({
      timeline: [{ date: '2026-03-10', cost: null, tokens: null, sessions: null }],
    });

    // The bar chart must exist (not the empty state) and carry a $0.00 tooltip.
    expect(screen.queryByText('No data available')).toBeNull();
    const bar = document.querySelector('[title]');
    expect(bar?.getAttribute('title')).toBe('$0.00');
  });

  it('substitutes a placeholder for a null provider name', async () => {
    await renderUsage({
      provider: [{ provider: null, cost: null, tokens: null }],
    });

    // A null GROUP BY key renders as the React key too; "Unknown" is at least
    // legible where an empty string was invisible.
    expect(screen.getByText('Unknown')).toBeDefined();
  });

  it('keeps percentages at zero when the total cost is null', async () => {
    await renderUsage({
      total: [{ total_cost: null, total_tokens: null, total_sessions: 2 }],
      provider: [
        { provider: 'openai', cost: null, tokens: null },
        { provider: 'anthropic', cost: null, tokens: null },
      ],
    });

    // Dividing by a null/0 total must not produce NaN% or Infinity%.
    expect(screen.getAllByText('$0.00 (0.0%)')).toHaveLength(2);
    expect(document.body.textContent).not.toContain('Infinity');
  });

  it('mixes null and real costs without corrupting the real ones', async () => {
    await renderUsage({
      total: [{ total_cost: 10, total_tokens: 1000, total_sessions: 2 }],
      provider: [
        { provider: 'openai', cost: 7.5, tokens: 750 },
        { provider: 'anthropic', cost: null, tokens: null },
      ],
    });

    expect(screen.getByText('$7.50 (75.0%)')).toBeDefined();
    expect(screen.getByText('$0.00 (0.0%)')).toBeDefined();
    expect(screen.getByText('750 tokens')).toBeDefined();
  });
});

// ===========================================================================
// Aggregation with real values
// ===========================================================================

describe('UsageTracking aggregation', () => {
  it('renders totals from the aggregate row', async () => {
    await renderUsage({
      total: [{ total_cost: 12.3456, total_tokens: 123456, total_sessions: 7 }],
    });

    expect(screen.getByText('$12.35')).toBeDefined();
    expect(screen.getByText('123,456')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
  });

  it('computes each provider share against the total cost', async () => {
    await renderUsage({
      total: [{ total_cost: 100, total_tokens: 1000, total_sessions: 3 }],
      provider: [
        { provider: 'openai', cost: 75, tokens: 750 },
        { provider: 'anthropic', cost: 25, tokens: 250 },
      ],
    });

    expect(screen.getByText('$75.00 (75.0%)')).toBeDefined();
    expect(screen.getByText('$25.00 (25.0%)')).toBeDefined();
  });

  it('renders model rows with four-decimal costs', async () => {
    await renderUsage({
      total: [{ total_cost: 1, total_tokens: 100, total_sessions: 1 }],
      model: [{ model: 'gpt-4o', provider: 'openai', cost: 0.1234, tokens: 100, sessions: 1 }],
    });

    expect(screen.getByText('$0.1234')).toBeDefined();
    expect(screen.getByText('gpt-4o')).toBeDefined();
  });

  it('renders one table row per model', async () => {
    await renderUsage({
      total: [{ total_cost: 3, total_tokens: 30, total_sessions: 3 }],
      model: [
        { model: 'gpt-4', provider: 'openai', cost: 1, tokens: 10, sessions: 1 },
        { model: 'claude-3', provider: 'anthropic', cost: 1, tokens: 10, sessions: 1 },
        { model: 'gemini', provider: 'google', cost: 1, tokens: 10, sessions: 1 },
      ],
    });

    expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('scales chart bars against the largest cost', async () => {
    await renderUsage({
      timeline: [
        { date: '2026-03-08', cost: 1, tokens: 10, sessions: 1 },
        { date: '2026-03-09', cost: 2, tokens: 20, sessions: 1 },
        { date: '2026-03-10', cost: 0, tokens: 0, sessions: 0 },
      ],
    });

    const heights = Array.from(document.querySelectorAll('[title]')).map(
      (el) => (el as HTMLElement).style.height
    );
    // Max cost is 2 over a 120px chart: 1 -> 60px, 2 -> 120px, 0 -> 0px.
    expect(heights).toEqual(['60px', '120px', '0px']);
  });

  it('renders the first and last timeline dates as axis labels', async () => {
    await renderUsage({
      timeline: [
        { date: '2026-03-01', cost: 1, tokens: 10, sessions: 1 },
        { date: '2026-03-05', cost: 1, tokens: 10, sessions: 1 },
        { date: '2026-03-10', cost: 1, tokens: 10, sessions: 1 },
      ],
    });

    expect(screen.getByText('2026-03-01')).toBeDefined();
    expect(screen.getByText('2026-03-10')).toBeDefined();
  });

  it('renders a flat chart without dividing by zero', async () => {
    await renderUsage({
      timeline: [
        { date: '2026-03-09', cost: 0, tokens: 0, sessions: 0 },
        { date: '2026-03-10', cost: 0, tokens: 0, sessions: 0 },
      ],
    });

    const heights = Array.from(document.querySelectorAll('[title]')).map(
      (el) => (el as HTMLElement).style.height
    );
    expect(heights).toEqual(['0px', '0px']);
    expect(document.body.textContent).not.toContain('NaN');
  });
});

// ===========================================================================
// Time range and queries
// ===========================================================================

describe('UsageTracking time range', () => {
  it('issues all four aggregate queries against usage_logs', async () => {
    await renderUsage();

    expect(capturedQueries).toHaveLength(4);
    for (const { query } of capturedQueries) {
      expect(query).toContain('FROM usage_logs');
    }
  });

  it('passes the same start time to every query', async () => {
    await renderUsage();

    const starts = capturedQueries.map((q) => q.params[0]);
    expect(new Set(starts).size).toBe(1);
  });

  it('defaults to the week window with a non-zero start time', async () => {
    const before = Date.now();
    await renderUsage();

    const start = capturedQueries[0].params[0] as number;
    // Week window: start is ~7 days back, so strictly between 0 and now.
    expect(start).toBeGreaterThan(0);
    expect(start).toBeLessThan(before);
    expect(before - start).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 5000);
  });

  it('re-queries from zero when All Time is selected', async () => {
    await renderUsage();
    capturedQueries.length = 0;

    // The Radix Select trigger is not keyboard-free in jsdom; drive the state
    // through the same handler by clicking the trigger then the option.
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByText('All Time')).toBeDefined());
    fireEvent.click(screen.getByText('All Time'));

    await waitFor(() => expect(capturedQueries.length).toBeGreaterThan(0));
    // `timeRange === 'all'` short-circuits to startTime 0 rather than
    // `now - MAX_SAFE_INTEGER`, which would be a large negative number.
    expect(capturedQueries[0].params[0]).toBe(0);
  });

  it('re-queries when Refresh is pressed', async () => {
    await renderUsage();
    const initial = capturedQueries.length;

    const refresh = Array.from(document.querySelectorAll('button')).find(
      (b) => b.querySelector('.lucide-refresh-cw') !== null
    );
    expect(refresh).toBeDefined();
    fireEvent.click(refresh as HTMLButtonElement);

    await waitFor(() => expect(capturedQueries.length).toBeGreaterThan(initial));
  });
});

// ===========================================================================
// CSV export
// ===========================================================================

describe('generateCSV', () => {
  it('returns an empty string when there are no stats', () => {
    expect(generateCSV(null)).toBe('');
  });

  it('emits a header row and one line per model', () => {
    const csv = generateCSV({
      totalCost: 3,
      totalTokens: 30,
      totalSessions: 2,
      avgResponseTime: 1000,
      byProvider: [],
      byModel: [
        { model: 'gpt-4', provider: 'openai', cost: 2, tokens: 20, sessions: 1, percentage: 66 },
        { model: 'claude-3', provider: 'anthropic', cost: 1, tokens: 10, sessions: 1, percentage: 33 },
      ],
      timeline: [],
    });

    const lines = csv.split('\n');
    expect(lines[0]).toBe('Model,Provider,Cost,Tokens,Sessions');
    expect(lines[1]).toBe('gpt-4,openai,2,20,1');
    expect(lines[2]).toBe('claude-3,anthropic,1,10,1');
    expect(lines).toHaveLength(3);
  });

  it('emits only the header when no models were used', () => {
    const csv = generateCSV({
      totalCost: 0,
      totalTokens: 0,
      totalSessions: 0,
      avgResponseTime: 0,
      byProvider: [],
      byModel: [],
      timeline: [],
    });

    expect(csv).toBe('Model,Provider,Cost,Tokens,Sessions');
  });
});

describe('UsageTracking export button', () => {
  it('builds a CSV blob download when Export is pressed', async () => {
    // Typed with its real parameter: `vi.fn(() => ...)` infers a zero-arity
    // signature, so `mock.calls[0][0]` is a tuple index error and the Blob
    // assertion below would not typecheck.
    const createObjectURL = vi.fn((_blob: Blob): string => 'blob:usage');
    const revokeObjectURL = vi.fn((_url: string): void => undefined);
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;

    // The anchor is created detached and clicked, so intercept the click rather
    // than expecting a navigation.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      await renderUsage({
        total: [{ total_cost: 1, total_tokens: 10, total_sessions: 1 }],
        model: [{ model: 'gpt-4', provider: 'openai', cost: 1, tokens: 10, sessions: 1 }],
      });

      fireEvent.click(screen.getByText('Export'));

      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe('text/csv');
      // The URL is released again; leaking it pins the blob for the session.
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:usage');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
    }
  });

  it('names the download after the selected range', async () => {
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => 'blob:usage') as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

    let downloadName = '';
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function mockClick(this: HTMLAnchorElement) {
        downloadName = this.download;
      });

    try {
      await renderUsage();

      fireEvent.click(screen.getByText('Export'));

      await waitFor(() => expect(downloadName).not.toBe(''));
      expect(downloadName).toMatch(/^usage-report-week-\d+\.csv$/);
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      clickSpy.mockRestore();
    }
  });
});
