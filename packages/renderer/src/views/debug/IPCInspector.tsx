/**
 * IPC Inspector - Monitor all IPC messages in real-time
 */

import * as React from 'react';
import type { IPCMessage } from '@cortex-ide/shared/types/debug';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { FiTrash2, FiSearch, FiChevronDown, FiChevronRight } from 'react-icons/fi';

export function IPCInspector() {
  const [messages, setMessages] = React.useState<IPCMessage[]>([]);
  const [stats, setStats] = React.useState<Record<string, { count: number; avgDuration: number }>>({});
  const [filter, setFilter] = React.useState({
    channel: '',
    direction: 'all'
  });
  const [expandedMessages, setExpandedMessages] = React.useState<Set<string>>(new Set());
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    loadMessages();
    loadStats();
    const interval = setInterval(() => {
      loadMessages();
      loadStats();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadMessages = async () => {
    try {
      const result = await window.electron.invoke<IPCMessage[]>('debug:get-ipc-messages', 500);
      setMessages(result);
    } catch (error) {
      console.error('Failed to load IPC messages:', error);
    }
  };

  const loadStats = async () => {
    try {
      const result = await window.electron.invoke<Record<string, { count: number; avgDuration: number }>>(
        'debug:get-ipc-stats'
      );
      setStats(result);
    } catch (error) {
      console.error('Failed to load IPC stats:', error);
    }
  };

  const handleClear = async () => {
    try {
      await window.electron.invoke('debug:clear-ipc');
      setMessages([]);
      setStats({});
    } catch (error) {
      console.error('Failed to clear IPC messages:', error);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMessages(newExpanded);
  };

  const filteredMessages = React.useMemo(() => {
    return messages.filter(msg => {
      if (filter.channel && !msg.channel.includes(filter.channel)) return false;
      if (filter.direction !== 'all' && msg.direction !== filter.direction) return false;
      return true;
    });
  }, [messages, filter]);

  return (
    <div className="h-full flex">
      {/* Messages List */}
      <div className="flex-1 flex flex-col border-r border-border">
        {/* Toolbar */}
        <div className="h-12 border-b border-border flex items-center gap-2 px-3 bg-background">
          <FiSearch className="w-4 h-4 text-text-secondary" />
          <Input
            placeholder="Filter by channel..."
            value={filter.channel}
            onChange={(e) => setFilter({ ...filter, channel: e.target.value })}
            className="h-8 flex-1"
          />
          
          <select
            value={filter.direction}
            onChange={(e) => setFilter({ ...filter, direction: e.target.value })}
            className="h-8 px-2 text-sm bg-surface border border-border rounded-sm"
          >
            <option value="all">All Directions</option>
            <option value="renderer->main">Renderer → Main</option>
            <option value="main->renderer">Main → Renderer</option>
          </select>

          <Button variant="ghost" size="sm" onClick={handleClear} className="h-8">
            <FiTrash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-xs">
          {filteredMessages.map((msg) => {
            const isExpanded = expandedMessages.has(msg.id);
            return (
              <div
                key={msg.id}
                className="border-b border-border/50 hover:bg-surface/50"
              >
                <div
                  className="px-3 py-2 cursor-pointer flex items-start gap-2"
                  onClick={() => toggleExpand(msg.id)}
                >
                  {isExpanded ? (
                    <FiChevronDown className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <FiChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  )}
                  <span className="text-text-secondary whitespace-nowrap">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`font-semibold whitespace-nowrap ${
                    msg.direction === 'renderer->main' ? 'text-blue-400' : 'text-green-400'
                  }`}>
                    {msg.direction === 'renderer->main' ? '→' : '←'}
                  </span>
                  <span className="flex-1 text-accent truncate">
                    {msg.channel}
                  </span>
                  {msg.duration !== undefined && (
                    <span className="text-text-secondary whitespace-nowrap">
                      {msg.duration.toFixed(1)}ms
                    </span>
                  )}
                </div>
                {isExpanded && (
                  <div className="px-3 pb-2 pl-11 text-text-secondary">
                    <pre className="text-[10px] whitespace-pre-wrap">
                      {JSON.stringify(msg.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
          {filteredMessages.length === 0 && (
            <div className="flex items-center justify-center h-full text-text-secondary">
              No IPC messages
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-8 border-t border-border flex items-center justify-between px-3 text-xs text-text-secondary bg-background">
          <span>{filteredMessages.length} messages</span>
        </div>
      </div>

      {/* Stats Sidebar */}
      <div className="w-80 flex flex-col bg-surface">
        <div className="h-12 border-b border-border flex items-center px-3 bg-background">
          <span className="text-sm font-medium">Channel Statistics</span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr>
                <th className="text-left p-2 font-medium">Channel</th>
                <th className="text-right p-2 font-medium">Count</th>
                <th className="text-right p-2 font-medium">Avg (ms)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([channel, data]) => (
                  <tr key={channel} className="border-b border-border/50 hover:bg-background/50">
                    <td className="p-2 truncate font-mono" title={channel}>
                      {channel}
                    </td>
                    <td className="p-2 text-right text-accent">{data.count}</td>
                    <td className="p-2 text-right text-text-secondary">
                      {data.avgDuration.toFixed(1)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
