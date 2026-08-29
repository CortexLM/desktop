import { type JSX, Match, Show, Switch } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { ComputerDesktop, type DesktopTransport } from './computer-desktop.tsx';
import { FilesPanel, TerminalPanel } from './computer-panels.tsx';
import { MascotRail, mascotLinks } from './mascot-rail.tsx';
import { computerIsMissing, computerIsOffline, type Mascot } from '../../state/bot-map.ts';
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

/**
 * The hardware line, only when the service reported hardware.
 *
 * It used to read "x86_64 · 4 vCPU · 16 GiB" for every mascot, including ones
 * with no machine at all, because those three numbers were defaults filled in
 * by the mapper rather than anything the farm had said.
 */
function computerSubtitle(mascot: Mascot): string {
  const spec = mascot.computer.spec;
  if (!spec) return mascot.name;
  return `${mascot.name} · ${spec.arch} · ${spec.vcpu} vCPU · ${spec.memoryGiB} GiB`;
}

function ComputerBody(props: ComputerBodyProps): JSX.Element {
  return (
    <>
      <PageHeader title="Computer" subtitle={computerSubtitle(props.mascot)} />
      <PageBody width="list">
        <MascotRail links={mascotLinks(props.mascot.id, 'computer', props.onGo)} />
        <Show when={props.error}>
          <HonestState kind="error" title="Computer error" body={props.error ?? ''} />
        </Show>
        <ComputerStates
          missing={computerIsMissing(props.mascot.computer)}
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
  missing: boolean;
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
  // `Switch` / `Match` rather than early `return`s: a component body runs once in
  // Solid, so the `if` chain this replaced meant a box that woke never showed its
  // panels — the screen stayed on whichever state was true at first paint.
  return (
    <Switch fallback={<LiveComputerPanels {...props} />}>
      <Match when={props.missing}>
        <HonestState
          kind="empty"
          title="No computer yet"
          body="Cortex has not provisioned a machine for this mascot. There is nothing to wake, and nothing to show."
        />
      </Match>
      <Match when={props.offline}>
        <HonestState
          kind="error"
          title="Computer offline"
          body="The farm or local daemon is not connected. This is not a live desktop."
          actionLabel="Retry wake"
          onAction={props.onWake}
        />
      </Match>
      <Match when={props.asleep}>
        <HonestState
          kind="empty"
          title="Hibernated"
          body="Unused farm machines sleep. Wake to resume this mascot’s dedicated box."
          actionLabel="Wake"
          onAction={props.onWake}
        />
      </Match>
    </Switch>
  );
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
