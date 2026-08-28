/**
 * Automation host for the web app.
 *
 * Automations are the clearest case for cloud-only. Main runs them because a
 * renderer cannot watch a filesystem and a schedule that only fires while a
 * window is open is not a schedule. A browser tab is worse on both counts — so
 * the service owns the cron and the watch, and this host is the request half.
 *
 * `file_watch` and `git_hook` triggers reference a path on a machine, so they only
 * mean something for a paired host. They round-trip untouched: the service decides
 * which host a watch belongs to, and a client that rewrote them would be guessing.
 *
 * `/v1/code/automations` was not on the public deployment when this was written.
 * Reads answer empty on a 404 so the screen shows its empty state, and writes
 * refuse with copy that names the cause, so nobody creates a schedule that will
 * never fire.
 */

import {
  createCodeAutomation,
  deleteCodeAutomation,
  isCortexApiError,
  listCodeAutomationLogs,
  listCodeAutomations,
  patchCodeAutomation,
  runCodeAutomation,
  type ApiCodeAutomation,
  type ApiCodeAutomationLog,
  type CortexApiClient,
} from '@cortex-ide/cortex-api';
import type { Action, Automation, AutomationLog, AutomationStatus, Trigger } from '@cortex-ide/shared';

import type { AutomationHost } from './automation-host.ts';

const NO_ROUTE = 'This Cortex backend does not run account automations yet.';

const STATUSES: readonly AutomationStatus[] = ['idle', 'running', 'success', 'error'];

function isRouteMissing(error: unknown): boolean {
  return isCortexApiError(error) && (error.code === 'not_found' || error.status === 404);
}

function explain(error: unknown): never {
  if (isRouteMissing(error)) throw new Error(NO_ROUTE);
  throw error;
}

function epoch(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Projects an automation row.
 *
 * A row without a recognisable trigger becomes `manual` rather than being dropped:
 * an automation the user created should still be listed and deletable even if this
 * client is older than the trigger type it uses.
 */
function toAutomation(row: ApiCodeAutomation, now = Date.now()): Automation {
  const created = epoch(row.created_at, now);
  return {
    id: row.id,
    // Empty rather than invented: the workspace is the account's, and the browser
    // has no local workspace id to claim.
    workspaceId: '',
    name: row.name ?? 'Automation',
    enabled: row.enabled === true,
    trigger: (row.trigger as Trigger | undefined) ?? { type: 'manual' },
    actions: (row.actions as Action[] | undefined) ?? [],
    createdAt: created,
    updatedAt: epoch(row.last_run_at, created),
  };
}

function toLog(row: ApiCodeAutomationLog, now = Date.now()): AutomationLog {
  const log: AutomationLog = {
    id: row.id,
    automationId: row.automation_id ?? '',
    status: STATUSES.find((status) => status === row.status) ?? 'idle',
    startedAt: epoch(row.created_at, now),
    actionResults: [],
  };
  if (row.message) log.output = row.message;
  return log;
}

/**
 * Runs a read, answering empty when the route is absent.
 *
 * A list is allowed to be empty; a write is not allowed to look like it worked.
 * That asymmetry is why reads and writes are wrapped differently.
 */
async function readOrEmpty<T>(read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (error) {
    if (isRouteMissing(error)) return [];
    throw error;
  }
}

/** Runs a write, turning a missing route into copy the screen can show. */
async function write<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    return explain(error);
  }
}

export function createCloudAutomationHost(client: CortexApiClient): AutomationHost {
  return {
    list: () => readOrEmpty(async () => (await listCodeAutomations(client)).map(toAutomation)),

    create: (input) =>
      write(async () =>
        toAutomation(
          await createCodeAutomation(client, {
            name: input.name,
            enabled: input.enabled,
            trigger: input.trigger,
            actions: input.actions,
          }),
        ),
      ),

    toggle: (id, enabled) =>
      write(async () => toAutomation(await patchCodeAutomation(client, id, { enabled }))),

    remove: (id) =>
      write(async () => {
        await deleteCodeAutomation(client, id);
      }),

    run: (id) => write(async () => toLog(await runCodeAutomation(client, id))),

    logs: (id) =>
      readOrEmpty(async () => (await listCodeAutomationLogs(client, id)).map(toLog)),
  };
}
