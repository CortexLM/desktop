import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import type { BotAsk, BotMessage, BotSecretAsk, BotWork } from '../../state/bot-map.ts';

export function UserBubble(props: { text: string }): JSX.Element {
  return (
    <div class="cx-product-row">
      <div>
        <div class="cx-product-row__title">You</div>
        <p class="cx-product-row__meta">{props.text}</p>
      </div>
    </div>
  );
}

export function SendToUserBubble(props: { name: string; message: BotMessage }): JSX.Element {
  return (
    <div class="cx-product-row">
      <div>
        <div class="cx-product-row__title">{props.name}</div>
        <p class="cx-product-row__meta">{props.message.content}</p>
        <Show when={props.message.attachments?.length}>
          <For each={props.message.attachments}>
            {(file) => <p class="cx-product-row__meta">{file.name ?? file.kind ?? 'attachment'}</p>}
          </For>
        </Show>
      </div>
    </div>
  );
}

export function AskCard(props: { ask: BotAsk; onAnswer: (text: string) => void }): JSX.Element {
  return (
    <div class="cx-product-row" role="group" aria-label="Question from mascot">
      <div>
        <div class="cx-product-row__title">Waiting on you</div>
        <p class="cx-product-row__meta">{props.ask.prompt}</p>
        <Show when={props.ask.options?.length} fallback={<p class="cx-product-row__meta">Answer in the composer.</p>}>
          <div class="cx-mascot-rail">
            <For each={props.ask.options}>
              {(option) => (
                <Button variant="secondary" onClick={() => props.onAnswer(option)}>
                  {option}
                </Button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}

export function SecretCard(props: {
  secret: BotSecretAsk;
  onSubmit: (name: string, value: string) => void;
}): JSX.Element {
  let field: HTMLInputElement | undefined;
  return (
    <div class="cx-product-row" role="group" aria-label="Secret request">
      <div>
        <div class="cx-product-row__title">Secret needed</div>
        <p class="cx-product-row__meta">{props.secret.reason ?? `This mascot needs ${props.secret.name}.`}</p>
        <input
          ref={field}
          class="cx-product-row"
          type="password"
          autocomplete="off"
          placeholder={props.secret.name}
        />
        <Button
          variant="primary"
          onClick={() => {
            const value = field?.value.trim() ?? '';
            if (value) props.onSubmit(props.secret.name, value);
          }}
        >
          Save secret
        </Button>
      </div>
    </div>
  );
}

export function WorkRail(props: { items: readonly BotWork[] }): JSX.Element {
  return (
    <details class="cx-product-row">
      <summary class="cx-product-row__title">Work</summary>
      <For each={props.items}>
        {(item) => (
          <p class="cx-product-row__meta">
            {item.tool ?? 'tool'}
            {item.output ? ` → ${stringify(item.output)}` : ''}
          </p>
        )}
      </For>
    </details>
  );
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
