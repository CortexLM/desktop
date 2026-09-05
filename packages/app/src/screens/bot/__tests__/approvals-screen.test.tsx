import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { BotApprovalsScreen, pendingApprovals } from '../../../routes/bot-approvals-route.tsx';
import type { Mascot } from '../../../state/bot-map.ts';

function mascot(overrides: Partial<Mascot> = {}): Mascot {
  return {
    id: 'mst_1',
    name: 'Scout',
    look: 'meadow',
    face: 'idle',
    unread: false,
    createdAt: 1,
    computer: { id: 'pc_1', mascotId: 'mst_1', status: 'hibernated' },
    messages: [],
    videos: [],
    ...overrides,
  };
}

describe('pendingApprovals', () => {
  it('collects pending asks and secrets and ignores work', () => {
    const items = pendingApprovals([
      mascot({
        messages: [
          {
            id: 'a',
            seq: 0,
            role: 'assistant',
            kind: 'ask_user',
            content: 'Wake?',
            at: 1,
            ask: { prompt: 'Wake?', pending: true },
          },
          {
            id: 'w',
            seq: 1,
            role: 'assistant',
            kind: 'work',
            content: '',
            at: 1,
            work: { tool: 'shell', output: 'ok' },
          },
        ],
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.message.kind).toBe('ask_user');
  });
});

describe('BotApprovalsScreen', () => {
  it('shows an honest empty state', () => {
    render(() => (
      <BotApprovalsScreen items={[]} onAnswer={vi.fn()} onSecret={vi.fn()} onOpen={vi.fn()} />
    ));
    expect(screen.getByText('Nothing waiting')).toBeInTheDocument();
  });

  it('answers a pending ask from the list', () => {
    const onAnswer = vi.fn();
    const row = mascot({
      messages: [
        {
          id: 'a',
          seq: 0,
          role: 'assistant',
          kind: 'ask_user',
          content: 'Wake?',
          at: 1,
          ask: { id: 'ask_1', prompt: 'Wake?', options: ['yes'], pending: true },
        },
      ],
    });
    render(() => (
      <BotApprovalsScreen
        items={pendingApprovals([row])}
        onAnswer={onAnswer}
        onSecret={vi.fn()}
        onOpen={vi.fn()}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    expect(onAnswer).toHaveBeenCalledWith('mst_1', 'yes', 'ask_1');
  });
});
