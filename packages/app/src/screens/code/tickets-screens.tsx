import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { RemoteStateView } from '../shared/remote-state-view.tsx';
import type { CodeTicket, TicketStatus } from '../../state/tickets.ts';
import type { RemoteState } from '../../state/remote-collection.ts';

import '../chat/product-pages.css';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  closed: 'Closed',
};

function NewTicketForm(props: { onAdd: (title: string) => void }): JSX.Element {
  const [title, setTitle] = createSignal('');

  return (
    <form
      class="cx-product-form"
      onSubmit={(event) => {
        event.preventDefault();
        const value = title().trim();
        if (!value) return;
        props.onAdd(value);
        setTitle('');
      }}
    >
      <input
        type="text"
        value={title()}
        placeholder="What needs doing?"
        aria-label="Ticket title"
        onInput={(event) => setTitle(event.currentTarget.value)}
      />
      <Button variant="primary" type="submit">Add ticket</Button>
    </form>
  );
}

export interface TicketsScreenProps {
  tickets: readonly CodeTicket[];
  state: RemoteState;
  error?: string;
  signedIn: boolean;
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  /** Starts a Code session for the ticket. Absent while one is already running. */
  onStart: (ticket: CodeTicket) => void;
  onOpenSession: (sessionId: string) => void;
  onRetry: () => void;
  onSignIn: () => void;
}

export function TicketsScreen(props: TicketsScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Tickets"
        subtitle="Work queued for Code. Start one and it becomes a session."
      />
      <PageBody width="list">
        <Show
          when={props.signedIn}
          fallback={
            <HonestState
              kind="signed-out"
              title="Tickets need a Cortex account"
              body="A ticket is queued work on your account, so it is there when you come back to it."
              actionLabel="Sign in"
              onAction={props.onSignIn}
            />
          }
        >
          <NewTicketForm onAdd={props.onAdd} />
          <RemoteStateView
            state={props.state}
            {...(props.error ? { error: props.error } : {})}
            label="Tickets"
            emptyTitle="No tickets"
            emptyBody="Add work you want Code to pick up. Nothing is queued until you do."
            onRetry={props.onRetry}
          >
            <div class="cx-product-list">
              <For each={props.tickets}>
                {(ticket) => (
                  <div class="cx-product-row" data-ticket={ticket.id}>
                    <button
                      type="button"
                      class="cx-product-row__open"
                      onClick={() => props.onOpen(ticket.id)}
                    >
                      <div class="cx-product-row__title">{ticket.title}</div>
                      <p class="cx-product-row__meta">
                        {STATUS_LABEL[ticket.status]}
                        {ticket.repository ? ` · ${ticket.repository}` : ''}
                      </p>
                    </button>
                    <div class="cx-product-row__action">
                      {/* Once a run exists the ticket links to it rather than
                          offering to start a second one for the same work. */}
                      <Show
                        when={ticket.sessionId}
                        fallback={
                          <Button variant="primary" onClick={() => props.onStart(ticket)}>
                            Start session
                          </Button>
                        }
                      >
                        {(sessionId) => (
                          <Button variant="secondary" onClick={() => props.onOpenSession(sessionId())}>
                            Open session
                          </Button>
                        )}
                      </Show>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </RemoteStateView>
        </Show>
      </PageBody>
    </>
  );
}

export interface TicketDetailScreenProps {
  ticket?: CodeTicket;
  state: RemoteState;
  error?: string;
  onSave: (patch: { title: string; body: string }) => void;
  onStart: (ticket: CodeTicket) => void;
  onOpenSession: (sessionId: string) => void;
  onBack: () => void;
}

export function TicketDetailScreen(props: TicketDetailScreenProps): JSX.Element {
  const [title, setTitle] = createSignal<string | undefined>();
  const [body, setBody] = createSignal<string | undefined>();

  return (
    <Show
      when={props.ticket}
      fallback={
        <Show
          when={props.state !== 'loading' && props.state !== 'idle'}
          fallback={<HonestState kind="loading" title="Opening ticket" body="Reading the ticket." />}
        >
          <HonestState
            kind="error"
            title="Ticket not found"
            body={props.error || 'This ticket is not on your account.'}
            actionLabel="Back to tickets"
            onAction={props.onBack}
          />
        </Show>
      }
    >
      {(ticket) => (
        <>
          <PageHeader
            title={ticket().title}
            subtitle={STATUS_LABEL[ticket().status]}
            actions={
              <Show
                when={ticket().sessionId}
                fallback={
                  <Button variant="primary" onClick={() => props.onStart(ticket())}>
                    Start session
                  </Button>
                }
              >
                {(sessionId) => (
                  <Button variant="secondary" onClick={() => props.onOpenSession(sessionId())}>
                    Open session
                  </Button>
                )}
              </Show>
            }
          />
          <PageBody width="list">
            <form
              class="cx-ticket-form"
              onSubmit={(event) => {
                event.preventDefault();
                props.onSave({
                  title: title() ?? ticket().title,
                  body: body() ?? ticket().body,
                });
              }}
            >
              <input
                type="text"
                value={title() ?? ticket().title}
                aria-label="Ticket title"
                onInput={(event) => setTitle(event.currentTarget.value)}
              />
              <textarea
                rows={8}
                value={body() ?? ticket().body}
                aria-label="Ticket detail"
                placeholder="What should the agent know before it starts?"
                onInput={(event) => setBody(event.currentTarget.value)}
              />
              <Button variant="secondary" type="submit">Save ticket</Button>
            </form>
          </PageBody>
        </>
      )}
    </Show>
  );
}
