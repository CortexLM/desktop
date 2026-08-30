/**
 * Dedicated computer page for a mascot. Screenshot poll plus noVNC when the
 * farm minted a stream URL. Extracted from bot-routes so that file stays
 * inside the line budget.
 */

import { createEffect, onCleanup, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { runLifecycle, sendComputerInput, setRecording } from '../state/bot-actions.ts';
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
import { desktopTransport, probeDesktopTransport, streamUrl, syncDesktopStream } from '../state/vnc-ticket.ts';
import { BotComputerScreen } from '../screens/bot/mascot-computer-screens.tsx';
import type { Mascot } from '../state/bot-map.ts';
import { useBotMascot } from './bot-mascot.ts';

export function BotComputerRoute(): JSX.Element {
  const navigate = useNavigate();
  const mascot = useBotMascot();
  useComputerPagePoll(mascot);
  return <LiveComputer mascotId={() => mascot()?.id} mascot={mascot()} navigate={navigate} />;
}

/** Conversation rail: frames + stream, no filesystem. */
export function useConversationDesktop(mascot: () => Mascot | undefined, open: () => boolean): void {
  createEffect(() => {
    const current = mascot();
    if (!current || !open()) return;
    syncDesktopStream(current.computer);
    if (current.computer.status !== 'running') return;
    void refreshScreenshot(current.id);
    void probeDesktopTransport(current.id);
    const timer = setInterval(() => void refreshScreenshot(current.id), 800);
    onCleanup(() => clearInterval(timer));
  });
}

function useComputerPagePoll(mascot: () => Mascot | undefined): void {
  createEffect(() => {
    const current = mascot();
    if (!current || current.computer.status !== 'running') return;
    syncDesktopStream(current.computer);
    void refreshScreenshot(current.id);
    void loadFs(current.id);
    void probeDesktopTransport(current.id);
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
      error={boxError()}
      transport={desktopTransport()}
      streamUrl={streamUrl()}
      {...lifecycleHandlers(id)}
      onBack={() => props.navigate('/bot')}
      onGo={(path) => props.navigate(path)}
    />
  );
}

function lifecycleHandlers(id: () => string | undefined) {
  return {
    onWake: () => void lifecycle(id(), 'resume'),
    onHibernate: () => void lifecycle(id(), 'hibernate'),
    onStop: () => void lifecycle(id(), 'stop'),
    onInput: (input: Parameters<typeof sendComputerInput>[1]) => {
      const current = id();
      if (current) void sendComputerInput(current, input);
    },
    onShell: (command: string) => {
      const current = id();
      if (current) void runShell(current, command);
    },
    onOpenFile: (path: string) => {
      const current = id();
      if (current) void openFile(current, path);
    },
    onToggleRecord: () => void toggleRecord(id()),
  };
}

function lifecycle(mascotId: string | undefined, action: 'resume' | 'hibernate' | 'stop'): void {
  if (mascotId) void runLifecycle(mascotId, action);
}

async function toggleRecord(mascotId: string | undefined): Promise<void> {
  if (!mascotId) return;
  const next = recording() ? 'stop' : 'start';
  await setRecording(mascotId, next);
  setRecordingFlagValue(next === 'start');
}
