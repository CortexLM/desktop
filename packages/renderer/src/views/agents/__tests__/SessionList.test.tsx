/**
 * SessionList tests
 *
 * Covers the date grouping / relative-time helpers (where a wrong bucket makes a
 * session unfindable and nothing looks broken) and the component's load, filter,
 * search, select, delete and archive paths against a stubbed `window.cortex`.
 *
 * The helpers take an injectable `now`, so every boundary case below is exact
 * rather than "roughly today" — a test that computes its expectation from
 * `Date.now()` the same way the code does cannot detect a wrong boundary.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import {
  SessionList,
  groupSessionsByDate,
  sessionDateGroup,
  formatRelativeTime,
  UNKNOWN_DATE_GROUP,
  type Session,
} from '../SessionList';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

/** Fixed reference instant: 2026-03-10 12:00 local. */
const NOW = new Date(2026, 2, 10, 12, 0, 0, 0).getTime();

function session(overrides: Partial<Session> & { id: string }): Session {
  return {
    title: 'A session',
    model: 'gpt-4',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  } as Session;
}

interface CortexStub {
  db: {
    query: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
}

let cortex: CortexStub;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function makeCortex(rows: Session[] = []): CortexStub {
  return {
    db: {
      query: vi.fn(async () => ({ success: true, data: { rows } })),
      execute: vi.fn(async () => ({ success: true, data: {} })),
    },
  };
}

function setCortex(stub: CortexStub) {
  cortex = stub;
  (globalThis as unknown as { window: Record<string, unknown> }).window.cortex = stub;
}

/**
 * The period filter buttons, by label.
 *
 * `getByText('Today')` is ambiguous: "Today" is both a filter button and a date
 * group heading, and once a session from today is on screen both exist. Scoping
 * to buttons keeps the two apart.
 */
function periodButton(label: 'All' | 'Today' | 'Week' | 'Month'): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === label
  );
  if (!match) throw new Error(`period button "${label}" not found`);
  return match as HTMLButtonElement;
}

/** Date group headings currently rendered, in DOM order. */
function groupHeadings(): string[] {
  return Array.from(document.querySelectorAll('p.text-xs.font-medium.text-text-secondary')).map(
    (el) => el.textContent?.trim() ?? ''
  );
}

async function renderList(
  rows: Session[] = [],
  props: Partial<React.ComponentProps<typeof SessionList>> = {}
) {
  setCortex(makeCortex(rows));
  const result = render(
    React.createElement(SessionList, {
      onSessionSelect: vi.fn(),
      onNewSession: vi.fn(),
      ...props,
    })
  );
  // Loading resolves before any assertion, so tests never race the spinner.
  await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
  return result;
}

beforeEach(() => {
  setCortex(makeCortex());
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  consoleErrorSpy.mockRestore();
  vi.useRealTimers();
});

// ===========================================================================
// sessionDateGroup — calendar-day bucketing
// ===========================================================================

describe('sessionDateGroup', () => {
  it('buckets an instant from earlier the same day as Today', () => {
    expect(sessionDateGroup(NOW - 2 * HOUR, NOW)).toBe('Today');
  });

  it('buckets local midnight itself as Today', () => {
    const midnight = new Date(2026, 2, 10, 0, 0, 0, 0).getTime();
    expect(sessionDateGroup(midnight, NOW)).toBe('Today');
  });

  /**
   * The midnight regression, stated exactly.
   *
   * At 00:30, a session from 23:00 the previous evening is 1.5h old. The old
   * implementation asked "is this under 24h old?" and answered Today, so last
   * night's work vanished from the Yesterday group the user would look under.
   */
  it('buckets 23:00 yesterday as Yesterday when read at 00:30 today', () => {
    const nowAt0030 = new Date(2026, 2, 10, 0, 30, 0, 0).getTime();
    const yesterdayAt2300 = new Date(2026, 2, 9, 23, 0, 0, 0).getTime();

    // Precondition: this is the case an elapsed-time rule gets wrong.
    expect(nowAt0030 - yesterdayAt2300).toBeLessThan(DAY);

    expect(sessionDateGroup(yesterdayAt2300, nowAt0030)).toBe('Yesterday');
  });

  it('buckets one minute before midnight as Yesterday', () => {
    const nowAt0001 = new Date(2026, 2, 10, 0, 1, 0, 0).getTime();
    const justBeforeMidnight = new Date(2026, 2, 9, 23, 59, 0, 0).getTime();

    expect(sessionDateGroup(justBeforeMidnight, nowAt0001)).toBe('Yesterday');
  });

  it('buckets 00:01 today as Today even when read at 23:59', () => {
    const nowAt2359 = new Date(2026, 2, 10, 23, 59, 0, 0).getTime();
    const todayAt0001 = new Date(2026, 2, 10, 0, 1, 0, 0).getTime();

    expect(sessionDateGroup(todayAt0001, nowAt2359)).toBe('Today');
  });

  it('separates the two sides of a midnight boundary into different buckets', () => {
    const nowAt1200 = new Date(2026, 2, 10, 12, 0, 0, 0).getTime();
    const lateYesterday = new Date(2026, 2, 9, 23, 59, 59, 0).getTime();
    const earlyToday = new Date(2026, 2, 10, 0, 0, 1, 0).getTime();

    // Two instants two seconds apart must not share a bucket.
    expect(sessionDateGroup(lateYesterday, nowAt1200)).toBe('Yesterday');
    expect(sessionDateGroup(earlyToday, nowAt1200)).toBe('Today');
  });

  it.each([
    ['2 days ago', 2, 'This Week'],
    ['6 days ago', 6, 'This Week'],
    ['7 days ago', 7, 'This Week'],
    ['8 days ago', 8, 'This Month'],
    ['29 days ago', 29, 'This Month'],
    ['30 days ago', 30, 'This Month'],
    ['31 days ago', 31, 'Older'],
    ['400 days ago', 400, 'Older'],
  ])('buckets %s as %s', (_label, daysAgo, expected) => {
    const startOfToday = new Date(2026, 2, 10, 0, 0, 0, 0).getTime();
    // Midday on the target day, so the assertion is about the day, not the hour.
    const timestamp = startOfToday - daysAgo * DAY + 12 * HOUR;
    expect(sessionDateGroup(timestamp, NOW)).toBe(expected);
  });

  it('treats a slightly future timestamp as Today rather than a stale bucket', () => {
    // Clock skew between machines writing the same DB.
    expect(sessionDateGroup(NOW + 5 * MINUTE, NOW)).toBe('Today');
  });

  /**
   * The NaN-fallthrough regression.
   *
   * `now - undefined` is NaN and every `NaN < x` comparison is false, so an
   * undated session fell through every branch into `Older` — indistinguishable
   * from a genuinely old session, with nothing to indicate the date was missing.
   */
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['a date string', '2026-01-01'],
    ['an object', {}],
  ])('routes %s to the unknown-date bucket, not Older', (_label, value) => {
    expect(sessionDateGroup(value, NOW)).toBe(UNKNOWN_DATE_GROUP);
    expect(sessionDateGroup(value, NOW)).not.toBe('Older');
  });
});

// ===========================================================================
// groupSessionsByDate
// ===========================================================================

describe('groupSessionsByDate', () => {
  it('returns no groups for no sessions', () => {
    expect(groupSessionsByDate([], NOW)).toEqual({});
  });

  it('omits buckets that have no sessions', () => {
    const groups = groupSessionsByDate([session({ id: 'a', updated_at: NOW })], NOW);

    expect(Object.keys(groups)).toEqual(['Today']);
  });

  it('keeps every session, including undated ones', () => {
    const sessions = [
      session({ id: 'today', updated_at: NOW }),
      session({ id: 'old', updated_at: NOW - 400 * DAY }),
      session({ id: 'undated', updated_at: undefined as unknown as number }),
    ];

    const groups = groupSessionsByDate(sessions, NOW);
    const total = Object.values(groups).reduce((n, list) => n + list.length, 0);

    expect(total).toBe(3);
  });

  it('orders buckets newest-first regardless of row order', () => {
    // Deliberately scrambled: relying on insertion order made the display order
    // a side effect of the SQL ORDER BY.
    const sessions = [
      session({ id: 'old', updated_at: NOW - 400 * DAY }),
      session({ id: 'undated', updated_at: undefined as unknown as number }),
      session({ id: 'today', updated_at: NOW }),
      session({ id: 'month', updated_at: NOW - 20 * DAY }),
      session({ id: 'yesterday', updated_at: NOW - DAY }),
      session({ id: 'week', updated_at: NOW - 4 * DAY }),
    ];

    expect(Object.keys(groupSessionsByDate(sessions, NOW))).toEqual([
      'Today',
      'Yesterday',
      'This Week',
      'This Month',
      'Older',
      UNKNOWN_DATE_GROUP,
    ]);
  });

  it('preserves the input order of sessions within a bucket', () => {
    const sessions = [
      session({ id: 'first', updated_at: NOW - HOUR }),
      session({ id: 'second', updated_at: NOW - 2 * HOUR }),
      session({ id: 'third', updated_at: NOW - 3 * HOUR }),
    ];

    expect(groupSessionsByDate(sessions, NOW).Today.map((s) => s.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('groups several sessions from the same day together', () => {
    const sessions = [
      session({ id: 'a', updated_at: NOW - HOUR }),
      session({ id: 'b', updated_at: NOW - 5 * HOUR }),
    ];

    expect(groupSessionsByDate(sessions, NOW).Today).toHaveLength(2);
  });
});

// ===========================================================================
// formatRelativeTime
// ===========================================================================

describe('formatRelativeTime', () => {
  it.each([
    ['just now', 0, 'Just now'],
    ['30 seconds ago', 30 * 1000, 'Just now'],
    ['1 minute ago', MINUTE, '1m ago'],
    ['59 minutes ago', 59 * MINUTE, '59m ago'],
    ['1 hour ago', HOUR, '1h ago'],
    ['23 hours ago', 23 * HOUR, '23h ago'],
    ['1 day ago', DAY, '1d ago'],
    ['6 days ago', 6 * DAY, '6d ago'],
  ])('renders %s as %s', (_label, ago, expected) => {
    expect(formatRelativeTime(NOW - ago, NOW)).toBe(expected);
  });

  it('falls back to an absolute date beyond a week', () => {
    const result = formatRelativeTime(NOW - 10 * DAY, NOW);

    expect(result).not.toMatch(/ago$/);
    // A real date, not the string "Invalid Date".
    expect(result).not.toContain('Invalid');
    expect(result).toContain('2026');
  });

  /**
   * The visible-garbage regression: `new Date(undefined).toLocaleDateString()`
   * renders the literal text "Invalid Date", and `new Date(null)` renders
   * "1/1/1970" — both were shown directly in the session row.
   */
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['NaN', NaN],
    ['a date string', '2026-01-01'],
  ])('renders %s as Unknown rather than a bogus date', (_label, value) => {
    const result = formatRelativeTime(value, NOW);

    expect(result).toBe('Unknown');
    expect(result).not.toContain('Invalid Date');
    expect(result).not.toContain('1970');
  });

  it('renders a future timestamp as Just now, not a negative age', () => {
    const result = formatRelativeTime(NOW + 5 * MINUTE, NOW);

    expect(result).toBe('Just now');
    expect(result).not.toContain('-');
  });
});

// ===========================================================================
// Component: loading and rendering
// ===========================================================================

describe('SessionList rendering', () => {
  it('queries the sessions table on mount', async () => {
    await renderList();

    const request = cortex.db.query.mock.calls[0][0] as { query: string };
    expect(request.query).toContain('FROM sessions');
    expect(request.query).toContain('ORDER BY s.updated_at DESC');
  });

  it('shows the empty state when there are no sessions', async () => {
    await renderList();

    expect(screen.getByText('No sessions found')).toBeDefined();
  });

  it('renders a session row with its title, model and message count', async () => {
    await renderList([session({ id: 's1', title: 'Refactor auth', messageCount: 12 })]);

    expect(screen.getByText('Refactor auth')).toBeDefined();
    expect(screen.getByText('gpt-4')).toBeDefined();
    expect(screen.getByText('12 messages')).toBeDefined();
  });

  it('falls back to a placeholder title for a null title', async () => {
    await renderList([session({ id: 's1', title: null })]);

    expect(screen.getByText('Untitled Session')).toBeDefined();
  });

  it('omits the model badge when the model is null', async () => {
    await renderList([session({ id: 's1', title: 'No model', model: null })]);

    expect(screen.getByText('No model')).toBeDefined();
    expect(screen.queryByText('gpt-4')).toBeNull();
  });

  it('renders the date group heading', async () => {
    await renderList([session({ id: 's1', updated_at: Date.now() })]);

    // "Today" is also a filter button label, so match the heading specifically.
    expect(groupHeadings()).toContain('Today');
  });

  /**
   * End-to-end version of the undated-session case: the row must be visible and
   * must not display "Invalid Date" anywhere.
   */
  it('renders an undated session under the unknown-date heading', async () => {
    await renderList([
      session({ id: 's1', title: 'Undated work', updated_at: undefined as unknown as number }),
    ]);

    expect(screen.getByText('Undated work')).toBeDefined();
    expect(screen.getByText(UNKNOWN_DATE_GROUP)).toBeDefined();
    expect(screen.getByText('Unknown')).toBeDefined();
    expect(document.body.textContent).not.toContain('Invalid Date');
  });

  it('pluralises the footer count', async () => {
    await renderList([session({ id: 's1' }), session({ id: 's2' })]);

    expect(screen.getByText('2 sessions')).toBeDefined();
  });

  it('uses the singular footer count for one session', async () => {
    await renderList([session({ id: 's1' })]);

    expect(screen.getByText('1 session')).toBeDefined();
  });

  it('marks the active session row', async () => {
    await renderList([session({ id: 's1' }), session({ id: 's2' })], {
      activeSessionId: 's2',
    });

    const rows = screen.getAllByTestId('session-item');
    expect(rows).toHaveLength(2);
    // The active row carries the stronger tint.
    expect(rows[1].className).toContain('bg-tint-strong');
    expect(rows[0].className).not.toContain('bg-tint-strong');
  });

  it('keeps the list usable when the query reports failure', async () => {
    setCortex(makeCortex());
    cortex.db.query.mockImplementation(async () => ({ success: false, error: { message: 'no' } }));

    render(
      React.createElement(SessionList, {
        onSessionSelect: vi.fn(),
        onNewSession: vi.fn(),
      })
    );

    await waitFor(() => expect(screen.getByText('No sessions found')).toBeDefined());
  });

  it('reports a load failure and stops loading', async () => {
    setCortex(makeCortex());
    cortex.db.query.mockImplementation(async () => {
      throw new Error('db offline');
    });

    render(
      React.createElement(SessionList, {
        onSessionSelect: vi.fn(),
        onNewSession: vi.fn(),
      })
    );

    // The spinner must clear even on failure, or the view is stuck forever.
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(screen.getByText('No sessions found')).toBeDefined();
  });
});

// ===========================================================================
// Component: interaction
// ===========================================================================

describe('SessionList interaction', () => {
  it('calls onNewSession from the New Chat button', async () => {
    const onNewSession = vi.fn();
    await renderList([], { onNewSession });

    fireEvent.click(screen.getByTestId('new-session'));

    expect(onNewSession).toHaveBeenCalledTimes(1);
  });

  it('calls onSessionSelect with the clicked session id', async () => {
    const onSessionSelect = vi.fn();
    await renderList([session({ id: 'session-9', title: 'Pick me' })], { onSessionSelect });

    fireEvent.click(screen.getByText('Pick me'));

    expect(onSessionSelect).toHaveBeenCalledWith('session-9');
  });

  it('filters by title through the debounced search box', async () => {
    vi.useFakeTimers();
    setCortex(
      makeCortex([
        session({ id: 'a', title: 'Refactor auth' }),
        session({ id: 'b', title: 'Write docs' }),
      ])
    );

    render(
      React.createElement(SessionList, {
        onSessionSelect: vi.fn(),
        onNewSession: vi.fn(),
      })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.change(screen.getByPlaceholderText('Search sessions...'), {
      target: { value: 'refactor' },
    });

    // Before the debounce window elapses, both rows are still shown.
    expect(screen.getAllByTestId('session-item')).toHaveLength(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getAllByTestId('session-item')).toHaveLength(1);
    expect(screen.getByText('Refactor auth')).toBeDefined();
    expect(screen.queryByText('Write docs')).toBeNull();
  });

  it('matches the search against the model as well as the title', async () => {
    vi.useFakeTimers();
    setCortex(
      makeCortex([
        session({ id: 'a', title: 'One', model: 'claude-3-opus' }),
        session({ id: 'b', title: 'Two', model: 'gpt-4' }),
      ])
    );

    render(
      React.createElement(SessionList, {
        onSessionSelect: vi.fn(),
        onNewSession: vi.fn(),
      })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.change(screen.getByPlaceholderText('Search sessions...'), {
      target: { value: 'claude' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getAllByTestId('session-item')).toHaveLength(1);
    expect(screen.getByText('One')).toBeDefined();
  });

  it('shows the empty state when the search matches nothing', async () => {
    vi.useFakeTimers();
    setCortex(makeCortex([session({ id: 'a', title: 'Refactor auth' })]));

    render(
      React.createElement(SessionList, {
        onSessionSelect: vi.fn(),
        onNewSession: vi.fn(),
      })
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    fireEvent.change(screen.getByPlaceholderText('Search sessions...'), {
      target: { value: 'zzzz' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText('No sessions found')).toBeDefined();
  });

  it('filters to today with the Today period button', async () => {
    const now = Date.now();
    await renderList([
      session({ id: 'recent', title: 'Recent work', updated_at: now - HOUR }),
      session({ id: 'ancient', title: 'Ancient work', updated_at: now - 40 * DAY }),
    ]);

    expect(screen.getAllByTestId('session-item')).toHaveLength(2);

    fireEvent.click(periodButton('Today'));

    expect(screen.getByText('Recent work')).toBeDefined();
    expect(screen.queryByText('Ancient work')).toBeNull();
  });

  it('filters to the last week with the Week period button', async () => {
    const now = Date.now();
    await renderList([
      session({ id: 'in', title: 'Three days ago', updated_at: now - 3 * DAY }),
      session({ id: 'out', title: 'Twenty days ago', updated_at: now - 20 * DAY }),
    ]);

    fireEvent.click(periodButton('Week'));

    expect(screen.getByText('Three days ago')).toBeDefined();
    expect(screen.queryByText('Twenty days ago')).toBeNull();
  });

  it('filters to the last month with the Month period button', async () => {
    const now = Date.now();
    await renderList([
      session({ id: 'in', title: 'Twenty days ago', updated_at: now - 20 * DAY }),
      session({ id: 'out', title: 'Ninety days ago', updated_at: now - 90 * DAY }),
    ]);

    fireEvent.click(periodButton('Month'));

    expect(screen.getByText('Twenty days ago')).toBeDefined();
    expect(screen.queryByText('Ninety days ago')).toBeNull();
  });

  it('restores every session with the All period button', async () => {
    const now = Date.now();
    await renderList([
      session({ id: 'recent', title: 'Recent work', updated_at: now - HOUR }),
      session({ id: 'ancient', title: 'Ancient work', updated_at: now - 40 * DAY }),
    ]);

    fireEvent.click(periodButton('Today'));
    expect(screen.queryByText('Ancient work')).toBeNull();

    fireEvent.click(periodButton('All'));

    expect(screen.getByText('Recent work')).toBeDefined();
    expect(screen.getByText('Ancient work')).toBeDefined();
  });
});

// ===========================================================================
// Component: delete and archive
// ===========================================================================

describe('SessionList delete and archive', () => {
  /** Open the per-row actions menu. */
  async function openMenu() {
    const row = screen.getByTestId('session-item');
    const menuButton = row.querySelector('button');
    if (!menuButton) throw new Error('row menu button not found');
    await act(async () => {
      fireEvent.click(menuButton);
    });
  }

  it('deletes messages and the session, in that order', async () => {
    await renderList([session({ id: 'doomed', title: 'Doomed' })]);

    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

    expect(cortex.db.execute).toHaveBeenCalledTimes(1);
    const { statements } = cortex.db.execute.mock.calls[0][0] as {
      statements: Array<{ query: string; params: unknown[] }>;
    };
    // Messages first: deleting the session first would orphan its messages if
    // the second statement failed.
    expect(statements[0].query).toContain('DELETE FROM messages');
    expect(statements[0].params).toEqual(['doomed']);
    expect(statements[1].query).toContain('DELETE FROM sessions');
    expect(statements[1].params).toEqual(['doomed']);
  });

  it('reloads the list after a delete', async () => {
    await renderList([session({ id: 'doomed', title: 'Doomed' })]);
    expect(cortex.db.query).toHaveBeenCalledTimes(1);

    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

    await waitFor(() => expect(cortex.db.query).toHaveBeenCalledTimes(2));
  });

  it('archives without deleting anything', async () => {
    await renderList([session({ id: 'keep', title: 'Keep' })]);

    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByText('Archive'));
    });

    const { statements } = cortex.db.execute.mock.calls[0][0] as {
      statements: Array<{ query: string; params: unknown[] }>;
    };
    expect(statements).toHaveLength(1);
    expect(statements[0].query).toContain('UPDATE sessions');
    expect(statements[0].query).not.toContain('DELETE');
    expect(statements[0].params).toEqual(['keep']);
  });

  it('survives a failing delete without crashing the list', async () => {
    await renderList([session({ id: 'doomed', title: 'Doomed' })]);
    cortex.db.execute.mockImplementation(async () => {
      throw new Error('constraint violation');
    });

    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(screen.getByText('Doomed')).toBeDefined();
  });

  it('survives a failing archive without crashing the list', async () => {
    await renderList([session({ id: 'keep', title: 'Keep' })]);
    cortex.db.execute.mockImplementation(async () => {
      throw new Error('locked');
    });

    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByText('Archive'));
    });

    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(screen.getByText('Keep')).toBeDefined();
  });

  it('does not select the session when the row menu is opened', async () => {
    const onSessionSelect = vi.fn();
    await renderList([session({ id: 's1', title: 'Row' })], { onSessionSelect });

    await openMenu();

    // The menu button stops propagation; opening the menu is not a row click.
    expect(onSessionSelect).not.toHaveBeenCalled();
  });
});
