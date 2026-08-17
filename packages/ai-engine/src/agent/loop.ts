import { extractThinking, parsePlan, parseToolCalls, stripToolMarkup } from './parse-tool-calls';
import { riskForTool, summarizeCall } from './permissions';
import type {
  AgentEvent,
  AgentMessage,
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
        yield { type: 'done', finishReason: 'plan' };
        return;
      }
    }

    const calls =
      completion.toolCalls && completion.toolCalls.length > 0
        ? completion.toolCalls
        : parseToolCalls(content);
    const visible = stripToolMarkup(content);
    if (visible) {
      yield { type: 'text', text: visible };
    }

    if (calls.length === 0) {
      messages.push({ role: 'assistant', content });
      yield { type: 'done', finishReason: 'stop' };
      return;
    }

    messages.push({ role: 'assistant', content });

    for (const call of calls) {
      if (options.abortSignal?.aborted) {
        yield { type: 'done', finishReason: 'aborted' };
        return;
      }

      const definition = tools.find((tool) => tool.name === call.name);
      const request: PermissionRequest = {
        id: `perm-${call.id}`,
        tool: call.name,
        risk: riskForTool(definition),
        summary: summarizeCall(call.name, call.arguments),
        detail: JSON.stringify(call.arguments),
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
  const labels: Record<string, string> = {
    read: 'Read',
    write: 'Write',
    edit: 'Editing',
    grep: 'Grep',
    glob: 'Glob',
    bash: 'Terminal',
    git: 'Git',
    task: 'Task',
  };
  return labels[name] ?? definition?.name ?? name;
}
