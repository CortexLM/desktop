import { describe, expect, it } from 'vitest';

import { splitParagraphs, visibleBubbles } from '../message-bubbles.ts';
import type { BotMessage } from '../../../state/bot-map.ts';

describe('message bubbles', () => {
  it('splits a send_to_user turn on blank lines', () => {
    expect(splitParagraphs('Hello.\n\nReady when you are.')).toEqual(['Hello.', 'Ready when you are.']);
    expect(splitParagraphs('  one block  ')).toEqual(['one block']);
    expect(splitParagraphs('   ')).toEqual([]);
  });

  it('prefers the service bubbles array over splitting', () => {
    const message: BotMessage = {
      id: 'm1',
      seq: 1,
      role: 'assistant',
      kind: 'send_to_user',
      content: 'ignored\n\nalso ignored',
      at: 1,
      bubbles: ['First', 'Second'],
    };
    expect(visibleBubbles(message)).toEqual(['First', 'Second']);
  });
});
