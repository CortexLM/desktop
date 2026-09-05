import { For, Show, createEffect, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../shell/app-shell.tsx';
import { HonestState } from '../screens/shared/honest-state.tsx';
import { AskCard, SecretCard } from '../screens/bot/conversation-widgets.tsx';
import { hydrateMascot, mascots, reconcileMascots } from '../state/bots.ts';
import { answerAsk, submitBotSecret } from '../state/bot-actions.ts';
import { isPendingAsk, isPendingSecret, type BotMessage, type Mascot } from '../state/bot-map.ts';

import '../screens/chat/product-pages.css';
import '../screens/bot/bot-teammate.css';

export function BotApprovalsRoute(): JSX.Element {
  const navigate = useNavigate();
  createEffect(() => {
    void reconcileMascots().then(() => {
      for (const mascot of mascots()) void hydrateMascot(mascot.id);
    });
  });
  return (
    <BotApprovalsScreen
      items={pendingApprovals(mascots())}
      onAnswer={(mascotId, text, askId) => void answerAsk(mascotId, text, askId)}
      onSecret={(mascotId, name, value) => void submitBotSecret(mascotId, name, value)}
      onOpen={(id) => navigate(`/bot/${id}`)}
    />
  );
}

export function BotApprovalsScreen(props: {
  items: readonly ApprovalItem[];
  onAnswer: (mascotId: string, text: string, askId?: string) => void;
  onSecret: (mascotId: string, name: string, value: string) => void;
  onOpen: (id: string) => void;
}): JSX.Element {
  return (
    <>
      <PageHeader title="Approvals" subtitle="Questions and secrets waiting on you." />
      <PageBody width="list">
        <Show
          when={props.items.length > 0}
          fallback={
            <HonestState
              kind="empty"
              title="Nothing waiting"
              body="When a mascot needs an answer or a secret, it lands here."
            />
          }
        >
          <div class="cx-product-list">
            <For each={props.items}>
              {(item) => (
                <ApprovalRow
                  item={item}
                  onAnswer={props.onAnswer}
                  onSecret={props.onSecret}
                  onOpen={props.onOpen}
                />
              )}
            </For>
          </div>
        </Show>
      </PageBody>
    </>
  );
}

function ApprovalRow(props: {
  item: ApprovalItem;
  onAnswer: (mascotId: string, text: string, askId?: string) => void;
  onSecret: (mascotId: string, name: string, value: string) => void;
  onOpen: (id: string) => void;
}): JSX.Element {
  const message = props.item.message;
  return (
    <div class="cx-product-row">
      <div>
        <div class="cx-product-row__title">{props.item.mascot.name}</div>
        <Show when={message.kind === 'ask_user' && message.ask}>
          <AskCard
            ask={message.ask!}
            onAnswer={(text) => props.onAnswer(props.item.mascot.id, text, message.ask?.id)}
          />
        </Show>
        <Show when={message.kind === 'secret' && message.secret}>
          <SecretCard
            secret={message.secret!}
            onSubmit={(name, value) => props.onSecret(props.item.mascot.id, name, value)}
          />
        </Show>
      </div>
      <Button variant="ghost" onClick={() => props.onOpen(props.item.mascot.id)}>
        Open
      </Button>
    </div>
  );
}

export interface ApprovalItem {
  mascot: Mascot;
  message: BotMessage;
}

export function pendingApprovals(roster: readonly Mascot[]): ApprovalItem[] {
  return roster.flatMap((mascot) =>
    mascot.messages
      .filter((message) => isPendingAsk(message) || isPendingSecret(message))
      .map((message) => ({ mascot, message })),
  );
}
