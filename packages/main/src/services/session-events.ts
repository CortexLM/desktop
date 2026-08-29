/**
 * Translates an agent stream chunk into a timeline entry.
 *
 * Split out of `SessionService` because it is the one part with no side effects and
 * the most branching: three chunk shapes, each with its own set of optional fields.
 * Pure, so it can be driven directly by a test rather than through a database and a
 * running agent.
 *
 * Every field is checked rather than trusted. The chunks come from the engine, not
 * from a user, but they are a structurally-typed bag: a shape change upstream would
 * otherwise write `undefined` into a timeline row and the screen would render an
 * entry with no title.
 */

import type { SessionEvent, SessionPlanStep } from '@cortex-ide/shared';

function asRecord(raw: unknown): Record<string, unknown> | undefined {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : undefined;
}

/** Copies a value onto the event only when it has the expected type. */
function assign<T extends object, K extends keyof T>(
  target: T,
  key: K,
  raw: unknown,
  type: 'string' | 'number' | 'boolean',
): void {
  if (typeof raw === type) target[key] = raw as T[K];
}

/** The output of a tool call, truncated. */
const MAX_OUTPUT = 4000;

function toToolEvent(tool: Record<string, unknown>, at: number): SessionEvent | undefined {
  if (typeof tool.name !== 'string') return undefined;

  const event: SessionEvent & { kind: 'tool' } = {
    kind: 'tool',
    at,
    name: tool.name,
    title: typeof tool.title === 'string' ? tool.title : tool.name,
  };

  assign(event, 'detail', tool.detail, 'string');
  assign(event, 'ok', tool.ok, 'boolean');
  assign(event, 'additions', tool.additions, 'number');
  assign(event, 'deletions', tool.deletions, 'number');
  assign(event, 'durationMs', tool.durationMs, 'number');

  // Truncated rather than stored whole: a single `cat` of a large file would
  // otherwise put megabytes in a row the screen shows four lines of.
  if (typeof tool.output === 'string') event.output = tool.output.slice(0, MAX_OUTPUT);

  return event;
}

/**
 * Engine risk words (`ToolRisk`: safe/write/exec) translated to the UI's
 * vocabulary. Unknown values read as `safe` deliberately: the agent loop is what
 * gates the call, and inflating an unrecognised value to `dangerous` would train
 * the user to dismiss the warning.
 */
function toRisk(raw: unknown): 'safe' | 'caution' | 'dangerous' {
  if (raw === 'dangerous' || raw === 'exec') return 'dangerous';
  if (raw === 'caution' || raw === 'write' || raw === 'net') return 'caution';
  return 'safe';
}

function toPermissionEvent(
  permission: Record<string, unknown>,
  at: number,
): SessionEvent | undefined {
  // The engine names it `id` (see PermissionRequest in the agent loop); older
  // rows may carry `requestId`. Accepting only the latter is how permission
  // requests silently vanished from the timeline — and the run then waited
  // forever on a decision nobody was ever shown.
  const requestId =
    typeof permission.id === 'string'
      ? permission.id
      : typeof permission.requestId === 'string'
        ? permission.requestId
        : undefined;
  if (!requestId) return undefined;

  return {
    kind: 'permission',
    at,
    requestId,
    summary:
      typeof permission.summary === 'string' ? permission.summary : 'Permission needed',
    risk: toRisk(permission.risk),
  };
}

function toTaskPhase(raw: unknown): 'started' | 'progress' | 'completed' | 'failed' {
  if (raw === 'progress' || raw === 'completed' || raw === 'failed') return raw;
  return 'started';
}

function toPlanState(raw: unknown): SessionPlanStep['state'] {
  if (raw === 'done' || raw === 'completed') return 'done';
  if (raw === 'current' || raw === 'active') return 'current';
  return 'pending';
}

function toPlanStep(raw: unknown, index: number): SessionPlanStep {
  if (typeof raw === 'string') {
    return { id: `step-${index}`, label: raw, state: 'pending' };
  }
  const step = asRecord(raw) ?? {};
  const label =
    typeof step.label === 'string'
      ? step.label
      : typeof step.title === 'string'
        ? step.title
        : `Step ${index + 1}`;
  return {
    id: typeof step.id === 'string' ? step.id : `step-${index}`,
    label,
    state: toPlanState(step.state ?? step.status),
  };
}

export function toSessionEvent(chunk: unknown, at: number): SessionEvent | undefined {
  const record = asRecord(chunk);
  if (!record) return undefined;

  const tool = asRecord(record.tool);
  if (tool) return toToolEvent(tool, at);

  const permission = asRecord(record.permission);
  if (permission) return toPermissionEvent(permission, at);

  return toPlanEvent(record, at) ?? toTaskEvent(record, at) ?? toReplyEvent(record, at);
}

function toPlanEvent(record: Record<string, unknown>, at: number): SessionEvent | undefined {
  const plan = asRecord(record.plan);
  if (!plan || !Array.isArray(plan.steps)) return undefined;
  const event: SessionEvent & { kind: 'plan' } = {
    kind: 'plan',
    at,
    steps: plan.steps.map(toPlanStep),
  };
  if (typeof plan.mermaid === 'string') event.mermaid = plan.mermaid;
  return event;
}

function toTaskEvent(record: Record<string, unknown>, at: number): SessionEvent | undefined {
  const task = asRecord(record.task);
  if (!task || typeof task.id !== 'string' || typeof task.summary !== 'string') return undefined;
  const event: SessionEvent & { kind: 'task' } = {
    kind: 'task',
    at,
    id: task.id,
    phase: toTaskPhase(task.phase),
    summary: task.summary,
  };
  if (typeof task.artifact_id === 'string') event.artifact_id = task.artifact_id;
  return event;
}

function toReplyEvent(record: Record<string, unknown>, at: number): SessionEvent | undefined {
  if (typeof record.content !== 'string' || record.content.length === 0) return undefined;
  return { kind: 'reply', at, text: record.content };
}
