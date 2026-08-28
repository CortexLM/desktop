import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { MascotListScreen } from '../mascot-screens.tsx';

describe('MascotListScreen', () => {
  it('shows an honest empty state, not a fake farm', () => {
    const onCreate = vi.fn();
    render(() => <MascotListScreen mascots={[]} onOpen={vi.fn()} onCreate={onCreate} />);

    expect(screen.getByText('No mascots')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'New mascot' })[0]!);
    expect(onCreate).toHaveBeenCalled();
  });
});
