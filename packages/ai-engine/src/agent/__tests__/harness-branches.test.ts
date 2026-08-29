import { describe, expect, it } from 'vitest';

import { ArtifactStore } from '../artifacts';
import {
  BackgroundTaskRegistry,
  completionReminder,
  resolveTaskKind,
} from '../background-tasks';
import { builtinSubagent, toDroid } from '../builtin-subagents';
import { compactMessages, keepSetReminder } from '../compaction';
import { conflictedWrites, specLocked, toolTitle, writeTarget } from '../loop-calls';
import { decideAndRun, finishResult, prepareCall, readArtifact } from '../loop-run';
import {
  answerAskUser,
  denyAskUser,
  denyPlanWorker,
  injectTaskEvents,
  spawnTaskResult,
} from '../loop-special';
import { denyExitSpec, extractMermaidFence, mermaidFromArgs, planFromExit } from '../plan-mode';
import { toolsFromConnections } from '../plugin-tools';
import { InMemoryPermissionGate } from '../permissions';
import { runAgentTurn } from '../loop';
import { AgentServer } from '../server';
import { CODING_TOOLS, filterTools } from '../tools';
import type { AgentEvent, AgentMessage, PermissionGate, ToolCall } from '../types';

const call = (name: string, args: Record<string, unknown>, id = 'c1'): ToolCall => ({
  id,
  name,
  arguments: args,
});

describe('resolveTaskKind and builtin kinds', () => {
  it('maps aliases and rejects an unknown kind', () => {
    expect(resolveTaskKind({ kind: 'explorer' })).toBe('explore');
    expect(resolveTaskKind({ subagent: 'PLAN' })).toBe('plan');
    expect(resolveTaskKind({ droid: 'worker' })).toBe('worker');
    expect(resolveTaskKind({ kind: 'mystery' })).toBeUndefined();
    expect(builtinSubagent('explorer')?.name).toBe('explore');
    expect(builtinSubagent('plan')?.name).toBe('plan');
    expect(builtinSubagent('worker')?.name).toBe('worker');
    expect(builtinSubagent('nope')).toBeUndefined();
    expect(toDroid(builtinSubagent('explore')!).name).toBe('explore');
  });
});

describe('BackgroundTaskRegistry branches', () => {
  it('cancels, times out, and reminds the parent of every phase', async () => {
    const store = new ArtifactStore({ threshold: 4 });
    const registry = new BackgroundTaskRegistry(
      async (input) => {
        input.onProgress('looking');
        if (input.prompt === 'throw') throw new Error('child boom');
        if (input.prompt === 'bare') throw 'bare-fail';
        if (input.prompt === 'empty') return { summary: '', output: 'ok' };
        return { summary: 'done', output: 'xxxx-big' };
      },
      store,
      20,
    );
    const hanging = new BackgroundTaskRegistry(async () => new Promise(() => undefined), undefined, 15);

    expect(registry.cancel('missing')).toBeUndefined();
    const ok = registry.spawn({ kind: 'explore', prompt: 'ok', callId: '1' });
    const threw = registry.spawn({ kind: 'plan', prompt: 'throw', callId: '2' });
    const bare = registry.spawn({ kind: 'worker', prompt: 'bare', callId: '3' });
    const empty = registry.spawn({ kind: 'explore', prompt: 'empty', callId: '4' });
    const hung = hanging.spawn({ kind: 'explore', prompt: 'never', callId: '5' });
    expect(registry.openIds()).toContain(ok.id);
    hanging.cancel(hung.id);
    hanging.cancelAll();
    await registry.waitOpen();
    await hanging.waitOpen();

    const events = [...registry.drain(), ...hanging.drain()];
    expect(events.some((event) => event.type === 'task_progress')).toBe(true);
    expect(events.some((event) => event.type === 'task_completed' && event.artifact_id)).toBe(true);
    expect(events.some((event) => event.type === 'task_failed' && event.id === threw.id)).toBe(true);
    expect(events.some((event) => event.type === 'task_failed' && event.id === bare.id)).toBe(true);
    expect(events.some((event) => event.type === 'task_failed' && event.id === hung.id)).toBe(true);
    expect(events.some((event) => event.type === 'task_completed' && event.id === empty.id)).toBe(true);

    expect(completionReminder({ type: 'task_completed', id: 't', summary: 's', artifact_id: 'art_1' })).toContain(
      'artifact_id=art_1',
    );
    expect(completionReminder({ type: 'task_completed', id: 't', summary: 's' })).toBe(
      'task_completed id=t summary=s',
    );
    expect(completionReminder({ type: 'task_failed', id: 't', summary: 'no' })).toContain('task_failed');
    expect(completionReminder({ type: 'text', text: 'x' })).toBeUndefined();
  });
});

describe('AskUser, Task spawn, and ExitSpec branches', () => {
  it('covers deny, missing host, options parse, and inject reminders', async () => {
    expect(denyAskUser(0)).toBeNull();
    expect(denyAskUser(1)).toMatch(/AskUser/);
    expect(denyPlanWorker('ask', 'worker')).toMatch(/worker/);
    expect(denyPlanWorker('plan', 'explore')).toBeNull();
    expect(denyPlanWorker('agent', 'worker')).toBeNull();

    const answered = await answerAskUser(call('AskUser', { prompt: 'Pick', options: '["A","B"]' }), {
      ask: async () => 'A',
    });
    expect(answered.answer).toBe('A');
    expect(answered.options).toEqual(['A', 'B']);
    const none = await answerAskUser(call('AskUser', { prompt: '?', options: '{bad' }));
    expect(none.answer).toBe('(no answer)');
    expect(none.options).toBeUndefined();
    expect((await answerAskUser(call('AskUser', { prompt: 'x', options: 3 }))).options).toBeUndefined();

    expect(spawnTaskResult(call('Task', { prompt: 'x' }), 'explore').result.ok).toBe(false);
    const spawned = spawnTaskResult(call('Task', {}), 'explore', {
      spawn: () => ({ id: 'task_9', summary: 'explore: ' }),
      cancel: () => undefined,
      cancelAll: () => undefined,
      drain: () => [],
      openIds: () => [],
      waitOpen: async () => undefined,
    });
    expect(spawned.started?.type).toBe('task_started');

    const messages: AgentMessage[] = [];
    const injected = injectTaskEvents(messages, [
      { type: 'task_progress', id: 't', summary: 'mid' },
      { type: 'task_completed', id: 't', summary: 'ok' },
      { type: 'text', text: 'ignore' },
    ]);
    expect(injected).toHaveLength(3);
    expect(messages.some((message) => message.content.includes('task_completed'))).toBe(true);
  });
});

describe('artifacts, compaction, and plan mermaid branches', () => {
  it('pages missing ids, empty keep-sets, and mermaid from rationale', () => {
    const store = new ArtifactStore();
    expect(store.get('art_1')).toBeUndefined();
    expect(store.readPage('missing')).toBeUndefined();
    expect(store.grep('missing', 'x')).toBeUndefined();
    store.offload('Grep', `${'z'.repeat(40_000)}\nnone`);
    expect(store.grep('art_1', 'no-such')).toMatch(/No matches/);
    expect(store.get('art_1')?.tool).toBe('Grep');
    expect(store.readPage('art_1', 0, 1)).toContain('1|');

    const empty = keepSetReminder({ open_artifact_ids: [], open_task_ids: [] });
    expect(empty.content).toContain('active_plan: (none)');
    expect(empty.content).toContain('open_artifact_ids: (none)');
    const duped = compactMessages(
      [
        { role: 'user', content: 'open_artifact_ids: keep' },
        { role: 'user', content: 'open_artifact_ids: keep' },
        { role: 'assistant', content: 'task_3 idle' },
      ],
      { open_artifact_ids: [], open_task_ids: ['task_3'], active_plan: { title: 'T', rationale: '', approved: false, steps: [] } },
    );
    expect(duped.filter((message) => message.content.includes('open_artifact_ids: keep'))).toHaveLength(1);

    expect(extractMermaidFence('```mermaid\n\n```')).toBeNull();
    expect(mermaidFromArgs({ rationale: 'flowchart TD\n  A-->B' })).toContain('flowchart');
    expect(mermaidFromArgs({ diagram: 1 })).toBeUndefined();
    expect(denyExitSpec({ unresolved_choices: true, mermaid: 'flowchart TD' })).toMatch(/AskUser/);
    const plan = planFromExit({ mermaid: '```mermaid\nsequenceDiagram\n  A->>B: hi\n```', steps: 'not-json\nWire' });
    expect(plan.title).toBe('Plan');
    expect(plan.steps.map((step) => step.title)).toEqual(['not-json', 'Wire']);
    expect(planFromExit({ title: 'X', mermaid: 'flowchart TD' }).steps).toEqual([]);
  });
});

describe('loop helpers: artifacts, writes, plugins', () => {
  it('reads and greps artifacts, denies writes, and filters plugin surfaces', async () => {
    const store = new ArtifactStore({ threshold: 8 });
    store.offload('Grep', 'alpha\nbeta\ngamma extra');
    expect(readArtifact(call('LS', { artifact_id: 'art_1' }), store)).toBeUndefined();
    expect(readArtifact(call('Read', {}), store)).toBeUndefined();
    expect(readArtifact(call('Read', { artifact_id: 'nope' }), store)?.ok).toBe(false);
    expect(readArtifact(call('Grep', { artifact_id: 'art_1', pattern: 'beta' }), store)?.output).toContain('beta');
    expect(readArtifact(call('Read', { artifact_id: 'art_1' }), store)?.output).toContain('1|');
    expect(finishResult('Read', { ok: true, output: 'plain' }).output).toBe('plain');

    const denyAll: PermissionGate = { decide: async () => 'deny' };
    const denied = await decideAndRun(
      [prepareCall(call('Read', { path: 'a.ts' }), undefined, 'agent')],
      denyAll,
      async () => ({ ok: true, output: 'no' }),
    );
    expect(denied.get('c1')?.ok).toBe(false);

    expect(writeTarget('Create', {})).toBeUndefined();
    expect(writeTarget('ApplyPatch', { patch: 1 })).toBeUndefined();
    expect(writeTarget('ApplyPatch', { patch: '+++ b/src/a.ts\n' })).toBe('src/a.ts');
    expect(writeTarget('ApplyPatch', { patch: '*** Update File: lib/b.ts' })).toBe('lib/b.ts');
    expect(writeTarget('Read', { path: 'x' })).toBeUndefined();
    const twice = conflictedWrites([
      call('Edit', { path: 'a.ts' }, 'w1'),
      call('Edit', { path: 'a.ts' }, 'w2'),
    ]);
    expect([...twice]).toEqual(['w2']);
    expect(specLocked('plan', 'Create', { name: 'Create', description: '', risk: 'write', parameters: { type: 'object', properties: {} } })).toBe(true);
    expect(toolTitle(undefined, 'Read')).toBe('Read');

    expect(toolsFromConnections([{ id: 'x', tools: [{ name: 't', description: 'd' }] }], 'code')).toEqual([]);
    expect(toolsFromConnections([{ id: 'x', surfaces: ['both'], tools: [{ name: 't', description: 'd' }] }], 'chat')[0]?.name).toBe(
      'plugin__x__t',
    );
    expect(toolsFromConnections([{ id: 'x' }], 'chat')).toEqual([]);
    expect(filterTools().length).toBeGreaterThan(0);
    expect(filterTools(['read']).map((tool) => tool.name)).toEqual(['Read']);
  });
});

const MERMAID = '```mermaid\nflowchart TD\n  A-->B\n```';

describe('loop and server keep-set branches', () => {
  it('denies child AskUser, unknown Task, plan worker, and emits context_full', async () => {
    const events: AgentEvent[] = [];
    const abort = new AbortController();
    abort.abort();
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'x' }],
      chat: async () => {
        throw 'offline';
      },
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      abortSignal: abort.signal,
      contextTokens: 10,
      contextLimit: 10,
      taskTimeoutMs: 40,
    })) {
      events.push(event);
    }
    expect(events.some((event) => event.type === 'context_full')).toBe(true);
    expect(events.some((event) => event.type === 'done' && event.finishReason === 'aborted')).toBe(true);

    const denied: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'x' }],
      chat: async () => ({
        content: '',
        toolCalls: [
          { id: 'a', name: 'AskUser', arguments: { prompt: '?' } },
          { id: 't1', name: 'Task', arguments: { kind: 'mystery', prompt: 'x' } },
          { id: 't2', name: 'Task', arguments: { kind: 'worker', prompt: 'x' } },
        ],
      }),
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      mode: 'plan',
      maxIterations: 2,
      taskTimeoutMs: 40,
    })) {
      denied.push(event);
    }
    const childAsk: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'x' }],
      chat: async () => ({
        content: '',
        toolCalls: [{ id: 'a', name: 'AskUser', arguments: { prompt: '?' } }],
      }),
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      delegationDepth: 1,
      maxIterations: 2,
      taskTimeoutMs: 40,
    })) {
      childAsk.push(event);
    }
    const ends = denied.filter((event) => event.type === 'tool_end');
    expect(childAsk.some((event) => event.type === 'tool_end' && /AskUser/.test(event.output))).toBe(true);
    expect(ends.some((event) => event.type === 'tool_end' && /explore, plan, or worker/.test(event.output))).toBe(true);
    expect(ends.some((event) => event.type === 'tool_end' && /worker Task/.test(event.output))).toBe(true);

    const writes: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'x' }],
      chat: async () => ({
        content: '',
        toolCalls: [
          { id: 'e1', name: 'Edit', arguments: { path: 'a.ts', old_string: 'a', new_string: 'b' } },
          { id: 'e2', name: 'Edit', arguments: { path: 'a.ts', old_string: 'a', new_string: 'c' } },
        ],
      }),
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: 'edited' }) },
      permissions: { decide: async () => 'allow-once' },
      systemPrompt: 'test',
      maxIterations: 2,
    })) {
      writes.push(event);
    }
    expect(
      writes.some((event) => event.type === 'tool_end' && /two calls/.test(event.output)),
    ).toBe(true);
  });

  it('runs plan and worker children and records keep-set on the session', async () => {
    const server = new AgentServer();
    const session = server.createSession({ providerId: 'test', title: 'New session', agentName: 'lead' });
    const bulky = 'line\n'.repeat(4000);
    let phase = 0;
    const events: AgentEvent[] = [];
    for await (const event of server.runTurn(session.id, 'go', {
      chat: async (messages) => {
        const last = messages.at(-1);
        if (last?.role === 'user' && last.content === 'plan it') {
          return {
            content: `<tool name="ExitSpecMode">${JSON.stringify({
              title: 'Ship',
              mermaid: MERMAID,
              steps: ['Read'],
            })}</tool>`,
          };
        }
        if (last?.role === 'user' && last.content === 'work it') {
          return { content: '', toolCalls: [{ id: 'r', name: 'Read', arguments: { path: 'a.ts' } }] };
        }
        if (phase === 0) {
          phase = 1;
          return {
            content:
              '<tool name="Task">{"kind":"plan","prompt":"plan it"}</tool>' +
              '<tool name="Task">{"kind":"worker","prompt":"work it"}</tool>',
          };
        }
        return {
          content: `<tool name="ExitSpecMode">${JSON.stringify({
            title: 'Parent plan',
            mermaid: MERMAID,
            steps: ['Read'],
          })}</tool>`,
        };
      },
      executor: { execute: async () => ({ ok: true, output: bulky }) },
      product: 'chat',
      pluginConnections: [{ id: 'drive', surfaces: ['chat'], tools: [{ name: 'list', description: 'List' }] }],
    })) {
      events.push(event);
    }
    expect(events.some((event) => event.type === 'task_completed')).toBe(true);
    expect(events.some((event) => event.type === 'task_progress')).toBe(true);
    expect(server.getSession(session.id)?.activePlan?.title).toBe('Parent plan');
    expect(server.compactSession(session.id, 80).id).toBe(session.id);
    expect(() => server.compactSession('missing')).toThrow(/not found/);
  });
});

