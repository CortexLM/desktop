import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { WelcomeScreen } from '../welcome-screen.tsx';

describe('Welcome splash', () => {
  it('offers Get started and a way in without an account', () => {
    const onGetStarted = vi.fn();
    const onSkip = vi.fn();
    render(() => <WelcomeScreen onGetStarted={onGetStarted} onSkip={onSkip} />);

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue without an account' }));

    expect(onGetStarted).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('names Chat and Code in English', () => {
    render(() => <WelcomeScreen onGetStarted={() => {}} onSkip={() => {}} />);
    expect(screen.getByText(/Chat and Code/)).toBeInTheDocument();
    expect(screen.queryByText(/Bot/)).toBeNull();
  });
});
