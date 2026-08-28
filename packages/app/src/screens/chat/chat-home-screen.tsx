import { For, type JSX, Show } from 'solid-js';

import { Chip, Composer, Icon, Segmented, type IconName } from '@cortex-ide/ui';

import './chat-home.css';

export type ChatMode = 'search' | 'reason';

export interface ChatApp {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  /** Why the app cannot be opened yet, when it cannot. */
  lockedReason?: string;
}

export interface ChatHomeScreenProps {
  /** "Good evening, Ana." — assembled by the caller, which knows the clock and the name. */
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
}

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

/**
 * The Chat product's home: greeting, composer, the apps row, suggestions.
 *
 * Pure view — the caller owns the draft, the conversation start and the app
 * registry, so this screen cannot invent behaviour the host does not have.
 */
export function ChatHomeScreen(props: ChatHomeScreenProps): JSX.Element {
  return (
    <div class="cx-chat-home">
      <div class="cx-chat-home__column">
        <h1 class="cx-chat-home__greeting">{props.greeting}</h1>

        <Composer
          class="cx-chat-home__composer"
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
              options={[
                { id: 'search', label: 'Search', icon: 'search' },
                { id: 'reason', label: 'Reason', icon: 'reason' },
              ]}
            />
          }
        />

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
      </div>

      <span class="cx-chat-home__spacer" />
      <p class="cx-chat-home__disclaimer">Cortex can make mistakes. Check important info.</p>
    </div>
  );
}
