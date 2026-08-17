/**
 * SessionList - Sidebar with historical chat sessions
 * Features: search, filters, new chat, delete/archive sessions
 * Performance: React.memo, virtual scrolling, debounced search
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Plus,
  Search,
  Clock,
  MessageSquare,
  MoreVertical,
  Trash2,
  Archive,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { useDebounce } from '../../hooks/use-performance';

/**
 * A session row as it arrives from the `sessions` query.
 *
 * `title` and `model` are nullable in the schema and are rendered defensively.
 * `updated_at` is declared `INTEGER NOT NULL`, but the date helpers below still
 * validate it: the renderer consumes whatever the query returned, and a partial
 * select or an aggregated row can hand over something that is not a number.
 */
export interface Session {
  id: string;
  title: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
  messageCount?: number;
}

interface SessionListProps {
  activeSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onNewSession: () => void;
}

export const SessionList: React.FC<SessionListProps> = React.memo(({
  activeSessionId,
  onSessionSelect,
  onNewSession,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Load sessions
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await window.cortex.db.query<Session>({
        query: `
          SELECT 
            s.*,
            (SELECT COUNT(*) FROM messages WHERE session_id = s.id) as messageCount
          FROM sessions s
          ORDER BY s.updated_at DESC
        `,
      });

      if (response.success && response.data) {
        setSessions(response.data.rows);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter sessions with useMemo for performance
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // Search filter
      if (debouncedSearchQuery) {
        const query = debouncedSearchQuery.toLowerCase();
        const title = session.title?.toLowerCase() || '';
        const model = session.model?.toLowerCase() || '';
        if (!title.includes(query) && !model.includes(query)) {
          return false;
        }
      }

      // Time period filter
      if (filterPeriod !== 'all') {
        const now = Date.now();
        const sessionDate = session.updated_at;
        const dayMs = 24 * 60 * 60 * 1000;

        switch (filterPeriod) {
          case 'today':
            if (now - sessionDate > dayMs) return false;
            break;
          case 'week':
            if (now - sessionDate > 7 * dayMs) return false;
            break;
          case 'month':
            if (now - sessionDate > 30 * dayMs) return false;
            break;
        }
      }

      return true;
    });
  }, [sessions, debouncedSearchQuery, filterPeriod]);

  // Group sessions by date with useMemo
  const groupedSessions = useMemo(() => groupSessionsByDate(filteredSessions), [filteredSessions]);

  // Handle delete session
  const handleDelete = useCallback(async (sessionId: string) => {
    try {
      await window.cortex.db.execute({
        statements: [
          { query: 'DELETE FROM messages WHERE session_id = ?', params: [sessionId] },
          { query: 'DELETE FROM sessions WHERE id = ?', params: [sessionId] },
        ],
      });
      loadSessions();
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [loadSessions]);

  // Handle archive session (soft delete)
  const handleArchive = useCallback(async (sessionId: string) => {
    try {
      await window.cortex.db.execute({
        statements: [
          {
            query: 'UPDATE sessions SET metadata = json_set(metadata, "$.archived", 1) WHERE id = ?',
            params: [sessionId],
          },
        ],
      });
      loadSessions();
    } catch (error) {
      console.error('Failed to archive session:', error);
    }
  }, [loadSessions]);

  return (
    <div className="flex flex-col h-full w-[378px] bg-wash border-r border-border-soft">
      {/* Header */}
      <div className="p-4 space-y-3 border-b border-border-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Sessions</h2>
          <Button
            size="sm"
            onClick={onNewSession}
            className="gap-2"
            data-testid="new-session"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'today', 'week', 'month'] as const).map((period) => (
            <Button
              key={period}
              variant={filterPeriod === period ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterPeriod(period)}
              className="flex-1 text-xs"
            >
              {period === 'all' ? 'All' : period.charAt(0).toUpperCase() + period.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-text-secondary">Loading sessions...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center space-y-2">
              <MessageSquare className="w-8 h-8 text-text-tertiary mx-auto" />
              <p className="text-sm text-text-secondary">No sessions found</p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            {Object.entries(groupedSessions).map(([date, dateSessions]) => (
              <div key={date} className="mb-4">
                <div className="px-4 py-2">
                  <p className="text-xs font-medium text-text-secondary">{date}</p>
                </div>
                <div className="space-y-1 px-2">
                  {dateSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      isActive={session.id === activeSessionId}
                      onSelect={() => onSessionSelect(session.id)}
                      onDelete={() => handleDelete(session.id)}
                      onArchive={() => handleArchive(session.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border-soft">
        <p className="text-xs text-text-tertiary">
          {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
});

// Session Item Component
interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onArchive: () => void;
}

const SessionItem: React.FC<SessionItemProps> = React.memo(({
  session,
  isActive,
  onSelect,
  onDelete,
  onArchive,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        'group relative rounded-sm px-3 py-2.5 cursor-pointer transition-colors',
        'hover:bg-tint',
        isActive && 'bg-tint-strong'
      )}
      onClick={onSelect}
      data-testid="session-item"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text truncate">
            {session.title || 'Untitled Session'}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {session.model && (
              <Badge variant="outline" className="text-xs">
                {session.model}
              </Badge>
            )}
            {session.messageCount !== undefined && (
              <span className="text-xs text-text-tertiary">
                {session.messageCount} messages
              </span>
            )}
          </div>
          <p className="text-xs text-text-tertiary mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(session.updated_at)}
          </p>
        </div>

        {/* Actions Menu */}
        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity',
                isMenuOpen && 'opacity-100'
              )}
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
                setIsMenuOpen(false);
              }}
            >
              <Archive className="w-4 h-4" />
              Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-red hover:text-red"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
                setIsMenuOpen(false);
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  return (
    prevProps.session.id === nextProps.session.id &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.session.updated_at === nextProps.session.updated_at
  );
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bucket used when a row carries no usable `updated_at`. */
export const UNKNOWN_DATE_GROUP = 'Unknown date';

/**
 * Render order for the date buckets.
 *
 * Insertion order used to be relied on implicitly: rows arrive
 * `ORDER BY updated_at DESC`, so the groups happened to be created newest-first.
 * That made the display order a side effect of the SQL, and a row with an
 * unusable date could be inserted anywhere. Ordering explicitly means the
 * headings read Today → Older regardless of row order.
 */
const GROUP_ORDER = [
  'Today',
  'Yesterday',
  'This Week',
  'This Month',
  'Older',
  UNKNOWN_DATE_GROUP,
] as const;

/**
 * True only for a value we can actually place on a calendar.
 *
 * `updated_at` is `INTEGER NOT NULL` in the schema, but the renderer receives
 * whatever the query produced: a joined/aggregated row, a partial select or a
 * row written before a migration can hand over `undefined`, `null` or a string.
 * Those must not be treated as dates — `now - undefined` is `NaN`, and every
 * `NaN < x` comparison is false, so an undated session used to fall through
 * every branch and land in `Older` with no indication anything was wrong.
 */
function isUsableTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Local midnight for the day containing `timestamp`. */
function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Bucket label for a session timestamp.
 *
 * Compares calendar days, not elapsed milliseconds. The previous version asked
 * "is this less than 24h old?" for `Today`, which is a different question: at
 * 00:30, a session from 23:00 the previous evening is 1.5h old and was labelled
 * `Today` even though it belongs to yesterday. Users looking under `Yesterday`
 * for last night's work could not find it, and nothing about the UI hinted why.
 *
 * `now` is injectable so the boundary behaviour can be tested without relying
 * on the wall clock.
 */
export function sessionDateGroup(timestamp: unknown, now: number = Date.now()): string {
  if (!isUsableTimestamp(timestamp)) return UNKNOWN_DATE_GROUP;

  const startOfToday = startOfLocalDay(now);

  // A timestamp at or after today's midnight is today — including one slightly
  // in the future, which happens with clock skew between machines.
  if (timestamp >= startOfToday) return 'Today';
  if (timestamp >= startOfToday - DAY_MS) return 'Yesterday';
  if (timestamp >= startOfToday - 7 * DAY_MS) return 'This Week';
  if (timestamp >= startOfToday - 30 * DAY_MS) return 'This Month';
  return 'Older';
}

/**
 * Group sessions into date buckets, in a stable display order.
 *
 * Only non-empty buckets are returned, so the UI renders no empty headings.
 */
export function groupSessionsByDate(
  sessions: Session[],
  now: number = Date.now()
): Record<string, Session[]> {
  const groups: Record<string, Session[]> = {};

  sessions.forEach((session) => {
    const label = sessionDateGroup(session.updated_at, now);
    if (!groups[label]) {
      groups[label] = [];
    }
    groups[label].push(session);
  });

  // Rebuilt in canonical order; object key order is what the caller iterates.
  const ordered: Record<string, Session[]> = {};
  for (const label of GROUP_ORDER) {
    if (groups[label]) ordered[label] = groups[label];
  }
  return ordered;
}

/**
 * Short "time since" label for a session row.
 *
 * Returns `Unknown` rather than letting an unusable timestamp reach
 * `new Date(...).toLocaleDateString()`, which rendered the literal string
 * `Invalid Date` for `undefined`/`NaN` and `1/1/1970` for `null` directly in
 * the session list.
 */
export function formatRelativeTime(timestamp: unknown, now: number = Date.now()): string {
  if (!isUsableTimestamp(timestamp)) return 'Unknown';

  const diff = now - timestamp;
  // Future timestamp (clock skew): "in -3m" would be nonsense.
  if (diff < 0) return 'Just now';

  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / DAY_MS);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
