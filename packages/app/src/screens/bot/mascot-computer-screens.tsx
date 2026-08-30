import { type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { ComputerRail } from './computer-rail.tsx';
import { FilesPanel, TerminalPanel } from './computer-panels.tsx';
import { MascotRail, mascotLinks } from './mascot-rail.tsx';
import { type ComputerRuntime, type Mascot } from '../../state/bot-map.ts';
import type { ApiFilePreview, ApiFsEntry, ComputerInput } from '@cortex-ide/cortex-api';

import '../chat/product-pages.css';
import './bot-teammate.css';

export function BotComputerScreen(props: {
  mascot?: Mascot;
  screenshot?: string;
  streamUrl?: string;
  hasControl?: boolean;
  signedIn?: boolean;
  shellLog: string;
  files: readonly ApiFsEntry[];
  preview?: ApiFilePreview;
  recording?: boolean;
  error?: string;
  onWake: () => void;
  onHibernate: () => void;
  onStop: () => void;
  onTakeControl?: () => void;
  onRelease?: () => void;
  onRuntime?: (runtime: ComputerRuntime) => void;
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
        <HonestState
          kind="error"
          title="Mascot not found"
          body="No computer without a mascot."
          actionLabel="Back"
          onAction={props.onBack}
        />
      }
    >
      {(mascot) => <ComputerBody mascot={mascot()} {...props} />}
    </Show>
  );
}

type ComputerBodyProps = {
  mascot: Mascot;
  screenshot?: string;
  streamUrl?: string;
  hasControl?: boolean;
  signedIn?: boolean;
  shellLog: string;
  files: readonly ApiFsEntry[];
  preview?: ApiFilePreview;
  recording?: boolean;
  error?: string;
  onWake: () => void;
  onHibernate: () => void;
  onStop: () => void;
  onTakeControl?: () => void;
  onRelease?: () => void;
  onRuntime?: (runtime: ComputerRuntime) => void;
  onInput: (input: ComputerInput) => void;
  onShell: (command: string) => void;
  onOpenFile: (path: string) => void;
  onToggleRecord: () => void;
  onGo: (path: string) => void;
};

function ComputerBody(props: ComputerBodyProps): JSX.Element {
  return (
    <>
      <PageHeader title="Computer" subtitle={props.mascot.name} />
      <PageBody width="list">
        <MascotRail links={mascotLinks(props.mascot.id, 'computer', props.onGo)} />
        <Show when={props.error}>
          <HonestState kind="error" title="Computer error" body={props.error ?? ''} />
        </Show>
        <PageComputerRail {...props} />
        <Show when={props.mascot.computer.status === 'running'}>
          <ComputerExtras {...props} />
        </Show>
      </PageBody>
    </>
  );
}

function PageComputerRail(props: ComputerBodyProps): JSX.Element {
  return (
    <ComputerRail
      mascot={props.mascot}
      screenshot={props.screenshot}
      streamUrl={props.streamUrl}
      hasControl={props.hasControl === true}
      signedIn={props.signedIn}
      onTakeControl={() => props.onTakeControl?.()}
      onRelease={() => props.onRelease?.()}
      onWake={props.onWake}
      onRuntime={(runtime) => props.onRuntime?.(runtime)}
      onInput={props.onInput}
    />
  );
}

function ComputerExtras(props: {
  shellLog: string;
  files: readonly ApiFsEntry[];
  preview?: ApiFilePreview;
  recording?: boolean;
  onHibernate: () => void;
  onStop: () => void;
  onShell: (command: string) => void;
  onOpenFile: (path: string) => void;
  onToggleRecord: () => void;
}): JSX.Element {
  return (
    <div class="cx-computer-page__extras">
      <div class="cx-computer-page__actions">
        <Button variant="secondary" onClick={() => props.onHibernate()}>
          Hibernate
        </Button>
        <Button variant="secondary" onClick={() => props.onStop()}>
          Stop
        </Button>
        <Button variant="secondary" onClick={() => props.onToggleRecord()}>
          {props.recording ? 'Stop recording' : 'Record'}
        </Button>
      </div>
      <details>
        <summary>Shell</summary>
        <TerminalPanel log={props.shellLog} onRun={props.onShell} />
      </details>
      <details>
        <summary>Files</summary>
        <FilesPanel entries={props.files} preview={props.preview} onOpen={props.onOpenFile} />
      </details>
    </div>
  );
}
