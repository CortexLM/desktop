import { createEffect, createResource, createSignal, For, type JSX, Show } from 'solid-js';

import { describeWorkspaceError } from '@cortex-ide/cortex-api';
import { Composer, Icon } from '@cortex-ide/ui';
import type { ChatMessage } from '@cortex-ide/shared';

import type { ConversationsContextValue } from '../../state/conversations-context.tsx';
import { saveToLibrary } from '../../state/library.ts';

import './conversation.css';

/** The first non-empty line, capped. What a library row is recognised by. */
function firstLine(text: string): string {
  const line = text.split('\n').find((entry) => entry.trim().length > 0) ?? 'Saved answer';
  return line.trim().slice(0, 80);
}

export interface ConversationScreenProps {
  conversationId: () => string;
  chats: ConversationsContextValue;
}

function UserTurn(props: { message: ChatMessage }): JSX.Element {
  return <div class="cx-conversation__user">{props.message.content}</div>;
}

interface TurnActions {
  onCopy: (text: string) => void;
  onSave: (text: string) => void;
  /** Set once this turn has been saved, so the control reports what it did. */
  saved: boolean;
}

function Turn(props: { message: ChatMessage; actions: TurnActions }): JSX.Element {
  return (
    <Show when={props.message.role === 'assistant'} fallback={<UserTurn message={props.message} />}>
      <AssistantTurn message={props.message} actions={props.actions} />
    </Show>
  );
}

/**
 * An assistant turn and what can be done with it.
 *
 * "Save" is the control the Library screen's copy has always promised ("Save an
 * answer from a conversation and it will land here") and that nothing provided:
 * `addLibraryItem` existed in the store and had no caller, so the library was
 * permanently empty by construction.
 */
function AssistantTurn(props: { message: ChatMessage; actions: TurnActions }): JSX.Element {
  return (
    <>
      <div class="cx-conversation__assistant">{props.message.content}</div>
      <div class="cx-conversation__actions">
        <button
          type="button"
          class="cx-conversation__action"
          onClick={() => props.actions.onCopy(props.message.content)}
        >
          <Icon name="copy" size={13} strokeWidth={1.75} />
          Copy
        </button>
        <button
          type="button"
          class="cx-conversation__action"
          disabled={props.actions.saved}
          onClick={() => props.actions.onSave(props.message.content)}
        >
          <Icon name="docs" size={13} strokeWidth={1.75} />
          {props.actions.saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </>
  );
}

/** The live tail: "Thinking…" until the first token, then the streaming text. */
function LiveTail(props: { text: () => string | undefined }): JSX.Element {
  return (
    <Show when={props.text() !== undefined}>
      <Show
        when={props.text() !== ''}
        fallback={
          <div class="cx-conversation__thinking" role="status">
            <span class="cx-conversation__thinking-dot" aria-hidden="true" />
            Thinking…
          </div>
        }
      >
        <div class="cx-conversation__assistant" aria-live="polite">
          {props.text()}
          <span class="cx-conversation__caret" aria-hidden="true" />
        </div>
      </Show>
    </Show>
  );
}

/**
 * Saving answers to the account library.
 *
 * Tracks which turns have been saved so the control can report what it did rather
 * than staying clickable and giving no sign either way.
 */
interface LibrarySaves {
  save: (text: string) => void;
  isSaved: (text: string) => boolean;
  error: () => string;
}

function useLibrarySaves(conversationId: () => string): LibrarySaves {
  const [saved, setSaved] = createSignal<readonly string[]>([]);
  const [error, setError] = createSignal('');

  return {
    isSaved: (text) => saved().includes(text),
    error,
    /**
     * The title is the answer's first line, trimmed: a library row needs something
     * recognisable, and asking for a title would put a dialog between the user and
     * a one-click action.
     */
    save: (text) => {
      setError('');
      void saveToLibrary({
        title: firstLine(text),
        kind: 'answer',
        excerpt: text.slice(0, 280),
        conversationId: conversationId(),
      })
        .then(() => setSaved((current) => [...current, text]))
        .catch((caught: unknown) => setError(describeWorkspaceError(caught)));
    },
  };
}

function Thread(props: {
  messages: readonly ChatMessage[];
  live: () => string | undefined;
  onCopy: (text: string) => void;
  library: LibrarySaves;
}): JSX.Element {
  return (
    <>
      <For each={props.messages}>
        {(message) => (
          <Turn
            message={message}
            actions={{
              onCopy: props.onCopy,
              onSave: props.library.save,
              saved: props.library.isSaved(message.content),
            }}
          />
        )}
      </For>
      <LiveTail text={props.live} />
      <Show when={props.library.error()}>
        <p class="cx-conversation__error" role="alert">{props.library.error()}</p>
      </Show>
    </>
  );
}

/**
 * One conversation: the stored turns, the live tail while a reply streams, and
 * the follow-up composer pinned beneath the reading column.
 */
export function ConversationScreen(props: ConversationScreenProps): JSX.Element {
  const [followUp, setFollowUp] = createSignal('');
  let thread: HTMLDivElement | undefined;

  // Re-reads the thread whenever the store says it changed on disk (a reply
  // finished, a follow-up was appended) or the route points at another thread.
  const [detail] = createResource(
    () => `${props.conversationId()}:${props.chats.revision()}`,
    () => props.chats.detail(props.conversationId()),
    { initialValue: null },
  );

  const live = () => props.chats.streamed(props.conversationId());

  // Follows the stream: new tokens keep the tail in view. Deliberate reads —
  // the effect re-runs when either the tail or the thread grows.
  createEffect(() => {
    live();
    detail();
    thread?.scrollTo({ top: thread.scrollHeight });
  });

  const send = async () => {
    const text = followUp().trim();
    if (!text) return;
    setFollowUp('');
    await props.chats.send(props.conversationId(), text);
  };

  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
  };

  const library = useLibrarySaves(props.conversationId);

  return (
    <div class="cx-conversation">
      <div class="cx-conversation__thread" ref={thread}>
        <Thread
          messages={detail()?.messages ?? []}
          live={live}
          onCopy={copy}
          library={library}
        />
      </div>

      <Composer
        class="cx-conversation__composer"
        value={followUp()}
        onValueChange={setFollowUp}
        onSubmit={() => void send()}
        placeholder="Ask a follow-up…"
        sendLabel="Send"
        disabled={props.chats.replying(props.conversationId())}
        disabledReason="Wait for the current reply to finish"
        modelLabel={props.chats.modelLabel()}
      />
    </div>
  );
}
