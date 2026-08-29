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
import {
  createMascot,
  loadError,
  loadState,
  mascots,
  reconcileMascots,
  removeMascot,
  updateMascot,
} from '../state/bots.ts';
import { teachFromVideo } from '../state/bot-runtime-store.ts';
import {
  boxError,
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
import { desktopTransport, probeDesktopTransport } from '../state/vnc-ticket.ts';
import { sendBotTurn } from '../state/realtime-session.ts';
import { CreateMascotScreen, MascotListScreen } from '../screens/bot/mascot-screens.tsx';
import { BotConversationScreen, BotMessagesScreen, BotVideosScreen } from '../screens/bot/mascot-detail-screens.tsx';
import { BotComputerScreen } from '../screens/bot/mascot-computer-screens.tsx';
import { BotSettingsScreen } from '../screens/bot/mascot-settings-screen.tsx';
import type { Mascot, MascotFace, MascotLook } from '../state/bot-map.ts';
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
  const [look, setLook] = createSignal<MascotLook>('meadow');
  const [face, setFace] = createSignal<MascotFace>('idle');
  const [error, setError] = createSignal('');

  return (
    <CreateMascotScreen
      name={name()}
      onName={setName}
      look={look()}
      onLook={setLook}
      face={face()}
      onFace={setFace}
      error={error()}
      onCreate={() => void createAndGo({ name: name(), look: look(), face: face(), navigate, setError })}
    />
  );
}

async function createAndGo(input: {
  name: string;
  look: MascotLook;
  face: MascotFace;
  navigate: (path: string) => void;
  setError: (value: string) => void;
}): Promise<void> {
  try {
    const mascot = await createMascot(input.name, input.look, input.face);
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
  const [celebrating, setCelebrating] = createSignal(false);

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
          setCelebrating,
        })
      }
      sending={sending()}
      celebrating={celebrating()}
      onMarkSettled={() => setCelebrating(false)}
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
  setCelebrating: (value: boolean) => void;
}): Promise<void> {
  const text = input.draft.trim();
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
  const mascot = useBotMascot();
  const [error, setError] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  /**
   * Applies one change.
   *
   * Errors land on the screen rather than being swallowed: a look button that
   * silently did nothing would look like the control was decorative, which is what
   * this screen used to be.
   */
  const apply = (patch: { name?: string; look?: MascotLook; face?: MascotFace }) => {
    const id = mascot()?.id;
    if (!id) return;
    setSaving(true);
    setError('');
    void updateMascot(id, patch)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught)))
      .finally(() => setSaving(false));
  };

  return (
    <BotSettingsScreen
      mascot={mascot()}
      error={error()}
      saving={saving()}
      onRename={(name) => apply({ name })}
      onLook={(look) => apply({ look })}
      onFace={(face) => apply({ face })}
      onDelete={() => {
        const id = mascot()?.id;
        if (!id) return;
        void removeMascot(id)
          .then(() => navigate('/bot'))
          .catch((caught: unknown) =>
            setError(caught instanceof Error ? caught.message : String(caught)),
          );
      }}
      onBack={() => navigate('/bot')}
      onGo={(path) => navigate(path)}
    />
  );
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
    // Asked once per box rather than per frame: the answer is a property of the
    // service and the box, and it does not change between screenshots.
    void probeDesktopTransport(current.id);
    const timer = setInterval(() => void refreshScreenshot(current.id), 800);
    onCleanup(() => clearInterval(timer));
  });
}

/**
 * `boxError` is passed through here for the first time. It was already being set by
 * `bot-computer-live` on every failed screenshot, shell command and file read, and no
 * screen ever received it — so a box that had stopped answering looked merely idle.
 */
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
      error={boxError()}
      transport={desktopTransport()}
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
