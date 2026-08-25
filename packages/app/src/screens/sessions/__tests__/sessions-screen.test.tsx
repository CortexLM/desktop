import { createSignal } from 'solid-js';
import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import {
  SessionsScreen,
  type InboxSession,
  type SessionsScreenProps,
} from '../sessions-screen.tsx';

const SESSIONS: InboxSession[] = [
  {
    id: 's1',
    title: 'Fix flaky auth tests',
    branch: 'agent/auth-tests-fix',
    repo: 'forge/backend-api',
    status: 'running',
    diff: { added: 186, removed: 42 },
    age: '4m ago',
    unread: true,
  },
  {
    id: 's2',
    title: 'Add rate limiting to public API',
    branch: 'agent/rate-limit-middleware',
    repo: 'forge/backend-api',
    status: 'pr-ready',
    diff: { added: 312, removed: 18 },
    age: '1h ago',
  },
  {
    id: 's3',
    title: 'Migrate dashboard charts to Recharts',
    branch: 'agent/recharts-migration',
    repo: 'forge/dashboard',
    status: 'merged',
    diff: { added: 954, removed: 707 },
    age: 'Yesterday',
  },
];

const FILTERS = [
  { id: 'all', label: 'All', count: 24 },
  { id: 'mine', label: 'Mine', count: 9 },
  { id: 'archived', label: 'Archived' },
];

function renderSessions(overrides: Partial<SessionsScreenProps> = {}) {
  const [filter, setFilter] = createSignal(overrides.activeFilter ?? 'all');
  const [query, setQuery] = createSignal(overrides.query ?? '');
  const onOpenSession = overrides.onOpenSession ?? vi.fn();

  const {
    activeFilter: _f,
    onFilterChange: _fc,
    query: _q,
    onQueryChange: _qc,
    onOpenSession: _o,
    ...rest
  } = overrides;

  const result = render(() => (
    <SessionsScreen
      sessions={SESSIONS}
      filters={FILTERS}
      {...rest}
      activeFilter={filter()}
      onFilterChange={setFilter}
      query={query()}
      onQueryChange={setQuery}
      onOpenSession={onOpenSession}
    />
  ));

  return { ...result, filter, query, onOpenSession };
}

describe('Sessions inbox', () => {
  it('groups sessions under their repo without repeating the heading', () => {
    renderSessions();

    expect(screen.getAllByText('forge/backend-api')).toHaveLength(1);
    expect(screen.getAllByText('forge/dashboard')).toHaveLength(1);
  });

  it('counts the sessions in each group', () => {
    renderSessions();

    expect(screen.getByText('2 sessions')).toBeInTheDocument();
    expect(screen.getByText('1 session')).toBeInTheDocument();
  });

  it('keeps arrival order within and between groups', () => {
    const { container } = renderSessions();
    const titles = [...container.querySelectorAll('.cx-inbox__title')].map((n) => n.textContent);

    expect(titles).toEqual([
      'Fix flaky auth tests',
      'Add rate limiting to public API',
      'Migrate dashboard charts to Recharts',
    ]);
  });

  it('reserves the unread lane on every row and fills it only where there is activity', () => {
    // Reserved so the titles share a vertical lane down the list.
    const { container } = renderSessions();

    expect(container.querySelectorAll('.cx-inbox__unread')).toHaveLength(3);
    expect(container.querySelectorAll('.cx-inbox__unread-dot')).toHaveLength(1);
  });

  it('confines the status colour to the dot and keeps the label muted', () => {
    // At 12px a coloured label on a white row reads as a link, so the hue stays in the dot.
    const { container } = renderSessions();

    expect(container.querySelector('.cx-inbox__status-dot--warning')).not.toBeNull();
    expect(container.querySelector('.cx-inbox__status-dot--success')).not.toBeNull();
    expect(container.querySelector('.cx-inbox__status-dot--accent')).not.toBeNull();
  });

  it('formats diff counts with a minus sign', () => {
    renderSessions();
    expect(screen.getByText('+186')).toBeInTheDocument();
    expect(screen.getByText('\u221242')).toBeInTheDocument();
  });

  it('opens a session by id', () => {
    const { onOpenSession } = renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /Fix flaky auth tests/ }));
    expect(onOpenSession).toHaveBeenCalledWith('s1');
  });

  it('names each row with its status, so the dot is not the only signal', () => {
    renderSessions();
    expect(
      screen.getByRole('button', { name: 'Fix flaky auth tests, Running' }),
    ).toBeInTheDocument();
  });
});

describe('Sessions controls', () => {
  it('marks the active filter as pressed', () => {
    renderSessions({ activeFilter: 'mine' });

    expect(screen.getByRole('button', { name: /Mine/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a count only on the filters that have one', () => {
    renderSessions();

    expect(screen.getByRole('button', { name: 'All 24' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archived' })).toBeInTheDocument();
  });

  it('changes the filter on press', () => {
    const { filter } = renderSessions();
    fireEvent.click(screen.getByRole('button', { name: /Archived/ }));
    expect(filter()).toBe('archived');
  });

  it('reports the search query', () => {
    const { query } = renderSessions();
    fireEvent.input(screen.getByLabelText('Search sessions'), { target: { value: 'auth' } });
    expect(query()).toBe('auth');
  });

  it('offers New session only when the host handles it', () => {
    const withAction = renderSessions({ onNewSession: vi.fn() });
    expect(screen.getByRole('button', { name: 'New session' })).toBeInTheDocument();
    withAction.unmount();

    renderSessions();
    expect(screen.queryByRole('button', { name: 'New session' })).toBeNull();
  });
});

describe('Sessions empty state', () => {
  it('replaces the list when there is nothing to show', () => {
    // Empty States is this screen with an empty list, not a separate route.
    const { container } = renderSessions({ sessions: [] });

    expect(container.querySelector('.cx-inbox')).toBeNull();
    expect(container.querySelector('.cx-empty')).not.toBeNull();
  });

  it('falls back to copy that explains how sessions get here', () => {
    renderSessions({ sessions: [] });

    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
    expect(screen.getByText(/Start one from the composer/)).toBeInTheDocument();
  });

  it('lets the host tailor the copy to the active filter', () => {
    renderSessions({
      sessions: [],
      emptyState: { title: 'Nothing archived', body: 'Sessions you archive will collect here.' },
    });

    expect(screen.getByText('Nothing archived')).toBeInTheDocument();
    expect(screen.getByText('Sessions you archive will collect here.')).toBeInTheDocument();
  });

  it('keeps the controls usable so the filter can be changed back', () => {
    // Hiding them would trap the user in an empty filter with no way out.
    renderSessions({ sessions: [], activeFilter: 'archived' });
    expect(screen.getByRole('button', { name: /All/ })).toBeInTheDocument();
  });
});
