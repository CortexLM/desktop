import { describe, expect, it } from 'vitest';

import * as publicApi from '../index.ts';
import { withTestDoublesFlag } from '../test-flag.ts';
import { createMockProductSurface, createMockRealtime } from '../test-doubles.ts';

describe('public client', () => {
  it('does not export mock hosts from the production entry', () => {
    expect(publicApi).not.toHaveProperty('createMockProductSurface');
    expect(publicApi).not.toHaveProperty('createMockRealtime');
    expect(publicApi).toHaveProperty('createHttpProductSurface');
  });
});

describe('test doubles', () => {
  it('refuse to look like a live farm without the test flag', () => {
    withTestDoublesFlag(undefined, () => {
      expect(() => createMockProductSurface()).toThrow(/test double/i);
      expect(() => createMockRealtime()).toThrow(/test double/i);
    });
  });

  it('seed a surface only when the flag is set', async () => {
    const surface = withTestDoublesFlag('1', () =>
      createMockProductSurface({
        tasks: [{ id: 'todays-notes', title: "Today's notes" }],
      }),
    );
    expect(await surface.listPlanningTasks()).toEqual([
      { id: 'todays-notes', title: "Today's notes" },
    ]);
    expect(await surface.createVncTicket('mst_1')).toEqual({ ticket_hash: 'ticket-hash-only' });
  });
});
