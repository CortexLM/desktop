/**
 * Test-only ProductSurface and realtime doubles.
 *
 * Import this module from suites, never from production hosts. Each factory
 * throws unless `CORTEX_ALLOW_TEST_DOUBLES=1`.
 */

import { assertTestDoublesAllowed } from './test-flag.ts';
import type {
  ApiCodeHost,
  ApiCodeSession,
  ApiLibraryItem,
  ApiMascot,
  ApiMascotVideo,
  ApiNotification,
  ApiPlanningTask,
  ApiPlugin,
  HostPairing,
  VncTicket,
} from './pending-schemas.ts';
import type { ProductSurface } from './pending.ts';
import { createMockRealtime, type MockRealtime } from './realtime/mock.ts';
import type { RealtimeStatus } from './realtime/events.ts';

export { createMockRealtime, type MockRealtime };
export { TEST_DOUBLES_FLAG, testDoublesAllowed } from './test-flag.ts';

export function createMockProductSurface(
  seed: Partial<{
    mascots: ApiMascot[];
    hosts: ApiCodeHost[];
    sessions: ApiCodeSession[];
    tasks: ApiPlanningTask[];
    library: ApiLibraryItem[];
    plugins: ApiPlugin[];
    notifications: ApiNotification[];
  }> = {},
): ProductSurface {
  assertTestDoublesAllowed('createMockProductSurface');
  const empty = async <T>(rows: T[] | undefined) => rows ?? [];
  return {
    listMascots: () => empty(seed.mascots),
    listCodeHosts: () => empty(seed.hosts),
    listCodeSessions: () => empty(seed.sessions),
    listPlanningTasks: () => empty(seed.tasks),
    listLibraryItems: () => empty(seed.library),
    listPlugins: () => empty(seed.plugins),
    listNotifications: () => empty(seed.notifications),
    postScheduledResult: async () => {},
    pairCodeHost: async () => mockPairing(),
    heartbeatCodeHost: async () => {},
    createMascot: async (body) => ({ id: 'mst_mock', name: body.name }),
    deleteMascot: async () => {},
    createVncTicket: async () => mockTicket(),
    listMascotVideos: async () => empty([] as ApiMascotVideo[]),
    markNotificationRead: async () => {},
  };
}

function mockPairing(): HostPairing {
  return { pairing_code: 'PAIR-TEST' };
}

function mockTicket(): VncTicket {
  return { ticket_hash: 'ticket-hash-only' };
}

export function createListenOnlyRealtime(status: RealtimeStatus = 'connected'): MockRealtime {
  return createMockRealtime(status, { writable: false });
}
