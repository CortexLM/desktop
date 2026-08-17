/**
 * UsageTracking - Dashboard for monitoring AI usage and costs
 * Features: usage graphs by provider/model, cumulative costs, real-time statistics
 */

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import {
  TrendingUp,
  DollarSign,
  Zap,
  Clock,
  BarChart3,
  PieChart,
  Calendar,
  RefreshCw,
  Download,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

interface UsageStats {
  totalCost: number;
  totalTokens: number;
  totalSessions: number;
  avgResponseTime: number;
  byProvider: ProviderUsage[];
  byModel: ModelUsage[];
  timeline: TimelineEntry[];
}

interface ProviderUsage {
  provider: string;
  cost: number;
  tokens: number;
  percentage: number;
}

interface ModelUsage {
  model: string;
  provider: string;
  cost: number;
  tokens: number;
  sessions: number;
  percentage: number;
}

interface TimelineEntry {
  date: string;
  cost: number;
  tokens: number;
  sessions: number;
}

/**
 * A `usage_logs` aggregate row as SQLite actually returns it.
 *
 * `tokens_input`, `tokens_output` and `cost` are all nullable in the schema
 * (`INTEGER` / `REAL` with no NOT NULL), and `SUM()` over zero matching rows —
 * or over rows whose values are all NULL — returns **NULL**, not 0. Verified
 * against the real schema:
 *
 *   SUM(cost) with no rows        -> null
 *   SUM(cost) with all-NULL costs -> null
 *   GROUP BY provider             -> [{ provider: 'openai', cost: null, tokens: null }]
 *
 * The view previously typed these as non-null `number` and called
 * `row.cost.toFixed(2)` / `row.tokens.toLocaleString()` straight on them, which
 * threw `TypeError: Cannot read properties of null (reading 'toFixed')` and blanked
 * the whole dashboard. Modelling the nullability is what forces the coercion below.
 */
type NullableNumber = number | null | undefined;

/** Coerce a nullable SQL aggregate to a finite number. */
function toFiniteNumber(value: NullableNumber): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Fenêtre d'agrégation du sélecteur de période. */
type UsageTimeRange = 'day' | 'week' | 'month' | 'all';

export const UsageTracking: React.FC = () => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [timeRange, setTimeRange] = useState<UsageTimeRange>('week');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsageStats();
  }, [timeRange]);

  const loadUsageStats = async () => {
    setIsLoading(true);
    try {
      const now = Date.now();
      const rangeMs = getTimeRangeMs(timeRange);
      const startTime = timeRange === 'all' ? 0 : now - rangeMs;

      // Get total stats
      const totalResponse = await window.cortex.db.query<{
        total_cost: NullableNumber;
        total_tokens: NullableNumber;
        total_sessions: NullableNumber;
      }>({
        query: `
          SELECT 
            SUM(cost) as total_cost,
            SUM(tokens_input + tokens_output) as total_tokens,
            COUNT(DISTINCT session_id) as total_sessions
          FROM usage_logs
          WHERE created_at >= ?
        `,
        params: [startTime],
      });

      // Get usage by provider
      const providerResponse = await window.cortex.db.query<{
        provider: string | null;
        cost: NullableNumber;
        tokens: NullableNumber;
      }>({
        query: `
          SELECT 
            provider,
            SUM(cost) as cost,
            SUM(tokens_input + tokens_output) as tokens
          FROM usage_logs
          WHERE created_at >= ?
          GROUP BY provider
          ORDER BY cost DESC
        `,
        params: [startTime],
      });

      // Get usage by model
      const modelResponse = await window.cortex.db.query<{
        model: string | null;
        provider: string | null;
        cost: NullableNumber;
        tokens: NullableNumber;
        sessions: NullableNumber;
      }>({
        query: `
          SELECT 
            model,
            provider,
            SUM(cost) as cost,
            SUM(tokens_input + tokens_output) as tokens,
            COUNT(DISTINCT session_id) as sessions
          FROM usage_logs
          WHERE created_at >= ?
          GROUP BY model, provider
          ORDER BY cost DESC
        `,
        params: [startTime],
      });

      // Get timeline data
      const timelineResponse = await window.cortex.db.query<{
        date: string | null;
        cost: NullableNumber;
        tokens: NullableNumber;
        sessions: NullableNumber;
      }>({
        query: `
          SELECT 
            DATE(created_at / 1000, 'unixepoch') as date,
            SUM(cost) as cost,
            SUM(tokens_input + tokens_output) as tokens,
            COUNT(DISTINCT session_id) as sessions
          FROM usage_logs
          WHERE created_at >= ?
          GROUP BY date
          ORDER BY date ASC
        `,
        params: [startTime],
      });

      if (
        totalResponse.success &&
        totalResponse.data?.rows[0] &&
        providerResponse.success &&
        modelResponse.success &&
        timelineResponse.success
      ) {
        const total = totalResponse.data.rows[0];
        const totalCost = toFiniteNumber(total.total_cost);

        // Every numeric field is coerced at this boundary rather than at each
        // render site: the row shapes above are the only place the DB's
        // nullability is visible, so normalising here means the formatters
        // downstream (`toFixed`, `toLocaleString`) always receive a number.
        setStats({
          totalCost,
          totalTokens: toFiniteNumber(total.total_tokens),
          totalSessions: toFiniteNumber(total.total_sessions),
          avgResponseTime: 2500, // Mock data - would need to track this separately
          byProvider: providerResponse.data.rows.map((row) => {
            const cost = toFiniteNumber(row.cost);
            return {
              provider: row.provider ?? 'Unknown',
              cost,
              tokens: toFiniteNumber(row.tokens),
              percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
            };
          }),
          byModel: modelResponse.data.rows.map((row) => {
            const cost = toFiniteNumber(row.cost);
            return {
              model: row.model ?? 'Unknown',
              provider: row.provider ?? 'Unknown',
              cost,
              tokens: toFiniteNumber(row.tokens),
              sessions: toFiniteNumber(row.sessions),
              percentage: totalCost > 0 ? (cost / totalCost) * 100 : 0,
            };
          }),
          timeline: timelineResponse.data.rows.map((row) => ({
            date: row.date ?? 'Unknown',
            cost: toFiniteNumber(row.cost),
            tokens: toFiniteNumber(row.tokens),
            sessions: toFiniteNumber(row.sessions),
          })),
        });
      }
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    // Export usage data as CSV
    try {
      const csvData = generateCSV(stats);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `usage-report-${timeRange}-${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-text-secondary">Loading usage data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-page">
      {/* Header */}
      <div className="h-[40px] border-b border-border-soft flex items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-text">Usage & Billing</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as UsageTimeRange)}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Last 24h</SelectItem>
              <SelectItem value="week">Last Week</SelectItem>
              <SelectItem value="month">Last Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={loadUsageStats} className="gap-2">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={DollarSign}
            label="Total Cost"
            value={`$${(stats?.totalCost || 0).toFixed(2)}`}
            change="+12.5%"
            variant="primary"
          />
          <StatCard
            icon={Zap}
            label="Total Tokens"
            value={(stats?.totalTokens || 0).toLocaleString()}
            change="+8.3%"
            variant="success"
          />
          <StatCard
            icon={TrendingUp}
            label="Sessions"
            value={(stats?.totalSessions || 0).toString()}
            change="+15.2%"
            variant="warning"
          />
          <StatCard
            icon={Clock}
            label="Avg Response"
            value={`${((stats?.avgResponseTime || 0) / 1000).toFixed(1)}s`}
            change="-5.1%"
            variant="info"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Usage by Provider */}
          <div className="border border-border rounded-sm">
            <div className="px-4 py-3 border-b border-border-dark bg-elevated">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-text">Usage by Provider</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {stats?.byProvider.map((provider, index) => (
                <div key={provider.provider} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text font-medium">{provider.provider}</span>
                    <span className="text-text-secondary">
                      ${provider.cost.toFixed(2)} ({provider.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress
                    value={provider.percentage}
                    className={cn(
                      'h-2',
                      index === 0 && '[&>div]:bg-accent',
                      index === 1 && '[&>div]:bg-green',
                      index === 2 && '[&>div]:bg-orange'
                    )}
                  />
                  <p className="text-xs text-text-tertiary">
                    {provider.tokens.toLocaleString()} tokens
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Graph */}
          <div className="border border-border rounded-sm">
            <div className="px-4 py-3 border-b border-border-dark bg-elevated">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-text">Cost Timeline</h3>
              </div>
            </div>
            <div className="p-4">
              <SimpleLineChart data={stats?.timeline || []} />
            </div>
          </div>
        </div>

        {/* Model Usage Table */}
        <div className="border border-border rounded-sm">
          <div className="px-4 py-3 border-b border-border-dark bg-elevated">
            <h3 className="text-sm font-semibold text-text">Usage by Model</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border-dark">
                <tr className="text-xs font-medium text-text-secondary">
                  <th className="text-left px-4 py-2">Model</th>
                  <th className="text-left px-4 py-2">Provider</th>
                  <th className="text-right px-4 py-2">Cost</th>
                  <th className="text-right px-4 py-2">Tokens</th>
                  <th className="text-right px-4 py-2">Sessions</th>
                  <th className="text-right px-4 py-2">Share</th>
                </tr>
              </thead>
              <tbody>
                {stats?.byModel.map((model) => (
                  <tr
                    key={`${model.model}-${model.provider}`}
                    className={cn(
                      'border-b border-border-dark last:border-0',
                      'hover:bg-tint transition-colors'
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm text-text font-mono">{model.model}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {model.provider}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-text font-semibold">
                        ${model.cost.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-text-secondary">
                        {model.tokens.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-text-secondary">{model.sessions}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-text-secondary">
                        {model.percentage.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  change: string;
  variant: 'primary' | 'success' | 'warning' | 'info';
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, change, variant }) => {
  const isPositive = change.startsWith('+');
  
  return (
    <div className="border border-border rounded-sm p-4 bg-elevated">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <Icon
          className={cn(
            'w-4 h-4',
            variant === 'primary' && 'text-accent',
            variant === 'success' && 'text-green',
            variant === 'warning' && 'text-orange',
            variant === 'info' && 'text-text-secondary'
          )}
        />
      </div>
      <p className="text-2xl font-semibold text-text mb-1">{value}</p>
      <p
        className={cn(
          'text-xs font-medium',
          isPositive ? 'text-green' : 'text-red'
        )}
      >
        {change} vs last period
      </p>
    </div>
  );
};

// Simple Line Chart Component
interface SimpleLineChartProps {
  data: TimelineEntry[];
}

const SimpleLineChart: React.FC<SimpleLineChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-sm text-text-secondary">No data available</p>
      </div>
    );
  }

  const maxCost = Math.max(...data.map((d) => d.cost));
  const chartHeight = 120;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between h-[120px] gap-1">
        {data.map((entry, index) => {
          const height = maxCost > 0 ? (entry.cost / maxCost) * chartHeight : 0;
          return (
            <div
              key={index}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-accent rounded-t-sm transition-all hover:opacity-80"
                style={{ height: `${height}px` }}
                title={`$${entry.cost.toFixed(2)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-text-tertiary">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
};

// Helpers
export function getTimeRangeMs(range: UsageTimeRange): number {
  const dayMs = 24 * 60 * 60 * 1000;
  switch (range) {
    case 'day':
      return dayMs;
    case 'week':
      return 7 * dayMs;
    case 'month':
      return 30 * dayMs;
    case 'all':
      return Number.MAX_SAFE_INTEGER;
  }
}

export function generateCSV(stats: UsageStats | null): string {
  if (!stats) return '';

  const lines: string[] = [
    'Model,Provider,Cost,Tokens,Sessions',
    ...stats.byModel.map(
      (m) => `${m.model},${m.provider},${m.cost},${m.tokens},${m.sessions}`
    ),
  ];

  return lines.join('\n');
}
