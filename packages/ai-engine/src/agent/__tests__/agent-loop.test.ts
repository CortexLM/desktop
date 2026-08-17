import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CheckpointStore } from '../checkpoints';
import { generateDroidFromDescription, parseDroidMarkdown } from '../droids';
import { runAgentTurn } from '../loop';
import { MissionOrchestrator, type MissionRecord } from '../mission-orchestrator';
import { InMemoryPermissionGate, matchRules } from '../permissions';
import { AgentServer } from '../server';
import { parseComposerPrefixes, parseSkillMarkdown } from '../skills';
import { composeSystemPrompt } from '../system-prompt';
import { CODING_TOOLS } from '../tools';
import type { AgentEvent, AgentMessage, ChatFn, ToolCall, ToolResult } from '../types';
import { WorkspaceToolExecutor } from '../workspace-tools';

function collect(events: AgentEvent[]) {
  return events.map((event) => event.type);
}

describe('composeSystemPrompt', () => {
  it('writes a real coding-agent brief, not placeholder copy', () => {
    const prompt = composeSystemPrompt({
      mode: 'agent',
      autonomy: 'ask',
      tools: CODING_TOOLS,
      projectConventions: 'Use bun, not npm.',
    });
    expect(prompt).toContain('Cortex Code');
    expect(prompt).toContain('<tool name=');
    expect(prompt).toContain('When to plan vs do');
    expect(prompt).toContain('Use bun, not npm.');
    expect(prompt).not.toMatch(/lorem ipsum/i);
  });
});

describe('runAgentTurn', () => {
  it('executes a mocked tool-using turn: read then answer', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cortex-agent-'));
    await writeFile(path.join(root, 'notes.txt'), 'hello from workspace', 'utf8');

    const replies = [
      '<thinking>Need the file.</thinking>\n<tool name="read">{"path":"notes.txt"}</tool>',
      'The file says hello from workspace.',
    ];
    const chat: ChatFn = async () => ({ content: replies.shift() ?? '' });

    const gate = new InMemoryPermissionGate({ autoAllowSafe: true });
    const executor = new WorkspaceToolExecutor({ workspaceRoot: root });
    const events: AgentEvent[] = [];

    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'What is in notes.txt?' }],
      chat,
      tools: CODING_TOOLS,
      executor,
      permissions: gate,
      systemPrompt: composeSystemPrompt({ tools: CODING_TOOLS }),
    })) {
      events.push(event);
    }

    expect(collect(events)).toContain('thinking');
    expect(collect(events)).toContain('tool_start');
    expect(collect(events)).toContain('tool_end');
    expect(collect(events)).toContain('text');
    expect(collect(events).at(-1)).toBe('done');

    const end = events.find((event) => event.type === 'tool_end');
    expect(end && end.type === 'tool_end' && end.ok).toBe(true);
    expect(end && end.type === 'tool_end' && end.output).toContain('hello from workspace');
  });

  it('uses native provider tool_calls when the chat function returns them', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cortex-native-'));
    await writeFile(path.join(root, 'notes.txt'), 'native', 'utf8');
    const executor = new WorkspaceToolExecutor({ workspaceRoot: root });
    const chat: ChatFn = async (messages) => {
      const last = messages.at(-1);
      if (last?.role === 'tool') {
        return { content: `Read ${last.content}` };
      }
      return {
        content: '',
        toolCalls: [{ id: 't1', name: 'read', arguments: { path: 'notes.txt' } }],
      };
    };
    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'read notes' }],
      chat,
      tools: CODING_TOOLS,
      executor,
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
    })) {
      events.push(event);
    }
    const end = events.find((event) => event.type === 'tool_end');
    expect(end && end.type === 'tool_end' && end.ok).toBe(true);
    expect(end && end.type === 'tool_end' && end.output).toContain('native');
  });

  it('denies a write when the permission gate says deny', async () => {
    const executor = {
      async execute(_call: ToolCall): Promise<ToolResult> {
        throw new Error('should not run');
      },
    };
    const gate = new InMemoryPermissionGate({
      autoAllowSafe: false,
      onRequest: (request) => {
        queueMicrotask(() => gate.resolve(request.id, 'deny'));
      },
    });

    const chat: ChatFn = async () => ({
      content: '<tool name="write">{"path":"x.ts","contents":"nope"}</tool>',
    });

    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'write a file' }],
      chat,
      tools: CODING_TOOLS,
      executor,
      permissions: gate,
      systemPrompt: 'test',
      maxIterations: 2,
    })) {
      events.push(event);
    }

    const denied = events.filter((event) => event.type === 'tool_end');
    expect(denied[0] && denied[0].type === 'tool_end' && denied[0].ok).toBe(false);
  });

  it('emits a plan and stops in plan mode', async () => {
    const chat: ChatFn = async () => ({
      content: '<plan title="Harden uploads">["Add helper","Wire panel"]</plan>\nNeed approval.',
    });
    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'harden uploads' }],
      chat,
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate(),
      systemPrompt: composeSystemPrompt({ mode: 'plan' }),
      mode: 'plan',
    })) {
      events.push(event);
    }
    expect(events.some((event) => event.type === 'plan')).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'done', finishReason: 'plan' });
  });

  it('reports context_full when over the limit', async () => {
    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'hi' }],
      chat: async () => ({ content: 'ok' }),
      tools: [],
      executor: { execute: async () => ({ ok: true, output: '' }) },
      permissions: new InMemoryPermissionGate(),
      systemPrompt: 'x',
      contextTokens: 200_000,
      contextLimit: 128_000,
    })) {
      events.push(event);
    }
    expect(events[0]).toMatchObject({ type: 'context_full', tokens: 200_000, limit: 128_000 });
  });
});

describe('workspace tools', () => {
  it('edits a file with a single replacement', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cortex-edit-'));
    const file = path.join(root, 'a.ts');
    await writeFile(file, 'const x = 1;\n', 'utf8');
    const executor = new WorkspaceToolExecutor({ workspaceRoot: root });
    const result = await executor.execute({
      id: '1',
      name: 'edit',
      arguments: { path: 'a.ts', old_string: 'const x = 1;', new_string: 'const x = 2;' },
    });
    expect(result.ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('const x = 2;\n');
  });

  it('applies a unified patch', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cortex-patch-'));
    const file = path.join(root, 'a.ts');
    await writeFile(file, 'const x = 1;\n', 'utf8');
    const executor = new WorkspaceToolExecutor({ workspaceRoot: root });
    const result = await executor.execute({
      id: '1',
      name: 'apply_patch',
      arguments: {
        patch: `--- a/a.ts\n+++ b/a.ts\n@@\n-const x = 1;\n+const x = 2;\n`,
      },
    });
    expect(result.ok).toBe(true);
    expect(await readFile(file, 'utf8')).toBe('const x = 2;\n');
  });

  it('rejects file:// webfetch', async () => {
    const executor = new WorkspaceToolExecutor({ workspaceRoot: tmpdir() });
    const result = await executor.execute({
      id: '1',
      name: 'webfetch',
      arguments: { url: 'file:///etc/passwd' },
    });
    expect(result.ok).toBe(false);
  });
});

describe('plan mode and permissions', () => {
  it('refuses write tools in plan mode', async () => {
    const events: AgentEvent[] = [];
    for await (const event of runAgentTurn({
      messages: [{ role: 'user', content: 'plan' }],
      chat: async () => ({
        content: '<tool name="write">{"path":"x.ts","contents":"nope"}</tool>',
      }),
      tools: CODING_TOOLS,
      executor: { execute: async () => ({ ok: true, output: 'wrote' }) },
      permissions: new InMemoryPermissionGate({ autoAllowSafe: true }),
      systemPrompt: 'test',
      mode: 'plan',
      maxIterations: 2,
    })) {
      events.push(event);
    }
    const end = events.find((event) => event.type === 'tool_end');
    expect(end && end.type === 'tool_end' && end.ok).toBe(false);
    expect(end && end.type === 'tool_end' && end.output).toMatch(/Plan\/ask mode/);
  });

  it('matches pattern-scoped deny rules', () => {
    expect(
      matchRules([{ action: 'deny', tool: 'bash', pattern: 'rm *' }], 'bash', 'rm -rf /')
    ).toBe('deny');
    expect(matchRules([{ action: 'allow', tool: 'read', pattern: 'src/**' }], 'read', 'src/a.ts')).toBe(
      'allow'
    );
  });
});

describe('AgentServer', () => {
  it('forks, compacts, and reverts without calling a provider from a view', async () => {
    const server = new AgentServer();
    const session = server.createSession({ providerId: 'mock', model: 'm' });
    for (let i = 0; i < 12; i += 1) {
      session.messages.push({ role: 'user', content: `u${i}` }, { role: 'assistant', content: `a${i}` });
    }
    const compacted = server.compactSession(session.id, 4);
    expect(compacted.messages.some((message) => message.content.startsWith('Compacted'))).toBe(true);
    expect(compacted.messages.filter((message) => message.role === 'user').length).toBeLessThan(12);

    const fork = server.forkSession(session.id);
    expect(fork.id).not.toBe(session.id);
    expect(fork.parentId).toBe(session.id);
    expect(fork.messages.length).toBe(compacted.messages.length);

    const child = server.createChildSession(session.id, 'reviewer');
    expect(child.parentId).toBe(session.id);

    session.messages.push({ role: 'user', content: 'undo me' }, { role: 'assistant', content: 'ok' });
    server.revertLastTurn(session.id);
    expect(session.messages.at(-1)?.content).not.toBe('undo me');

    server.switchModel(session.id, 'anthropic', 'claude-sonnet-4');
    expect(server.getSession(session.id)?.providerId).toBe('anthropic');
  });

  it('runs a turn through the session API', async () => {
    const server = new AgentServer();
    const session = server.createSession({ providerId: 'mock', workspacePath: tmpdir() });
    const events: AgentEvent[] = [];
    for await (const event of server.runTurn(session.id, 'hi', {
      chat: async () => ({ content: 'hello' }),
      executor: { execute: async () => ({ ok: true, output: '' }) },
    })) {
      events.push(event);
    }
    expect(events.some((event) => event.type === 'text' && event.text === 'hello')).toBe(true);
    expect(server.getSession(session.id)?.messages.some((message) => message.role === 'user')).toBe(true);
  });
});

describe('droids and skills', () => {
  it('parses a markdown droid and generates one from a brief', () => {
    const parsed = parseDroidMarkdown(
      `---
name: reviewer
model: mock
tools: read, grep
---
You review diffs only.`,
      'fallback'
    );
    expect(parsed.name).toBe('reviewer');
    expect(parsed.tools).toEqual(['read', 'grep']);
    expect(parsed.systemPrompt).toContain('review diffs');

    const generated = generateDroidFromDescription('Write unit tests for the upload helper');
    expect(generated.tools).toContain('bash');
    expect(generated.systemPrompt).toContain('upload helper');
  });

  it('parses composer prefixes and skills', () => {
    expect(parseComposerPrefixes('!git status')).toEqual({
      kind: 'shell',
      value: 'git status',
      rest: '',
    });
    expect(parseComposerPrefixes('/fix-test src/a.test.ts').kind).toBe('command');
    expect(parseComposerPrefixes('#snippet-login').kind).toBe('snippet');
    expect(parseComposerPrefixes('@UploadPanel look at this').kind).toBe('mention');
    const skill = parseSkillMarkdown('---\nname: /fix-test\ndescription: Fix CI\n---\nRun the failing test.', 'x');
    expect(skill.name).toBe('fix-test');
  });
});

describe('checkpoints and missions', () => {
  it('restores a previous message list', () => {
    const store = new CheckpointStore();
    const first: AgentMessage[] = [{ role: 'user', content: 'one' }];
    const ckpt = store.create(first, 'before edit');
    const restored = store.restore(ckpt.id);
    expect(restored).toEqual(first);
    expect(store.list()[0]?.label).toBe('before edit');
  });

  it('walks planning → running → completed', async () => {
    const records = new Map<string, MissionRecord>();
    const orchestrator = new MissionOrchestrator({
      create: (mission) => {
        records.set(mission.id, mission);
      },
      update: (id, patch) => {
        records.set(id, { ...records.get(id)!, ...patch });
      },
      get: (id) => records.get(id) ?? null,
      list: (workspaceId) => [...records.values()].filter((item) => item.workspaceId === workspaceId),
    });

    const created = await orchestrator.create({
      workspaceId: 'ws',
      name: 'Harden upload',
      description: 'shared sanitize helper',
      steps: ['Helper', 'Wire panel'],
    });
    expect(created.status).toBe('planning');
    await orchestrator.start(created.id);
    await orchestrator.completeStep(created.id, 'helper done');
    const done = await orchestrator.completeStep(created.id, 'wired');
    expect(done.status).toBe('completed');
    expect(done.steps.every((step) => step.status === 'completed')).toBe(true);
  });
});
