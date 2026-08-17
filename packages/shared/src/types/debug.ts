// Debug and logging types

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  /** Contexte libre fourni par l'appelant ; à narrower côté consommateur. */
  data?: unknown;
  stack?: string;
  source: 'main' | 'renderer';
}

export interface IPCMessage {
  id: string;
  timestamp: number;
  channel: string;
  direction: 'main->renderer' | 'renderer->main';
  /** Payload du canal : la forme dépend du canal, à narrower à l'usage. */
  data: unknown;
  duration?: number;
}

export interface PerformanceMetric {
  id: string;
  timestamp: number;
  category: string;
  name: string;
  value: number;
  unit: string;
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface NetworkRequest {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  error?: string;
}

export interface DebugSettings {
  enabled: boolean;
  logLevel: LogLevel;
  categories: {
    ipc: boolean;
    performance: boolean;
    network: boolean;
    database: boolean;
    ai: boolean;
    git: boolean;
  };
  maxLogSize: number; // in MB
  logRotation: boolean;
}

export interface ErrorReport {
  id: string;
  timestamp: number;
  message: string;
  stack: string;
  componentStack?: string;
  source: 'main' | 'renderer';
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
