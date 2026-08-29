/**
 * Runtimes and tickets.
 *
 * Runtimes is where the browser stops pretending it can run a harness and instead
 * connects the machine that can. Tickets is the queue a session is started from.
 */

import { createEffect, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import { useAccount } from '../state/session-context.tsx';
import { useSessions } from '../state/sessions-context.tsx';
import {
  addSshRuntime,
  clearPairingCode,
  codeHosts,
  codeHostsError,
  codeHostsState,
  loadCodeHosts,
  loadSshRuntimes,
  pairingCode,
  pairingError,
  removeHost,
  removeSshRuntime,
  sshRuntimes,
  sshRuntimesError,
  sshRuntimesState,
  startPairing,
} from '../state/code-hosts.ts';
import {
  addTicket,
  loadTicket,
  loadTickets,
  openTicket,
  saveTicket,
  setTicketStatus,
  ticketError,
  ticketsError,
  ticketsState,
  tickets,
  ticketState,
  type CodeTicket,
} from '../state/tickets.ts';
import { RuntimesScreen } from '../screens/code/runtimes-screen.tsx';
import { TicketDetailScreen, TicketsScreen } from '../screens/code/tickets-screens.tsx';

export function RuntimesRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();

  createEffect(() => {
    if (!account.capabilities().authenticated) return;
    void loadCodeHosts();
    void loadSshRuntimes();
  });

  return (
    <RuntimesScreen
      hosts={codeHosts()}
      hostsState={codeHostsState()}
      hostsError={codeHostsError()}
      runtimes={sshRuntimes()}
      runtimesState={sshRuntimesState()}
      runtimesError={sshRuntimesError()}
      pairingCode={pairingCode()}
      pairingError={pairingError()}
      signedIn={account.capabilities().authenticated}
      onPair={() => void startPairing()}
      onDismissCode={clearPairingCode}
      onUnpair={(id) => void removeHost(id)}
      onAddSsh={(target) => void addSshRuntime(target)}
      onRemoveSsh={(id) => void removeSshRuntime(id)}
      onReload={() => {
        void loadCodeHosts();
        void loadSshRuntimes();
      }}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

/**
 * Starts a run for a ticket.
 *
 * The ticket's own status is moved to `in_progress` after the session starts, not
 * before: a ticket marked in progress for a run that failed to start would be
 * reporting work nobody is doing.
 */
function useStartTicket(): (ticket: CodeTicket) => void {
  const runs = useSessions();
  const navigate = useNavigate();

  return (ticket) => {
    void (async () => {
      const started = await runs.start({
        prompt: ticket.body?.trim() ? `${ticket.title}\n\n${ticket.body}` : ticket.title,
        runtime: 'cloud',
        ...(ticket.repository ? { repo: ticket.repository } : {}),
      });
      if (!started) return;
      await setTicketStatus(ticket.id, 'in_progress').catch(() => {});
      navigate(`/code/sessions/${started.id}`);
    })();
  };
}

export function TicketsRoute(): JSX.Element {
  const account = useAccount();
  const navigate = useNavigate();
  const start = useStartTicket();

  createEffect(() => {
    if (account.capabilities().authenticated) void loadTickets();
  });

  return (
    <TicketsScreen
      tickets={tickets()}
      state={ticketsState()}
      error={ticketsError()}
      signedIn={account.capabilities().authenticated}
      onAdd={(title) => void addTicket({ title })}
      onOpen={(id) => navigate(`/code/tickets/${id}`)}
      onStart={start}
      onOpenSession={(sessionId) => navigate(`/code/sessions/${sessionId}`)}
      onRetry={() => void loadTickets()}
      onSignIn={() => navigate('/sign-in')}
    />
  );
}

export function TicketDetailRoute(): JSX.Element {
  const params = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const start = useStartTicket();

  createEffect(() => {
    void loadTicket(params.ticketId);
  });

  return (
    <TicketDetailScreen
      ticket={openTicket()}
      state={ticketState()}
      error={ticketError()}
      onSave={(patch) => void saveTicket(params.ticketId, patch)}
      onStart={start}
      onOpenSession={(sessionId) => navigate(`/code/sessions/${sessionId}`)}
      onBack={() => navigate('/code/tickets')}
    />
  );
}
