import { fireEvent, render, screen } from '@solidjs/testing-library';
import { describe, expect, it, vi } from 'vitest';

import { RuntimesScreen, type RuntimesScreenProps } from '../runtimes-screen.tsx';
import {
  TicketDetailScreen,
  TicketsScreen,
  type TicketsScreenProps,
} from '../tickets-screens.tsx';
import type { CodeTicket } from '../../../state/tickets.ts';

function runtimesProps(overrides: Partial<RuntimesScreenProps> = {}): RuntimesScreenProps {
  return {
    hosts: [{ id: 'h1', name: 'ana-mbp', status: 'online', url: 'https://code.internal' }],
    hostsState: 'ready',
    runtimes: [{ id: 's1', label: 'deploy@build-01', status: 'unknown' }],
    runtimesState: 'ready',
    signedIn: true,
    onPair: vi.fn(),
    onDismissCode: vi.fn(),
    onUnpair: vi.fn(),
    onAddSsh: vi.fn(),
    onRemoveSsh: vi.fn(),
    onReload: vi.fn(),
    onSignIn: vi.fn(),
    ...overrides,
  };
}

describe('RuntimesScreen', () => {
  it('lists paired machines and registered servers', () => {
    render(() => <RuntimesScreen {...runtimesProps()} />);

    expect(screen.getByText('ana-mbp')).toBeInTheDocument();
    expect(screen.getByText(/Online/)).toBeInTheDocument();
    expect(screen.getByText('deploy@build-01')).toBeInTheDocument();
    // An unknown status is reported as unknown, not as offline.
    expect(screen.getByText(/Status unknown/)).toBeInTheDocument();
    expect((document.body.textContent ?? '').toLowerCase()).not.toMatch(/\bthis pc\b|\bthis desktop\b/);
  });

  it('shows a pairing code with where to type it', () => {
    const onDismissCode = vi.fn();
    render(() => (
      <RuntimesScreen {...runtimesProps({ pairingCode: 'PAIR-1234', onDismissCode })} />
    ));

    expect(screen.getByText('PAIR-1234')).toBeInTheDocument();
    // A code with no destination is the same as no code.
    expect(screen.getByText(/On the machine running Cortex Code/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDismissCode).toHaveBeenCalled();
  });

  it('registers a server without asking for a key or password', () => {
    const onAddSsh = vi.fn();
    render(() => <RuntimesScreen {...runtimesProps({ onAddSsh })} />);

    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/key/i)).not.toBeInTheDocument();

    fireEvent.input(screen.getByLabelText('SSH host'), { target: { value: 'build-02' } });
    fireEvent.input(screen.getByLabelText('SSH user'), { target: { value: 'deploy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add server' }));

    expect(onAddSsh).toHaveBeenCalledWith({ host: 'build-02', user: 'deploy', port: 22 });
  });

  it('does not submit an incomplete server', () => {
    const onAddSsh = vi.fn();
    render(() => <RuntimesScreen {...runtimesProps({ onAddSsh })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add server' }));
    expect(onAddSsh).not.toHaveBeenCalled();
  });

  it('unpairs and removes', () => {
    const onUnpair = vi.fn();
    const onRemoveSsh = vi.fn();
    render(() => <RuntimesScreen {...runtimesProps({ onUnpair, onRemoveSsh })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Unpair' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onUnpair).toHaveBeenCalledWith('h1');
    expect(onRemoveSsh).toHaveBeenCalledWith('s1');
  });

  it('gates on an account, because a paired machine is registered against one', () => {
    const onSignIn = vi.fn();
    render(() => <RuntimesScreen {...runtimesProps({ signedIn: false, onSignIn })} />);

    expect(screen.getByText('Runtimes need a Cortex account')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pair a machine' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('offers pairing from the empty state and reports a pairing failure', () => {
    const onPair = vi.fn();
    render(() => (
      <RuntimesScreen
        {...runtimesProps({
          hosts: [],
          hostsState: 'empty',
          pairingError: 'This Cortex backend cannot pair a Code host yet.',
          onPair,
        })}
      />
    ));

    expect(screen.getByText('No paired machines')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/cannot pair a Code host/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Pair a machine' })[1]!);
    expect(onPair).toHaveBeenCalled();
  });

  it('reports a missing hosts route rather than no machines', () => {
    render(() => (
      <RuntimesScreen
        {...runtimesProps({
          hosts: [],
          hostsState: 'unsupported',
          hostsError: 'Cortex Code hosts is not available on this Cortex backend yet.',
        })}
      />
    ));

    expect(screen.getByText('Cortex Code hosts is not on this backend')).toBeInTheDocument();
    expect(screen.queryByText('No paired machines')).not.toBeInTheDocument();
  });
});

const TICKET: CodeTicket = {
  id: 't1',
  title: 'Fix auth',
  body: 'the refresh path 401s',
  status: 'open',
  repository: 'cortex/app',
};

function ticketsProps(overrides: Partial<TicketsScreenProps> = {}): TicketsScreenProps {
  return {
    tickets: [TICKET],
    state: 'ready',
    signedIn: true,
    onAdd: vi.fn(),
    onOpen: vi.fn(),
    onStart: vi.fn(),
    onOpenSession: vi.fn(),
    onRetry: vi.fn(),
    onSignIn: vi.fn(),
    ...overrides,
  };
}

describe('TicketsScreen', () => {
  it('lists tickets and starts one', () => {
    const onStart = vi.fn();
    const onOpen = vi.fn();
    render(() => <TicketsScreen {...ticketsProps({ onStart, onOpen })} />);

    expect(screen.getByText('Fix auth')).toBeInTheDocument();
    expect(screen.getByText(/Open · cortex\/app/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(onStart).toHaveBeenCalledWith(TICKET);
    fireEvent.click(screen.getByText('Fix auth'));
    expect(onOpen).toHaveBeenCalledWith('t1');
  });

  it('links to the run instead of offering to start a second one', () => {
    const onStart = vi.fn();
    const onOpenSession = vi.fn();
    render(() => (
      <TicketsScreen
        {...ticketsProps({
          tickets: [{ ...TICKET, status: 'in_progress', sessionId: 'ses_9' }],
          onStart,
          onOpenSession,
        })}
      />
    ));

    expect(screen.queryByRole('button', { name: 'Start session' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open session' }));
    expect(onOpenSession).toHaveBeenCalledWith('ses_9');
    expect(onStart).not.toHaveBeenCalled();
  });

  it('adds a ticket and ignores an empty one', () => {
    const onAdd = vi.fn();
    render(() => <TicketsScreen {...ticketsProps({ onAdd })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add ticket' }));
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.input(screen.getByLabelText('Ticket title'), { target: { value: '  Fix lint  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add ticket' }));
    expect(onAdd).toHaveBeenCalledWith('Fix lint');
  });

  it('gates on an account and reports its own states', () => {
    const onSignIn = vi.fn();
    const gated = render(() => (
      <TicketsScreen {...ticketsProps({ signedIn: false, onSignIn })} />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignIn).toHaveBeenCalled();
    gated.unmount();

    const empty = render(() => <TicketsScreen {...ticketsProps({ tickets: [], state: 'empty' })} />);
    expect(screen.getByText('No tickets')).toBeInTheDocument();
    empty.unmount();

    render(() => (
      <TicketsScreen
        {...ticketsProps({
          tickets: [],
          state: 'unsupported',
          error: 'Tickets is not available on this Cortex backend yet.',
        })}
      />
    ));
    expect(screen.getByText('Tickets is not on this backend')).toBeInTheDocument();
  });
});

describe('TicketDetailScreen', () => {
  it('edits a ticket and saves the pair together', () => {
    const onSave = vi.fn();
    render(() => (
      <TicketDetailScreen
        ticket={TICKET}
        state="ready"
        onSave={onSave}
        onStart={vi.fn()}
        onOpenSession={vi.fn()}
        onBack={vi.fn()}
      />
    ));

    fireEvent.input(screen.getByLabelText('Ticket detail'), { target: { value: 'more detail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save ticket' }));

    expect(onSave).toHaveBeenCalledWith({ title: 'Fix auth', body: 'more detail' });
  });

  it('distinguishes loading from a ticket that is not there', () => {
    const loading = render(() => (
      <TicketDetailScreen
        state="loading"
        onSave={vi.fn()}
        onStart={vi.fn()}
        onOpenSession={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    expect(screen.getByText('Opening ticket')).toBeInTheDocument();
    loading.unmount();

    const onBack = vi.fn();
    render(() => (
      <TicketDetailScreen
        state="error"
        error="Nope."
        onSave={vi.fn()}
        onStart={vi.fn()}
        onOpenSession={vi.fn()}
        onBack={onBack}
      />
    ));
    expect(screen.getByText('Ticket not found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to tickets' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('starts a run from the detail header', () => {
    const onStart = vi.fn();
    render(() => (
      <TicketDetailScreen
        ticket={TICKET}
        state="ready"
        onSave={vi.fn()}
        onStart={onStart}
        onOpenSession={vi.fn()}
        onBack={vi.fn()}
      />
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));
    expect(onStart).toHaveBeenCalledWith(TICKET);
  });
});
