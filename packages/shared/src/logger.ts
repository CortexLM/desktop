// Structured logging infrastructure
import type { LogLevel, LogEntry } from './types/debug';

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 10000; // Keep last 10k logs in memory
  private listeners: Set<(log: LogEntry) => void> = new Set();

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Subscribe to log events
   */
  onLog(callback: (log: LogEntry) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Log a message
   */
  log(
    level: LogLevel,
    category: string,
    message: string,
    data?: unknown,
    stack?: string
  ): void {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack,
      source: typeof globalThis !== 'undefined' && 'window' in globalThis ? 'renderer' : 'main'
    };

    // Add to in-memory buffer
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Notify listeners
    this.listeners.forEach(listener => listener(entry));

    // Console output in dev mode
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      const prefix = `[${level.toUpperCase()}] [${category}]`;
      const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[method](prefix, message, data || '');
      if (stack) {
        console[method](stack);
      }
    }
  }

  debug(category: string, message: string, data?: unknown): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: unknown): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: unknown): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, error?: unknown): void {
    // Callers throw all sorts of things, so the stack is read only when the
    // argument really is an Error; otherwise a fresh one supplies the call site.
    const stack = error instanceof Error ? error.stack : new Error().stack;
    this.log('error', category, message, error, stack);
  }

  /**
   * Get recent logs
   */
  getLogs(limit?: number): LogEntry[] {
    return limit ? this.logs.slice(-limit) : [...this.logs];
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Filter logs by criteria
   */
  filter(criteria: {
    level?: LogLevel;
    category?: string;
    source?: 'main' | 'renderer';
    since?: number;
  }): LogEntry[] {
    return this.logs.filter(log => {
      if (criteria.level && log.level !== criteria.level) return false;
      if (criteria.category && log.category !== criteria.category) return false;
      if (criteria.source && log.source !== criteria.source) return false;
      if (criteria.since && log.timestamp < criteria.since) return false;
      return true;
    });
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
