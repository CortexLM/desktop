/**
 * AgentDetail - Detailed view of agent session with metrics and configuration
 * Shows: tokens, cost, duration, configuration, history timeline
 */

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import {
  Activity,
  Clock,
  DollarSign,
  Settings,
  History,
  Zap,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../../components/ui/accordion';

interface AgentMetrics {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  duration: number;
  messageCount: number;
}

interface AgentConfig {
  model: string;
  provider: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

interface HistoryEntry {
  id: string;
  /**
   * Nullable on purpose: this is `messages.created_at` as the query returned it,
   * and `formatTimestamp` is responsible for rendering an unusable value. Typing
   * it as a plain `number` is what let `new Date(undefined)` reach the DOM.
   */
  timestamp: number | null | undefined;
  type: 'message' | 'tool_call' | 'error';
  content: string;
  tokens?: number;
  cost?: number;
}

/** Nullable SQL aggregate — see `toFiniteNumber`. */
type NullableNumber = number | null | undefined;

/**
 * Coerce a nullable/NaN SQL aggregate to a finite number.
 *
 * `usage_logs.tokens_input`, `tokens_output` and `cost` are all nullable, and
 * `SUM()` over zero rows returns NULL rather than 0.
 */
export function toFiniteNumber(value: NullableNumber): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Elapsed time between the first and last message of a session.
 *
 * `MIN(created_at)` / `MAX(created_at)` are both NULL when a session has no
 * messages, and `null - null` is `0`, but a *partial* row (one bound present,
 * the other missing) yields either `NaN` or — for `null - 100` — a **negative**
 * duration, which `formatDuration` rendered as `-1s`. Both bounds must be usable
 * and ordered for the difference to mean anything; otherwise the duration is 0.
 */
export function deriveDuration(maxTime: NullableNumber, minTime: NullableNumber): number {
  // Both bounds must be present. Coercing a missing bound to 0 first would be
  // worse than NaN: `max=1_700_000_000_000, min=undefined` becomes a 53-year
  // duration, which formats as a plausible-looking "473958h 20m" rather than
  // anything obviously wrong.
  const bothUsable =
    typeof maxTime === 'number' &&
    Number.isFinite(maxTime) &&
    typeof minTime === 'number' &&
    Number.isFinite(minTime);
  if (!bothUsable) return 0;

  const duration = maxTime - minTime;
  return duration > 0 ? duration : 0;
}

/**
 * Token count recorded on a message's metadata JSON.
 *
 * `metadata.tokens?.input + metadata.tokens?.output` is `NaN` as soon as either
 * side is absent, and the badge is rendered under `{entry.tokens && ...}` — so a
 * message recording only `input` had its token count silently dropped from the
 * timeline instead of showing the half that was known.
 */
export function deriveEntryTokens(tokens: unknown): number | undefined {
  if (typeof tokens !== 'object' || tokens === null) return undefined;
  const { input, output } = tokens as { input?: unknown; output?: unknown };
  const total = toFiniteNumber(input as NullableNumber) + toFiniteNumber(output as NullableNumber);
  return total > 0 ? total : undefined;
}

/**
 * Parse a `metadata` TEXT column, treating unparseable JSON as absent metadata.
 *
 * `metadata` is a free-form JSON string with no CHECK constraint, so a single
 * malformed row is possible. A bare `JSON.parse` throws inside the one shared
 * `try` in `loadAgentData`, which abandoned the *entire* load — config, metrics
 * and timeline all blanked because one message had bad metadata.
 */
export function parseMetadata(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    // Arrays are excluded as well as null: `['a']['provider']` is `undefined`
    // rather than an error, so an array would be accepted as "metadata" and
    // every field read from it would silently be missing.
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Absolute timestamp for a timeline row.
 *
 * `new Date(undefined).toLocaleString()` renders the literal string
 * `Invalid Date` in the timeline header.
 */
export function formatTimestamp(timestamp: unknown): string {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return 'Unknown date';
  return new Date(timestamp).toLocaleString();
}

interface AgentDetailProps {
  sessionId: string;
  onBack?: () => void;
}

export const AgentDetail: React.FC<AgentDetailProps> = ({ sessionId, onBack }) => {
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAgentData();
  }, [sessionId]);

  const loadAgentData = async () => {
    setIsLoading(true);
    try {
      // Load session config
      const sessionResponse = await window.cortex.db.query<{
        id: string;
        model: string | null;
        metadata: string | null;
      }>({
        query: 'SELECT * FROM sessions WHERE id = ?',
        params: [sessionId],
      });

      if (sessionResponse.success && sessionResponse.data?.rows[0]) {
        const session = sessionResponse.data.rows[0];
        const metadata = parseMetadata(session.metadata);

        setConfig({
          model: session.model || 'Unknown',
          provider: (metadata.provider as string) || 'Unknown',
          temperature: metadata.temperature as number | undefined,
          maxTokens: metadata.maxTokens as number | undefined,
          systemPrompt: metadata.systemPrompt as string | undefined,
        });
      }

      // Load usage metrics
      const usageResponse = await window.cortex.db.query<{
        tokens_input: NullableNumber;
        tokens_output: NullableNumber;
        cost: NullableNumber;
      }>({
        query: `
          SELECT 
            SUM(tokens_input) as tokens_input,
            SUM(tokens_output) as tokens_output,
            SUM(cost) as cost
          FROM usage_logs
          WHERE session_id = ?
        `,
        params: [sessionId],
      });

      // Load message count and duration
      const messagesResponse = await window.cortex.db.query<{
        count: NullableNumber;
        min_time: NullableNumber;
        max_time: NullableNumber;
      }>({
        query: `
          SELECT 
            COUNT(*) as count,
            MIN(created_at) as min_time,
            MAX(created_at) as max_time
          FROM messages
          WHERE session_id = ?
        `,
        params: [sessionId],
      });

      if (
        usageResponse.success &&
        usageResponse.data?.rows[0] &&
        messagesResponse.success &&
        messagesResponse.data?.rows[0]
      ) {
        const usage = usageResponse.data.rows[0];
        const messages = messagesResponse.data.rows[0];

        const inputTokens = toFiniteNumber(usage.tokens_input);
        const outputTokens = toFiniteNumber(usage.tokens_output);

        setMetrics({
          totalTokens: inputTokens + outputTokens,
          inputTokens,
          outputTokens,
          totalCost: toFiniteNumber(usage.cost),
          duration: deriveDuration(messages.max_time, messages.min_time),
          messageCount: toFiniteNumber(messages.count),
        });
      }

      // Load history
      const historyResponse = await window.cortex.db.query<{
        id: string;
        role: string;
        content: string | null;
        created_at: NullableNumber;
        metadata: string | null;
      }>({
        query: 'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 50',
        params: [sessionId],
      });

      if (historyResponse.success && historyResponse.data) {
        setHistory(
          historyResponse.data.rows.map((row) => {
            const metadata = parseMetadata(row.metadata);
            return {
              id: row.id,
              timestamp: row.created_at,
              type: metadata.toolCalls ? 'tool_call' : 'message',
              content: (row.content ?? '').slice(0, 100),
              tokens: deriveEntryTokens(metadata.tokens),
              cost: typeof metadata.cost === 'number' ? metadata.cost : undefined,
            };
          })
        );
      }
    } catch (error) {
      console.error('Failed to load agent data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-secondary">Loading agent details...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-page">
      {/* Header */}
      <div className="h-[40px] border-b border-border-soft flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-7 w-7">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <h2 className="text-sm font-semibold text-text">Agent Details</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={loadAgentData} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Metrics Cards */}
        <div className="grid grid-cols-3 gap-4">
          <MetricCard
            icon={Activity}
            label="Total Tokens"
            value={metrics?.totalTokens.toLocaleString() || '0'}
            subtext={`${metrics?.inputTokens.toLocaleString() || 0} in / ${metrics?.outputTokens.toLocaleString() || 0} out`}
          />
          <MetricCard
            icon={DollarSign}
            label="Total Cost"
            value={`$${(metrics?.totalCost || 0).toFixed(4)}`}
            variant="success"
          />
          <MetricCard
            icon={Clock}
            label="Duration"
            value={formatDuration(metrics?.duration || 0)}
            subtext={`${metrics?.messageCount || 0} messages`}
          />
        </div>

        {/* Configuration */}
        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border-dark bg-elevated">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-text">Configuration</h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <ConfigRow label="Model" value={config?.model || 'N/A'} />
            <ConfigRow label="Provider" value={config?.provider || 'N/A'} />
            {config?.temperature !== undefined && (
              <ConfigRow label="Temperature" value={config.temperature.toString()}>
                <Progress value={config.temperature * 100} className="h-1.5" />
              </ConfigRow>
            )}
            {config?.maxTokens !== undefined && (
              <ConfigRow label="Max Tokens" value={config.maxTokens.toLocaleString()} />
            )}
            {config?.systemPrompt && (
              <div className="pt-2 border-t border-border-dark">
                <p className="text-xs font-medium text-text-secondary mb-2">System Prompt</p>
                <div className="px-3 py-2 bg-wash rounded-sm">
                  <p className="text-xs text-text font-mono">{config.systemPrompt}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* History Timeline */}
        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border-dark bg-elevated">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-text">History Timeline</h3>
            </div>
          </div>
          <div className="p-4">
            <Accordion type="single" collapsible className="space-y-2">
              {history.map((entry) => (
                <AccordionItem
                  key={entry.id}
                  value={entry.id}
                  className="border border-border-dark rounded-sm"
                >
                  <AccordionTrigger className="px-3 py-2 hover:bg-tint">
                    <div className="flex items-center justify-between w-full mr-2">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            entry.type === 'error'
                              ? 'destructive'
                              : entry.type === 'tool_call'
                              ? 'warning'
                              : 'secondary'
                          }
                          className="text-xs"
                        >
                          {entry.type}
                        </Badge>
                        <span className="text-xs text-text-secondary">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>
                      {entry.tokens && (
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <Zap className="w-3 h-3" />
                          {entry.tokens.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 py-2 bg-wash">
                    <p className="text-xs text-text font-mono">{entry.content}...</p>
                    {entry.cost && (
                      <p className="text-xs text-text-secondary mt-2">
                        Cost: ${entry.cost.toFixed(6)}
                      </p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric Card Component
interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  variant?: 'default' | 'success' | 'warning';
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon: Icon,
  label,
  value,
  subtext,
  variant = 'default',
}) => {
  return (
    <div className="border border-border rounded-sm p-4 bg-elevated">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <Icon
          className={cn(
            'w-4 h-4',
            variant === 'success' && 'text-green',
            variant === 'warning' && 'text-orange',
            variant === 'default' && 'text-accent'
          )}
        />
      </div>
      <p className="text-2xl font-semibold text-text">{value}</p>
      {subtext && <p className="text-xs text-text-tertiary mt-1">{subtext}</p>}
    </div>
  );
};

// Config Row Component
interface ConfigRowProps {
  label: string;
  value: string;
  children?: React.ReactNode;
}

const ConfigRow: React.FC<ConfigRowProps> = ({ label, value, children }) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <p className="text-xs text-text font-mono">{value}</p>
      </div>
      {children}
    </div>
  );
};

// Helper: Format duration
export function formatDuration(ms: number): string {
  // Coerced here as well as in `deriveDuration`: this is the last point before
  // the string reaches the DOM, and `Math.floor(NaN)` is NaN, so an unguarded
  // NaN would render as the literal text "NaNs".
  const total = toFiniteNumber(ms);
  const seconds = Math.floor(total / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
