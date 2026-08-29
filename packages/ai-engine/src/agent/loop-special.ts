/**
 * Special tool calls the loop owns: AskUser, Task, ExitSpecMode.
 */

import { completionReminder } from './background-tasks';
import { denyExitSpec, planFromExit } from './plan-mode';
import type {
  AgentEvent,
  AgentMessage,
  QuestionGate,
  TaskHost,
  BackgroundTaskKind,
  ToolCall,
  ToolResult,
} from './types';

export function denyAskUser(depth: number): string | null {
  if (depth > 0) return 'Children must not AskUser. Return a self-contained report.';
  return null;
}

export function denyNestedTask(depth: number): string | null {
  if (depth > 0) return 'No nested Task.';
  return null;
}

export function denyPlanWorker(mode: string | undefined, kind: BackgroundTaskKind): string | null {
  if ((mode === 'plan' || mode === 'ask') && kind === 'worker') {
    return 'Plan/ask mode forbids a worker Task. Use explore or plan.';
  }
  return null;
}

export async function answerAskUser(
  call: ToolCall,
  questions?: QuestionGate,
): Promise<{ prompt: string; options?: string[]; answer: string }> {
  const prompt = String(call.arguments.prompt ?? '');
  const options = parseOptions(call.arguments.options);
  const answer = questions ? await questions.ask(call.id, prompt, options) : '';
  return { prompt, options, answer: answer || '(no answer)' };
}

export function spawnTaskResult(
  call: ToolCall,
  kind: BackgroundTaskKind,
  tasks?: TaskHost,
): { result: ToolResult; started?: AgentEvent } {
  if (!tasks) {
    return { result: { ok: false, output: 'Background Task is not configured on this run.' } };
  }
  const prompt = String(call.arguments.prompt ?? '');
  const spawned = tasks.spawn({ kind, prompt, callId: call.id });
  return {
    result: { ok: true, output: JSON.stringify(spawned) },
    started: { type: 'task_started', id: spawned.id, summary: spawned.summary },
  };
}

export function exitSpecResult(call: ToolCall): { denied?: string; plan?: ReturnType<typeof planFromExit> } {
  const denied = denyExitSpec(call.arguments);
  if (denied) return { denied };
  return { plan: planFromExit(call.arguments) };
}

export function injectTaskEvents(messages: AgentMessage[], events: AgentEvent[]): AgentEvent[] {
  for (const event of events) {
    const reminder = completionReminder(event);
    if (reminder) messages.push({ role: 'system', content: reminder });
  }
  return events;
}

function parseOptions(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}
