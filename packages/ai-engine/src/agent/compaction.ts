/**
 * Compaction keep-set: open_artifact_ids, active_plan, open_task_ids.
 * Everything else may be summarized; those three stay addressable.
 */

import type { AgentMessage, AgentPlan } from './types';

export const COMPACTION_KEEP_FIELDS = ['open_artifact_ids', 'active_plan', 'open_task_ids'] as const;

export interface CompactionKeepSet {
  open_artifact_ids: string[];
  active_plan?: AgentPlan;
  open_task_ids: string[];
}

export interface CompactOptions {
  preserveRecent?: number;
}

export function compactMessages(
  messages: AgentMessage[],
  keep: CompactionKeepSet,
  options: CompactOptions = {},
): AgentMessage[] {
  const preserveRecent = options.preserveRecent ?? 8;
  const system = messages.filter((message) => message.role === 'system');
  const rest = messages.filter((message) => message.role !== 'system');
  const pinned = rest.filter((message) => mentionsKeepSet(message, keep));
  const unpinned = rest.filter((message) => !mentionsKeepSet(message, keep));
  const recent = unpinned.slice(-preserveRecent);
  const dropped = unpinned.slice(0, Math.max(0, unpinned.length - preserveRecent));
  const reminder = keepSetReminder(keep, dropped.length);
  return dedupe([...system, reminder, ...pinned, ...recent]);
}

export function keepSetReminder(keep: CompactionKeepSet, dropped = 0): AgentMessage {
  const plan = keep.active_plan
    ? `${keep.active_plan.title}${keep.active_plan.mermaid ? ` · mermaid` : ''}`
    : '(none)';
  const body = [
    dropped > 0 ? `Compacted ${dropped} earlier messages.` : 'Compaction keep-set.',
    `open_artifact_ids: ${keep.open_artifact_ids.join(', ') || '(none)'}`,
    `active_plan: ${plan}`,
    `open_task_ids: ${keep.open_task_ids.join(', ') || '(none)'}`,
  ].join('\n');
  return { role: 'system', content: body };
}

function mentionsKeepSet(message: AgentMessage, keep: CompactionKeepSet): boolean {
  const text = message.content;
  if (keep.open_artifact_ids.some((id) => text.includes(id))) return true;
  if (keep.open_task_ids.some((id) => text.includes(id))) return true;
  if (keep.active_plan && text.includes(keep.active_plan.title)) return true;
  return COMPACTION_KEEP_FIELDS.some((field) => text.includes(field));
}

function dedupe(messages: AgentMessage[]): AgentMessage[] {
  const seen = new Set<string>();
  const next: AgentMessage[] = [];
  for (const message of messages) {
    const key = `${message.role}:${message.content.slice(0, 240)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(message);
  }
  return next;
}
