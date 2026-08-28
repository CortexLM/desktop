import { For, type JSX, Show } from 'solid-js';

import { Button } from '@cortex-ide/ui';

import { PageBody, PageHeader } from '../../shell/app-shell.tsx';
import { HonestState } from '../shared/honest-state.tsx';
import type { ScheduledTask } from '../../state/planning.ts';

import './product-pages.css';

export interface PlanningScreenProps {
  tasks: readonly ScheduledTask[];
  signedIn: boolean;
  loading?: boolean;
  error?: string;
  onToggle: (id: string) => void;
  onRun: (id: string) => void;
  onSignIn: () => void;
}

function cadenceLabel(task: ScheduledTask): string {
  return task.cadence === 'weekly' ? 'Weekly' : 'Daily';
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
          {cadenceLabel(props.task)} · {props.task.status === 'active' ? 'Active' : 'Paused'} · {props.task.summary}
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
 * Scheduled tasks. The five seed jobs are the product lock; Subnet 100 is last
 * and Cortex-only.
 */
export function PlanningScreen(props: PlanningScreenProps): JSX.Element {
  return (
    <>
      <PageHeader
        title="Planning"
        subtitle="Recurring jobs that run on a cadence. Not a project plan."
      />
      <PageBody width="list">
        <Show when={!props.loading} fallback={<HonestState kind="loading" title="Loading jobs" body="Reading the schedule." />}>
          <Show when={!props.error} fallback={<HonestState kind="error" title="Could not load Planning" body={props.error ?? ''} />}>
            <Show
              when={props.tasks.length > 0}
              fallback={
                <HonestState
                  kind="empty"
                  title="No scheduled jobs"
                  body="When you add a recurring job it will appear here, active until you pause it."
                />
              }
            >
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
            </Show>
          </Show>
        </Show>
      </PageBody>
    </>
  );
}
