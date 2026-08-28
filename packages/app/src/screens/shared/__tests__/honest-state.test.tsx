import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { HonestState } from '../honest-state.tsx';

describe('HonestState', () => {
  it('marks an error as an alert', () => {
    render(() => <HonestState kind="error" title="Wake failed" body="The farm did not come back." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Wake failed');
  });

  it('offers the action on a signed-out gate', () => {
    const onAction = vi.fn();
    render(() => (
      <HonestState
        kind="signed-out"
        title="Sign in"
        body="Research needs an account."
        actionLabel="Sign in"
        onAction={onAction}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
