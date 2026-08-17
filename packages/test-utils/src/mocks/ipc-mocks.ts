/**
 * Mock factory for IPC (Inter-Process Communication)
 */

import { vi } from 'vitest';

// `mock(fn)` was Bun's spy factory; `vi.fn(fn)` is the Vitest equivalent.
// Typed explicitly: an inferred type resolves into vitest's hoisted
// `@vitest/spy` path, which `tsc` rejects as non-portable (TS2742).
const mock: typeof vi.fn = vi.fn;

/**
 * Un handler de canal. Le payload est opaque pour le mock : c'est le test qui
 * connaît la forme attendue, d'où `unknown` plutôt qu'`any`.
 */
export type MockIPCHandler = (data: unknown) => unknown;

export interface MockIPCChannel {
  name: string;
  handler: MockIPCHandler;
}

/**
 * Create a mock IPC system
 */
export function createMockIPC() {
  const channels = new Map<string, MockIPCHandler[]>();
  const sentMessages: Array<{ channel: string; data: unknown }> = [];

  const on = mock((channel: string, handler: MockIPCHandler) => {
    if (!channels.has(channel)) {
      channels.set(channel, []);
    }
    channels.get(channel)!.push(handler);
  });

  const send = mock(async (channel: string, data: unknown) => {
    sentMessages.push({ channel, data });
    const handlers = channels.get(channel) || [];
    
    for (const handler of handlers) {
      await handler(data);
    }
  });

  const invoke = mock(async (channel: string, data: unknown) => {
    sentMessages.push({ channel, data });
    const handlers = channels.get(channel) || [];
    
    if (handlers.length === 0) {
      throw new Error(`No handler registered for channel: ${channel}`);
    }

    // Return result from first handler
    return handlers[0](data);
  });

  const removeListener = mock((channel: string, handler: MockIPCHandler) => {
    const handlers = channels.get(channel);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  });

  const removeAllListeners = mock((channel: string) => {
    channels.delete(channel);
  });

  const reset = () => {
    channels.clear();
    sentMessages.length = 0;
    on.mockClear();
    send.mockClear();
    invoke.mockClear();
    removeListener.mockClear();
    removeAllListeners.mockClear();
  };

  return {
    on,
    send,
    invoke,
    removeListener,
    removeAllListeners,
    getSentMessages: () => [...sentMessages],
    getChannels: () => Array.from(channels.keys()),
    reset
  };
}

/**
 * Create mock Electron IPC
 */
export function createMockElectronIPC() {
  const mainIPC = createMockIPC();
  const rendererIPC = createMockIPC();

  return {
    main: mainIPC,
    renderer: rendererIPC,
    
    // Connect main and renderer
    connectChannels: () => {
      // Forward renderer.send to main.on
      const originalRendererSend = rendererIPC.send;
      rendererIPC.send.mockImplementation(async (channel: string, data: unknown) => {
        await originalRendererSend(channel, data);
        await mainIPC.send(channel, data);
      });

      // Forward main.send to renderer.on
      const originalMainSend = mainIPC.send;
      mainIPC.send.mockImplementation(async (channel: string, data: unknown) => {
        await originalMainSend(channel, data);
        await rendererIPC.send(channel, data);
      });
    },

    reset: () => {
      mainIPC.reset();
      rendererIPC.reset();
    }
  };
}
