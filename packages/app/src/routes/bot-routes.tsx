import { createEffect, createSignal, onCleanup, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import {
  answerAsk,
  runLifecycle,
  sendBotMessage,
  sendComputerInput,
  setRecording,
  submitBotSecret,
} from '../state/bot-actions.ts';
import { createMascot, loadError, loadState, mascots, reconcileMascots } from '../state/bots.ts';
import { teachFromVideo } from '../state/bot-runtime-store.ts';
import {
  fsEntries,
  loadFs,
  openFile,
  preview,
  recording,
  refreshScreenshot,
  runShell,
  screenshotSrc,
  setRecordingFlagValue,
  shellLog,
  shot,
} from '../state/bot-computer-live.ts';
import { sendBotTurn } from '../state/realtime-session.ts';
import { CreateMascotScreen, MascotListScreen } from '../screens/bot/mascot-screens.tsx';
import { BotConversationScreen, BotMessagesScreen, BotVideosScreen } from '../screens/bot/mascot-detail-screens.tsx';
import { BotComputerScreen, BotSettingsScreen } from '../screens/bot/mascot-computer-screens.tsx';
import type { Mascot, MascotColor, MascotShape } from '../state/bot-map.ts';
import { useBotMascot } from './bot-mascot.ts';

export {
  BotGroupsRoute,
  BotMemoryRoute,
  BotRoutinesRoute,
  BotSkillsRoute,
} from './bot-runtime-routes.tsx';

export function BotHomeRoute(): JSX.Element {
  const navigate = useNavigate();
  createEffect(() => {
    void reconcileMascots();
  });
  return (
    <MascotListScreen
      mascots={mascots()}
      loading={loadState() === 'loading'}
      unavailable={loadState() === 'unavailable'}
      error={loadState() === 'error' ? loadError() : undefined}
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
  const [error, setError] = createSignal('');

  return (
    <CreateMascotScreen
      name={name()}
      onName={setName}
      shape={shape()}
      onShape={setShape}
      color={color()}
      onColor={setColor}
      error={error()}
      onCreate={() => void createAndGo({ name: name(), shape: shape(), color: color(), navigate, setError })}
    />
  );
}

async function createAndGo(input: {
  name: string;
  shape: MascotShape;
  color: MascotColor;
  navigate: (path: string) => void;
  setError: (value: string) => void;
}): Promise<void> {
  try {
    const mascot = await createMascot(input.name, input.shape, input.color);
    input.navigate(`/bot/${mascot.id}`);
  } catch (caught) {
    input.setError(caught instanceof Error ? caught.message : String(caught));
  }
}

export function BotConversationRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  const [draft, setDraft] = createSignal('');
  const [error, setError] = createSignal('');
  const [sending, setSending] = createSignal(false);

  return (
    <BotConversationScreen
      mascot={mascot()}
      draft={draft()}
      onDraft={setDraft}
      onSend={() =>
        void sendFromComposer({
          mascotId: mascot()?.id,
          draft: draft(),
          setDraft,
          setError,
          setSending,
        })
      }
      sending={sending()}
      error={error()}
      onAnswer={(text, askId) => {
        const id = mascot()?.id;
        if (id) void answerAsk(id, text, askId);
      }}
      onSecret={(name, value) => {
        const id = mascot()?.id;
        if (id) void submitBotSecret(id, name, value);
      }}
      onGo={(path) => navigate(path)}
      onBack={() => navigate('/bot')}
    />
  );
}

async function sendFromComposer(input: {
  mascotId: string | undefined;
  draft: string;
  setDraft: (value: string) => void;
  setError: (value: string) => void;
  setSending: (value: boolean) => void;
}): Promise<void> {
  const text = input.draft.trim();
  if (!input.mascotId || !text) return;
  input.setSending(true);
  input.setError('');
  try {
    await sendBotMessage(input.mascotId, text);
    input.setDraft('');
    sendBotTurn(input.mascotId, text);
  } catch (caught) {
    input.setError(caught instanceof Error ? caught.message : String(caught));
  } finally {
    input.setSending(false);
  }
}

export function BotMessagesRoute(): JSX.Element {
  const navigate = useNavigate();
  return <BotMessagesScreen mascot={useBotMascot()()} onBack={() => navigate('/bot')} onGo={(path) => navigate(path)} />;
}

export function BotVideosRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  return (
    <BotVideosScreen
      mascot={mascot()}
      onTeach={(videoId) => {
        const current = mascot();
        if (current) void teachFromVideo(current.id, videoId);
      }}
      onBack={() => navigate('/bot')}
      onGo={(path) => navigate(path)}
    />
  );
}

export function BotSettingsRoute(): JSX.Element {
  const navigate = useNavigate();
  return <BotSettingsScreen mascot={useBotMascot()()} onBack={() => navigate('/bot')} onGo={(path) => navigate(path)} />;
}

export function BotComputerRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  useComputerPoll(mascot);
  return <LiveComputer mascotId={() => mascot()?.id} mascot={mascot()} navigate={navigate} />;
}

function useComputerPoll(mascot: () => Mascot | undefined): void {
  createEffect(() => {
    const current = mascot();
    if (!current || current.computer.status !== 'running') return;
    void refreshScreenshot(current.id);
    void loadFs(current.id);
    const timer = setInterval(() => void refreshScreenshot(current.id), 800);
    onCleanup(() => clearInterval(timer));
  });
}

function LiveComputer(props: {
  mascotId: () => string | undefined;
  mascot: Mascot | undefined;
  navigate: (path: string) => void;
}): JSX.Element {
  const id = () => props.mascotId();
  return (
    <BotComputerScreen
      mascot={props.mascot}
      screenshot={screenshotSrc(shot())}
      shellLog={shellLog()}
      files={fsEntries()}
      preview={preview()}
      recording={recording()}
      onWake={() => {
        const current = id();
        if (current) void runLifecycle(current, 'resume');
      }}
      onHibernate={() => {
        const current = id();
        if (current) void runLifecycle(current, 'hibernate');
      }}
      onStop={() => {
        const current = id();
        if (current) void runLifecycle(current, 'stop');
      }}
      onInput={(input) => {
        const current = id();
        if (current) void sendComputerInput(current, input);
      }}
      onShell={(command) => {
        const current = id();
        if (current) void runShell(current, command);
      }}
      onOpenFile={(path) => {
        const current = id();
        if (current) void openFile(current, path);
      }}
      onToggleRecord={() => void toggleRecord(id())}
      onBack={() => props.navigate('/bot')}
      onGo={(path) => props.navigate(path)}
    />
  );
}

async function toggleRecord(mascotId: string | undefined): Promise<void> {
  if (!mascotId) return;
  const next = recording() ? 'stop' : 'start';
  await setRecording(mascotId, next);
  setRecordingFlagValue(next === 'start');
}
