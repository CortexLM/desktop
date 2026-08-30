import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { ANONYMOUS_CAPABILITIES, AUTHENTICATED_CAPABILITIES } from '@cortex-ide/cortex-api';

import { FirstBotSetup } from '../first-bot-setup.tsx';
import { computerHostOptions } from '../computer-host.ts';

const hostsSignedInWeb = computerHostOptions(AUTHENTICATED_CAPABILITIES, 'browser');
const hostsGuestDesktop = computerHostOptions(ANONYMOUS_CAPABILITIES, 'electron');

describe('FirstBotSetup', () => {
  it('creates a named mascot on an unlocked host and invents no teammate', () => {
    const onCreate = vi.fn();
    const onName = vi.fn();
    render(() => (
      <FirstBotSetup
        name=""
        onName={onName}
        look="meadow"
        onLook={vi.fn()}
        face="idle"
        onFace={vi.fn()}
        computerKind="cloud"
        onComputerKind={vi.fn()}
        hosts={hostsSignedInWeb}
        onCreate={onCreate}
      />
    ));
    expect(screen.getByText('Create your first mascot')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Name this teammate')).toBeInTheDocument();
    expect(screen.queryByText(/Sprite|Finch|Pebble/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Create mascot/ })).toBeDisabled();
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Scout' } });
    expect(onName).toHaveBeenCalledWith('Scout');
  });

  it('enables create once a name and unlocked host are set', () => {
    const onCreate = vi.fn();
    render(() => (
      <FirstBotSetup
        name="Scout"
        onName={vi.fn()}
        look="meadow"
        onLook={vi.fn()}
        face="idle"
        onFace={vi.fn()}
        computerKind="cloud"
        onComputerKind={vi.fn()}
        hosts={hostsSignedInWeb}
        onCreate={onCreate}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: /Create mascot/ }));
    expect(onCreate).toHaveBeenCalled();
  });

  it('locks the signed-out roster instead of inventing mascots', () => {
    const onSignIn = vi.fn();
    render(() => (
      <FirstBotSetup
        name=""
        onName={vi.fn()}
        look="meadow"
        onLook={vi.fn()}
        face="idle"
        onFace={vi.fn()}
        onComputerKind={vi.fn()}
        hosts={hostsGuestDesktop}
        onCreate={vi.fn()}
        signedOut
        onSignIn={onSignIn}
      />
    ));
    expect(screen.getByText('Bot needs a Cortex account')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
  });
});
