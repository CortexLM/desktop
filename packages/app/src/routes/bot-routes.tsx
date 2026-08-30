import { createEffect, createSignal, type JSX } from 'solid-js';
import { useNavigate, useParams } from '@solidjs/router';

import {
  runLifecycle,
  sendComputerInput,
  setRecording,
} from '../state/bot-actions.ts';
import { pickComputerRuntime, runComputerControl } from '../state/bot-control.ts';
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
  openFile,
  preview,
  recording,
  runShell,
  setRecordingFlagValue,
  shellLog,
} from '../state/bot-computer-live.ts';
import { liveRailPaint } from '../state/computer-rail-paint.ts';
import { CreateMascotScreen, MascotListScreen } from '../screens/bot/mascot-screens.tsx';
import { BotMessagesScreen, BotVideosScreen } from '../screens/bot/mascot-detail-screens.tsx';
import { BotComputerScreen } from '../screens/bot/mascot-computer-screens.tsx';
import { BotSettingsScreen } from '../screens/bot/mascot-settings-screen.tsx';
import { useAccount } from '../state/session-context.tsx';
import { guestBlocked } from '../state/guest-lock.ts';
import type { Mascot, MascotFace, MascotLook } from '../state/bot-map.ts';
import { useBotMascot } from './bot-mascot.ts';
import { bindComputerLive } from './bot-computer-bind.ts';

export {
  BotGroupsRoute,
  BotMemoryRoute,
  BotRoutinesRoute,
  BotSkillsRoute,
} from './bot-runtime-routes.tsx';

export { BotConversationRoute } from './bot-conversation-route.tsx';
export { BotApprovalsRoute } from './bot-approvals-route.tsx';

export function BotHomeRoute(): JSX.Element {
  const navigate = useNavigate();
  const account = useAccount();
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
      onCreate={() => {
        if (guestBlocked(account.capabilities().authenticated)) return;
        navigate('/bot/new');
      }}
    />
  );
}

export function BotCreateRoute(): JSX.Element {
  const navigate = useNavigate();
  const account = useAccount();
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
      onCreate={() => {
        if (guestBlocked(account.capabilities().authenticated)) return;
        void createAndGo({ name: name(), look: look(), face: face(), navigate, setError });
      }}
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
  const account = useAccount();
  const params = useParams<{ mascotId: string }>();
  const mascot = useBotMascot();
  bindComputerLive(() => params.mascotId, { files: true });
  return (
    <LiveComputer
      routeId={params.mascotId}
      mascot={mascot()}
      signedIn={Boolean(account.user())}
      navigate={navigate}
    />
  );
}

function LiveComputer(props: {
  routeId: string | undefined;
  mascot: Mascot | undefined;
  signedIn: boolean;
  navigate: (path: string) => void;
}): JSX.Element {
  const [controlError, setComputerError] = createSignal('');
  const id = () => props.routeId;
  const rail = () => liveRailPaint(id(), props.mascot);
  return (
    <BotComputerScreen
      mascot={props.mascot}
      screenshot={rail().screenshotUrl}
      streamUrl={rail().streamUrl}
      hasControl={props.mascot?.id === id() && props.mascot?.computer.controlHolder === 'user'}
      signedIn={props.signedIn}
      shellLog={shellLog()}
      files={fsEntries()}
      preview={preview()}
      recording={recording()}
      error={controlError() || boxError()}
      onWake={() => void withId(id(), (current) => runLifecycle(current, 'resume'))}
      onHibernate={() => void withId(id(), (current) => runLifecycle(current, 'hibernate'))}
      onStop={() => void withId(id(), (current) => runLifecycle(current, 'stop'))}
      onTakeControl={() => void runComputerControl(id(), 'take', setComputerError)}
      onRelease={() => void runComputerControl(id(), 'release', setComputerError)}
      onRuntime={(runtime) => void pickComputerRuntime(id(), runtime, setComputerError)}
      onInput={(input) => void withId(id(), (current) => sendComputerInput(current, input))}
      onShell={(command) => void withId(id(), (current) => runShell(current, command))}
      onOpenFile={(path) => void withId(id(), (current) => openFile(current, path))}
      onToggleRecord={() => void toggleRecord(id())}
      onBack={() => props.navigate('/bot')}
      onGo={(path) => props.navigate(path)}
    />
  );
}

function withId(id: string | undefined, work: (id: string) => Promise<unknown> | void): void {
  if (id) void work(id);
}

async function toggleRecord(mascotId: string | undefined): Promise<void> {
  if (!mascotId) return;
  const next = recording() ? 'stop' : 'start';
  await setRecording(mascotId, next);
  setRecordingFlagValue(next === 'start');
}
