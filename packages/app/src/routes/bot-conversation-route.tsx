/**
 * Mascot conversation with the computer rail open by default.
 */

import { createSignal, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { answerAsk, runLifecycle, sendBotMessage, sendComputerInput, submitBotSecret } from '../state/bot-actions.ts';
import { boxError, screenshotSrc, shot } from '../state/bot-computer-live.ts';
import { desktopTransport, streamUrl } from '../state/vnc-ticket.ts';
import { sendBotTurn } from '../state/realtime-session.ts';
import { BotConversationScreen } from '../screens/bot/mascot-detail-screens.tsx';
import type { Mascot } from '../state/bot-map.ts';
import { useBotMascot } from './bot-mascot.ts';
import { useConversationDesktop } from './bot-computer-route.tsx';

export function BotConversationRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  const [draft, setDraft] = createSignal('');
  const [error, setError] = createSignal('');
  const [sending, setSending] = createSignal(false);
  const [celebrating, setCelebrating] = createSignal(false);
  const [computerOpen, setComputerOpen] = createSignal(true);
  useConversationDesktop(mascot, computerOpen);

  return (
    <ConversationScreen
      mascot={mascot()}
      draft={draft()}
      error={error()}
      sending={sending()}
      celebrating={celebrating()}
      computerOpen={computerOpen()}
      onDraft={setDraft}
      onError={setError}
      onSending={setSending}
      onCelebrating={setCelebrating}
      onToggleComputer={() => setComputerOpen((open) => !open)}
      navigate={navigate}
    />
  );
}

function ConversationScreen(props: {
  mascot?: Mascot;
  draft: string;
  error: string;
  sending: boolean;
  celebrating: boolean;
  computerOpen: boolean;
  onDraft: (value: string) => void;
  onError: (value: string) => void;
  onSending: (value: boolean) => void;
  onCelebrating: (value: boolean) => void;
  onToggleComputer: () => void;
  navigate: (path: string) => void;
}): JSX.Element {
  const id = () => props.mascot?.id;
  return (
    <BotConversationScreen
      mascot={props.mascot}
      draft={props.draft}
      onDraft={props.onDraft}
      onSend={() => void sendFromComposer(id(), props)}
      sending={props.sending}
      celebrating={props.celebrating}
      onMarkSettled={() => props.onCelebrating(false)}
      error={props.error}
      computerOpen={props.computerOpen}
      onToggleComputer={props.onToggleComputer}
      screenshot={screenshotSrc(shot())}
      streamUrl={streamUrl()}
      transport={desktopTransport()}
      computerError={boxError()}
      onWake={() => void runIf(id(), (mascotId) => runLifecycle(mascotId, 'resume'))}
      onHibernate={() => void runIf(id(), (mascotId) => runLifecycle(mascotId, 'hibernate'))}
      onInput={(input) => void runIf(id(), (mascotId) => sendComputerInput(mascotId, input))}
      onAnswer={(text, askId) => void runIf(id(), (mascotId) => answerAsk(mascotId, text, askId))}
      onSecret={(name, value) => void runIf(id(), (mascotId) => submitBotSecret(mascotId, name, value))}
      onGo={props.navigate}
      onBack={() => props.navigate('/bot')}
    />
  );
}

function runIf(mascotId: string | undefined, run: (id: string) => Promise<void> | void): Promise<void> | void {
  if (mascotId) return run(mascotId);
}

async function sendFromComposer(
  mascotId: string | undefined,
  props: {
    draft: string;
    onDraft: (value: string) => void;
    onError: (value: string) => void;
    onSending: (value: boolean) => void;
    onCelebrating: (value: boolean) => void;
  },
): Promise<void> {
  const text = props.draft.trim();
  if (!mascotId || !text) return;
  props.onSending(true);
  props.onError('');
  try {
    await sendBotMessage(mascotId, text);
    props.onDraft('');
    sendBotTurn(mascotId, text);
    props.onCelebrating(true);
  } catch (caught) {
    props.onError(caught instanceof Error ? caught.message : String(caught));
  } finally {
    props.onSending(false);
  }
}
