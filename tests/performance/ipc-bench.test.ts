/**
 * Performance benchmarks for IPC operations
 */

import { describe, beforeEach } from 'vitest';
import { bench } from './bench-harness';
import { createMockIPC } from '@cortex-ide/test-utils';

describe('IPC Performance', () => {
  let ipc: ReturnType<typeof createMockIPC>;

  beforeEach(() => {
    ipc = createMockIPC();
    
    // Setup handlers
    ipc.on('test:echo', (data: any) => data);
    ipc.on('test:process', (data: { value: number }) => ({ result: data.value * 2 }));
  });

  bench('single IPC invoke', async () => {
    await ipc.invoke('test:echo', { message: 'hello' });
  }, { metric: 'ipc_invoke_small' });

  bench('batch IPC invokes', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      ipc.invoke('test:process', { value: i })
    );
    await Promise.all(promises);
  }, { metric: 'ipc_invoke_batch_10' });

  bench('IPC send (fire and forget)', async () => {
    await ipc.send('test:echo', { message: 'hello' });
  }, { metric: 'ipc_send' });

  bench('large payload IPC', async () => {
    const largePayload = {
      data: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        content: `Item ${i}`,
        metadata: { timestamp: Date.now() }
      }))
    };
    
    await ipc.invoke('test:echo', largePayload);
  }, { metric: 'ipc_invoke_large' });

  bench('rapid sequential calls', async () => {
    for (let i = 0; i < 20; i++) {
      await ipc.invoke('test:echo', { count: i });
    }
  }, { metric: 'ipc_invoke_sequential_20' });

  bench('listener management', () => {
    const handler = (data: any) => data;
    
    // Add and remove listeners
    for (let i = 0; i < 10; i++) {
      ipc.on(`channel-${i}`, handler);
      ipc.removeListener(`channel-${i}`, handler);
    }
  }, { metric: 'ipc_listener_churn' });
});
