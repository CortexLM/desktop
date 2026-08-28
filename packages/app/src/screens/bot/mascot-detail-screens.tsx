import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import type { Mascot } from '../../state/bots.ts';

import '../chat/product-pages.css';

function Missing(props: { onBack: () => void }): JSX.Element {
  return (
    <HonestState
      kind="error"
      title="Mascot not found"
      body="This mascot is not on this device."
      actionLabel="Back to Bot"
      onAction={props.onBack}
    />
  );
}

function Thread(props: { name: string; messages: Mascot['messages'] }): JSX.Element {
  return (
    <Show
      when={props.messages.length > 0}
      fallback={
        <HonestState
          kind="empty"
          title="No messages yet"
          body="Talk to this mascot. Its computer stays dedicated — recordings and VNC never leak to another bot."
        />
      }
    >
      <div class="cx-product-list">
        <For each={props.messages}>
          {(message) => (
            <div class="cx-product-row">
              <div>
                <div class="cx-product-row__title">{message.role === 'user' ? 'You' : props.name}</div>
                <p class="cx-product-row__meta">{message.content}</p>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

export function BotConversationScreen(props: {
  mascot?: Mascot;
  draft: string;
  onDraft: (value: string) => void;
  onSend: () => void;
  onOpenComputer: () => void;
  onBack: () => void;
}): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader
            title={mascot().name}
            subtitle={`Computer ${mascot().computer.status.replace('-', ' ')}`}
            actions={<Button variant="secondary" onClick={() => props.onOpenComputer()}>Computer</Button>}
          />
          <PageBody width="list">
            <Show when={mascot().messages.some((message) => message.askUser)}>
              <HonestState kind="error" title="Waiting on you" body="This mascot asked a question and will not continue until you answer." />
            </Show>
            <Thread name={mascot().name} messages={mascot().messages} />
            <input
              class="cx-product-row"
              value={props.draft}
              onInput={(event) => props.onDraft(event.currentTarget.value)}
              placeholder="Message this mascot"
              onKeyDown={(event) => {
                if (event.key === 'Enter') props.onSend();
              }}
            />
          </PageBody>
        </>
      )}
    </Show>
  );
}

export function BotMessagesScreen(props: { mascot?: Mascot; onBack: () => void }): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader title="Messages" subtitle={mascot().name} />
          <PageBody width="list">
            <Show
              when={mascot().messages.length > 0}
              fallback={<HonestState kind="empty" title="No messages" body="The conversation is still empty." />}
            >
              <div class="cx-product-list">
                <For each={mascot().messages}>
                  {(message) => (
                    <div class="cx-product-row">
                      <div>
                        <div class="cx-product-row__title">{message.role}</div>
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

export function BotVideosScreen(props: { mascot?: Mascot; onBack: () => void }): JSX.Element {
  return (
    <Show when={props.mascot} fallback={<Missing onBack={props.onBack} />}>
      {(mascot) => (
        <>
          <PageHeader
            title="Videos"
            subtitle="Cursor and click-zoom recordings from this mascot's computer only."
          />
          <PageBody width="list">
            <Show
              when={mascot().videos.length > 0}
              fallback={
                <HonestState
                  kind="empty"
                  title="No recordings"
                  body="When this computer records, the clip stays on this mascot. Nothing is shared across bots."
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
