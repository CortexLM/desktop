import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ComputerRail } from '../computer-rail.tsx';
import type { Mascot } from '../../../state/bot-map.ts';

import '../bot-teammate.css';

function mascot(overrides: Partial<Mascot> = {}): Mascot {
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
      status: 'running',
      spec: { arch: 'x86_64', vcpu: 4, memoryGiB: 16, browser: true },
    },
    messages: [],
    videos: [],
    ...overrides,
  };
}

describe('ComputerRail', () => {
  it('offers take control on a live box and release once held', () => {
    const onTake = vi.fn();
    const onRelease = vi.fn();
    const live = render(() => (
      <ComputerRail
        mascot={mascot()}
        hasControl={false}
        onTakeControl={onTake}
        onRelease={onRelease}
        onWake={vi.fn()}
        onRuntime={vi.fn()}
        onInput={vi.fn()}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Take control' }));
    expect(onTake).toHaveBeenCalled();
    live.unmount();

    render(() => (
      <ComputerRail
        mascot={mascot()}
        hasControl
        onTakeControl={onTake}
        onRelease={onRelease}
        onWake={vi.fn()}
        onRuntime={vi.fn()}
        onInput={vi.fn()}
      />
    ));
    expect(screen.getByText('You have control')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Release' }));
    expect(onRelease).toHaveBeenCalled();
  });

  it('embeds a noVNC stream rather than a tab navbar', () => {
    render(() => (
      <ComputerRail
        mascot={mascot()}
        streamUrl="https://farm.example/vnc?token=1"
        hasControl={false}
        onTakeControl={vi.fn()}
        onRelease={vi.fn()}
        onWake={vi.fn()}
        onRuntime={vi.fn()}
        onInput={vi.fn()}
      />
    ));
    const frame = screen.getByTitle('Computer');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('src')).toContain('view_only=true');
    expect(screen.queryByRole('button', { name: 'Terminal' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Files' })).toBeNull();
  });

  it('does not offer This PC or SSH as a host', () => {
    render(() => (
      <ComputerRail
        mascot={mascot()}
        hasControl={false}
        onTakeControl={vi.fn()}
        onRelease={vi.fn()}
        onWake={vi.fn()}
        onRuntime={vi.fn()}
        onInput={vi.fn()}
      />
    ));
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\bThis PC\b|\bThis desktop\b/i);
    expect(screen.queryByRole('button', { name: /^This PC$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^SSH$/i })).toBeNull();
  });
});
