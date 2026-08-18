import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MissionsView } from '../MissionsView';

const mission = {
  list: vi.fn(),
  create: vi.fn(),
  start: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
};

beforeEach(() => {
  mission.list.mockReset();
  mission.create.mockReset();
  mission.start.mockReset();
  mission.pause.mockReset();
  mission.resume.mockReset();
  mission.list.mockResolvedValue({ success: true, data: { missions: [] } });
  (window as unknown as { cortex: { mission: typeof mission } }).cortex = { mission };
});

describe('MissionsView', () => {
  it('creates a mission and lists it', async () => {
    const created = {
      id: 'mission-1',
      name: 'Ship the workbench',
      status: 'planning',
      description: 'Wire remaining surfaces',
      currentStep: 0,
      steps: [
        { id: 'step-1', name: 'Plan', status: 'pending' },
        { id: 'step-2', name: 'Implement', status: 'pending' },
        { id: 'step-3', name: 'Verify', status: 'pending' },
      ],
    };
    mission.create.mockResolvedValue({ success: true, data: { mission: created } });
    mission.list
      .mockResolvedValueOnce({ success: true, data: { missions: [] } })
      .mockResolvedValueOnce({ success: true, data: { missions: [created] } });

    render(<MissionsView workspaceId="/repo" />);

    await waitFor(() => expect(screen.getByText('No missions yet')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('mission-name'), {
      target: { value: 'Ship the workbench' },
    });
    fireEvent.change(screen.getByTestId('mission-description'), {
      target: { value: 'Wire remaining surfaces' },
    });
    fireEvent.click(screen.getByTestId('mission-create-submit'));

    await waitFor(() => expect(mission.create).toHaveBeenCalledTimes(1));
    expect(mission.create).toHaveBeenCalledWith({
      workspaceId: '/repo',
      name: 'Ship the workbench',
      description: 'Wire remaining surfaces',
      steps: ['Plan', 'Implement', 'Verify'],
    });
    await waitFor(() => expect(screen.getByText('Ship the workbench')).toBeInTheDocument());
    expect(screen.getByText('planning')).toBeInTheDocument();
  });

  it('starts a planning mission', async () => {
    const existing = {
      id: 'mission-2',
      name: 'Existing',
      status: 'planning',
      description: '',
      currentStep: 0,
      steps: [{ id: 'step-1', name: 'Plan', status: 'pending' }],
    };
    const running = { ...existing, status: 'running', steps: [{ id: 'step-1', name: 'Plan', status: 'running' }] };
    mission.list
      .mockResolvedValueOnce({ success: true, data: { missions: [existing] } })
      .mockResolvedValueOnce({ success: true, data: { missions: [running] } });
    mission.start.mockResolvedValue({ success: true, data: { mission: running } });

    render(<MissionsView workspaceId="/repo" />);

    await waitFor(() => expect(screen.getByText('Existing')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('mission-start-mission-2'));
    await waitFor(() => expect(mission.start).toHaveBeenCalledWith({ id: 'mission-2' }));
    await waitFor(() => expect(screen.getByText('running')).toBeInTheDocument());
  });
});
