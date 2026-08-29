import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { PLANNING_TEMPLATES, type ScheduledTask } from '../../../state/planning.ts';
import { PlanningScreen } from '../planning-screen.tsx';

const SCHEDULED: readonly ScheduledTask[] = [
  {
    id: 'todays-notes',
    title: "Today's notes",
    summary: 'Gather what you wrote today.',
    cadence: 'daily',
    status: 'active',
  },
];

function planningProps(overrides: Partial<Parameters<typeof PlanningScreen>[0]> = {}) {
  return {
    tasks: SCHEDULED,
    state: 'ready' as const,
    signedIn: true,
    templates: PLANNING_TEMPLATES.filter((template) => template.id !== 'todays-notes'),
    onToggle: vi.fn(),
    onRun: vi.fn(),
    onAdd: vi.fn(),
    onRetry: vi.fn(),
    onSignIn: vi.fn(),
    ...overrides,
  };
}

describe('PlanningScreen', () => {
  it('lists the account schedule alongside the jobs it can still add', () => {
    render(() => <PlanningScreen {...planningProps()} />);

    expect(screen.getByText("Today's notes")).toBeInTheDocument();
    expect(screen.getByText('Jobs you can add')).toBeInTheDocument();
    // The template order is the product lock, Subnet 100 last.
    expect(screen.getByText('Subnet 100 news')).toBeInTheDocument();
  });

  it('adds a template rather than seeding one locally', () => {
    const onAdd = vi.fn();
    render(() => <PlanningScreen {...planningProps({ onAdd })} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]!);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'unread-mentions' }),
    );
  });

  it('locks the Cortex-only job behind sign-in', () => {
    const onSignIn = vi.fn();
    render(() => (
      <PlanningScreen {...planningProps({ signedIn: false, tasks: [], onSignIn })} />
    ));

    // Signed out, the schedule cannot exist at all: it runs when the tab is shut.
    expect(screen.getByText('Planning needs a Cortex account')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cortex account' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('says a missing route is missing instead of showing an empty schedule', () => {
    render(() => (
      <PlanningScreen
        {...planningProps({
          state: 'unsupported',
          tasks: [],
          error: 'Planning is not available on this Cortex backend yet.',
        })}
      />
    ));

    expect(screen.getByText('Planning is not on this backend')).toBeInTheDocument();
    expect(screen.queryByText('No scheduled jobs')).not.toBeInTheDocument();
  });

  it('shows a loading state so the empty state does not flash first', () => {
    render(() => <PlanningScreen {...planningProps({ state: 'loading', tasks: [] })} />);
    expect(screen.getByText('Loading planning')).toBeInTheDocument();
  });
});
