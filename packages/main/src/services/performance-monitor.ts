/**
 * Performance Monitor - Track performance metrics
 */

import { logger } from '@cortex-ide/shared/logger';

interface PerformanceMetric {
  category: string;
  name: string;
  value: number;
  timestamp: number;
  unit?: string;
}

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private memorySnapshots: MemorySnapshot[] = [];
  private maxMetrics = 5000;
  private maxSnapshots = 100;

  recordMetric(category: string, name: string, value: number, unit?: string): void {
    this.metrics.push({
      category,
      name,
      value,
      timestamp: Date.now(),
      unit
    });

    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  takeMemorySnapshot(): void {
    const mem = process.memoryUsage();
    this.memorySnapshots.push({
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss
    });

    if (this.memorySnapshots.length > this.maxSnapshots) {
      this.memorySnapshots.shift();
    }
  }

  getMetrics(category?: string, limit?: number): PerformanceMetric[] {
    let filtered = category
      ? this.metrics.filter(m => m.category === category)
      : [...this.metrics];
    
    return limit ? filtered.slice(-limit) : filtered;
  }

  getMemorySnapshots(limit?: number): MemorySnapshot[] {
    return limit ? this.memorySnapshots.slice(-limit) : [...this.memorySnapshots];
  }

  getMetricStats(category: string, name: string) {
    const filtered = this.metrics.filter(m => m.category === category && m.name === name);
    if (filtered.length === 0) return null;

    const values = filtered.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { count: values.length, avg, min, max, sum };
  }

  clear(): void {
    this.metrics = [];
    this.memorySnapshots = [];
    logger.info('performance-monitor', 'Performance metrics cleared');
  }
}

export const performanceMonitor = new PerformanceMonitor();
