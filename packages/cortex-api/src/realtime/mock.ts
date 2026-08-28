/**
 * In-process realtime client for tests. Not a live farm or session.
 *
 * Import from `@cortex-ide/cortex-api/test-doubles` with
 * `CORTEX_ALLOW_TEST_DOUBLES=1`. The public package entry does not export this.
 */

import { assertTestDoublesAllowed } from '../test-flag.ts';
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

export function createMockRealtime(
  initial: RealtimeStatus = 'disconnected',
  options: { writable?: boolean } = {},
): MockRealtime {
  assertTestDoublesAllowed('createMockRealtime');
  const handlers = new Set<(event: RealtimeEvent) => void>();
  const sent: RealtimeClientMessage[] = [];
  let status: RealtimeStatus = initial;

  return {
    sent,
    get status() {
      return status;
    },
    get writable() {
      return options.writable ?? status === 'connected';
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
    join: (room) => {
      sent.push({ type: 'subscribe', room });
    },
    leave: (room) => {
      sent.push({ type: 'unsubscribe', room });
    },
    emit: (event) => {
      for (const handler of handlers) handler(event);
    },
  };
}
