/**
 * Planning = scheduled tasks (recurring jobs), not a project plan.
 *
 * Seed mix is product-locked: four generalist jobs, then Subnet 100 last.
 * Copy is Cortex's — do not clone ChatGPT task names.
 */

import { createSignal } from 'solid-js';

import { readJson, writeJson } from './persist.ts';

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

const STORAGE_KEY = 'cortex.planning.v1';

/** The locked seed. Ids are stable so a reinstall does not duplicate them. */
export const PLANNING_SEED: readonly ScheduledTask[] = [
  {
    id: 'todays-notes',
    title: "Today's notes",
    summary: 'Gather what you wrote, decided, and left open today.',
    cadence: 'daily',
    status: 'active',
  },
  {
    id: 'unread-mentions',
    title: 'Unread mentions',
    summary: 'Threads where someone asked you something and is still waiting.',
    cadence: 'daily',
    status: 'active',
  },
  {
    id: 'week-ahead',
    title: 'Week ahead',
    summary: 'A Monday brief of what is scheduled and what is slipping.',
    cadence: 'weekly',
    status: 'active',
  },
  {
    id: 'evening-recap',
    title: 'Evening recap',
    summary: 'Close the day with what moved and what waits until tomorrow.',
    cadence: 'daily',
    status: 'active',
  },
  {
    id: 'subnet-100',
    title: 'Subnet 100 news',
    summary: 'What changed on Cortex Subnet 100 since yesterday.',
    cadence: 'daily',
    status: 'active',
    requiresAccount: true,
  },
];

function load(): ScheduledTask[] {
  const stored = readJson<ScheduledTask[]>(STORAGE_KEY, []);
  if (stored.length === 0) return PLANNING_SEED.map((task) => ({ ...task }));

  // A seed id that vanished from storage is re-inserted so a future job cannot
  // disappear because an older client never knew it.
  const have = new Set(stored.map((task) => task.id));
  const missing = PLANNING_SEED.filter((task) => !have.has(task.id));
  return missing.length === 0 ? stored : [...stored, ...missing];
}

const [tasks, setTasks] = createSignal<ScheduledTask[]>(load());

export { tasks as scheduledTasks };

function persist(next: ScheduledTask[]): void {
  setTasks(next);
  writeJson(STORAGE_KEY, next);
}

export function setTaskStatus(id: string, status: TaskStatus): void {
  persist(tasks().map((task) => (task.id === id ? { ...task, status } : task)));
}

export function markTaskRan(id: string, at = Date.now()): void {
  persist(tasks().map((task) => (task.id === id ? { ...task, lastRunAt: at } : task)));
}
