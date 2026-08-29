/**
 * Plan / spec mode: mermaid fence is required, ExitSpecMode before writes.
 */

import { hasUnresolvedOptions } from './workspace-tools';
import type { AgentPlan } from './types';

const FENCE = /```mermaid\s+([\s\S]*?)```/i;
const DIAGRAM = /^\s*(flowchart|sequenceDiagram)\b/m;

export function extractMermaidFence(text: string): string | null {
  const match = FENCE.exec(text);
  return match?.[1]?.trim() ? match[1].trim() : null;
}

export function isValidPlanMermaid(text: string): boolean {
  const fenced = extractMermaidFence(text);
  if (fenced) return DIAGRAM.test(fenced);
  return DIAGRAM.test(text.trim());
}

export function mermaidFromArgs(args: Record<string, unknown>): string | undefined {
  const parts = [stringify(args.mermaid), stringify(args.rationale), stringify(args.diagram)];
  for (const part of parts) {
    if (part && isValidPlanMermaid(part)) {
      return extractMermaidFence(part) ?? part.trim();
    }
  }
  return undefined;
}

export function denyExitSpec(args: Record<string, unknown>): string | null {
  if (hasUnresolvedOptions(args)) {
    return 'Do not ExitSpecMode with unresolved Option A/B. Use AskUser first.';
  }
  if (!mermaidFromArgs(args)) {
    return 'Plan mode requires a mermaid fence (flowchart or sequenceDiagram) before ExitSpecMode.';
  }
  return null;
}

export function planFromExit(args: Record<string, unknown>): AgentPlan {
  const mermaid = mermaidFromArgs(args);
  return {
    title: String(args.title ?? 'Plan'),
    rationale: String(args.rationale ?? ''),
    approved: false,
    mermaid,
    steps: parseSteps(args.steps).map((title, index) => ({
      id: `step-${index + 1}`,
      title,
      status: index === 0 ? 'active' : 'pending',
    })),
  };
}

function parseSteps(raw: unknown): string[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* fall through */
  }
  return String(raw ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
