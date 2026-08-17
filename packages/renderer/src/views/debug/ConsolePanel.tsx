/**
 * Console Panel - Display all logs from main and renderer
 */

import * as React from 'react';
import type { LogEntry, LogLevel } from '@cortex-ide/shared/types/debug';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { FiTrash2, FiSearch } from 'react-icons/fi';

export function ConsolePanel() {
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [filter, setFilter] = React.useState({
    level: 'all',
    category: '',
    source: 'all',
    search: ''
  });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = React.useState(true);

  // Load initial logs
  React.useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto scroll
  React.useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const loadLogs = async () => {
    try {
      const result = await window.electron.invoke<LogEntry[]>('debug:get-logs', 1000);
      setLogs(result);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const handleClear = async () => {
    try {
      await window.electron.invoke('debug:clear-logs');
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      if (filter.level !== 'all' && log.level !== filter.level) return false;
      if (filter.source !== 'all' && log.source !== filter.source) return false;
      if (filter.category && !log.category.includes(filter.category)) return false;
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        return (
          log.message.toLowerCase().includes(searchLower) ||
          log.category.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [logs, filter]);

  const getLevelColor = (level: LogLevel): string => {
    switch (level) {
      case 'debug': return 'text-gray-400';
      case 'info': return 'text-blue-400';
      case 'warn': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-text';
    }
  };

  const getLevelBg = (level: LogLevel): string => {
    switch (level) {
      case 'debug': return 'bg-gray-500/10';
      case 'info': return 'bg-blue-500/10';
      case 'warn': return 'bg-yellow-500/10';
      case 'error': return 'bg-red-500/10';
      default: return 'bg-surface';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 border-b border-border flex items-center gap-2 px-3 bg-background">
        <div className="flex items-center gap-2 flex-1">
          <FiSearch className="w-4 h-4 text-text-secondary" />
          <Input
            placeholder="Search logs..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="h-8 w-64"
          />
        </div>
        
        <select
          value={filter.level}
          onChange={(e) => setFilter({ ...filter, level: e.target.value })}
          className="h-8 px-2 text-sm bg-surface border border-border rounded-sm"
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>

        <select
          value={filter.source}
          onChange={(e) => setFilter({ ...filter, source: e.target.value })}
          className="h-8 px-2 text-sm bg-surface border border-border rounded-sm"
        >
          <option value="all">All Sources</option>
          <option value="main">Main</option>
          <option value="renderer">Renderer</option>
        </select>

        <Button variant="ghost" size="sm" onClick={handleClear} className="h-8">
          <FiTrash2 className="w-4 h-4" />
        </Button>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-4 h-4"
          />
          Auto-scroll
        </label>
      </div>

      {/* Logs */}
      <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-xs">
        {filteredLogs.map((log) => (
          <div
            key={log.id}
            className={`px-3 py-1 border-b border-border/50 hover:bg-surface/50 ${getLevelBg(log.level)}`}
          >
            <div className="flex items-start gap-2">
              <span className="text-text-secondary whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`font-semibold uppercase whitespace-nowrap ${getLevelColor(log.level)}`}>
                {log.level}
              </span>
              <span className="text-accent whitespace-nowrap">
                [{log.category}]
              </span>
              <span className="text-text-secondary text-[10px] whitespace-nowrap">
                {log.source}
              </span>
              <span className="flex-1 text-text break-all">
                {log.message}
              </span>
            </div>
            {log.data !== undefined && log.data !== null && (
              <div className="mt-1 ml-32 text-text-secondary whitespace-pre-wrap">
                {/* JSON.stringify returns `string | undefined` (undefined for
                    values like functions), which is not a valid ReactNode. */}
                {JSON.stringify(log.data, null, 2) ?? String(log.data)}
              </div>
            )}
            {log.stack && (
              <div className="mt-1 ml-32 text-red-400 text-[10px] whitespace-pre-wrap">
                {log.stack}
              </div>
            )}
          </div>
        ))}
        {filteredLogs.length === 0 && (
          <div className="flex items-center justify-center h-full text-text-secondary">
            No logs to display
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="h-8 border-t border-border flex items-center justify-between px-3 text-xs text-text-secondary bg-background">
        <span>{filteredLogs.length} logs</span>
        <span>{logs.length} total</span>
      </div>
    </div>
  );
}
