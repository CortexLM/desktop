/**
 * IPC Monitor - Monitor IPC messages for debugging
 */

import { logger } from '@cortex-ide/shared/logger';

interface IPCMessage {
  channel: string;
  timestamp: number;
  duration?: number;
  direction: 'send' | 'receive';
}

class IPCMonitor {
  private messages: IPCMessage[] = [];
  private maxMessages = 1000;
  private channelStats: Map<string, { count: number; totalDuration: number }> = new Map();

  /**
   * Resets the monitor to an empty state.
   *
   * Called during app startup. This method previously didn't exist, so that
   * call threw a TypeError inside `app.whenReady()` and aborted the rest of
   * startup - including `createWindow()`, so the app opened no window at all.
   */
  initialize(): void {
    this.messages = [];
    this.channelStats.clear();
    logger.info('ipc-monitor', 'IPC monitor initialized');
  }

  recordMessage(channel: string, direction: 'send' | 'receive', duration?: number): void {
    this.messages.push({
      channel,
      timestamp: Date.now(),
      duration,
      direction
    });

    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    const stats = this.channelStats.get(channel) || { count: 0, totalDuration: 0 };
    stats.count++;
    if (duration) stats.totalDuration += duration;
    this.channelStats.set(channel, stats);
  }

  getMessages(limit?: number): IPCMessage[] {
    return limit ? this.messages.slice(-limit) : [...this.messages];
  }

  getChannelStats() {
    const stats: Record<string, any> = {};
    for (const [channel, data] of this.channelStats.entries()) {
      stats[channel] = {
        count: data.count,
        avgDuration: data.totalDuration / data.count
      };
    }
    return stats;
  }

  clear(): void {
    this.messages = [];
    this.channelStats.clear();
    logger.info('ipc-monitor', 'IPC messages cleared');
  }
}

export const ipcMonitor = new IPCMonitor();
