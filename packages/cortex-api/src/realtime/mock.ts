/**
 * In-process realtime client. Same interface as the WebSocket client.
 *
 * Used by tests and by the app when `/v1/realtime` has not landed. It never
 * pretends to be the farm: callers must `emit` events they want the UI to see.
 */

import type {
  RealtimeClient,
  RealtimeClientMessage,
  RealtimeEvent,
  RealtimeStatus,
} from './events.ts';

export interface MockRealtime extends RealtimeClient {
  readonly sent: RealtimeClientMessage[];
  emit: (event: RealtimeEvent) => void;
}

export function createMockRealtime(initial: RealtimeStatus = 'disconnected'): MockRealtime {
  const handlers = new Set<(event: RealtimeEvent) => void>();
  const sent: RealtimeClientMessage[] = [];
  let status: RealtimeStatus = initial;

  return {
    sent,
    get status() {
      return status;
    },
    connect: async () => {
      status = 'connected';
      return status;
    },
    disconnect: () => {
      status = 'disconnected';
    },
    subscribe: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    send: (message) => {
      sent.push(message);
    },
    emit: (event) => {
      for (const handler of handlers) handler(event);
    },
  };
}
