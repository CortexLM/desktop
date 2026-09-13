import { beforeEach, describe, expect, it } from 'vitest';

import { isPinned, resetPinsForTests, splitPinned, togglePin } from '../pins.ts';

describe('pins', () => {
  beforeEach(() => {
    resetPinsForTests();
  });

  it('pins a chat above recents and keeps the live row, not an invented one', () => {
    togglePin('chats', 'c2');
    expect(isPinned('chats', 'c2')).toBe(true);

    const rows = [
      { id: 'c1', title: 'Today' },
      { id: 'c2', title: 'Pinned thread' },
    ];
    const { pinned, recents } = splitPinned(rows, 'chats');
    expect(pinned).toEqual([{ id: 'c2', title: 'Pinned thread' }]);
    expect(recents).toEqual([{ id: 'c1', title: 'Today' }]);
  });

  it('drops a pin whose conversation is gone rather than inventing a row', () => {
    togglePin('chats', 'missing');
    const { pinned, recents } = splitPinned([{ id: 'c1', title: 'Only live' }], 'chats');
    expect(pinned).toEqual([]);
    expect(recents).toEqual([{ id: 'c1', title: 'Only live' }]);
  });

  it('unpins on a second toggle', () => {
    togglePin('sessions', 's1');
    togglePin('sessions', 's1');
    expect(isPinned('sessions', 's1')).toBe(false);
  });
});
