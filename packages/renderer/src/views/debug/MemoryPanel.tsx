/**
 * Memory Panel - Real-time memory usage visualization
 */

import * as React from 'react';
import type { MemorySnapshot } from '@cortex-ide/shared/types/debug';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '../../components/ui/button';
import { FiTrash2 } from 'react-icons/fi';

/** Réponse du canal `debug:get-system-info`. */
interface SystemInfo {
  platform: string;
  arch: string;
  electron: string;
  chrome: string;
  node: string;
  v8: string;
}

export function MemoryPanel() {
  const [snapshots, setSnapshots] = React.useState<MemorySnapshot[]>([]);
  const [systemInfo, setSystemInfo] = React.useState<SystemInfo | null>(null);

  React.useEffect(() => {
    loadSnapshots();
    loadSystemInfo();
    const interval = setInterval(loadSnapshots, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadSnapshots = async () => {
    try {
      const result = await window.electron.invoke<MemorySnapshot[]>('debug:get-memory', 100);
      setSnapshots(result);
    } catch (error) {
      console.error('Failed to load memory snapshots:', error);
    }
  };

  const loadSystemInfo = async () => {
    try {
      // `invoke` returns `unknown`; this channel answers with SystemInfo.
      const result = (await window.electron.invoke('debug:get-system-info')) as SystemInfo;
      setSystemInfo(result);
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  };

  const handleClear = async () => {
    try {
      await window.electron.invoke('debug:clear-metrics');
      setSnapshots([]);
    } catch (error) {
      console.error('Failed to clear memory data:', error);
    }
  };

  // Prepare chart data
  const chartData = React.useMemo(() => {
    return snapshots.map((snapshot, i) => ({
      index: i,
      heapUsed: snapshot.heapUsed / 1024 / 1024,
      heapTotal: snapshot.heapTotal / 1024 / 1024,
      external: snapshot.external / 1024 / 1024,
      rss: snapshot.rss / 1024 / 1024
    }));
  }, [snapshots]);

  // Latest snapshot
  const latest = snapshots[snapshots.length - 1];

  const formatBytes = (bytes: number): string => {
    const mb = bytes / 1024 / 1024;
    return mb >= 1000 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-border flex items-center gap-2 px-3 bg-background">
        <span className="text-sm font-medium">Memory Usage</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={handleClear} className="h-8">
          <FiTrash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 flex">
        {/* Chart */}
        <div className="flex-1 p-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="index" stroke="#666" />
                <YAxis stroke="#666" label={{ value: 'MB', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '4px'
                  }}
                  // Recharts widens the value to `ValueType | undefined`, so it
                  // is narrowed here rather than assuming a number.
                  formatter={(value) =>
                    typeof value === 'number' ? `${value.toFixed(2)} MB` : String(value ?? '')
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="heapUsed"
                  stroke="#3b82f6"
                  name="Heap Used"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="heapTotal"
                  stroke="#10b981"
                  name="Heap Total"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="external"
                  stroke="#f59e0b"
                  name="External"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="rss"
                  stroke="#ef4444"
                  name="RSS"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              No memory data
            </div>
          )}
        </div>

        {/* Stats Sidebar */}
        <div className="w-80 border-l border-border bg-surface overflow-auto">
          <div className="sticky top-0 h-12 border-b border-border flex items-center px-3 bg-background">
            <span className="text-sm font-medium">Current Memory</span>
          </div>
          
          {latest && (
            <div className="p-3 space-y-3">
              <div className="p-3 bg-background rounded border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium">Heap Used</span>
                </div>
                <div className="text-2xl font-bold text-accent">
                  {formatBytes(latest.heapUsed)}
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  {((latest.heapUsed / latest.heapTotal) * 100).toFixed(1)}% of heap
                </div>
              </div>

              <div className="p-3 bg-background rounded border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Heap Total</span>
                </div>
                <div className="text-2xl font-bold text-text">
                  {formatBytes(latest.heapTotal)}
                </div>
              </div>

              <div className="p-3 bg-background rounded border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm font-medium">External</span>
                </div>
                <div className="text-2xl font-bold text-text">
                  {formatBytes(latest.external)}
                </div>
              </div>

              <div className="p-3 bg-background rounded border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm font-medium">RSS</span>
                </div>
                <div className="text-2xl font-bold text-text">
                  {formatBytes(latest.rss)}
                </div>
                <div className="text-xs text-text-secondary mt-1">
                  Resident Set Size
                </div>
              </div>
            </div>
          )}

          {systemInfo && (
            <>
              <div className="h-12 border-t border-b border-border flex items-center px-3 bg-background">
                <span className="text-sm font-medium">System Info</span>
              </div>
              <div className="p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Platform:</span>
                  <span className="text-text">{systemInfo.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Arch:</span>
                  <span className="text-text">{systemInfo.arch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Electron:</span>
                  <span className="text-text">{systemInfo.electron}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Chrome:</span>
                  <span className="text-text">{systemInfo.chrome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Node:</span>
                  <span className="text-text">{systemInfo.node}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">V8:</span>
                  <span className="text-text">{systemInfo.v8}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
