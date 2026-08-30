import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { BotConversationScreen } from '../mascot-detail-screens.tsx';
import { BotComputerScreen } from '../mascot-computer-screens.tsx';
import { BotVideosScreen } from '../mascot-detail-screens.tsx';
import type { Mascot } from '../../../state/bot-map.ts';

function baseMascot(overrides: Partial<Mascot> = {}): Mascot {
  return {
    id: 'mst_1',
    name: 'Scout',
    look: 'meadow',
    face: 'idle',
    unread: false,
    createdAt: 1,
    computer: {
      id: 'pc_1',
      mascotId: 'mst_1',
      status: 'hibernated',
      spec: { arch: 'x86_64', vcpu: 4, memoryGiB: 16, browser: true },
    },
    messages: [],
    videos: [],
    ...overrides,
  };
}

describe('BotConversationScreen', () => {
  it('blocks the composer on a pending ask and secret', () => {
    const onAnswer = vi.fn();
    const onSecret = vi.fn();
    const mascot = baseMascot({
      messages: [
        { id: 'u', seq: 0, role: 'user', kind: 'user', content: 'hi', at: 1 },
        {
          id: 'a',
          seq: 1,
          role: 'assistant',
          kind: 'ask_user',
          content: 'Wake?',
          at: 1,
          ask: { id: 'ask_1', prompt: 'Wake?', options: ['yes'], pending: true },
        },
        {
          id: 's',
          seq: 2,
          role: 'assistant',
          kind: 'secret',
          content: '',
          at: 1,
          secret: { name: 'token', pending: true },
        },
        {
          id: 'w',
          seq: 3,
          role: 'assistant',
          kind: 'work',
          content: '',
          at: 1,
          work: { tool: 'shell', output: 'ok' },
        },
        {
          id: 't',
          seq: 4,
          role: 'assistant',
          kind: 'send_to_user',
          content: 'Ready.',
          at: 1,
        },
      ],
    });
    render(() => (
      <BotConversationScreen
        mascot={mascot}
        draft=""
        onDraft={vi.fn()}
        onSend={vi.fn()}
        onAnswer={onAnswer}
        onSecret={onSecret}
        onGo={vi.fn()}
        onBack={vi.fn()}
        error="denied"
        sending
      />
    ));
    expect(screen.getAllByText('Waiting on you').length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText('Answer the question above first')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));
    expect(onAnswer).toHaveBeenCalledWith('yes', 'ask_1');
  });

  it('shows the empty thread and a missing mascot', () => {
    const empty = render(() => (
      <BotConversationScreen
        mascot={baseMascot()}
        draft="hello"
        onDraft={vi.fn()}
        onSend={vi.fn()}
        onAnswer={vi.fn()}
        onSecret={vi.fn()}
        onGo={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
    empty.unmount();
    render(() => (
      <BotConversationScreen
        draft=""
        onDraft={vi.fn()}
        onSend={vi.fn()}
        onAnswer={vi.fn()}
        onSecret={vi.fn()}
        onGo={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    expect(screen.getByText('Mascot not found')).toBeInTheDocument();
  });

  it('renders one SendToUser turn as several bubbles and opens the computer rail', () => {
    const onGo = vi.fn();
    const mascot = baseMascot({
      computer: {
        id: 'pc_1',
        mascotId: 'mst_1',
        status: 'running',
        kind: 'cloud',
        spec: { arch: 'x86_64', vcpu: 4, memoryGiB: 16, browser: true },
      },
      messages: [
        {
          id: 't',
          seq: 1,
          role: 'assistant',
          kind: 'send_to_user',
          content: 'Hello.\n\nReady when you are.',
          at: 1,
        },
      ],
    });
    render(() => (
      <BotConversationScreen
        mascot={mascot}
        draft=""
        onDraft={vi.fn()}
        onSend={vi.fn()}
        onAnswer={vi.fn()}
        onSecret={vi.fn()}
        onGo={onGo}
        onBack={vi.fn()}
        computerOpen
        streamUrl="https://farm.example/novnc/abc"
        transport="novnc"
        onWake={vi.fn()}
        onHibernate={vi.fn()}
        onInput={vi.fn()}
      />
    ));
    expect(screen.getByText('Hello.')).toBeInTheDocument();
    expect(screen.getByText('Ready when you are.')).toBeInTheDocument();
    expect(screen.getAllByText(/Cloud · running/).length).toBeGreaterThan(0);
    expect(screen.getByTitle('Live desktop')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open computer' }));
    expect(onGo).toHaveBeenCalledWith('/bot/mst_1/computer');
  });
});

describe('hibernated computer and empty videos', () => {
  it('offers wake and teach', () => {
    const onWake = vi.fn();
    const onTeach = vi.fn();
    render(() => (
      <>
        <BotComputerScreen
          mascot={baseMascot()}
          shellLog=""
          files={[]}
          onWake={onWake}
          onHibernate={vi.fn()}
          onStop={vi.fn()}
          onInput={vi.fn()}
          onShell={vi.fn()}
          onOpenFile={vi.fn()}
          onToggleRecord={vi.fn()}
          onBack={vi.fn()}
          onGo={vi.fn()}
        />
        <BotVideosScreen
          mascot={baseMascot({ videos: [{ id: 'vid_1', title: 'Clip', recordedAt: 1, kind: 'zoom' }] })}
          onTeach={onTeach}
          onBack={vi.fn()}
          onGo={vi.fn()}
        />
      </>
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Wake' }));
    fireEvent.click(screen.getByRole('button', { name: 'Teach skill' }));
    expect(onWake).toHaveBeenCalled();
    expect(onTeach).toHaveBeenCalledWith('vid_1');
  });
});
