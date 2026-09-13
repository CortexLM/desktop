import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { AskCard, SecretCard, SendToUserBubble, UserBubble } from './conversation-widgets.tsx';
import { MascotRail, mascotLinks } from './mascot-rail.tsx';
import type { BotMessage, Mascot } from '../../state/bot-map.ts';

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
                  {(message) => <HistoryRow name={mascot().name} message={message} />}
                </For>
              </div>
            </Show>
          </PageBody>
        </>
      )}
    </Show>
  );
}

function HistoryRow(props: { name: string; message: BotMessage }): JSX.Element {
  const message = props.message;
  if (message.kind === 'user') return <UserBubble text={message.content} />;
  if (message.kind === 'ask_user' && message.ask) {
    return <AskCard ask={message.ask} onAnswer={() => undefined} />;
  }
  if (message.kind === 'secret' && message.secret) {
    return <SecretCard secret={message.secret} onSubmit={() => undefined} />;
  }
  return <SendToUserBubble name={props.name} message={message} />;
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
          <PageHeader title="Videos" subtitle="Pointer and click-zoom recordings from this mascot's computer only." />
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
