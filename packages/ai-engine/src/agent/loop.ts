import { autonomyAllowsExecute } from './autonomy';
import { extractThinking, parsePlan, parseToolCalls, stripToolMarkup } from './parse-tool-calls';
import { riskForTool, summarizeCall, targetForCall } from './permissions';
import { SPEC_MODE_REMINDER, wrapSystemReminder } from './system-reminder';
import { canonicalToolName, MUTATE_TOOLS, SPEC_SAFE_TOOLS } from './tool-names';
import { hasUnresolvedOptions } from './workspace-tools';
import type {
  AgentEvent,
  AgentMessage,
  AgentPlan,
  PermissionRequest,
  RunAgentTurnOptions,
  ToolDefinition,
} from './types';

const DEFAULT_MAX_ITERATIONS = 12;

export async function* runAgentTurn(options: RunAgentTurnOptions): AsyncGenerator<AgentEvent> {
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const tools = options.tools;
  const messages: AgentMessage[] = [
    { role: 'system', content: options.systemPrompt },
    ...options.messages,
  ];
  if (options.mode === 'plan' && !options.systemPrompt.includes('Spec mode is active')) {
    messages.splice(1, 0, { role: 'system', content: wrapSystemReminder(SPEC_MODE_REMINDER) });
  }

  if (options.contextTokens != null && options.contextLimit != null) {
    if (options.contextTokens >= options.contextLimit) {
      yield {
        type: 'context_full',
        tokens: options.contextTokens,
        limit: options.contextLimit,
      };
    }
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (options.abortSignal?.aborted) {
      yield { type: 'done', finishReason: 'aborted' };
      return;
    }

    let completion;
    try {
      completion = await options.chat(messages);
    } catch (error) {
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
      return;
    }

    const content = completion.content ?? '';
    const thinking = extractThinking(content);
    if (thinking) {
      yield { type: 'thinking', text: thinking };
    }

    const plan = parsePlan(content);
    if (plan) {
      yield { type: 'plan', plan };
      if (options.mode === 'plan' && !plan.approved) {
        const visible = stripToolMarkup(content);
        if (visible) yield { type: 'text', text: visible };
        options.onMessages?.(messages);
        yield { type: 'done', finishReason: 'plan' };
        return;
      }
    }

    const calls = (
      completion.toolCalls && completion.toolCalls.length > 0
        ? completion.toolCalls
        : parseToolCalls(content)
    ).map((call) => ({ ...call, name: canonicalToolName(call.name) }));
    const visible = stripToolMarkup(content);
    if (visible) {
      yield { type: 'text', text: visible };
    }

    if (calls.length === 0) {
      messages.push({ role: 'assistant', content });
      options.onMessages?.(messages);
      yield { type: 'done', finishReason: 'stop' };
      return;
    }

    messages.push({ role: 'assistant', content });

    const writePaths = new Set<string>();
    const skipped = new Set<string>();
    for (const call of calls) {
      const writePath = writeTarget(call.name, call.arguments);
      if (writePath) {
        if (writePaths.has(writePath)) {
          const denied = `Never edit one file from two calls at once: ${writePath}`;
          messages.push({ role: 'tool', name: call.name, content: denied });
          yield {
            type: 'tool_end',
            id: call.id,
            name: call.name,
            ok: false,
            output: denied,
            durationMs: 0,
          };
          skipped.add(call.id);
        }
        writePaths.add(writePath);
      }
    }

    for (const call of calls) {
      if (skipped.has(call.id)) continue;
      if (options.abortSignal?.aborted) {
        yield { type: 'done', finishReason: 'aborted' };
        return;
      }

      const definition = tools.find((tool) => canonicalToolName(tool.name) === call.name);
      const specLocked =
        (options.mode === 'plan' || options.mode === 'ask') &&
        !SPEC_SAFE_TOOLS.has(call.name) &&
        (MUTATE_TOOLS.has(call.name) || definition?.risk !== 'safe');
      if (specLocked) {
        const denied = `Plan/ask mode forbids ${call.name}`;
        messages.push({ role: 'tool', name: call.name, content: denied });
        yield {
          type: 'tool_end',
          id: call.id,
          name: call.name,
          ok: false,
          output: denied,
          durationMs: 0,
        };
        continue;
      }

      if (call.name === 'AskUser') {
        if ((options.delegationDepth ?? 0) > 0) {
          const denied = 'Children must not AskUser. Return a self-contained report.';
          messages.push({ role: 'tool', name: call.name, content: denied });
          yield {
            type: 'tool_end',
            id: call.id,
            name: call.name,
            ok: false,
            output: denied,
            durationMs: 0,
          };
          continue;
        }
        const prompt = String(call.arguments.prompt ?? '');
        let choices: string[] | undefined;
        try {
          if (typeof call.arguments.options === 'string') {
            choices = JSON.parse(call.arguments.options) as string[];
          }
        } catch {
          choices = undefined;
        }
        yield { type: 'question', id: call.id, prompt, options: choices };
        const answer = options.questions
          ? await options.questions.ask(call.id, prompt, choices)
          : '';
        messages.push({ role: 'tool', name: 'AskUser', content: answer || '(no answer)' });
        yield {
          type: 'tool_end',
          id: call.id,
          name: 'AskUser',
          ok: true,
          output: answer || '(no answer)',
          durationMs: 0,
        };
        continue;
      }

      if (call.name === 'Task' && (options.delegationDepth ?? 0) > 0) {
        const denied = 'No nested Task.';
        messages.push({ role: 'tool', name: call.name, content: denied });
        yield {
          type: 'tool_end',
          id: call.id,
          name: call.name,
          ok: false,
          output: denied,
          durationMs: 0,
        };
        continue;
      }

      if (call.name === 'ExitSpecMode') {
        if (hasUnresolvedOptions(call.arguments)) {
          const denied = 'Do not ExitSpecMode with unresolved Option A/B. Use AskUser first.';
          messages.push({ role: 'tool', name: call.name, content: denied });
          yield {
            type: 'tool_end',
            id: call.id,
            name: call.name,
            ok: false,
            output: denied,
            durationMs: 0,
          };
          continue;
        }
        const plan = planFromExit(call.arguments);
        yield { type: 'plan', plan };
        messages.push({ role: 'tool', name: call.name, content: JSON.stringify(plan) });
        options.onMessages?.(messages);
        yield { type: 'done', finishReason: 'plan' };
        return;
      }

      if (call.name === 'Execute') {
        const command = String(call.arguments.command ?? '');
        if (!autonomyAllowsExecute(options.autonomy ?? 'medium', command)) {
          const denied = `Execute blocked by autonomy=${options.autonomy ?? 'medium'} or the blocklist.`;
          messages.push({ role: 'tool', name: call.name, content: denied });
          yield {
            type: 'tool_end',
            id: call.id,
            name: call.name,
            ok: false,
            output: denied,
            durationMs: 0,
          };
          continue;
        }
      }

      const request: PermissionRequest = {
        id: `perm-${call.id}`,
        tool: call.name,
        risk: riskForTool(definition),
        summary: summarizeCall(call.name, call.arguments),
        detail: JSON.stringify(call.arguments),
        path: targetForCall(call.arguments),
        agent: options.agentName,
      };

      yield { type: 'permission', request };
      const decision = await options.permissions.decide(request);
      if (decision === 'deny') {
        const denied = `Permission denied for ${call.name}`;
        messages.push({ role: 'tool', name: call.name, content: denied });
        yield {
          type: 'tool_end',
          id: call.id,
          name: call.name,
          ok: false,
          output: denied,
          durationMs: 0,
        };
        continue;
      }

      yield {
        type: 'tool_start',
        id: call.id,
        name: call.name,
        title: toolTitle(definition, call.name),
        detail: request.summary,
      };

      const started = Date.now();
      const result = await options.executor.execute(call);
      const durationMs = Date.now() - started;

      messages.push({
        role: 'tool',
        name: call.name,
        content: result.output,
      });

      yield {
        type: 'tool_end',
        id: call.id,
        name: call.name,
        ok: result.ok,
        output: result.output,
        additions: result.additions,
        deletions: result.deletions,
        durationMs,
      };
    }
  }

  yield { type: 'error', message: `Stopped after ${maxIterations} tool iterations` };
}

function toolTitle(definition: ToolDefinition | undefined, name: string): string {
  return definition?.name ?? name;
}

function writeTarget(name: string, args: Record<string, unknown>): string | undefined {
  if (name === 'Create' || name === 'Edit') {
    return typeof args.path === 'string' ? args.path : undefined;
  }
  if (name === 'ApplyPatch' && typeof args.patch === 'string') {
    const match = /\+\+\+ (?:b\/)?(\S+)/.exec(args.patch) ?? /\*\*\* (?:Update|Add) File: (.+)$/m.exec(args.patch);
    return match?.[1];
  }
  return undefined;
}

function planFromExit(args: Record<string, unknown>): AgentPlan {
  let steps: string[] = [];
  try {
    const parsed = typeof args.steps === 'string' ? JSON.parse(args.steps) : args.steps;
    if (Array.isArray(parsed)) steps = parsed.map(String);
  } catch {
    steps = String(args.steps ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return {
    title: String(args.title ?? 'Plan'),
    rationale: String(args.rationale ?? ''),
    approved: false,
    steps: steps.map((title, index) => ({
      id: `step-${index + 1}`,
      title,
      status: index === 0 ? 'active' : 'pending',
    })),
  };
}
