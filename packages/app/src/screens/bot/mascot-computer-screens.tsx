import { createSignal, For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { ComputerDesktop, type DesktopTransport } from './computer-desktop.tsx';
import { FilesPanel, TerminalPanel } from './computer-panels.tsx';
import { MascotRail, mascotLinks } from './mascot-rail.tsx';
import {
  computerIsOffline,
  type Mascot,
  type MascotColor,
  type MascotShape,
} from '../../state/bot-map.ts';
import type { ApiFilePreview, ApiFsEntry, ComputerInput } from '@cortex-ide/cortex-api';

import '../chat/product-pages.css';

export function BotComputerScreen(props: {
  mascot?: Mascot;
  screenshot?: string;
  shellLog: string;
  files: readonly ApiFsEntry[];
  preview?: ApiFilePreview;
  recording?: boolean;
  error?: string;
  transport?: DesktopTransport;
  onWake: () => void;
  onHibernate: () => void;
  onStop: () => void;
  onInput: (input: ComputerInput) => void;
  onShell: (command: string) => void;
  onOpenFile: (path: string) => void;
  onToggleRecord: () => void;
  onBack: () => void;
  onGo: (path: string) => void;
}): JSX.Element {
  return (
    <Show
      when={props.mascot}
      fallback={
        <HonestState kind="error" title="Mascot not found" body="No computer without a mascot." actionLabel="Back" onAction={props.onBack} />
      }
    >
      {(mascot) => (
        <ComputerBody
          mascot={mascot()}
          screenshot={props.screenshot}
          shellLog={props.shellLog}
          files={props.files}
          preview={props.preview}
          recording={props.recording}
          error={props.error}
          transport={props.transport}
          onWake={props.onWake}
          onHibernate={props.onHibernate}
          onStop={props.onStop}
          onInput={props.onInput}
          onShell={props.onShell}
          onOpenFile={props.onOpenFile}
          onToggleRecord={props.onToggleRecord}
          onGo={props.onGo}
        />
      )}
    </Show>
  );
}

interface ComputerBodyProps {
  mascot: Mascot;
  screenshot?: string;
  shellLog: string;
  files: readonly ApiFsEntry[];
  preview?: ApiFilePreview;
  recording?: boolean;
  error?: string;
  transport?: DesktopTransport;
  onWake: () => void;
  onHibernate: () => void;
  onStop: () => void;
  onInput: (input: ComputerInput) => void;
  onShell: (command: string) => void;
  onOpenFile: (path: string) => void;
  onToggleRecord: () => void;
  onGo: (path: string) => void;
}

function ComputerBody(props: ComputerBodyProps): JSX.Element {
  const spec = props.mascot.computer.spec;
  return (
    <>
      <PageHeader title="Computer" subtitle={`${props.mascot.name} · ${spec.arch} · ${spec.vcpu} vCPU · ${spec.memoryGiB} GiB`} />
      <PageBody width="list">
        <MascotRail links={mascotLinks(props.mascot.id, 'computer', props.onGo)} />
        <Show when={props.error}>
          <HonestState kind="error" title="Computer error" body={props.error ?? ''} />
        </Show>
        <ComputerStates
          offline={computerIsOffline(props.mascot.computer)}
          asleep={props.mascot.computer.status === 'hibernated' || props.mascot.computer.status === 'stopped'}
          screenshot={props.screenshot}
          shellLog={props.shellLog}
          files={props.files}
          preview={props.preview}
          recording={props.recording}
          transport={props.transport}
          onWake={props.onWake}
          onHibernate={props.onHibernate}
          onStop={props.onStop}
          onInput={props.onInput}
          onShell={props.onShell}
          onOpenFile={props.onOpenFile}
          onToggleRecord={props.onToggleRecord}
        />
      </PageBody>
    </>
  );
}

function ComputerStates(props: {
  offline: boolean;
  asleep: boolean;
  screenshot?: string;
  shellLog: string;
  files: readonly ApiFsEntry[];
  preview?: ApiFilePreview;
  recording?: boolean;
  transport?: DesktopTransport;
  onWake: () => void;
  onHibernate: () => void;
  onStop: () => void;
  onInput: (input: ComputerInput) => void;
  onShell: (command: string) => void;
  onOpenFile: (path: string) => void;
  onToggleRecord: () => void;
}): JSX.Element {
  if (props.offline) {
    return <HonestState kind="error" title="Computer offline" body="The farm or local daemon is not connected. This is not a live desktop." actionLabel="Retry wake" onAction={props.onWake} />;
  }
  if (props.asleep) {
    return <HonestState kind="empty" title="Hibernated" body="Unused farm machines sleep. Wake to resume this mascot’s dedicated box." actionLabel="Wake" onAction={props.onWake} />;
  }
  return <LiveComputerPanels {...props} />;
}

function LiveComputerPanels(props: {
  screenshot?: string;
  shellLog: string;
  files: readonly ApiFsEntry[];
  preview?: ApiFilePreview;
  recording?: boolean;
  transport?: DesktopTransport;
  onHibernate: () => void;
  onStop: () => void;
  onInput: (input: ComputerInput) => void;
  onShell: (command: string) => void;
  onOpenFile: (path: string) => void;
  onToggleRecord: () => void;
}): JSX.Element {
  return (
    <>
      <ComputerDesktop
        src={props.screenshot}
        offline={false}
        transport={props.transport}
        onInput={props.onInput}
      />
      <TerminalPanel log={props.shellLog} onRun={props.onShell} />
      <FilesPanel entries={props.files} preview={props.preview} onOpen={props.onOpenFile} />
      <div class="cx-mascot-rail">
        <Button variant="secondary" onClick={() => props.onHibernate()}>Hibernate</Button>
        <Button variant="secondary" onClick={() => props.onStop()}>Stop</Button>
        <Button variant="secondary" onClick={() => props.onToggleRecord()}>
          {props.recording ? 'Stop recording' : 'Record'}
        </Button>
      </div>
    </>
  );
}

const SHAPES: readonly MascotShape[] = ['round', 'square', 'tall', 'wide'];
const COLORS: readonly MascotColor[] = ['green', 'terracotta', 'ink'];

/**
 * Shape and colour, editable.
 *
 * The same segmented controls the create screen uses, so a mascot is not permanently
 * whatever it was made as. `PATCH /v1/mascots/{id}` has always been in the client;
 * this screen simply printed the values as prose and offered no way to change them.
 */
function Appearance(props: {
  shape: MascotShape;
  color: MascotColor;
  onShape: (shape: MascotShape) => void;
  onColor: (color: MascotColor) => void;
}): JSX.Element {
  return (
    <>
      <h3 class="cx-product-section">Shape</h3>
      <div class="cx-mascot-rail">
        <For each={SHAPES}>
          {(shape) => (
            <Button
              variant={props.shape === shape ? 'primary' : 'secondary'}
              aria-pressed={props.shape === shape}
              onClick={() => props.onShape(shape)}
            >
              {shape}
            </Button>
          )}
        </For>
      </div>
      <h3 class="cx-product-section">Colour</h3>
      <div class="cx-mascot-rail">
        <For each={COLORS}>
          {(color) => (
            <Button
              variant={props.color === color ? 'primary' : 'secondary'}
              aria-pressed={props.color === color}
              onClick={() => props.onColor(color)}
            >
              {color}
            </Button>
          )}
        </For>
      </div>
    </>
  );
}

export interface BotSettingsScreenProps {
  mascot?: Mascot;
  error?: string;
  saving?: boolean;
  onRename: (name: string) => void;
  onShape: (shape: MascotShape) => void;
  onColor: (color: MascotColor) => void;
  onDelete: () => void;
  onBack: () => void;
  onGo: (path: string) => void;
}

export function BotSettingsScreen(props: BotSettingsScreenProps): JSX.Element {
  const [name, setName] = createSignal<string | undefined>();
  const [confirming, setConfirming] = createSignal(false);

  return (
    <Show
      when={props.mascot}
      fallback={<HonestState kind="error" title="Mascot not found" body="Settings need a mascot." actionLabel="Back" onAction={props.onBack} />}
    >
      {(mascot) => (
        <>
          <PageHeader title="Mascot settings" subtitle={mascot().name} />
          <PageBody width="settings">
            <MascotRail links={mascotLinks(mascot().id, 'settings', props.onGo)} />
            <Show when={props.error}>
              <p class="cx-product-error" role="alert">{props.error}</p>
            </Show>

            <form
              class="cx-product-form"
              onSubmit={(event) => {
                event.preventDefault();
                props.onRename(name() ?? mascot().name);
              }}
            >
              <input
                type="text"
                value={name() ?? mascot().name}
                aria-label="Mascot name"
                onInput={(event) => setName(event.currentTarget.value)}
              />
              <Button variant="secondary" type="submit" disabled={props.saving}>Rename</Button>
            </form>

            <Appearance
              shape={mascot().shape}
              color={mascot().color}
              onShape={props.onShape}
              onColor={props.onColor}
            />

            <h3 class="cx-product-section">Computer</h3>
            <p class="cx-product-row__meta">
              The computer id {mascot().computer.id} is bound to this mascot and cannot be
              reassigned.
            </p>

            <h3 class="cx-product-section">Delete</h3>
            <Show
              when={confirming()}
              fallback={
                <Button variant="secondary" onClick={() => setConfirming(true)}>
                  Delete mascot
                </Button>
              }
            >
              {/* Confirmed because the dedicated computer goes with it, and this
                  client cannot undo either. */}
              <p class="cx-product-row__meta">
                Deleting {mascot().name} also destroys its dedicated computer and everything
                on it.
              </p>
              <div class="cx-mascot-rail">
                <Button variant="destructive" onClick={() => props.onDelete()}>
                  Delete permanently
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            </Show>
          </PageBody>
        </>
      )}
    </Show>
  );
}
