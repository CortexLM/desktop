import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { AskCard, SecretCard, SendToUserBubble, UserBubble, WorkRail } from './conversation-widgets.tsx';
import { MascotRail, mascotLinks } from './mascot-rail.tsx';
import {
  isPendingAsk,
  isPendingSecret,
  type BotMessage,
  type Mascot,
} from '../../state/bot-map.ts';

import '../chat/product-pages.css';

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
  error?: string;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <ConversationBody
          mascot={mascot()}
          draft={props.draft}
          onDraft={props.onDraft}
          onSend={props.onSend}
          onAnswer={props.onAnswer}
          onSecret={props.onSecret}
          onGo={props.onGo}
          sending={props.sending}
          error={props.error}
        />
      )}
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
  onGo: (path: string) => void;
  sending?: boolean;
  error?: string;
}): JSX.Element {
  const blocked = () =>
    props.mascot.messages.some((message) => isPendingAsk(message) || isPendingSecret(message));
  const visible = () => props.mascot.messages.filter((message) => message.kind !== 'work');
  const work = () =>
    props.mascot.messages.filter((message) => message.kind === 'work').map((message) => message.work!);

  return (
    <>
      <PageHeader
        title={props.mascot.name}
        subtitle={`Computer ${props.mascot.computer.status.replace('-', ' ')}`}
      />
      <PageBody width="list">
        <MascotRail links={mascotLinks(props.mascot.id, 'chat', props.onGo)} />
        <ConversationAlerts error={props.error} blocked={blocked()} work={work()} />
        <Thread
          name={props.mascot.name}
          messages={visible()}
          onAnswer={props.onAnswer}
          onSecret={props.onSecret}
        />
        <Composer
          draft={props.draft}
          blocked={blocked()}
          sending={props.sending}
          onDraft={props.onDraft}
          onSend={props.onSend}
        />
      </PageBody>
    </>
  );
}

function ConversationAlerts(props: {
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
          body="Talk to this mascot. Only what it sends to you appears here — tool traces stay in Work."
        />
      }
    >
      <div class="cx-product-list">
        <For each={props.messages}>{(message) => <Turn name={props.name} message={message} onAnswer={props.onAnswer} onSecret={props.onSecret} />}</For>
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
  return <SendToUserBubble name={props.name} message={message} />;
}

export function BotMessagesScreen(props: { mascot?: Mascot; onBack: () => void; onGo: (path: string) => void }): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader title="Messages" subtitle={mascot().name} />
          <PageBody width="list">
            <MascotRail links={mascotLinks(mascot().id, 'chat', props.onGo)} />
            <Show
              when={mascot().messages.some((message) => message.kind !== 'work')}
              fallback={<HonestState kind="empty" title="No messages" body="The conversation is still empty." />}
            >
              <div class="cx-product-list">
                <For each={mascot().messages.filter((message) => message.kind !== 'work')}>
                  {(message) => (
                    <div class="cx-product-row">
                      <div>
                        <div class="cx-product-row__title">{message.kind}</div>
                        <p class="cx-product-row__meta">{message.content}</p>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </PageBody>
        </>
      )}
    </Show>
  );
}

export function BotVideosScreen(props: {
  mascot?: Mascot;
  recording?: boolean;
  onToggleRecord?: () => void;
  onTeach?: (videoId: string) => void;
  onBack: () => void;
  onGo: (path: string) => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader title="Videos" subtitle="Cursor and click-zoom recordings from this mascot's computer only." />
          <PageBody width="list">
            <MascotRail links={mascotLinks(mascot().id, 'videos', props.onGo)} />
            <Show
              when={mascot().videos.length > 0}
              fallback={
                <HonestState
                  kind="empty"
                  title="No recordings"
                  body="Start a recording from Computer. Clips stay on this mascot."
                />
              }
            >
              <div class="cx-product-list">
                <For each={mascot().videos}>
                  {(video) => (
                    <div class="cx-product-row">
                      <div>
                        <div class="cx-product-row__title">{video.title}</div>
                        <p class="cx-product-row__meta">{video.kind}</p>
                      </div>
                      <Button variant="secondary" onClick={() => props.onTeach?.(video.id)}>
                        Teach skill
                      </Button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </PageBody>
        </>
      )}
    </Show>
  );
}
