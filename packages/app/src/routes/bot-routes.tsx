import { createMemo, createSignal, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import {
  appendBotMessage,
  createMascot,
  mascotById,
  mascots,
  setComputerStatus,
  type MascotColor,
  type MascotShape,
} from '../state/bots.ts';
import { postInbox } from '../state/inbox.ts';
import { showOsNotification } from '../state/os-notify.ts';
import { sendBotTurn } from '../state/realtime-session.ts';
import { watchLiveRoom } from '../state/realtime-rooms.ts';
import { requestVncTicket } from '../state/vnc-ticket.ts';
import { CreateMascotScreen, MascotListScreen } from '../screens/bot/mascot-screens.tsx';
import {
  BotConversationScreen,
  BotMessagesScreen,
  BotVideosScreen,
} from '../screens/bot/mascot-detail-screens.tsx';
import { BotComputerScreen, BotSettingsScreen } from '../screens/bot/mascot-computer-screens.tsx';

function useMascot() {
  const params = useParams<{ mascotId: string }>();
  watchLiveRoom('mascot', () => params.mascotId);
  return createMemo(() => mascotById(params.mascotId));
}

export function BotHomeRoute(): JSX.Element {
  const navigate = useNavigate();
  return (
    <MascotListScreen
      mascots={mascots()}
      onOpen={(id) => navigate(`/bot/${id}`)}
      onCreate={() => navigate('/bot/new')}
    />
  );
}

export function BotCreateRoute(): JSX.Element {
  const navigate = useNavigate();
  const [name, setName] = createSignal('');
  const [shape, setShape] = createSignal<MascotShape>('round');
  const [color, setColor] = createSignal<MascotColor>('green');

  return (
    <CreateMascotScreen
      name={name()}
      onName={setName}
      shape={shape()}
      onShape={setShape}
      color={color()}
      onColor={setColor}
      onCreate={() => {
        const mascot = createMascot(name(), shape(), color());
        navigate(`/bot/${mascot.id}`);
      }}
    />
  );
}

export function BotConversationRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useMascot();
  const [draft, setDraft] = createSignal('');

  const send = () => {
    const current = mascot();
    const text = draft().trim();
    if (!current || !text) return;
    appendBotMessage(current.id, { role: 'user', content: text, at: Date.now() });
    setDraft('');
    sendBotTurn(current.id, text);
    if (current.computer.status === 'hibernated' || current.computer.status === 'wake-failed') {
      appendBotMessage(current.id, {
        role: 'assistant',
        content: 'My computer is asleep. Wake it from the Computer rail to continue.',
        at: Date.now(),
        askUser: true,
      });
      const item = postInbox({
        kind: 'bot-ask-user',
        message: `${current.name} needs you`,
        href: `/bot/${current.id}`,
      });
      void showOsNotification({ title: 'Bot', body: item.message, kind: 'bot-ask-user' });
    }
  };

  return (
    <BotConversationScreen
      mascot={mascot()}
      draft={draft()}
      onDraft={setDraft}
      onSend={send}
      onOpenComputer={() => {
        const current = mascot();
        if (current) navigate(`/bot/${current.id}/computer`);
      }}
      onBack={() => navigate('/bot')}
    />
  );
}

export function BotMessagesRoute(): JSX.Element {
  const navigate = useNavigate();
  return <BotMessagesScreen mascot={useMascot()()} onBack={() => navigate('/bot')} />;
}

export function BotVideosRoute(): JSX.Element {
  const navigate = useNavigate();
  return <BotVideosScreen mascot={useMascot()()} onBack={() => navigate('/bot')} />;
}

export function BotSettingsRoute(): JSX.Element {
  const navigate = useNavigate();
  return <BotSettingsScreen mascot={useMascot()()} onBack={() => navigate('/bot')} />;
}

export function BotComputerRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useMascot();

  const wake = () => {
    const current = mascot();
    if (!current) return;
    setComputerStatus(current.id, 'waking');
    void finishWake(current.id, current.name);
  };

  return (
    <BotComputerScreen
      mascot={mascot()}
      onWake={wake}
      onHibernate={() => {
        const current = mascot();
        if (current) setComputerStatus(current.id, 'hibernated');
      }}
      onBack={() => navigate('/bot')}
    />
  );
}

async function finishWake(mascotId: string, name: string): Promise<void> {
  const hash = await requestVncTicket(mascotId);
  if (hash) {
    setComputerStatus(mascotId, 'running');
    return;
  }
  setComputerStatus(mascotId, 'wake-failed', 'The farm is not reachable from this client.');
  const item = postInbox({
    kind: 'farm-wake-fail',
    message: `${name}'s computer failed to wake`,
    href: `/bot/${mascotId}/computer`,
  });
  void showOsNotification({ title: 'Bot', body: item.message, kind: 'farm-wake-fail' });
}
