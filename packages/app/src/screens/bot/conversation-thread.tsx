import { For, Match, Show, Switch, type JSX } from 'solid-js';

import { HonestState } from '../shared/honest-state.tsx';
import { AskCard, SecretCard, SendToUserBubble, UserBubble, WorkRail } from './conversation-widgets.tsx';
import { visibleBubbles } from './message-bubbles.ts';
import {
  isPendingAsk,
  isPendingSecret,
  type BotMessage,
  type Mascot,
} from '../../state/bot-map.ts';

export function ConversationAlerts(props: {
  error?: string;
  blocked: boolean;
  work: NonNullable<BotMessage['work']>[];
}): JSX.Element {
  return (
    <>
      <Show when={props.error}>
        <HonestState kind="error" title="Could not send" body={props.error ?? ''} />
      </Show>
      <Show when={props.blocked}>
        <HonestState
          kind="error"
          title="Waiting on you"
          body="Answer the question or save the secret. The composer stays locked until then."
        />
      </Show>
      <Show when={props.work.length > 0}>
        <WorkRail items={props.work} />
      </Show>
    </>
  );
}

export function Composer(props: {
  draft: string;
  blocked: boolean;
  sending?: boolean;
  onDraft: (value: string) => void;
  onSend: () => void;
}): JSX.Element {
  return (
    <input
      class="cx-product-row"
      value={props.draft}
      disabled={props.blocked || props.sending}
      onInput={(event) => props.onDraft(event.currentTarget.value)}
      placeholder={props.blocked ? 'Answer the question above first' : 'Message this mascot'}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !props.blocked) props.onSend();
      }}
    />
  );
}

export function Thread(props: {
  name: string;
  messages: BotMessage[];
  onAnswer: (text: string, askId?: string) => void;
  onSecret: (name: string, value: string) => void;
}): JSX.Element {
  return (
    <Show
      when={props.messages.length > 0}
      fallback={
        <HonestState
          kind="empty"
          title="No messages yet"
          body="Talk to this mascot. Only what it sends to you appears here — tool traces stay in Work."
        />
      }
    >
      <div class="cx-product-list cx-bot-thread">
        <For each={props.messages}>
          {(message) => (
            <Turn name={props.name} message={message} onAnswer={props.onAnswer} onSecret={props.onSecret} />
          )}
        </For>
      </div>
    </Show>
  );
}

function Turn(props: {
  name: string;
  message: BotMessage;
  onAnswer: (text: string, askId?: string) => void;
  onSecret: (name: string, value: string) => void;
}): JSX.Element {
  return (
    <Switch fallback={<AssistantBubbles name={props.name} message={props.message} />}>
      <Match when={props.message.kind === 'user'}>
        <div class="cx-bot-bubbles">
          <For each={visibleBubbles(props.message)}>{(text) => <UserBubble text={text} />}</For>
        </div>
      </Match>
      <Match when={props.message.kind === 'ask_user' && props.message.ask}>
        {(ask) => (
          <AskCard ask={ask()} onAnswer={(text) => props.onAnswer(text, ask().id)} />
        )}
      </Match>
      <Match when={props.message.kind === 'secret' && props.message.secret}>
        {(secret) => <SecretCard secret={secret()} onSubmit={props.onSecret} />}
      </Match>
    </Switch>
  );
}

function AssistantBubbles(props: { name: string; message: BotMessage }): JSX.Element {
  const parts = () => visibleBubbles(props.message);
  return (
    <div class="cx-bot-bubbles" aria-label={`${props.name} said`}>
      <For each={parts()}>{(text) => <SendToUserBubble name={props.name} text={text} />}</For>
    </div>
  );
}

export function conversationBlocked(mascot: Mascot): boolean {
  return mascot.messages.some((message) => isPendingAsk(message) || isPendingSecret(message));
}

export function visibleMessages(mascot: Mascot): BotMessage[] {
  return mascot.messages.filter((message) => message.kind !== 'work');
}

export function workItems(mascot: Mascot): NonNullable<BotMessage['work']>[] {
  return mascot.messages.filter((message) => message.kind === 'work').map((message) => message.work!);
}
