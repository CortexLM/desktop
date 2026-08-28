import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import { RemoteStateView } from '../shared/remote-state-view.tsx';
import type { PlanningTemplate, ScheduledTask } from '../../state/planning.ts';
import type { RemoteState } from '../../state/remote-collection.ts';

import './product-pages.css';

export interface PlanningScreenProps {
  tasks: readonly ScheduledTask[];
  state: RemoteState;
  error?: string;
  signedIn: boolean;
  /** Cortex-authored jobs not yet on the schedule. */
  templates: readonly PlanningTemplate[];
  onToggle: (id: string) => void;
  onRun: (id: string) => void;
  onAdd: (template: PlanningTemplate) => void;
  onRetry: () => void;
  onSignIn: () => void;
}

function cadenceLabel(cadence: 'daily' | 'weekly'): string {
  return cadence === 'weekly' ? 'Weekly' : 'Daily';
}

function TaskRow(props: {
  task: ScheduledTask;
  locked: boolean;
  onToggle: () => void;
  onRun: () => void;
}): JSX.Element {
  return (
    <div class="cx-product-row" data-task={props.task.id}>
      <div>
        <div class="cx-product-row__title">{props.task.title}</div>
        <p class="cx-product-row__meta">
          {cadenceLabel(props.task.cadence)} · {props.task.status === 'active' ? 'Active' : 'Paused'} · {props.task.summary}
        </p>
      </div>
      <div class="cx-product-row__action">
        <Show
          when={!props.locked}
          fallback={<span class="cx-product-row__meta">Cortex account</span>}
        >
          <Button variant="secondary" onClick={() => props.onToggle()}>
            {props.task.status === 'active' ? 'Pause' : 'Resume'}
          </Button>
          {' '}
          <Button variant="primary" onClick={() => props.onRun()}>
            Run now
          </Button>
        </Show>
      </div>
    </div>
  );
}

/**
 * The jobs Cortex offers to schedule.
 *
 * Shown below the list rather than only in the empty state: someone who added one
 * job should still be able to see the other four, and hiding them behind an empty
 * list would make the catalogue reachable exactly once.
 */
function TemplateList(props: {
  templates: readonly PlanningTemplate[];
  signedIn: boolean;
  onAdd: (template: PlanningTemplate) => void;
  onSignIn: () => void;
}): JSX.Element {
  return (
    <Show when={props.templates.length > 0}>
      <h3 class="cx-product-section">Jobs you can add</h3>
      <div class="cx-product-list">
        <For each={props.templates}>
          {(template) => (
            <div class="cx-product-row" data-template={template.id}>
              <div>
                <div class="cx-product-row__title">{template.title}</div>
                <p class="cx-product-row__meta">
                  {cadenceLabel(template.cadence)} · {template.summary}
                </p>
              </div>
              <div class="cx-product-row__action">
                <Show
                  when={!template.requiresAccount || props.signedIn}
                  fallback={
                    <Button variant="secondary" onClick={() => props.onSignIn()}>
                      Cortex account
                    </Button>
                  }
                >
                  <Button variant="secondary" onClick={() => props.onAdd(template)}>
                    Add
                  </Button>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

/**
 * Signed out there is no schedule to show, only the catalogue.
 *
 * The templates stay visible so what Planning is for is legible before signing in —
 * a bare gate would explain nothing about what an account buys.
 */
function SignedOut(props: PlanningScreenProps): JSX.Element {
  return (
    <>
      <HonestState
        kind="signed-out"
        title="Planning needs a Cortex account"
        body="A job has to run when this tab is closed, so the schedule lives on Cortex."
        actionLabel="Sign in"
        onAction={props.onSignIn}
      />
      <TemplateList
        templates={props.templates}
        signedIn={false}
        onAdd={props.onAdd}
        onSignIn={props.onSignIn}
      />
    </>
  );
}

function ScheduleList(props: PlanningScreenProps): JSX.Element {
  return (
    <div class="cx-product-list">
      <For each={props.tasks}>
        {(task) => (
          <TaskRow
            task={task}
            locked={Boolean(task.requiresAccount) && !props.signedIn}
            onToggle={() => props.onToggle(task.id)}
            onRun={() =>
              task.requiresAccount && !props.signedIn ? props.onSignIn() : props.onRun(task.id)
            }
          />
        )}
      </For>
    </div>
  );
}

/**
 * Scheduled tasks. The schedule is the account's; the five Cortex-authored jobs
 * are templates, and Subnet 100 is last and Cortex-only.
 */
export function PlanningScreen(props: PlanningScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Planning"
        subtitle="Recurring jobs that run on Cortex, on a cadence. Not a project plan."
      />
      <PageBody width="list">
        <Show when={props.signedIn} fallback={<SignedOut {...props} />}>
          <RemoteStateView
            state={props.state}
            {...(props.error ? { error: props.error } : {})}
            label="Planning"
            emptyTitle="No scheduled jobs"
            emptyBody="Add one of the jobs below and it will run on its cadence until you pause it."
            onRetry={props.onRetry}
          >
            <ScheduleList {...props} />
          </RemoteStateView>
          <Show when={props.state === 'ready' || props.state === 'empty'}>
            <TemplateList
              templates={props.templates}
              signedIn={props.signedIn}
              onAdd={props.onAdd}
              onSignIn={props.onSignIn}
            />
          </Show>
        </Show>
      </PageBody>
    </>
  );
}
