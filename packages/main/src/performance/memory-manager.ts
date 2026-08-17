/**
 * Memory Manager - Gestion optimale de la mémoire avec cleanup automatique
 */

import { EventEmitter } from 'events';
import { profiler } from './profiler';

interface DisposableResource {
  id: string;
  dispose: () => void | Promise<void>;
  timestamp: number;
  category: string;
}

class MemoryManager extends EventEmitter {
  private resources = new Map<string, DisposableResource>();
  private gcInterval: NodeJS.Timeout | null = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private maxMemoryThreshold = 500 * 1024 * 1024; // 500MB
  private gcIntervalMs = 30000; // 30 seconds
  private memoryCheckIntervalMs = 10000; // 10 seconds

  constructor() {
    super();
  }

  /**
   * Start memory management
   */
  start() {
    this.startGarbageCollection();
    this.startMemoryMonitoring();
  }

  /**
   * Stop memory management
   */
  stop() {
    this.stopGarbageCollection();
    this.stopMemoryMonitoring();
  }

  /**
   * Register a disposable resource
   */
  register(id: string, dispose: () => void | Promise<void>, category = 'generic'): void {
    this.resources.set(id, {
      id,
      dispose,
      timestamp: Date.now(),
      category
    });
  }

  /**
   * Unregister and dispose a resource
   */
  async dispose(id: string): Promise<void> {
    const resource = this.resources.get(id);
    if (!resource) return;

    try {
      await resource.dispose();
      this.resources.delete(id);
      this.emit('resource:disposed', { id, category: resource.category });
    } catch (error) {
      console.error(`[MemoryManager] Failed to dispose resource ${id}:`, error);
      this.emit('resource:dispose-error', { id, error });
    }
  }

  /**
   * Dispose resources by category
   */
  async disposeByCategory(category: string): Promise<void> {
    const resources = Array.from(this.resources.values())
      .filter(r => r.category === category);

    await Promise.all(resources.map(r => this.dispose(r.id)));
  }

  /**
   * Dispose old resources (older than maxAge ms)
   */
  async disposeOldResources(maxAge: number): Promise<void> {
    const now = Date.now();
    const oldResources = Array.from(this.resources.values())
      .filter(r => now - r.timestamp > maxAge);

    await Promise.all(oldResources.map(r => this.dispose(r.id)));
  }

  /**
   * Force garbage collection if available
   */
  forceGC(): void {
    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();
      
      const freed = before.heapUsed - after.heapUsed;
      this.emit('gc:completed', { freed, before, after });
      
      profiler.takeMemorySnapshot();
    }
  }

  /**
   * Start automatic garbage collection
   */
  private startGarbageCollection() {
    if (this.gcInterval) return;

    this.gcInterval = setInterval(() => {
      this.forceGC();
    }, this.gcIntervalMs);
  }

  /**
   * Stop automatic garbage collection
   */
  private stopGarbageCollection() {
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
      this.gcInterval = null;
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring() {
    if (this.memoryCheckInterval) return;

    this.memoryCheckInterval = setInterval(() => {
      const mem = process.memoryUsage();
      
      if (mem.heapUsed > this.maxMemoryThreshold) {
        this.emit('memory:threshold-exceeded', mem);
        
        // Try to free memory
        this.forceGC();
        
        // Dispose old resources
        this.disposeOldResources(5 * 60 * 1000); // 5 minutes
      }

      this.emit('memory:check', mem);
    }, this.memoryCheckIntervalMs);
  }

  /**
   * Stop memory monitoring
   */
  private stopMemoryMonitoring() {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    resources: number;
    categories: Record<string, number>;
    memory: NodeJS.MemoryUsage;
  } {
    const categories: Record<string, number> = {};
    
    for (const resource of this.resources.values()) {
      categories[resource.category] = (categories[resource.category] || 0) + 1;
    }

    return {
      resources: this.resources.size,
      categories,
      memory: process.memoryUsage()
    };
  }

  /**
   * Dispose all resources
   */
  async disposeAll(): Promise<void> {
    const resources = Array.from(this.resources.values());
    await Promise.all(resources.map(r => this.dispose(r.id)));
  }

  /**
   * Set memory threshold
   */
  setMemoryThreshold(bytes: number) {
    this.maxMemoryThreshold = bytes;
  }

  /**
   * Set GC interval
   */
  setGCInterval(ms: number) {
    this.gcIntervalMs = ms;
    if (this.gcInterval) {
      this.stopGarbageCollection();
      this.startGarbageCollection();
    }
  }
}

export const memoryManager = new MemoryManager();
