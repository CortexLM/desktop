/**
 * Per-call guards and parallel execution. Results stay in the original call order.
 */

import { canonicalToolName, MUTATE_TOOLS, SPEC_SAFE_TOOLS } from './tool-names';
import type { AgentMode, ToolCall, ToolDefinition, ToolResult } from './types';

export function writeTarget(name: string, args: Record<string, unknown>): string | undefined {
  if (name === 'Create' || name === 'Edit') {
    return typeof args.path === 'string' ? args.path : undefined;
  }
  if (name === 'ApplyPatch' && typeof args.patch === 'string') {
    const match = /\+\+\+ (?:b\/)?(\S+)/.exec(args.patch) ?? /\*\*\* (?:Update|Add) File: (.+)$/m.exec(args.patch);
    return match?.[1];
  }
  return undefined;
}

export function specLocked(
  mode: AgentMode | undefined,
  name: string,
  definition: ToolDefinition | undefined,
): boolean {
  if (mode !== 'plan' && mode !== 'ask') return false;
  if (SPEC_SAFE_TOOLS.has(name)) return false;
  return MUTATE_TOOLS.has(name) || definition?.risk !== 'safe';
}

export function conflictedWrites(calls: ToolCall[]): Set<string> {
  const seen = new Set<string>();
  const skipped = new Set<string>();
  for (const call of calls) {
    const target = writeTarget(call.name, call.arguments);
    if (!target) continue;
    if (seen.has(target)) skipped.add(call.id);
    seen.add(target);
  }
  return skipped;
}

export async function runParallel(
  calls: ToolCall[],
  run: (call: ToolCall) => Promise<ToolResult>,
): Promise<ToolResult[]> {
  return Promise.all(calls.map((call) => run(call)));
}

export function toolTitle(definition: ToolDefinition | undefined, name: string): string {
  return definition?.name ?? name;
}

export function denied(output: string): ToolResult {
  return { ok: false, output };
}
