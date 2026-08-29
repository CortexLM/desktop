/**
 * Planning = scheduled tasks (recurring jobs), not a project plan.
 *
 * The schedule belongs to the service. This used to be a `localStorage` array
 * seeded with five jobs, which meant every browser profile believed it had its own
 * scheduler: "Run now" bumped a local timestamp, and nothing ran on a cadence
 * because nothing was watching the clock. A job that only fires while a tab is
 * open is not scheduled.
 *
 * The five Cortex-authored jobs survive as **templates**. They are the product
 * lock — four generalist jobs, then Subnet 100 last, in that order — but they are
 * now offered as things to add to an account with an empty schedule, the same way
 * Code offers automation templates. An account's real tasks come from
 * `/v1/planning/tasks`; nothing is presented as scheduled until the service says
 * it is.
 *
 * Copy is Cortex's — do not clone another assistant's task names.
 */

import {
  createPlanningTask,
  deletePlanningTask,
  listPlanningTasks,
  patchPlanningTask,
  runPlanningTask,
  type ApiPlanningTask,
} from '@cortex-ide/cortex-api';

import { botClient } from './bot-client.ts';
import { createRemoteCollection } from './remote-collection.ts';

export type TaskCadence = 'daily' | 'weekly';
export type TaskStatus = 'active' | 'paused';

export interface ScheduledTask {
  id: string;
  title: string;
  summary: string;
  cadence: TaskCadence;
  status: TaskStatus;
  /** Last successful run, epoch ms. Absent until the first result. */
  lastRunAt?: number;
  /** Cortex-only jobs stay visible signed out, locked. */
  requiresAccount?: boolean;
}

/** A job Cortex offers to schedule. Not a task until the account has added it. */
export interface PlanningTemplate {
  id: string;
  title: string;
  summary: string;
  cadence: TaskCadence;
  requiresAccount?: boolean;
}

/**
 * The locked template set. Ids are stable so adding one twice is detectable and
 * the order is the product's.
 */
export const PLANNING_TEMPLATES: readonly PlanningTemplate[] = [
  {
    id: 'todays-notes',
    title: "Today's notes",
    summary: 'Gather what you wrote, decided, and left open today.',
    cadence: 'daily',
  },
  {
    id: 'unread-mentions',
    title: 'Unread mentions',
    summary: 'Threads where someone asked you something and is still waiting.',
    cadence: 'daily',
  },
  {
    id: 'week-ahead',
    title: 'Week ahead',
    summary: 'A Monday brief of what is scheduled and what is slipping.',
    cadence: 'weekly',
  },
  {
    id: 'evening-recap',
    title: 'Evening recap',
    summary: 'Close the day with what moved and what waits until tomorrow.',
    cadence: 'daily',
  },
  {
    id: 'subnet-100',
    title: 'Subnet 100 news',
    summary: 'What changed on Cortex Subnet 100 since yesterday.',
    cadence: 'daily',
    requiresAccount: true,
  },
];

/** Falls back to `daily`: a cadence this client cannot read is not weekly. */
function toCadence(value: string | undefined): TaskCadence {
  return value === 'weekly' ? 'weekly' : 'daily';
}

/**
 * Falls back to `active`.
 *
 * A task the service returned exists and is presumed to be running unless it says
 * `paused` — showing it as paused would tell the user nothing is going to happen.
 */
function toStatus(value: string | undefined): TaskStatus {
  return value === 'paused' ? 'paused' : 'active';
}

/**
 * Projects a task row.
 *
 * The matching template fills anything the row leaves out. That is not invention:
 * the service stores the task by the template's id, so its title and summary are
 * the same copy, and a row that omits them should still read as the job it is.
 */
export function toScheduledTask(row: ApiPlanningTask): ScheduledTask {
  const template = PLANNING_TEMPLATES.find((entry) => entry.id === row.id);
  const task: ScheduledTask = {
    id: row.id,
    title: row.title ?? template?.title ?? 'Scheduled job',
    summary: readString(row, 'summary') ?? template?.summary ?? '',
    cadence: toCadence(row.cadence ?? template?.cadence),
    status: toStatus(row.status),
  };

  return withOptional(task, readEpoch(row, 'last_run_at'), template?.requiresAccount);
}

function withOptional(
  task: ScheduledTask,
  lastRunAt: number | undefined,
  requiresAccount: boolean | undefined,
): ScheduledTask {
  if (lastRunAt !== undefined) task.lastRunAt = lastRunAt;
  if (requiresAccount) task.requiresAccount = true;
  return task;
}

/** Reads a passthrough key the schema does not declare, without an `any`. */
function readString(row: ApiPlanningTask, key: string): string | undefined {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function readEpoch(row: ApiPlanningTask, key: string): number | undefined {
  const value = readString(row, key);
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const collection = createRemoteCollection<ScheduledTask>({
  label: 'Planning',
  load: async (client) => (await listPlanningTasks(client)).map(toScheduledTask),
});

export const scheduledTasks = collection.items;
export const planningState = collection.state;
export const planningError = collection.error;
export const loadPlanning = collection.reload;
export const resetPlanningForTests = collection.reset;

/** Templates not already on the schedule. What the empty state offers to add. */
export function availableTemplates(): readonly PlanningTemplate[] {
  const have = new Set(scheduledTasks().map((task) => task.id));
  return PLANNING_TEMPLATES.filter((template) => !have.has(template.id));
}

export function addPlanningTask(template: PlanningTemplate): Promise<void> {
  return collection.mutate((client) =>
    createPlanningTask(client, {
      title: template.title,
      summary: template.summary,
      cadence: template.cadence,
      template_id: template.id,
    }),
  );
}

export function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  return collection.mutate((client) => patchPlanningTask(client, id, { status }));
}

export function removePlanningTask(id: string): Promise<void> {
  return collection.mutate((client) => deletePlanningTask(client, id));
}

/**
 * Asks the service to run a job now.
 *
 * Returns the conversation the result landed in, when there is one, so the UI can
 * link to a real thread instead of a notification it composed itself.
 */
export async function runTaskNow(id: string): Promise<{ conversationId?: string }> {
  const client = botClient();
  if (!client) throw new Error('Planning needs a connection to Cortex.');
  const run = await runPlanningTask(client, id);
  await collection.reload();
  return run.conversation_id ? { conversationId: run.conversation_id } : {};
}
