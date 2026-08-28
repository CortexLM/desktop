import { fireEvent, render, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { stubFetch } from '../../../../../cortex-api/src/__tests__/fixtures.ts';
import { setBotClientForTests } from '../../../state/bot-client.ts';
import { resetBotsForTests } from '../../../state/bots.ts';
import { sendBotMessage } from '../../../state/bot-actions.ts';
import { BotConversationScreen } from '../mascot-detail-screens.tsx';
import type { Mascot } from '../../../state/bot-map.ts';

afterEach(() => {
  globalThis.localStorage?.clear();
  setBotClientForTests(undefined);
  resetBotsForTests();
});

const mascot: Mascot = {
  id: 'mst_1',
  name: 'Scout',
  shape: 'round',
  color: 'green',
  createdAt: 1,
  computer: {
    id: 'pc_1',
    mascotId: 'mst_1',
    status: 'hibernated',
    spec: { arch: 'x86_64', vcpu: 4, memoryGiB: 16, browser: true },
  },
  messages: [],
  videos: [],
};

describe('sending a Bot message', () => {
  it('does not treat localStorage as the source of truth', async () => {
    const { fetch, calls } = stubFetch([
      { body: { id: 'msg_1', role: 'user', kind: 'user', text: 'hello from Ana' } },
    ]);
    setBotClientForTests(new CortexApiClient({ fetch }));

    const writes: string[] = [];
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      writes.push(key);
      return original.call(this, key, value);
    };

    let draft = 'hello from Ana';
    render(() => (
      <BotConversationScreen
        mascot={mascot}
        draft={draft}
        onDraft={(value) => {
          draft = value;
        }}
        onSend={() => {
          void sendBotMessage('mst_1', draft);
        }}
        onAnswer={() => {}}
        onSecret={() => {}}
        onGo={() => {}}
        onBack={() => {}}
      />
    ));

    fireEvent.keyDown(screen.getByPlaceholderText('Message this mascot'), { key: 'Enter' });
    await Promise.resolve();
    await Promise.resolve();

    expect(calls[0]!.url).toBe('https://api.cortex.foundation/v1/mascots/mst_1/messages');
    expect(calls[0]!.body).toEqual({ text: 'hello from Ana' });
    expect(writes.filter((key) => key.startsWith('cortex.bots'))).toEqual([]);

    Storage.prototype.setItem = original;
  });
});
