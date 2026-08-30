import { createSignal, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import {
  answerAsk,
  runLifecycle,
  sendBotMessage,
  sendComputerInput,
  submitBotSecret,
} from '../state/bot-actions.ts';
import { pickComputerRuntime, runComputerControl } from '../state/bot-control.ts';
import { boxError } from '../state/bot-computer-live.ts';
import { sendBotTurn } from '../state/realtime-session.ts';
import { liveRailPaint } from '../state/computer-rail-paint.ts';
import { BotConversationScreen } from '../screens/bot/conversation-screen.tsx';
import { useAccount } from '../state/session-context.tsx';
import { useBotMascot } from './bot-mascot.ts';
import { bindComputerLive } from './bot-computer-bind.ts';
import type { Mascot } from '../state/bot-map.ts';

export function BotConversationRoute(): JSX.Element {
  const navigate = useNavigate();
  const account = useAccount();
  const params = useParams<{ mascotId: string }>();
  const mascot = useBotMascot();
  bindComputerLive(() => params.mascotId);
  return (
    <ConversationLive
      routeId={params.mascotId}
      mascot={mascot()}
      signedIn={Boolean(account.user())}
      navigate={navigate}
    />
  );
}

function ConversationLive(props: {
  routeId: string | undefined;
  mascot: Mascot | undefined;
  signedIn: boolean;
  navigate: (path: string) => void;
}): JSX.Element {
  const thread = useThreadState();
  const [computerError, setComputerError] = createSignal('');
  const id = () => props.routeId;
  const rail = () => liveRailPaint(id(), props.mascot);
  return (
    <BotConversationScreen
      mascot={props.mascot}
      signedIn={props.signedIn}
      draft={thread.draft()}
      onDraft={thread.setDraft}
      onSend={() => void sendFromComposer({ mascotId: id(), ...thread })}
      sending={thread.sending()}
      celebrating={thread.celebrating()}
      onMarkSettled={() => thread.setCelebrating(false)}
      error={thread.error()}
      screenshot={rail().screenshotUrl}
      streamUrl={rail().streamUrl}
      hasControl={props.mascot?.id === id() && props.mascot?.computer.controlHolder === 'user'}
      computerError={computerError() || boxError()}
      onAnswer={(text, askId) => void ifId(id(), (current) => answerAsk(current, text, askId))}
      onSecret={(name, value) => void ifId(id(), (current) => submitBotSecret(current, name, value))}
      onTakeControl={() => void runComputerControl(id(), 'take', setComputerError)}
      onRelease={() => void runComputerControl(id(), 'release', setComputerError)}
      onWake={() => void ifId(id(), (current) => runLifecycle(current, 'resume'))}
      onRuntime={(runtime) => void pickComputerRuntime(id(), runtime, setComputerError)}
      onInput={(input) => void ifId(id(), (current) => sendComputerInput(current, input))}
      onGo={(path) => props.navigate(path)}
      onBack={() => props.navigate('/bot')}
    />
  );
}

function useThreadState() {
  const [draft, setDraft] = createSignal('');
  const [error, setError] = createSignal('');
  const [sending, setSending] = createSignal(false);
  const [celebrating, setCelebrating] = createSignal(false);
  return { draft, setDraft, error, setError, sending, setSending, celebrating, setCelebrating };
}

function ifId(id: string | undefined, work: (id: string) => Promise<unknown> | void): void {
  if (id) void work(id);
}

async function sendFromComposer(input: {
  mascotId: string | undefined;
  draft: () => string;
  setDraft: (value: string) => void;
  setError: (value: string) => void;
  setSending: (value: boolean) => void;
  setCelebrating: (value: boolean) => void;
}): Promise<void> {
  const text = input.draft().trim();
  if (!input.mascotId || !text) return;
  input.setSending(true);
  input.setError('');
  try {
    await sendBotMessage(input.mascotId, text);
    input.setDraft('');
    sendBotTurn(input.mascotId, text);
    input.setCelebrating(true);
  } catch (caught) {
    input.setError(caught instanceof Error ? caught.message : String(caught));
  } finally {
    input.setSending(false);
  }
}
