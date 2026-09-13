import { For, type JSX, Show } from 'solid-js';

import { Chip, Composer, Icon, Segmented, type IconName } from '@cortex-ide/ui';
import type { ChatMode } from '@cortex-ide/shared';

import './chat-home.css';

export type { ChatMode };

export interface ChatApp {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  lockedReason?: string;
}

export interface ChatRecent {
  id: string;
  title: string;
}

export interface ChatHomeScreenProps {
  greeting: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  modelLabel: string;
  onPickModel?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  apps: readonly ChatApp[];
  onOpenApp: (id: string) => void;
  suggestions: readonly string[];
  onPickSuggestion: (suggestion: string) => void;
  recents?: readonly ChatRecent[];
  onOpenRecent?: (id: string) => void;
  pinned?: readonly ChatRecent[];
  onOpenPinned?: (id: string) => void;
}

const CHAT_MODES = [
  { id: 'search', label: 'Search', icon: 'search' as const },
  { id: 'reason', label: 'Reason', icon: 'reason' as const },
  { id: 'research', label: 'Research', icon: 'research' as const },
];

function AppCard(props: { app: ChatApp; onOpen: (id: string) => void }): JSX.Element {
  return (
    <button
      type="button"
      class="cx-chat-home__app"
      aria-disabled={props.app.lockedReason ? 'true' : undefined}
      title={props.app.lockedReason}
      onClick={() => {
        if (!props.app.lockedReason) props.onOpen(props.app.id);
      }}
    >
      <span class="cx-chat-home__app-art" aria-hidden="true">
        <Icon name={props.app.icon} size={26} strokeWidth={1.6} />
      </span>
      <span class="cx-chat-home__app-text">
        <span class="cx-chat-home__app-title">{props.app.title}</span>
        <span class="cx-chat-home__app-description">{props.app.description}</span>
      </span>
    </button>
  );
}

function ChatComposer(props: ChatHomeScreenProps): JSX.Element {
  return (
    <Composer
      class="cx-chat-home__composer"
      floating
      value={props.draft}
      onValueChange={props.onDraftChange}
      onSubmit={props.onSubmit}
      placeholder="Ask anything, or pick an app below…"
      sendLabel="Send"
      disabled={props.disabled}
      disabledReason={props.disabledReason}
      modelLabel={props.modelLabel}
      onPickModel={props.onPickModel}
      leading={
        <Segmented
          bordered
          label="Mode"
          value={props.mode}
          onChange={(id) => props.onModeChange(id as ChatMode)}
          options={CHAT_MODES}
        />
      }
    />
  );
}

function ChatList(props: {
  title: string;
  label: string;
  rows: readonly ChatRecent[];
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <section class="cx-chat-home__recents" aria-label={props.label}>
      <h2 class="cx-chat-home__recents-title">{props.title}</h2>
      <For each={props.rows}>
        {(row) => (
          <button type="button" class="cx-chat-home__recent" onClick={() => props.onOpen(row.id)}>
            {row.title}
          </button>
        )}
      </For>
    </section>
  );
}

export function ChatHomeScreen(props: ChatHomeScreenProps): JSX.Element {
  return (
    <div class="cx-chat-home">
      <div class="cx-chat-home__column">
        <h1 class="cx-chat-home__greeting">{props.greeting}</h1>
        <div class="cx-chat-home__apps">
          <For each={props.apps}>{(app) => <AppCard app={app} onOpen={props.onOpenApp} />}</For>
        </div>
        <Show when={props.suggestions.length > 0}>
          <div class="cx-chat-home__suggestions">
            <For each={props.suggestions}>
              {(suggestion) => (
                <Chip variant="outlined" onPress={() => props.onPickSuggestion(suggestion)}>
                  {suggestion}
                </Chip>
              )}
            </For>
          </div>
        </Show>
        <Show when={props.pinned?.length ? props.pinned : undefined}>
          {(rows) => (
            <ChatList
              title="Pinned"
              label="Pinned chats"
              rows={rows()}
              onOpen={(id) => props.onOpenPinned?.(id) ?? props.onOpenRecent?.(id)}
            />
          )}
        </Show>
        <Show when={props.recents?.length ? props.recents : undefined}>
          {(rows) => (
            <ChatList
              title="Recents"
              label="Recent chats"
              rows={rows()}
              onOpen={(id) => props.onOpenRecent?.(id)}
            />
          )}
        </Show>
      </div>
      <div class="cx-chat-home__dock">
        <ChatComposer {...props} />
        <p class="cx-chat-home__disclaimer">Cortex can make mistakes. Check important info.</p>
      </div>
    </div>
  );
}
