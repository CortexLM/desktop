import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient, type RealtimeEvent } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';
import { applyBotRealtime } from '../bot-realtime.ts';
import { setBotClientForTests } from '../bot-client.ts';
import { createMascot, mascotById, resetBotsForTests } from '../bots.ts';

afterEach(() => {
  setBotClientForTests(undefined);
  resetBotsForTests();
});

function event(type: string, extra: Partial<RealtimeEvent> = {}): RealtimeEvent {
  return { type, mascot_id: 'mst_1', ...extra };
}

describe('applyBotRealtime', () => {
  it('puts send_to_user in the thread and tools in work', async () => {
    const { fetch } = stubFetch([{ body: { id: 'mst_1', name: 'Scout', computer_id: 'pc_1' } }]);
    setBotClientForTests(new CortexApiClient({ fetch }));
    await createMascot('Scout', 'round', 'green');

    applyBotRealtime(event('send_to_user', { text: 'Ready.' }));
    applyBotRealtime(event('tool_call', { tool: 'shell' }));
    applyBotRealtime(event('computer_offline', { message: 'farm down' }));

    const mascot = mascotById('mst_1')!;
    expect(mascot.messages.filter((row) => row.kind === 'send_to_user')[0]?.content).toBe('Ready.');
    expect(mascot.messages.some((row) => row.kind === 'work')).toBe(true);
    expect(mascot.computer.status).toBe('offline');
  });
});
