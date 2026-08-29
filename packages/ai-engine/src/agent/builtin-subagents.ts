import { EXPLORER_TOOLS, PLAN_CHILD_TOOLS } from './tool-names';
import type { AutonomyLevel, DroidDefinition, TaskKind } from './types';

export interface BuiltinSubagent {
  name: TaskKind;
  description: string;
  autonomy: AutonomyLevel;
  tools?: string[];
  systemPrompt: string;
}

export const EXPLORE_SUBAGENT: BuiltinSubagent = {
  name: 'explore',
  description: 'Read-only explorer for cheap, parallel context gathering.',
  autonomy: 'off',
  tools: [...EXPLORER_TOOLS],
  systemPrompt:
    'You are the Cortex explore subagent. You may only Read, LS, Grep, and Glob. Do not edit, execute, or ask the user. Return a self-contained report of what you found.',
};

/** @deprecated Use EXPLORE_SUBAGENT. Kept so older imports keep resolving. */
export const EXPLORER_SUBAGENT = EXPLORE_SUBAGENT;

export const PLAN_SUBAGENT: BuiltinSubagent = {
  name: 'plan',
  description: 'Read-only planner. Must exit with a mermaid flowchart or sequenceDiagram.',
  autonomy: 'off',
  tools: [...PLAN_CHILD_TOOLS],
  systemPrompt:
    'You are the Cortex plan subagent. Investigate with read-only tools. Do not mutate. Do not ask the user. Present the plan by calling ExitSpecMode with a mermaid fence (flowchart or sequenceDiagram).',
};

export const WORKER_SUBAGENT: BuiltinSubagent = {
  name: 'worker',
  description: 'General worker with the full tool set at medium autonomy.',
  autonomy: 'medium',
  systemPrompt:
    'You are the Cortex worker subagent. Complete the handoff. Do not ask the user. Do not spawn another Task. Return a self-contained report that is the source of record.',
};

export function builtinSubagent(name: string): BuiltinSubagent | undefined {
  const kind = name === 'explorer' ? 'explore' : name;
  if (kind === 'explore') return EXPLORE_SUBAGENT;
  if (kind === 'plan') return PLAN_SUBAGENT;
  if (kind === 'worker') return WORKER_SUBAGENT;
  return undefined;
}

export function toDroid(subagent: BuiltinSubagent): DroidDefinition {
  return {
    name: subagent.name,
    description: subagent.description,
    tools: subagent.tools,
    systemPrompt: subagent.systemPrompt,
  };
}
