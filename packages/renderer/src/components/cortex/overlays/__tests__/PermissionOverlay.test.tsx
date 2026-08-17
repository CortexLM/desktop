import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PermissionOverlay } from '../PermissionOverlay';

const request = {
  id: 'p1',
  tool: 'bash',
  risk: 'high',
  summary: 'Run npm test',
  detail: 'npm test -- --runInBand',
};

describe('PermissionOverlay', () => {
  it('renders the Paper permission card actions', () => {
    const onDecide = vi.fn();
    render(<PermissionOverlay request={request} onDecide={onDecide} />);

    expect(screen.getByText('Permission needed')).toBeInTheDocument();
    expect(screen.getByText('Paused — waiting for approval')).toBeInTheDocument();
    expect(screen.getByText('Deny')).toBeInTheDocument();
    expect(screen.getByText('Allow once')).toBeInTheDocument();
    expect(screen.getByText('Always allow')).toBeInTheDocument();
    expect(screen.queryByText('Allow session')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Allow once'));
    expect(onDecide).toHaveBeenCalledWith('allow-once');
  });

  it('maps enter to allow once and escape to deny', () => {
    const onDecide = vi.fn();
    render(<PermissionOverlay request={request} onDecide={onDecide} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onDecide).toHaveBeenCalledWith('allow-once');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDecide).toHaveBeenCalledWith('deny');
  });
});
