import { createEffect, createResource, createSignal, For, type JSX, Show } from 'solid-js';

import { Composer, Icon } from '@cortex-ide/ui';
import type { ChatMessage } from '@cortex-ide/shared';

import type { ConversationsContextValue } from '../../state/conversations-context.tsx';

import './conversation.css';

export interface ConversationScreenProps {
  conversationId: () => string;
  chats: ConversationsContextValue;
}

function UserTurn(props: { message: ChatMessage }): JSX.Element {
  return <div class="cx-conversation__user">{props.message.content}</div>;
}

function Turn(props: { message: ChatMessage; onCopy: (text: string) => void }): JSX.Element {
  return (
    <Show when={props.message.role === 'assistant'} fallback={<UserTurn message={props.message} />}>
      <AssistantTurn message={props.message} onCopy={props.onCopy} />
    </Show>
  );
}

function AssistantTurn(props: { message: ChatMessage; onCopy: (text: string) => void }): JSX.Element {
  return (
    <>
      <div class="cx-conversation__assistant">{props.message.content}</div>
      <div class="cx-conversation__actions">
        <button
          type="button"
          class="cx-conversation__action"
          onClick={() => props.onCopy(props.message.content)}
        >
          <Icon name="copy" size={13} strokeWidth={1.75} />
          Copy
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

  return (
    <div class="cx-conversation">
      <div class="cx-conversation__thread" ref={thread}>
        <For each={detail()?.messages ?? []}>{(message) => <Turn message={message} onCopy={copy} />}</For>
        <LiveTail text={live} />
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
