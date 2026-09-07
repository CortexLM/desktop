/**
 * Code tickets — the queue a session gets started from.
 *
 * There was no tickets surface at all: the only hits for "ticket" in the repo were
 * a Bot VNC signalling ticket and an internal orchestration metric. A ticket is the
 * unit of queued work: a title, a body, a repository, and — once someone starts it
 * — the session that is doing it.
 *
 * `sessionId` is what keeps this from being a second inbox. A ticket links into the
 * workbench rather than duplicating its state, so a run's status has exactly one
 * home.
 */

import {
  createCodeTicket,
  deleteCodeTicket,
  getCodeTicket,
  listCodeTickets,
  patchCodeTicket,
  type ApiCodeTicket,
  describeWorkspaceError,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import { createRemoteCollection, type RemoteState } from './remote-collection.ts';
import { createSignal } from 'solid-js';

export type TicketStatus = 'open' | 'in_progress' | 'done' | 'closed';

export interface CodeTicket {
  id: string;
  title: string;
  body: string;
  status: TicketStatus;
  repository?: string;
  sessionId?: string;
}

const STATUSES: readonly TicketStatus[] = ['open', 'in_progress', 'done', 'closed'];

/** Falls back to `open`: an unrecognised status is still work someone queued. */
function toStatus(value: string | undefined): TicketStatus {
  return STATUSES.find((status) => status === value) ?? 'open';
}

export function toCodeTicket(row: ApiCodeTicket): CodeTicket {
  const ticket: CodeTicket = {
    id: row.id,
    title: row.title ?? 'Ticket',
    body: row.body ?? '',
    status: toStatus(row.status),
  };
  if (row.repository) ticket.repository = row.repository;
  if (row.session_id) ticket.sessionId = row.session_id;
  return ticket;
}

const collection = createRemoteCollection<CodeTicket>({
  label: 'Tickets',
  load: async (client) => (await listCodeTickets(client)).map(toCodeTicket),
});

export const tickets = collection.items;
export const ticketsState = collection.state;
export const ticketsError = collection.error;
export const loadTickets = collection.reload;

export function addTicket(input: {
  title: string;
  body?: string;
  repository?: string;
}): Promise<void> {
  return collection.mutate((client) =>
    createCodeTicket(client, {
      title: input.title,
      ...(input.body ? { body: input.body } : {}),
      ...(input.repository ? { repository: input.repository } : {}),
    }),
  );
}

export function setTicketStatus(id: string, status: TicketStatus): Promise<void> {
  return collection.mutate((client) => patchCodeTicket(client, id, { status }));
}

export function removeTicket(id: string): Promise<void> {
  return collection.mutate((client) => deleteCodeTicket(client, id));
}

/* ------------------------------------------------------------------------- */
/* One ticket                                                               */
/* ------------------------------------------------------------------------- */

const [openTicket, setOpenTicket] = createSignal<CodeTicket | undefined>();
const [ticketState, setTicketState] = createSignal<RemoteState>('idle');
const [ticketError, setTicketError] = createSignal('');

export { openTicket, ticketState, ticketError };

export async function loadTicket(id: string): Promise<void> {
  const client = botClient();
  if (!client) {
    setOpenTicket(undefined);
    setTicketState('disconnected');
    setTicketError('Tickets need a connection to Cortex.');
    return;
  }

  setTicketState('loading');
  setTicketError('');
  try {
    setOpenTicket(toCodeTicket(await getCodeTicket(client, id)));
    setTicketState('ready');
  } catch (error) {
    setOpenTicket(undefined);
    setTicketState('error');
    setTicketError(describeWorkspaceError(error));
  }
}

export async function saveTicket(
  id: string,
  patch: { title?: string; body?: string },
): Promise<void> {
  const client = botClient();
  if (!client) throw new Error('Tickets need a connection to Cortex.');
  await patchCodeTicket(client, id, patch);
  await loadTicket(id);
}

export function resetTicketsForTests(): void {
  collection.reset();
  setOpenTicket(undefined);
  setTicketState('idle');
  setTicketError('');
}
