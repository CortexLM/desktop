import { For, type JSX, Show } from 'solid-js';

import { Button, Icon, TabPanel, Tabs, type TabDefinition } from '@cortex-ide/ui';

import { DiffView, type DiffFile } from './diff-view.tsx';
import { PlanList, SessionTimeline, type SessionTimelineProps } from './session-timeline.tsx';

import './session-detail.css';

export type WorkbenchTab = 'shell' | 'files' | 'changes' | 'plan';

export interface SessionDetailScreenProps extends SessionTimelineProps {
  title: string;
  /** Repo, branch and start time, joined by the caller. */
  meta: string;
  /** True while the agent is still working; drives Stop versus the finished actions. */
  running: boolean;
  activeTab: WorkbenchTab;
  onTabChange: (tab: WorkbenchTab) => void;
  files: readonly DiffFile[];
  /** Rendered in the Terminal tab. Owned by the host, which has the pty. */
  shell?: JSX.Element;
  error?: string;
  onStop?: () => void;
  onBack: () => void;
}

function workbenchTabs(fileCount: number): TabDefinition[] {
  return [
    { id: 'shell', label: 'Terminal', icon: 'terminal' },
    { id: 'files', label: 'Files', icon: 'file', count: fileCount },
    { id: 'changes', label: 'Diff', icon: 'changes', count: fileCount },
    { id: 'plan', label: 'Plan', icon: 'reason' },
  ];
}

function SessionHeader(props: {
  title: string;
  meta: string;
  running: boolean;
  onBack: () => void;
  onStop?: () => void;
}): JSX.Element {
  return (
    <header class="cx-session__header">
      <button
        type="button"
        class="cx-session__back"
        onClick={() => props.onBack()}
        aria-label="Back to sessions"
      >
        <Icon name="back" size={14} />
      </button>

      <div class="cx-session__titles">
        <h1 class="cx-session__title">{props.title}</h1>
        <p class="cx-session__meta">{props.meta}</p>
      </div>

      <div class="cx-session__actions">
        <Show when={props.running && props.onStop}>
          {(stop) => (
            <Button variant="ghost" onClick={() => stop()()}>
              Stop
            </Button>
          )}
        </Show>
      </div>
    </header>
  );
}

function FilesPanel(props: { files: readonly DiffFile[] }): JSX.Element {
  return (
    <Show when={props.files.length > 0} fallback={<p class="cx-session__empty">No file changes yet.</p>}>
      <ul class="cx-session__files">
        <For each={props.files}>{(file) => <li class="cx-session__file">{file.path}</li>}</For>
      </ul>
    </Show>
  );
}

function PlanPanel(props: SessionTimelineProps): JSX.Element {
  return (
    <Show
      when={props.plan?.length || props.planMermaid}
      fallback={<p class="cx-session__empty">No plan yet. Start in Plan mode to write one.</p>}
    >
      <Show when={props.planMermaid}>
        {(diagram) => (
          <pre class="cx-plan__mermaid" aria-label="Plan diagram">
            {diagram()}
          </pre>
        )}
      </Show>
      <Show when={props.plan?.length ? props.plan : undefined}>
        {(steps) => <PlanList steps={steps()} />}
      </Show>
    </Show>
  );
}

export function SessionDetailScreen(props: SessionDetailScreenProps): JSX.Element {
  return (
    <div class="cx-session">
      <SessionHeader
        title={props.title}
        meta={props.meta}
        running={props.running}
        onBack={props.onBack}
        onStop={props.onStop}
      />

      <Show when={props.error}>
        {(message) => (
          <p class="cx-session__error" role="alert">
            {message()}
          </p>
        )}
      </Show>

      <div class="cx-session__body">
        <div class="cx-session__timeline">
          <SessionTimeline {...props} />
        </div>

        <div class="cx-session__workbench">
          <Tabs
            tabs={workbenchTabs(props.files.length)}
            active={props.activeTab}
            onChange={(id) => props.onTabChange(id as WorkbenchTab)}
            label="Session workbench"
          />

          <TabPanel tabId="shell" active={props.activeTab}>
            {props.shell}
          </TabPanel>
          <TabPanel tabId="files" active={props.activeTab}>
            <FilesPanel files={props.files} />
          </TabPanel>
          <TabPanel tabId="changes" active={props.activeTab}>
            <DiffView files={props.files} />
          </TabPanel>
          <TabPanel tabId="plan" active={props.activeTab}>
            <PlanPanel {...props} />
          </TabPanel>
        </div>
      </div>
    </div>
  );
}
