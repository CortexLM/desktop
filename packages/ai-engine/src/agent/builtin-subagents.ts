import { EXPLORER_TOOLS } from './tool-names';
import type { AutonomyLevel, DroidDefinition } from './types';

export interface BuiltinSubagent {
  name: 'explorer' | 'worker';
  description: string;
  autonomy: AutonomyLevel;
  tools?: string[];
  systemPrompt: string;
}

export const EXPLORER_SUBAGENT: BuiltinSubagent = {
  name: 'explorer',
  description: 'Read-only explorer for cheap, parallel context gathering.',
  autonomy: 'off',
  tools: [...EXPLORER_TOOLS],
  systemPrompt:
    'You are the Cortex explorer subagent. You may only Read, LS, Grep, and Glob. Do not edit, execute, or ask the user. Return a self-contained report of what you found.',
};

export const WORKER_SUBAGENT: BuiltinSubagent = {
  name: 'worker',
  description: 'General worker with the full tool set at medium autonomy.',
  autonomy: 'medium',
  systemPrompt:
    'You are the Cortex worker subagent. Complete the handoff. Do not ask the user. Do not spawn another Task. Return a self-contained report that is the source of record.',
};

export function builtinSubagent(name: string): BuiltinSubagent | undefined {
  if (name === 'explorer') return EXPLORER_SUBAGENT;
  if (name === 'worker') return WORKER_SUBAGENT;
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
