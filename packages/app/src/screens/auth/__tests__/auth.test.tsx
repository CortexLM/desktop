import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import {
  DeviceCodeScreen,
  type DeviceCodeScreenProps,
  type DeviceCodeStatus,
} from '../device-code-screen.tsx';
import { SignInScreen, type SignInScreenProps } from '../sign-in-screen.tsx';

function renderSignIn(overrides: Partial<SignInScreenProps> = {}) {
  const handlers = {
    onContinueWithGitHub: vi.fn(),
    onContinueWithGoogle: vi.fn(),
    onContinueWithEmail: vi.fn(),
    onContinueWithoutAccount: vi.fn(),
  };

  const result = render(() => <SignInScreen {...handlers} {...overrides} />);
  return { ...result, ...handlers, ...overrides };
}

function renderDeviceCode(overrides: Partial<DeviceCodeScreenProps> = {}) {
  const handlers = {
    onOpenBrowser: vi.fn(),
    onCopyCode: vi.fn(),
    onCancel: vi.fn(),
    onRetry: vi.fn(),
  };

  const result = render(() => (
    <DeviceCodeScreen
      userCode="TESTCODE"
      verificationUri="https://auth.cortex.foundation/device"
      status="waiting"
      secondsRemaining={900}
      {...handlers}
      {...overrides}
    />
  ));

  return { ...result, ...handlers };
}

describe('Sign in providers', () => {
  it('offers GitHub, Google and email', () => {
    renderSignIn();

    expect(screen.getByRole('button', { name: /Continue with GitHub/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with email' })).toBeInTheDocument();
  });

  it('starts the GitHub and Google flows', () => {
    const { onContinueWithGitHub, onContinueWithGoogle } = renderSignIn();

    fireEvent.click(screen.getByRole('button', { name: /Continue with GitHub/ }));
    fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ }));

    expect(onContinueWithGitHub).toHaveBeenCalledOnce();
    expect(onContinueWithGoogle).toHaveBeenCalledOnce();
  });

  it('holds the email action until the address and password are present', () => {
    renderSignIn();
    const submit = screen.getByRole('button', { name: 'Continue with email' });
    const input = screen.getByLabelText('Email address');

    expect(submit).toBeDisabled();

    fireEvent.input(input, { target: { value: 'not-an-email' } });
    expect(submit).toBeDisabled();

    fireEvent.input(input, { target: { value: 'alex@example.com' } });
    expect(submit).toBeDisabled();

    fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    expect(submit).not.toBeDisabled();
  });

  it('trims the address before handing it over', () => {
    const { onContinueWithEmail } = renderSignIn();

    fireEvent.input(screen.getByLabelText('Email address'), {
      target: { value: '  alex@example.com  ' },
    });
    fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));

    expect(onContinueWithEmail).toHaveBeenCalledWith('alex@example.com', 'secret');
  });

  it('does not reload the page on native form submit', () => {
    const { container, onContinueWithEmail } = renderSignIn();
    fireEvent.input(screen.getByLabelText('Email address'), {
      target: { value: 'alex@example.com' },
    });
    fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'secret' } });

    const submitted = fireEvent.submit(container.querySelector('form')!);

    expect(submitted).toBe(false);
    expect(onContinueWithEmail).toHaveBeenCalledOnce();
  });

  it('blocks every action while a flow is in flight', () => {
    renderSignIn({ busy: true });

    expect(screen.getByRole('button', { name: /Continue with GitHub/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue without an account' })).toBeDisabled();
  });

  it('announces a failure assertively', () => {
    renderSignIn({ error: 'That address is not on an allowed domain' });
    expect(screen.getByRole('alert')).toHaveTextContent('not on an allowed domain');
  });
});

describe('Sign in anonymous route', () => {
  it('offers a way in with no account', () => {
    // Anonymous use is a product requirement; the artboard originally had no affordance for
    // it, so one was added to the Paper file and this is its implementation.
    renderSignIn();
    expect(screen.getByRole('button', { name: 'Continue without an account' })).toBeInTheDocument();
  });

  it('enters the app without an account', () => {
    const { onContinueWithoutAccount } = renderSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Continue without an account' }));
    expect(onContinueWithoutAccount).toHaveBeenCalledOnce();
  });

  it('states what the anonymous route costs', () => {
    // "Continue without an account" alone invites a user to pick it and then wonder why the
    // model picker is empty.
    renderSignIn();
    expect(screen.getByText(/Cortex models and cloud runtimes need an account/)).toBeInTheDocument();
  });

  it('sits after the legal copy, which governs the sign-in actions above it', () => {
    const { container } = renderSignIn();
    const legal = container.querySelector('.cx-auth__legal')!;
    const anonymous = container.querySelector('.cx-auth__anonymous')!;

    expect(legal.compareDocumentPosition(anonymous) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('Device code', () => {
  it('shows the code and where to enter it', () => {
    renderDeviceCode();

    expect(screen.getByText('TESTCODE')).toBeInTheDocument();
    expect(screen.getByText('https://auth.cortex.foundation/device')).toBeInTheDocument();
  });

  it('spells the code out for assistive technology', () => {
    // Read letter by letter it is transcribable; read as a word it is not.
    renderDeviceCode();
    expect(screen.getByLabelText('Device code T E S T C O D E')).toBeInTheDocument();
  });

  it('formats the expiry as minutes and seconds', () => {
    renderDeviceCode({ secondsRemaining: 900 });
    expect(screen.getByText('Expires in 15:00')).toBeInTheDocument();
  });

  it('pads the seconds', () => {
    renderDeviceCode({ secondsRemaining: 65 });
    expect(screen.getByText('Expires in 1:05')).toBeInTheDocument();
  });

  it('never shows a negative countdown', () => {
    renderDeviceCode({ secondsRemaining: -30 });
    expect(screen.getByText('Expires in 0:00')).toBeInTheDocument();
  });

  it('spins while waiting rather than claiming progress it cannot know', () => {
    // The wait has no known duration; a progress bar would make a promise about how much is
    // left that it cannot keep.
    const { container } = renderDeviceCode({ status: 'waiting' });
    expect(container.querySelector('.cx-device__spinner')).not.toBeNull();
  });

  it('stops spinning once the outcome is known', () => {
    const { container } = renderDeviceCode({ status: 'authorized' });
    expect(container.querySelector('.cx-device__spinner')).toBeNull();
  });

  it('announces the status politely, since the user is looking at their browser', () => {
    renderDeviceCode();
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for you to approve');
  });

  const outcomes: Array<[DeviceCodeStatus, string]> = [
    ['authorized', 'Approved'],
    ['denied', 'declined'],
    ['expired', 'expired'],
  ];

  for (const [status, copy] of outcomes) {
    it(`reports the ${status} outcome`, () => {
      renderDeviceCode({ status });
      expect(screen.getByRole('status')).toHaveTextContent(copy);
    });
  }

  it('offers browser, copy and cancel while waiting', () => {
    renderDeviceCode();

    expect(screen.getByRole('button', { name: 'Open browser' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('swaps to Start over once the flow is over', () => {
    // Copying a code that can no longer be redeemed would be a dead end.
    renderDeviceCode({ status: 'expired' });

    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy code' })).toBeNull();
  });

  it('hides the countdown once the flow is over', () => {
    renderDeviceCode({ status: 'expired', secondsRemaining: 0 });
    expect(screen.queryByText(/Expires in/)).toBeNull();
  });

  it('wires each action', () => {
    const { onOpenBrowser, onCopyCode, onCancel } = renderDeviceCode();

    fireEvent.click(screen.getByRole('button', { name: 'Open browser' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenBrowser).toHaveBeenCalledOnce();
    expect(onCopyCode).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('retries from the terminal states', () => {
    const { onRetry } = renderDeviceCode({ status: 'denied' });
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
