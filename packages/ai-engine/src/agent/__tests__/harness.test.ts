import { describe, expect, it } from 'vitest';

import { ArtifactStore } from '../artifacts';
import { compactMessages } from '../compaction';
import { runAgentTurn } from '../loop';
import { isValidPlanMermaid } from '../plan-mode';
import { InMemoryPermissionGate } from '../permissions';
import { toolsFromConnections } from '../plugin-tools';
import { CODING_TOOLS } from '../tools';
import type { AgentEvent, AgentMessage, ChatFn, ToolCall } from '../types';

const MERMAID = '```mermaid\nflowchart TD\n  Read-->Plan\n```';

function collect(events: AgentEvent[]) {
  return events.map((event) => event.type);
}

describe('background Task', () => {
  it('spawns a background child and delivers the parent completion payload', async () => {
    const replies = [
      '<tool name="Task">{"kind":"explore","prompt":"list src"}</tool>',
      'The explore child finished.',
    ];
    const childReplies = ['src has two files.'];
    const chat: ChatFn = async (messages) => {
      const last = messages.at(-1);
      if (last?.role === 'user' && last.content === 'list src') {
        return { content: childReplies.shift() ?? '' };
      }
      return { content: replies.shift() ?? 'done' };
    };

    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'Explore the tree' }],
      chat,
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      maxIterations: 4,
    })) {
      events.push(event);
    }

    expect(collect(events)).toContain('task_started');
    expect(collect(events)).toContain('task_completed');
    const completed = events.find((event) => event.type === 'task_completed');
    expect(completed && completed.type === 'task_completed' && completed.id).toMatch(/^task_/);
    expect(completed && completed.type === 'task_completed' && completed.summary).toContain('src has two files');
    const started = events.find((event) => event.type === 'tool_end' && event.name === 'Task');
    expect(started && started.type === 'tool_end' && started.ok).toBe(true);
    expect(started && started.type === 'tool_end' && started.output).toMatch(/task_/);
  });

  it('forbids nested Task and AskUser on a child', async () => {
    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'delegate' }],
      chat: async () => ({
        content: '<tool name="Task">{"kind":"explore","prompt":"look"}</tool>',
      }),
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: 'should not run' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      delegationDepth: 1,
      maxIterations: 2,
    })) {
      events.push(event);
    }
    const end = events.find((event) => event.type === 'tool_end');
    expect(end && end.type === 'tool_end' && end.ok).toBe(false);
    expect(end && end.type === 'tool_end' && end.output).toMatch(/nested Task/i);
  });

  it('times out a hung child as task_failed', async () => {
    let spawned = false;
    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'hang' }],
      chat: async (messages) => {
        const last = messages.at(-1);
        if (last?.role === 'user' && last.content === 'never') {
          await new Promise(() => undefined);
        }
        if (!spawned) {
          spawned = true;
          return { content: '<tool name="Task">{"kind":"explore","prompt":"never"}</tool>' };
        }
        return { content: 'waiting' };
      },
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      taskTimeoutMs: 40,
      maxIterations: 3,
    })) {
      events.push(event);
    }
    expect(events.some((event) => event.type === 'task_failed')).toBe(true);
  });
});

describe('artifacts', () => {
  it('offloads oversized tool output to a stub the agent can page', async () => {
    const store = new ArtifactStore({ threshold: 40, previewLines: 2 });
    const bulky = Array.from({ length: 20 }, (_, i) => `line-${i} api_key=notasecretvalue`).join('\n');
    const chat: ChatFn = async (messages) => {
      const last = messages.at(-1);
      if (last?.role === 'tool') {
        expect(last.content).toContain('[artifact art_');
        expect(last.content).not.toContain('notasecretvalue');
        return { content: 'paged' };
      }
      return {
        content: '',
        toolCalls: [{ id: 't1', name: 'Grep', arguments: { pattern: 'line' } }],
      };
    };

    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'search' }],
      chat,
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: bulky }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      artifacts: store,
    })) {
      events.push(event);
    }

    const end = events.find((event) => event.type === 'tool_end');
    expect(end && end.type === 'tool_end' && end.output).toContain('artifact_id="art_1"');
    expect(store.ids()).toEqual(['art_1']);
    expect(store.readPage('art_1', 1, 2)).toContain('1|');
    expect(store.grep('art_1', 'line-3')).toContain('line-3');
  });
});

describe('plan mermaid', () => {
  it('accepts a mermaid flowchart and rejects ExitSpecMode without one', async () => {
    expect(isValidPlanMermaid(MERMAID)).toBe(true);
    expect(isValidPlanMermaid('```mermaid\nsequenceDiagram\n  A->>B: hi\n```')).toBe(true);
    expect(isValidPlanMermaid('just words')).toBe(false);

    const denied: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'plan' }],
      chat: async () => ({
        content: '<tool name="ExitSpecMode">{"title":"X","rationale":"go","steps":["a"]}</tool>',
      }),
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      mode: 'plan',
      maxIterations: 2,
    })) {
      denied.push(event);
    }
    const fail = denied.find((event) => event.type === 'tool_end');
    expect(fail && fail.type === 'tool_end' && fail.ok).toBe(false);
    expect(fail && fail.type === 'tool_end' && fail.output).toMatch(/mermaid/i);

    const ok: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'plan' }],
      chat: async () => ({
        content: `<tool name="ExitSpecMode">${JSON.stringify({
          title: 'Ship',
          rationale: 'One path',
          mermaid: MERMAID,
          steps: ['Read', 'Write'],
        })}</tool>`,
      }),
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      mode: 'plan',
    })) {
      ok.push(event);
    }
    const plan = ok.find((event) => event.type === 'plan');
    expect(plan && plan.type === 'plan' && plan.plan.mermaid).toMatch(/flowchart/);
    expect(ok.at(-1)).toEqual({ type: 'done', finishReason: 'plan' });
  });
});

describe('compaction keep-set', () => {
  it('keeps open_artifact_ids, active_plan, and open_task_ids', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'You are Cortex.' },
      { role: 'user', content: 'old one' },
      { role: 'assistant', content: 'old two' },
      { role: 'user', content: 'see art_9 and task_3' },
      { role: 'assistant', content: 'working' },
      { role: 'user', content: 'recent' },
      { role: 'assistant', content: 'recent answer' },
    ];
    const compacted = compactMessages(
      messages,
      {
        open_artifact_ids: ['art_9'],
        open_task_ids: ['task_3'],
        active_plan: {
          title: 'Harden uploads',
          rationale: '',
          approved: false,
          mermaid: 'flowchart TD',
          steps: [],
        },
      },
      { preserveRecent: 2 },
    );
    const text = compacted.map((message) => message.content).join('\n');
    expect(text).toContain('open_artifact_ids: art_9');
    expect(text).toContain('open_task_ids: task_3');
    expect(text).toContain('active_plan: Harden uploads');
    expect(text).toContain('art_9');
    expect(text).toContain('task_3');
    expect(text).not.toContain('old one');
  });
});

describe('plugin tools from connections', () => {
  it('injects Chat/Bot connections and uses a Code catalog only when supplied', () => {
    const connections = [
      {
        id: 'c1',
        slug: 'drive',
        surfaces: ['both' as const],
        tools: [{ name: 'list', description: 'List files' }],
      },
    ];
    const chat = toolsFromConnections(connections, 'chat');
    expect(chat.map((tool) => tool.name)).toEqual(['plugin__drive__list']);
    expect(toolsFromConnections(connections, 'code')).toEqual([]);
    const code = toolsFromConnections(connections, 'code', connections);
    expect(code.map((tool) => tool.name)).toEqual(['plugin__drive__list']);
  });
});

describe('parallel tool results stay in call order', () => {
  it('returns results in the original call order', async () => {
    const order: string[] = [];
    const chat: ChatFn = async (messages) => {
      const last = messages.at(-1);
      if (last?.role === 'tool') {
        return { content: 'done' };
      }
      return {
        content: '',
        toolCalls: [
          { id: 'slow', name: 'Read', arguments: { path: 'b.ts' } },
          { id: 'fast', name: 'Read', arguments: { path: 'a.ts' } },
        ] satisfies ToolCall[],
      };
    };
    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'read both' }],
      chat,
      tools: CODING_TOOLS,
      executor: {
        execute: async (call) => {
          if (call.id === 'slow') await new Promise((resolve) => setTimeout(resolve, 20));
          order.push(call.id);
          return { ok: true, output: call.id };
        },
      },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
    })) {
      events.push(event);
    }
    const ends = events.filter((event) => event.type === 'tool_end');
    expect(ends.map((event) => (event.type === 'tool_end' ? event.id : ''))).toEqual(['slow', 'fast']);
  });
});
