import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { Segmented } from '../segmented.tsx';

describe('Segmented', () => {
  it('marks the selected option and reports a change', () => {
    const onChange = vi.fn();
    render(() => (
      <Segmented
        label="Shape"
        value="round"
        onChange={onChange}
        bordered
        options={[
          { id: 'round', label: 'Round', icon: 'bot' },
          { id: 'square', label: 'Square', disabled: true },
        ]}
      />
    ));

    const round = screen.getByRole('button', { name: 'Round' });
    expect(round).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Shape' })).toHaveClass('cx-segmented--bordered');
    fireEvent.click(round);
    expect(onChange).toHaveBeenCalledWith('round');
    expect(screen.getByRole('button', { name: 'Square' })).toBeDisabled();
  });

  it('uses the raised-chip register when bordered and icons are omitted', () => {
    const onChange = vi.fn();
    render(() => (
      <Segmented
        label="Mode"
        value="plan"
        onChange={onChange}
        options={[
          { id: 'plan', label: 'Plan' },
          { id: 'act', label: 'Act' },
        ]}
      />
    ));

    const group = screen.getByRole('group', { name: 'Mode' });
    expect(group).toHaveClass('cx-segmented');
    expect(group).not.toHaveClass('cx-segmented--bordered');
    expect(group.querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Act' }));
    expect(onChange).toHaveBeenCalledWith('act');
  });
});
