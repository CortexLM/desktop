import type { AgentPlan, ToolCall } from './types';

const TOOL_RE = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/g;
const PLAN_RE = /<plan\s+title="([^"]+)">([\s\S]*?)<\/plan>/;

export function parseToolCalls(content: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const matches = content.matchAll(TOOL_RE);
  let index = 0;
  for (const match of matches) {
    const name = match[1]?.trim();
    if (!name) continue;
    let args: Record<string, unknown> = {};
    const raw = match[2]?.trim() ?? '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          args = parsed as Record<string, unknown>;
        }
      } catch {
        args = { input: raw };
      }
    }
    calls.push({
      id: `tool-${index + 1}-${name}`,
      name,
      arguments: args,
    });
    index += 1;
  }
  return calls;
}

export function stripToolMarkup(content: string): string {
  return content.replace(TOOL_RE, '').replace(PLAN_RE, '').trim();
}

export function parsePlan(content: string): AgentPlan | null {
  const match = content.match(PLAN_RE);
  if (!match) return null;
  const title = match[1] ?? 'Plan';
  let steps: string[] = [];
  try {
    const parsed = JSON.parse(match[2] ?? '[]') as unknown;
    if (Array.isArray(parsed)) {
      steps = parsed.map((item) => String(item));
    }
  } catch {
    steps = (match[2] ?? '')
      .split('\n')
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
      .filter(Boolean);
  }
  return {
    title,
    rationale: stripToolMarkup(content).slice(0, 400),
    approved: false,
    steps: steps.map((titleText, index) => ({
      id: `step-${index + 1}`,
      title: titleText,
      status: index === 0 ? 'active' : 'pending',
    })),
  };
}

export function extractThinking(content: string): string | null {
  const match = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  return match?.[1]?.trim() || null;
}
