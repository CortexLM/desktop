import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';
import type { ComputerInput } from '@cortex-ide/cortex-api';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { ComputerRail } from './computer-rail.tsx';
import type { DesktopTransport } from './computer-desktop.tsx';
import {
  Composer,
  ConversationAlerts,
  Thread,
  conversationBlocked,
  visibleMessages,
  workItems,
} from './conversation-thread.tsx';
import { MascotRail, mascotLinks } from './mascot-rail.tsx';
import { computerLabel, type Mascot } from '../../state/bot-map.ts';
import { resolveMascotMotion } from './mascot-looks.ts';
import { MascotMark } from './mascot-mark.tsx';

import '../chat/product-pages.css';
import './bot-workbench.css';

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
  computerOpen?: boolean;
  onToggleComputer?: () => void;
  screenshot?: string;
  streamUrl?: string;
  transport?: DesktopTransport;
  computerError?: string;
  onWake?: () => void;
  onHibernate?: () => void;
  onInput?: (input: ComputerInput) => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => <ConversationBody {...props} mascot={mascot()} />}
    </Show>
  );
}

function ConversationBody(props: ConversationBodyProps): JSX.Element {
  const blocked = () => conversationBlocked(props.mascot);
  return (
    <>
      <ConversationHeader mascot={props.mascot} blocked={blocked()} rest={props} />
      <PageBody width="bleed" class="cx-bot-workbench-page">
        <div class="cx-bot-workbench">
          <ThreadColumn mascot={props.mascot} blocked={blocked()} rest={props} />
          <Show when={props.computerOpen}>
            <WorkbenchRail mascot={props.mascot} rest={props} />
          </Show>
        </div>
      </PageBody>
    </>
  );
}

interface ConversationBodyProps {
  mascot: Mascot;
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onAnswer: (text: string, askId?: string) => void;
  onSecret: (name: string, value: string) => void;
  onGo: (path: string) => void;
  sending?: boolean;
  celebrating?: boolean;
  onMarkSettled?: () => void;
  error?: string;
  computerOpen?: boolean;
  onToggleComputer?: () => void;
  screenshot?: string;
  streamUrl?: string;
  transport?: DesktopTransport;
  computerError?: string;
  onWake?: () => void;
  onHibernate?: () => void;
  onInput?: (input: ComputerInput) => void;
}

function ConversationHeader(props: {
  mascot: Mascot;
  blocked: boolean;
  rest: ConversationBodyProps;
}): JSX.Element {
  return (
    <PageHeader
      title={props.mascot.name}
      subtitle={`Computer ${computerLabel(props.mascot.computer)}`}
      mark={
        <ConversationMark
          mascot={props.mascot}
          blocked={props.blocked}
          sending={props.rest.sending}
          celebrating={props.rest.celebrating}
          onSettled={props.rest.onMarkSettled}
        />
      }
      actions={
        <Button variant="secondary" onClick={() => props.rest.onToggleComputer?.()}>
          {props.rest.computerOpen ? 'Hide computer' : 'Computer'}
        </Button>
      }
    />
  );
}

function ThreadColumn(props: {
  mascot: Mascot;
  blocked: boolean;
  rest: ConversationBodyProps;
}): JSX.Element {
  return (
    <div class="cx-bot-workbench__thread">
      <MascotRail links={mascotLinks(props.mascot.id, 'chat', props.rest.onGo)} />
      <ConversationAlerts error={props.rest.error} blocked={props.blocked} work={workItems(props.mascot)} />
      <Thread
        name={props.mascot.name}
        messages={visibleMessages(props.mascot)}
        onAnswer={props.rest.onAnswer}
        onSecret={props.rest.onSecret}
      />
      <Composer
        draft={props.rest.draft}
        blocked={props.blocked}
        sending={props.rest.sending}
        onDraft={props.rest.onDraft}
        onSend={props.rest.onSend}
      />
    </div>
  );
}

function WorkbenchRail(props: { mascot: Mascot; rest: ConversationBodyProps }): JSX.Element {
  return (
    <ComputerRail
      mascot={props.mascot}
      screenshot={props.rest.screenshot}
      streamUrl={props.rest.streamUrl}
      transport={props.rest.transport}
      error={props.rest.computerError}
      onWake={() => props.rest.onWake?.()}
      onHibernate={() => props.rest.onHibernate?.()}
      onInput={(input) => props.rest.onInput?.(input)}
      onOpenPage={() => props.rest.onGo(`/bot/${props.mascot.id}/computer`)}
      onClose={props.rest.onToggleComputer}
    />
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

export function BotMessagesScreen(props: {
  mascot?: Mascot;
  onBack: () => void;
  onGo: (path: string) => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader title="Messages" subtitle={mascot().name} />
          <PageBody width="list">
            <MascotRail links={mascotLinks(mascot().id, 'messages', props.onGo)} />
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
