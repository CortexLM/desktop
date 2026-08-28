import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { PLANNING_SEED } from '../../../state/planning.ts';
import { PlanningScreen } from '../planning-screen.tsx';
import { PluginsScreen } from '../library-plugins-screens.tsx';

describe('PlanningScreen', () => {
  it('lists the seed jobs and locks Subnet 100 when signed out', () => {
    render(() => (
      <PlanningScreen
        tasks={PLANNING_SEED}
        signedIn={false}
        onToggle={vi.fn()}
        onRun={vi.fn()}
        onSignIn={vi.fn()}
      />
    ));

    expect(screen.getByText("Today's notes")).toBeInTheDocument();
    expect(screen.getByText('Subnet 100 news')).toBeInTheDocument();
    expect(screen.getByText('Cortex account')).toBeInTheDocument();
  });
});

describe('PluginsScreen', () => {
  it('shows official brand names and the Composio install path', () => {
    const onInstall = vi.fn();
    render(() => <PluginsScreen connected={[]} onConnect={onInstall} />);

    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText('Slack')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Paper')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Connect with Composio' })[0]!);
    expect(onInstall).toHaveBeenCalledWith('drive');
  });
});
