/**
 * Performance Profiler - Mesure et analyse les performances de l'application
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface PerformanceMetric {
  name: string;
  category: 'ipc' | 'database' | 'render' | 'memory' | 'cpu' | 'startup' | 'custom';
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

export interface PerformanceReport {
  timestamp: number;
  uptime: number;
  metrics: PerformanceMetric[];
  memorySnapshots: MemorySnapshot[];
  summary: {
    avgIpcLatency: number;
    avgDatabaseQuery: number;
    avgRenderTime: number;
    peakMemory: number;
    totalMetrics: number;
  };
}

class PerformanceProfiler extends EventEmitter {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private completedMetrics: PerformanceMetric[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private memorySnapshotInterval: NodeJS.Timeout | null = null;
  private maxMetricsHistory = 10000;
  private maxMemorySnapshots = 1000;
  private enabled = process.env.NODE_ENV === 'development';

  constructor() {
    super();
  }

  /**
   * Enable/disable profiler
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      this.startMemoryMonitoring();
    } else {
      this.stopMemoryMonitoring();
    }
  }

  /**
   * Start a performance measurement
   */
  start(name: string, category: PerformanceMetric['category'], metadata?: Record<string, any>): string {
    if (!this.enabled) return name;

    const metric: PerformanceMetric = {
      name,
      category,
      startTime: performance.now(),
      metadata
    };

    this.metrics.set(name, metric);
    return name;
  }

  /**
   * End a performance measurement
   */
  end(name: string, metadata?: Record<string, any>): number | null {
    if (!this.enabled) return null;

    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`[Profiler] Metric "${name}" not found`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    if (metadata) {
      metric.metadata = { ...metric.metadata, ...metadata };
    }

    this.metrics.delete(name);
    this.completedMetrics.push(metric);

    // Limit history
    if (this.completedMetrics.length > this.maxMetricsHistory) {
      this.completedMetrics.shift();
    }

    this.emit('metric:completed', metric);
    
    // Warn sur les métriques lentes
    if (metric.duration > 100) {
      this.emit('metric:slow', metric);
    }

    return metric.duration;
  }

  /**
   * Measure a function execution
   */
  async measure<T>(
    name: string,
    category: PerformanceMetric['category'],
    fn: () => T | Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    this.start(name, category, metadata);
    try {
      const result = await fn();
      this.end(name);
      return result;
    } catch (error) {
      this.end(name, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): MemorySnapshot {
    const mem = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss
    };

    this.memorySnapshots.push(snapshot);

    // Limit snapshots
    if (this.memorySnapshots.length > this.maxMemorySnapshots) {
      this.memorySnapshots.shift();
    }

    this.emit('memory:snapshot', snapshot);
    return snapshot;
  }

  /**
   * Start automatic memory monitoring
   */
  startMemoryMonitoring(intervalMs = 10000) {
    if (this.memorySnapshotInterval) return;

    this.memorySnapshotInterval = setInterval(() => {
      this.takeMemorySnapshot();
    }, intervalMs);
  }

  /**
   * Stop automatic memory monitoring
   */
  stopMemoryMonitoring() {
    if (this.memorySnapshotInterval) {
      clearInterval(this.memorySnapshotInterval);
      this.memorySnapshotInterval = null;
    }
  }

  /**
   * Get performance report
   */
  getReport(): PerformanceReport {
    const ipcMetrics = this.completedMetrics.filter(m => m.category === 'ipc');
    const dbMetrics = this.completedMetrics.filter(m => m.category === 'database');
    const renderMetrics = this.completedMetrics.filter(m => m.category === 'render');

    const avgIpcLatency = ipcMetrics.length > 0
      ? ipcMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / ipcMetrics.length
      : 0;

    const avgDatabaseQuery = dbMetrics.length > 0
      ? dbMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / dbMetrics.length
      : 0;

    const avgRenderTime = renderMetrics.length > 0
      ? renderMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / renderMetrics.length
      : 0;

    const peakMemory = this.memorySnapshots.length > 0
      ? Math.max(...this.memorySnapshots.map(s => s.heapUsed))
      : 0;

    return {
      timestamp: Date.now(),
      uptime: process.uptime(),
      metrics: [...this.completedMetrics],
      memorySnapshots: [...this.memorySnapshots],
      summary: {
        avgIpcLatency,
        avgDatabaseQuery,
        avgRenderTime,
        peakMemory,
        totalMetrics: this.completedMetrics.length
      }
    };
  }

  /**
   * Export report to file
   */
  async exportReport(outputPath?: string): Promise<string> {
    const report = this.getReport();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = outputPath || path.join(
      app.getPath('userData'),
      'performance',
      `performance-report-${timestamp}.json`
    );

    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, JSON.stringify(report, null, 2));

    return filename;
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.clear();
    this.completedMetrics = [];
    this.memorySnapshots = [];
  }

  /**
   * Get metrics by category
   */
  getMetricsByCategory(category: PerformanceMetric['category']): PerformanceMetric[] {
    return this.completedMetrics.filter(m => m.category === category);
  }

  /**
   * Get slow metrics (> threshold ms)
   */
  getSlowMetrics(thresholdMs = 100): PerformanceMetric[] {
    return this.completedMetrics.filter(m => (m.duration || 0) > thresholdMs);
  }

  /**
   * Get statistics for a metric name
   */
  getMetricStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    median: number;
  } | null {
    const metrics = this.completedMetrics
      .filter(m => m.name === name && m.duration !== undefined)
      .map(m => m.duration!);

    if (metrics.length === 0) return null;

    const sorted = [...metrics].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    return {
      count: metrics.length,
      min: Math.min(...metrics),
      max: Math.max(...metrics),
      avg: metrics.reduce((sum, m) => sum + m, 0) / metrics.length,
      median
    };
  }
}

// Singleton instance
export const profiler = new PerformanceProfiler();
