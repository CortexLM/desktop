/**
 * Performance Module - Point d'entrée pour toutes les optimisations
 */

export { v8Cache } from './v8-cache';
export { profiler, type PerformanceMetric, type PerformanceReport, type MemorySnapshot } from './profiler';
export { memoryManager } from './memory-manager';
export { ipcOptimizer } from './ipc-optimizer';
export { dbOptimizer, type PreparedStatementCache } from './database-optimizer';
// Lazy loader removed - not used in main process

import { v8Cache } from './v8-cache';
import { profiler } from './profiler';
import { memoryManager } from './memory-manager';
import { ipcOptimizer } from './ipc-optimizer';

/**
 * Initialize all performance optimizations
 */
export async function initializePerformance(options?: {
  enableV8Cache?: boolean;
  enableProfiler?: boolean;
  enableMemoryManager?: boolean;
  enableIPCOptimizer?: boolean;
  profilerEnabled?: boolean;
}) {
  const opts = {
    enableV8Cache: true,
    enableProfiler: true,
    enableMemoryManager: true,
    enableIPCOptimizer: true,
    profilerEnabled: process.env.NODE_ENV === 'development',
    ...options
  };

  profiler.start('performance:initialization', 'startup');

  try {
    // Initialize V8 cache
    if (opts.enableV8Cache) {
      await v8Cache.initialize();
      profiler.end('v8cache:initialize');
    }

    // Enable profiler
    if (opts.enableProfiler) {
      profiler.setEnabled(opts.profilerEnabled);
      if (opts.profilerEnabled) {
        profiler.startMemoryMonitoring();
      }
    }

    // Start memory manager
    if (opts.enableMemoryManager) {
      memoryManager.start();
    }

    // Start IPC optimizer
    if (opts.enableIPCOptimizer) {
      ipcOptimizer.start();
    }

    profiler.end('performance:initialization');
    
    console.log('[Performance] All optimizations initialized');
  } catch (error) {
    console.error('[Performance] Failed to initialize:', error);
    profiler.end('performance:initialization', { error: String(error) });
  }
}

/**
 * Cleanup all performance systems
 */
export async function cleanupPerformance() {
  profiler.start('performance:cleanup', 'startup');

  try {
    memoryManager.stop();
    ipcOptimizer.stop();
    profiler.stopMemoryMonitoring();

    await memoryManager.disposeAll();

    profiler.end('performance:cleanup');
    console.log('[Performance] Cleanup completed');
  } catch (error) {
    console.error('[Performance] Cleanup failed:', error);
  }
}

/**
 * Get overall performance statistics
 */
export function getPerformanceStats() {
  return {
    profiler: profiler.getReport(),
    memory: memoryManager.getStats(),
    ipc: ipcOptimizer.getStats(),
    v8Cache: v8Cache.getStats()
  };
}
