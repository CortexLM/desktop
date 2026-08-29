/**
 * Wires a BackgroundTaskRegistry that runs a real child turn.
 * Children inherit tools for their kind, cannot nest Task, and cannot AskUser.
 */

import { BackgroundTaskRegistry, type ChildRunner } from './background-tasks';
import { builtinSubagent } from './builtin-subagents';
import { composeSystemPrompt } from './system-prompt';
import { toolsForMode } from './tools';
import { canonicalToolName } from './tool-names';
import type { AgentEvent, RunAgentTurnOptions, TaskKind, ToolDefinition } from './types';

type RunTurn = (options: RunAgentTurnOptions) => AsyncGenerator<AgentEvent>;

export function createTaskRegistry(options: RunAgentTurnOptions, runTurn: RunTurn): BackgroundTaskRegistry {
  return new BackgroundTaskRegistry(childRunner(options, runTurn), options.artifacts, options.taskTimeoutMs);
}

function childRunner(parent: RunAgentTurnOptions, runTurn: RunTurn): ChildRunner {
  return async (input) => {
    let summary = '';
    let output = '';
    for await (const event of runTurn(childOptions(parent, input))) {
      if (event.type === 'text') summary = event.text;
      if (event.type === 'tool_end') {
        output = event.output;
        input.onProgress(`${event.name}: ${event.output.slice(0, 120)}`);
      }
      if (event.type === 'plan' && event.plan.title) summary = event.plan.title;
    }
    return { summary: summary || 'Child finished', output: output || summary };
  };
}

function childOptions(
  parent: RunAgentTurnOptions,
  input: { kind: TaskKind; prompt: string; signal: AbortSignal },
): RunAgentTurnOptions {
  const builtin = builtinSubagent(input.kind);
  const tools = toolsForKind(input.kind, parent.tools);
  const mode = input.kind === 'plan' ? 'plan' : 'agent';
  return {
    messages: [{ role: 'user', content: input.prompt }],
    chat: parent.chat,
    tools,
    executor: parent.executor,
    permissions: parent.permissions,
    systemPrompt: composeSystemPrompt({
      mode,
      droid: builtin
        ? { name: builtin.name, description: builtin.description, systemPrompt: builtin.systemPrompt }
        : undefined,
      tools,
      autonomy: builtin?.autonomy ?? 'off',
      runtime: parent.runtime,
    }),
    mode,
    autonomy: builtin?.autonomy ?? 'off',
    runtime: parent.runtime,
    agentName: input.kind,
    delegationDepth: 1,
    abortSignal: input.signal,
    artifacts: parent.artifacts,
    maxIterations: parent.maxIterations,
  };
}

function toolsForKind(kind: TaskKind, tools: ToolDefinition[]): ToolDefinition[] {
  const builtin = builtinSubagent(kind);
  if (!builtin?.tools) return toolsForMode(kind === 'plan' ? 'plan' : 'agent', tools, builtin?.autonomy);
  const allow = new Set(builtin.tools.map((name) => canonicalToolName(name)));
  return tools.filter((tool) => allow.has(canonicalToolName(tool.name)));
}
