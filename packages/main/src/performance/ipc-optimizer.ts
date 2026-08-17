/**
 * IPC Optimizer - Optimise les communications IPC avec batching et streaming
 */

import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { profiler } from './profiler';

/**
 * Payload transitant par IPC.
 *
 * `unknown` plutôt qu'`any` : cet optimiseur ne fait que transporter la donnée
 * (batching / découpage), il ne l'inspecte jamais — c'est le handler du canal qui
 * connaît sa forme.
 */
type IPCPayload = unknown;

interface BatchedMessage {
  channel: string;
  data: IPCPayload;
  timestamp: number;
}

interface StreamChunk {
  id: string;
  index: number;
  data: IPCPayload[];
  isLast: boolean;
}

class IPCOptimizer extends EventEmitter {
  private batchQueue = new Map<string, BatchedMessage[]>();
  private batchInterval: NodeJS.Timeout | null = null;
  private batchDelayMs = 16; // ~60fps
  private maxBatchSize = 100;
  private activeStreams = new Map<string, IPCPayload[]>();

  constructor() {
    super();
  }

  /**
   * Start IPC optimization
   */
  start() {
    this.startBatching();
  }

  /**
   * Stop IPC optimization
   */
  stop() {
    this.stopBatching();
  }

  /**
   * Send a message with batching
   */
  sendBatched(window: BrowserWindow, channel: string, data: IPCPayload) {
    if (!this.batchQueue.has(channel)) {
      this.batchQueue.set(channel, []);
    }

    const queue = this.batchQueue.get(channel)!;
    queue.push({
      channel,
      data,
      timestamp: Date.now()
    });

    // If queue is full, flush immediately
    if (queue.length >= this.maxBatchSize) {
      this.flushBatch(window, channel);
    }
  }

  /**
   * Start a stream for large data transfer
   */
  startStream(window: BrowserWindow, streamId: string, data: IPCPayload[], chunkSize = 1000) {
    profiler.start(`stream:${streamId}`, 'ipc', { chunkSize, totalSize: data.length });

    this.activeStreams.set(streamId, data);

    const chunks = Math.ceil(data.length / chunkSize);
    
    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, data.length);
      const chunk: StreamChunk = {
        id: streamId,
        index: i,
        data: data.slice(start, end),
        isLast: i === chunks - 1
      };

      window.webContents.send('ipc:stream-chunk', chunk);
    }

    profiler.end(`stream:${streamId}`);
    this.activeStreams.delete(streamId);
  }

  /**
   * Send large data efficiently
   */
  async sendLargeData(window: BrowserWindow, channel: string, data: IPCPayload) {
    const serialized = JSON.stringify(data);
    const sizeInBytes = Buffer.byteLength(serialized);

    // If data is small, send directly
    if (sizeInBytes < 100 * 1024) { // < 100KB
      window.webContents.send(channel, data);
      return;
    }

    // For large data, use streaming
    const streamId = `${channel}-${Date.now()}`;
    
    if (Array.isArray(data)) {
      this.startStream(window, streamId, data);
    } else {
      // For objects, split into chunks
      const entries = Object.entries(data as Record<string, unknown>);
      const chunks: IPCPayload[] = [];
      const chunkSize = 100;
      
      for (let i = 0; i < entries.length; i += chunkSize) {
        chunks.push(Object.fromEntries(entries.slice(i, i + chunkSize)));
      }
      
      this.startStream(window, streamId, chunks);
    }

    window.webContents.send(channel, { streamId, streaming: true });
  }

  /**
   * Flush a specific batch
   */
  private flushBatch(window: BrowserWindow, channel: string) {
    const queue = this.batchQueue.get(channel);
    if (!queue || queue.length === 0) return;

    profiler.start(`batch:${channel}`, 'ipc', { count: queue.length });

    window.webContents.send('ipc:batch', {
      channel,
      messages: queue.map(m => m.data),
      count: queue.length
    });

    profiler.end(`batch:${channel}`);
    this.batchQueue.set(channel, []);
    
    this.emit('batch:flushed', { channel, count: queue.length });
  }

  /**
   * Flush all batches
   */
  flushAll(window: BrowserWindow) {
    for (const channel of this.batchQueue.keys()) {
      this.flushBatch(window, channel);
    }
  }

  /**
   * Start automatic batching
   */
  private startBatching() {
    if (this.batchInterval) return;

    this.batchInterval = setInterval(() => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        this.flushAll(windows[0]);
      }
    }, this.batchDelayMs);
  }

  /**
   * Stop automatic batching
   */
  private stopBatching() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      batchQueues: this.batchQueue.size,
      activeStreams: this.activeStreams.size,
      queuedMessages: Array.from(this.batchQueue.values()).reduce((sum, q) => sum + q.length, 0)
    };
  }

  /**
   * Set batch delay
   */
  setBatchDelay(ms: number) {
    this.batchDelayMs = ms;
    if (this.batchInterval) {
      this.stopBatching();
      this.startBatching();
    }
  }

  /**
   * Set max batch size
   */
  setMaxBatchSize(size: number) {
    this.maxBatchSize = size;
  }
}

export const ipcOptimizer = new IPCOptimizer();
