import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { AskCard, SecretCard, SendToUserBubble, UserBubble } from './conversation-widgets.tsx';
import { ComputerRail } from './computer-rail.tsx';
import {
  computerLabel,
  isPendingAsk,
  isPendingSecret,
  type BotMessage,
  type ComputerRuntime,
  type Mascot,
} from '../../state/bot-map.ts';
import { splitEmployeeBubbles } from '../../state/bot-bubbles.ts';
import { resolveMascotMotion } from './mascot-looks.ts';
import { MascotMark } from './mascot-mark.tsx';
import type { ComputerInput } from '@cortex-ide/cortex-api';

import '../chat/product-pages.css';
import './bot-teammate.css';

function Missing(props: { onBack: () => void }): JSX.Element {
  return (
    <HonestState
      kind="error"
      title="Mascot not found"
      body="This mascot is not on the server."
      actionLabel="Back to Bot"
      onAction={props.onBack}
    />
  );
}

export function BotConversationScreen(props: {
  mascot?: Mascot;
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onAnswer: (text: string, askId?: string) => void;
  onSecret: (name: string, value: string) => void;
  onGo: (path: string) => void;
  onBack: () => void;
  sending?: boolean;
  celebrating?: boolean;
  onMarkSettled?: () => void;
  error?: string;
  screenshot?: string;
  streamUrl?: string;
  hasControl?: boolean;
  signedIn?: boolean;
  computerError?: string;
  onTakeControl?: () => void;
  onRelease?: () => void;
  onWake?: () => void;
  onRuntime?: (runtime: ComputerRuntime) => void;
  onInput?: (input: ComputerInput) => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => <ConversationBody mascot={mascot()} {...props} />}
    </Show>
  );
}

function ConversationBody(props: {
  mascot: Mascot;
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onAnswer: (text: string, askId?: string) => void;
  onSecret: (name: string, value: string) => void;
  sending?: boolean;
  celebrating?: boolean;
  onMarkSettled?: () => void;
  error?: string;
  screenshot?: string;
  streamUrl?: string;
  hasControl?: boolean;
  signedIn?: boolean;
  computerError?: string;
  onTakeControl?: () => void;
  onRelease?: () => void;
  onWake?: () => void;
  onRuntime?: (runtime: ComputerRuntime) => void;
  onInput?: (input: ComputerInput) => void;
}): JSX.Element {
  const blocked = () =>
    props.mascot.messages.some((message) => isPendingAsk(message) || isPendingSecret(message));

  return (
    <div class="cx-bot-workbench">
      <ThreadColumn mascot={props.mascot} blocked={blocked()} {...props} />
      <ComputerRail
        mascot={props.mascot}
        screenshot={props.screenshot}
        streamUrl={props.streamUrl}
        hasControl={props.hasControl === true}
        signedIn={props.signedIn}
        error={props.computerError}
        onTakeControl={() => props.onTakeControl?.()}
        onRelease={() => props.onRelease?.()}
        onWake={() => props.onWake?.()}
        onRuntime={(runtime) => props.onRuntime?.(runtime)}
        onInput={(input) => props.onInput?.(input)}
      />
    </div>
  );
}

function ThreadColumn(props: {
  mascot: Mascot;
  blocked: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onAnswer: (text: string, askId?: string) => void;
  onSecret: (name: string, value: string) => void;
  sending?: boolean;
  celebrating?: boolean;
  onMarkSettled?: () => void;
  error?: string;
}): JSX.Element {
  return (
    <div class="cx-bot-workbench__thread">
      <ConversationHeader {...props} />
      <Thread
        name={props.mascot.name}
        messages={props.mascot.messages.filter((message) => message.kind !== 'work')}
        onAnswer={props.onAnswer}
        onSecret={props.onSecret}
      />
      <Composer
        draft={props.draft}
        blocked={props.blocked}
        sending={props.sending}
        onDraft={props.onDraft}
        onSend={props.onSend}
      />
    </div>
  );
}

function ConversationHeader(props: {
  mascot: Mascot;
  blocked: boolean;
  sending?: boolean;
  celebrating?: boolean;
  onMarkSettled?: () => void;
  error?: string;
}): JSX.Element {
  return (
    <>
      <PageHeader
        title={props.mascot.name}
        subtitle={computerLabel(props.mascot.computer)}
        mark={
          <ConversationMark
            mascot={props.mascot}
            blocked={props.blocked}
            sending={props.sending}
            celebrating={props.celebrating}
            onSettled={props.onMarkSettled}
          />
        }
      />
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
    </>
  );
}

function ConversationMark(props: {
  mascot: Mascot;
  blocked: boolean;
  sending?: boolean;
  celebrating?: boolean;
  onSettled?: () => void;
}): JSX.Element {
  return (
    <MascotMark
      look={props.mascot.look}
      face={props.mascot.face}
      seed={props.mascot.id}
      size={48}
      state={resolveMascotMotion({
        computer: props.mascot.computer.status,
        unread: props.mascot.unread || props.blocked,
        sending: props.sending,
        celebrating: props.celebrating,
      })}
      onSettled={props.onSettled}
    />
  );
}

function Composer(props: {
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

function Thread(props: {
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
          body="Talk to this mascot. Only what it sends to you appears here."
        />
      }
    >
      <div class="cx-teammate-thread" aria-label="Conversation">
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
  const message = props.message;
  if (message.kind === 'user') return <UserBubble text={message.content} />;
  if (message.kind === 'ask_user' && message.ask) {
    return <AskCard ask={message.ask} onAnswer={(text) => props.onAnswer(text, message.ask?.id)} />;
  }
  if (message.kind === 'secret' && message.secret) {
    return <SecretCard secret={message.secret} onSubmit={props.onSecret} />;
  }
  return (
    <For each={splitEmployeeBubbles(message.content)}>
      {(bubble) => <SendToUserBubble name={props.name} message={{ ...message, content: bubble }} />}
    </For>
  );
}
