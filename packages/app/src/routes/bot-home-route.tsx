/**
 * Bot home (first mascot or roster) and create. Computer host is This PC,
 * SSH, or Cloud — never a loop cap.
 */

import { createEffect, createSignal, Match, Switch, type JSX } from 'solid-js';
import { useNavigate } from '@solidjs/router';

import { classifyBotError, type AppSurface, type ComputerKind } from '@cortex-ide/cortex-api';

import { createMascot, loadError, loadState, mascots, reconcileMascots } from '../state/bots.ts';
import { hasElectronHost } from '../state/electron-bridge.ts';
import { useAccount } from '../state/session-context.tsx';
import { CreateMascotScreen, MascotListScreen } from '../screens/bot/mascot-screens.tsx';
import { FirstBotSetup, SignedOutFirstBot } from '../screens/bot/first-bot-setup.tsx';
import { computerHostOptions, defaultComputerKind } from '../screens/bot/computer-host.ts';
import { PageBody, PageHeader } from '../shell/app-shell.tsx';
import type { MascotFace, MascotLook } from '../state/bot-map.ts';

export function BotHomeRoute(): JSX.Element {
  const navigate = useNavigate();
  const account = useAccount();
  createEffect(() => {
    void reconcileMascots();
  });
  const signedIn = () => Boolean(account.user());
  const emptyReady = () => loadState() === 'ready' && mascots().length === 0;

  return (
    <Switch fallback={<Roster onOpen={(id) => navigate(`/bot/${id}`)} onCreate={() => navigate('/bot/new')} />}>
      <Match when={emptyReady() && !signedIn()}>
        <SignedOutHome onSignIn={() => navigate('/sign-in')} />
      </Match>
      <Match when={emptyReady() && signedIn()}>
        <FirstBotHome onCreated={(id) => navigate(`/bot/${id}`)} />
      </Match>
    </Switch>
  );
}

export function BotCreateRoute(): JSX.Element {
  const navigate = useNavigate();
  const form = useMascotForm();
  return (
    <CreateMascotScreen
      name={form.name()}
      onName={form.setName}
      look={form.look()}
      onLook={form.setLook}
      face={form.face()}
      onFace={form.setFace}
      computerKind={form.computerKind()}
      onComputerKind={form.setComputerKind}
      hosts={form.hosts()}
      error={form.error()}
      onCreate={() => void createAndGo({ ...form.snapshot(), navigate, setError: form.setError })}
    />
  );
}

function Roster(props: { onOpen: (id: string) => void; onCreate: () => void }): JSX.Element {
  return (
    <MascotListScreen
      mascots={mascots()}
      loading={loadState() === 'loading'}
      unavailable={loadState() === 'unavailable'}
      error={loadState() === 'error' ? loadError() : undefined}
      onOpen={props.onOpen}
      onCreate={props.onCreate}
    />
  );
}

function SignedOutHome(props: { onSignIn: () => void }): JSX.Element {
  return (
    <>
      <PageHeader title="Bot" subtitle="Each mascot owns one dedicated computer. Machines are never shared." />
      <PageBody width="settings">
        <SignedOutFirstBot onSignIn={props.onSignIn} />
      </PageBody>
    </>
  );
}

function FirstBotHome(props: { onCreated: (id: string) => void }): JSX.Element {
  const form = useMascotForm();
  const [creating, setCreating] = createSignal(false);
  return (
    <>
      <PageHeader title="Bot" subtitle="Each mascot owns one dedicated computer. Machines are never shared." />
      <PageBody width="settings">
        <FirstBotSetup
          name={form.name()}
          onName={form.setName}
          look={form.look()}
          onLook={form.setLook}
          face={form.face()}
          onFace={form.setFace}
          computerKind={form.computerKind()}
          onComputerKind={form.setComputerKind}
          hosts={form.hosts()}
          creating={creating()}
          error={form.error()}
          onCreate={() =>
            void createFirst({
              ...form.snapshot(),
              setError: form.setError,
              setCreating,
              onCreated: props.onCreated,
            })
          }
        />
      </PageBody>
    </>
  );
}

function useMascotForm() {
  const account = useAccount();
  const surface = appSurface();
  const [name, setName] = createSignal('');
  const [look, setLook] = createSignal<MascotLook>('meadow');
  const [face, setFace] = createSignal<MascotFace>('idle');
  const [computerKind, setComputerKind] = createSignal<ComputerKind | undefined>();
  const [error, setError] = createSignal('');
  createEffect(() => {
    if (computerKind()) return;
    const next = defaultComputerKind(account.capabilities(), surface);
    if (next) setComputerKind(next);
  });
  return {
    name,
    setName,
    look,
    setLook,
    face,
    setFace,
    computerKind,
    setComputerKind,
    error,
    setError,
    hosts: () => computerHostOptions(account.capabilities(), surface),
    snapshot: () => ({ name: name(), look: look(), face: face(), computerKind: computerKind() }),
  };
}

function appSurface(): AppSurface {
  return hasElectronHost() ? 'electron' : 'browser';
}

async function createAndGo(input: {
  name: string;
  look: MascotLook;
  face: MascotFace;
  computerKind?: ComputerKind;
  navigate: (path: string) => void;
  setError: (value: string) => void;
}): Promise<void> {
  try {
    const mascot = await createMascot(input.name, input.look, input.face, input.computerKind);
    input.navigate(`/bot/${mascot.id}`);
  } catch (caught) {
    input.setError(classifyBotError(caught).message);
  }
}

async function createFirst(input: {
  name: string;
  look: MascotLook;
  face: MascotFace;
  computerKind?: ComputerKind;
  setError: (value: string) => void;
  setCreating: (value: boolean) => void;
  onCreated: (id: string) => void;
}): Promise<void> {
  input.setCreating(true);
  input.setError('');
  try {
    const mascot = await createMascot(input.name, input.look, input.face, input.computerKind);
    input.onCreated(mascot.id);
  } catch (caught) {
    input.setError(classifyBotError(caught).message);
  } finally {
    input.setCreating(false);
  }
}
