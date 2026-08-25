import { type JSX, Show } from 'solid-js';

import { Button, Icon, TabPanel, Tabs, type TabDefinition } from '@cortex-ide/ui';

import { DiffView, type DiffFile } from './diff-view.tsx';
import { SessionTimeline, type SessionTimelineProps } from './session-timeline.tsx';

import './session-detail.css';

export type WorkbenchTab = 'shell' | 'changes' | 'pr' | 'browser';

export interface SessionDetailScreenProps extends SessionTimelineProps {
  title: string;
  /** Repo, branch and start time, joined by the caller. */
  meta: string;
  /** True while the agent is still working; drives Stop versus the finished actions. */
  running: boolean;
  activeTab: WorkbenchTab;
  onTabChange: (tab: WorkbenchTab) => void;
  files: readonly DiffFile[];
  /** Rendered in the Shell tab. Owned by the host, which has the pty. */
  shell?: JSX.Element;
  /** Rendered in the PR tab. */
  pullRequest?: JSX.Element;
  /** Rendered in the Browser tab. */
  browser?: JSX.Element;
  /** Present once the agent has opened one. */
  pullRequestNumber?: number;
  onBack: () => void;
  onStop?: () => void;
  onOpenPullRequest?: () => void;
}

/**
 * The workbench tabs.
 *
 * Changes carries the file count so the badge is a fact rather than a decoration; the other
 * three have nothing countable, and inventing a zero would be noise.
 */
function workbenchTabs(fileCount: number): TabDefinition[] {
  return [
    { id: 'shell', label: 'Shell', icon: 'terminal' },
    { id: 'changes', label: 'Changes', icon: 'changes', count: fileCount },
    { id: 'pr', label: 'PR', icon: 'pullRequest' },
    { id: 'browser', label: 'Browser', icon: 'browser' },
  ];
}

function SessionHeader(props: {
  title: string;
  meta: string;
  running: boolean;
  pullRequestNumber?: number;
  onBack: () => void;
  onStop?: () => void;
  onOpenPullRequest?: () => void;
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
        {/* Stop only exists while there is something to stop. Leaving it visible but
            disabled on a finished session would suggest the agent might still be running. */}
        <Show when={props.running && props.onStop}>
          {(stop) => (
            <Button variant="ghost" onClick={() => stop()()}>
              Stop
            </Button>
          )}
        </Show>
        <Show when={props.pullRequestNumber !== undefined}>
          <Button variant="secondary" icon="pullRequest" onClick={() => props.onOpenPullRequest?.()}>
            View PR #{props.pullRequestNumber}
          </Button>
        </Show>
      </div>
    </header>
  );
}

/**
 * Session Detail: the agent timeline beside the workbench.
 *
 * The Session Detail (Focus) artboard is this screen at the full window width with the
 * sidebar hidden. That is a shell decision, not a different screen, so there is one
 * component for both.
 */
export function SessionDetailScreen(props: SessionDetailScreenProps): JSX.Element {
  return (
    <div class="cx-session">
      <SessionHeader
        title={props.title}
        meta={props.meta}
        running={props.running}
        pullRequestNumber={props.pullRequestNumber}
        onBack={props.onBack}
        onStop={props.onStop}
        onOpenPullRequest={props.onOpenPullRequest}
      />

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
          <TabPanel tabId="changes" active={props.activeTab}>
            <DiffView files={props.files} />
          </TabPanel>
          <TabPanel tabId="pr" active={props.activeTab}>
            {props.pullRequest}
          </TabPanel>
          <TabPanel tabId="browser" active={props.activeTab}>
            {props.browser}
          </TabPanel>
        </div>
      </div>
    </div>
  );
}
