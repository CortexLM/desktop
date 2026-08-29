import { autonomyAllowsExecute } from './autonomy';
import {
  answerAskUser,
  denyAskUser,
  denyNestedTask,
  denyPlanWorker,
  exitSpecResult,
  injectTaskEvents,
  spawnTaskResult,
} from './loop-special';
import { conflictedWrites, denied, specLocked, toolTitle } from './loop-calls';
import { decideAndRun, prepareCall } from './loop-run';
import { ArtifactStore } from './artifacts';
import { resolveTaskKind } from './background-tasks';
import { createTaskRegistry } from './child-runner';
import { extractThinking, parsePlan, parseToolCalls, stripToolMarkup } from './parse-tool-calls';
import { SPEC_MODE_REMINDER, wrapSystemReminder } from './system-reminder';
import { canonicalToolName } from './tool-names';
import type {
  AgentEvent,
  AgentMessage,
  RunAgentTurnOptions,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from './types';

const DEFAULT_MAX_ITERATIONS = 12;

export async function* runAgentTurn(options: RunAgentTurnOptions): AsyncGenerator<AgentEvent> {
  const artifacts = options.artifacts ?? new ArtifactStore();
  const hosted: RunAgentTurnOptions = {
    ...options,
    artifacts,
    tasks: options.tasks ?? createTaskRegistry({ ...options, artifacts, tasks: undefined }, runAgentTurn),
  };
  const messages = seedMessages(hosted);
  yield* yieldContextFull(options);
  const stop = yield* iterateTurns(hosted, messages, options.maxIterations ?? DEFAULT_MAX_ITERATIONS);
  await hosted.tasks?.waitOpen();
  yield* flushTasks(hosted, messages);
  hosted.onMessages?.(messages);
  yield stop;
}

function yieldContextFull(options: RunAgentTurnOptions): AgentEvent[] {
  if (options.contextTokens == null || options.contextLimit == null) return [];
  if (options.contextTokens < options.contextLimit) return [];
  return [{ type: 'context_full', tokens: options.contextTokens, limit: options.contextLimit }];
}

async function* iterateTurns(
  hosted: RunAgentTurnOptions,
  messages: AgentMessage[],
  maxIterations: number,
): AsyncGenerator<AgentEvent, AgentEvent> {
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (hosted.abortSignal?.aborted) {
      hosted.tasks?.cancelAll();
      return { type: 'done', finishReason: 'aborted' };
    }
    yield* flushTasks(hosted, messages);
    const completion = await chatSafe(hosted, messages);
    if ('error' in completion) return completion.error;
    const stop = yield* handleModelOutput(hosted, messages, completion.content, completion.toolCalls);
    if (stop) return stop;
  }
  return { type: 'error', message: `Stopped after ${maxIterations} tool iterations` };
}

async function chatSafe(
  hosted: RunAgentTurnOptions,
  messages: AgentMessage[],
): Promise<{ content: string; toolCalls?: ToolCall[] } | { error: AgentEvent }> {
  try {
    return await hosted.chat(messages);
  } catch (error) {
    return { error: { type: 'error', message: error instanceof Error ? error.message : String(error) } };
  }
}

function seedMessages(options: RunAgentTurnOptions): AgentMessage[] {
  const messages: AgentMessage[] = [
    { role: 'system', content: options.systemPrompt },
    ...options.messages,
  ];
  if (options.mode === 'plan' && !options.systemPrompt.includes('Spec mode is active')) {
    messages.splice(1, 0, { role: 'system', content: wrapSystemReminder(SPEC_MODE_REMINDER) });
  }
  return messages;
}

async function* flushTasks(
  options: RunAgentTurnOptions,
  messages: AgentMessage[],
): AsyncGenerator<AgentEvent> {
  const events = options.tasks?.drain() ?? [];
  for (const event of injectTaskEvents(messages, events)) yield event;
}

async function* handleModelOutput(
  options: RunAgentTurnOptions,
  messages: AgentMessage[],
  content: string,
  nativeCalls?: ToolCall[],
): AsyncGenerator<AgentEvent, AgentEvent | undefined> {
  const thinking = extractThinking(content);
  if (thinking) yield { type: 'thinking', text: thinking };

  const plan = parsePlan(content);
  if (plan) {
    yield { type: 'plan', plan };
    if (options.mode === 'plan' && !plan.approved) {
      const visible = stripToolMarkup(content);
      if (visible) yield { type: 'text', text: visible };
      return { type: 'done', finishReason: 'plan' };
    }
  }

  const calls = (nativeCalls?.length ? nativeCalls : parseToolCalls(content)).map((call) => ({
    ...call,
    name: canonicalToolName(call.name),
  }));
  const visible = stripToolMarkup(content);
  if (visible) yield { type: 'text', text: visible };

  if (calls.length === 0) {
    messages.push({ role: 'assistant', content });
    return { type: 'done', finishReason: 'stop' };
  }

  messages.push({ role: 'assistant', content, toolCalls: calls });
  const exited = yield* runCalls(options, messages, calls);
  return exited;
}

async function* runCalls(
  options: RunAgentTurnOptions,
  messages: AgentMessage[],
  calls: ToolCall[],
): AsyncGenerator<AgentEvent, AgentEvent | undefined> {
  const skipped = conflictedWrites(calls);
  const early = new Map<string, ToolResult>();
  const runnable: ToolCall[] = [];

  for (const call of calls) {
    const special = yield* takeSpecial(options, call, skipped);
    if (special && 'type' in special && special.type === 'done') return special;
    if (special && 'output' in special) early.set(call.id, special);
    else if (!special) runnable.push(call);
  }

  const prepared = runnable.map((call) =>
    prepareCall(call, findTool(options.tools, call.name), options.agentName),
  );
  yield* emitPrepared(prepared);
  const executed = await decideAndRun(
    prepared,
    options.permissions,
    (call) => options.executor.execute(call),
    options.artifacts,
  );
  yield* emitResults(calls, early, executed, messages);
  return undefined;
}

function* emitPrepared(prepared: ReturnType<typeof prepareCall>[]): Generator<AgentEvent> {
  for (const item of prepared) {
    yield { type: 'permission', request: item.request };
    yield {
      type: 'tool_start',
      id: item.call.id,
      name: item.call.name,
      title: toolTitle(item.definition, item.call.name),
      detail: item.request.summary,
    };
  }
}

function* emitResults(
  calls: ToolCall[],
  early: Map<string, ToolResult>,
  executed: Map<string, ToolResult>,
  messages: AgentMessage[],
): Generator<AgentEvent> {
  for (const call of calls) {
    const result = early.get(call.id) ?? executed.get(call.id);
    if (!result) continue;
    pushTool(messages, call, result);
    yield {
      type: 'tool_end',
      id: call.id,
      name: call.name,
      ok: result.ok,
      output: result.output,
      additions: result.additions,
      deletions: result.deletions,
      durationMs: 0,
    };
  }
}

async function* takeSpecial(
  options: RunAgentTurnOptions,
  call: ToolCall,
  skipped: Set<string>,
): AsyncGenerator<AgentEvent, ToolResult | AgentEvent | undefined> {
  const blocked = earlyDeny(options, call, skipped);
  if (blocked) return blocked;
  if (call.name === 'AskUser') return yield* handleAsk(options, call);
  if (call.name === 'Task') return yield* handleTask(options, call);
  if (call.name === 'ExitSpecMode') return yield* handleExit(call);
  return undefined;
}

function earlyDeny(
  options: RunAgentTurnOptions,
  call: ToolCall,
  skipped: Set<string>,
): ToolResult | undefined {
  if (skipped.has(call.id)) {
    return denied(`Never edit one file from two calls at once: ${writePath(call)}`);
  }
  if (specLocked(options.mode, call.name, findTool(options.tools, call.name))) {
    return denied(`Plan/ask mode forbids ${call.name}`);
  }
  const command = String(call.arguments.command ?? '');
  if (call.name === 'Execute' && !autonomyAllowsExecute(options.autonomy ?? 'medium', command)) {
    return denied(`Execute blocked by autonomy=${options.autonomy ?? 'medium'} or the blocklist.`);
  }
  return undefined;
}

async function* handleAsk(
  options: RunAgentTurnOptions,
  call: ToolCall,
): AsyncGenerator<AgentEvent, ToolResult> {
  const blocked = denyAskUser(options.delegationDepth ?? 0);
  if (blocked) return denied(blocked);
  const asked = await answerAskUser(call, options.questions);
  yield { type: 'question', id: call.id, prompt: asked.prompt, options: asked.options };
  return { ok: true, output: asked.answer };
}

async function* handleTask(
  options: RunAgentTurnOptions,
  call: ToolCall,
): AsyncGenerator<AgentEvent, ToolResult> {
  const nested = denyNestedTask(options.delegationDepth ?? 0);
  if (nested) return denied(nested);
  const kind = resolveTaskKind(call.arguments);
  if (!kind) return denied('Task requires kind explore, plan, or worker.');
  const worker = denyPlanWorker(options.mode, kind);
  if (worker) return denied(worker);
  const spawned = spawnTaskResult(call, kind, options.tasks);
  if (spawned.started) yield spawned.started;
  return spawned.result;
}

async function* handleExit(call: ToolCall): AsyncGenerator<AgentEvent, ToolResult | AgentEvent> {
  const result = exitSpecResult(call);
  if (result.denied) return denied(result.denied);
  yield { type: 'plan', plan: result.plan! };
  return { type: 'done', finishReason: 'plan' };
}

function findTool(tools: ToolDefinition[], name: string): ToolDefinition | undefined {
  return tools.find((tool) => canonicalToolName(tool.name) === name);
}

function pushTool(messages: AgentMessage[], call: ToolCall, result: ToolResult): void {
  messages.push({ role: 'tool', name: call.name, content: result.output, toolCallId: call.id });
}

function writePath(call: ToolCall): string {
  return typeof call.arguments.path === 'string' ? call.arguments.path : call.name;
}
