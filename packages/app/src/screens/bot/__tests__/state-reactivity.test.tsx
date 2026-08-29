import { render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';

import { BotComputerScreen } from '../mascot-computer-screens.tsx';
import { MascotListScreen } from '../mascot-screens.tsx';
import { BotMemoryScreen } from '../mascot-runtime-screens.tsx';
import type { BotPanelState } from '../../../state/bot-runtime-store.ts';
import type { Mascot } from '../../../state/bot-map.ts';

function mascot(overrides: Partial<Mascot> = {}): Mascot {
  return {
    id: 'mst_1',
    name: 'Scout',
    look: 'meadow',
    face: 'idle',
    unread: false,
    messages: [],
    videos: [],
    computer: {
      id: 'pc_1',
      mascotId: 'mst_1',
      status: 'running',
      spec: { arch: 'x86_64', vcpu: 4, memoryGiB: 8 },
    },
    ...overrides,
  } as Mascot;
}

/**
 * These screens picked their state with a chain of early `return`s. A component body
 * runs once in Solid, so whichever branch was true at first paint was the only one
 * that would ever render — and the first paint is always the pre-fetch state. Each
 * case here drives a state change after mount, which is what used to be ignored.
 */
describe('Bot screens react to state that arrives after the first paint', () => {
  it('replaces the empty mascot list once the reconcile lands', () => {
    const [mascots, setMascots] = createSignal<readonly Mascot[]>([]);
    const [loading, setLoading] = createSignal(true);

    render(() => (
      <MascotListScreen
        mascots={mascots()}
        loading={loading()}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
      />
    ));

    expect(screen.getByText('Loading mascots')).toBeInTheDocument();

    setLoading(false);
    expect(screen.getByText('No mascots')).toBeInTheDocument();

    setMascots([mascot()]);

    // The bug: this stayed on "No mascots" forever, so a signed-in account with
    // mascots never saw them even though the API call had succeeded.
    expect(screen.queryByText('No mascots')).not.toBeInTheDocument();
    expect(screen.getByText('Scout')).toBeInTheDocument();
  });

  it('shows the API failure that arrives after mount', () => {
    const [error, setError] = createSignal<string | undefined>();

    render(() => (
      <MascotListScreen
        mascots={[]}
        error={error()}
        onOpen={vi.fn()}
        onCreate={vi.fn()}
      />
    ));

    expect(screen.getByText('No mascots')).toBeInTheDocument();

    setError('The mascot service refused the request.');
    expect(screen.getByText('Could not load mascots')).toBeInTheDocument();
  });

  it('leaves the hibernated state when the box wakes', () => {
    const [current, setCurrent] = createSignal(
      mascot({
        computer: {
          id: 'pc_1',
          mascotId: 'mst_1',
          status: 'hibernated',
          spec: { arch: 'x86_64', vcpu: 4, memoryGiB: 8 },
        },
      } as Partial<Mascot>),
    );

    render(() => (
      <BotComputerScreen
        mascot={current()}
        shellLog=""
        files={[]}
        onWake={vi.fn()}
        onHibernate={vi.fn()}
        onStop={vi.fn()}
        onInput={vi.fn()}
        onShell={vi.fn()}
        onOpenFile={vi.fn()}
        onToggleRecord={vi.fn()}
        onBack={vi.fn()}
        onGo={vi.fn()}
      />
    ));

    expect(screen.getByText('Hibernated')).toBeInTheDocument();

    setCurrent(mascot());

    // Waking is the whole point of the button next to this state.
    expect(screen.queryByText('Hibernated')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hibernate' })).toBeInTheDocument();
  });

  it('replaces a runtime panel\'s loading state with its rows', () => {
    const [state, setState] = createSignal<BotPanelState>('loading');

    render(() => (
      <BotMemoryScreen
        mascot={mascot()}
        facts={[{ id: 'f1', tier: 'profile', text: 'Prefers tea' }]}
        state={state()}
        error=""
        onForget={vi.fn()}
        onBack={vi.fn()}
        onGo={vi.fn()}
      />
    ));

    expect(screen.getByText('Loading memory')).toBeInTheDocument();

    setState('ready');
    expect(screen.queryByText('Loading memory')).not.toBeInTheDocument();
    expect(screen.getByText('Prefers tea')).toBeInTheDocument();
  });
});
