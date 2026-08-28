import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CheckpointStore } from '../checkpoints';
import { readProjectConventions } from '../conventions';
import { loadDroidsFromWorkspace, serializeDroid } from '../droids';
import { MissionOrchestrator, type MissionRecord } from '../mission-orchestrator';
import { AgentServer } from '../server';
import { loadSkillsFromWorkspace, parseComposerPrefixes } from '../skills';

describe('conventions, droids, and skills', () => {
  it('reads AGENTS.md and returns empty when none exist', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cortex-conv-'));
    expect(await readProjectConventions(root)).toBe('');
    await writeFile(path.join(root, 'AGENTS.md'), 'Use bun.\n', 'utf8');
    expect(await readProjectConventions(root)).toContain('Use bun.');
  });

  it('serializes a droid and loads workspace droids and skills', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'cortex-pack-'));
    await mkdir(path.join(root, '.cortex', 'droids'), { recursive: true });
    await mkdir(path.join(root, '.cortex', 'skills'), { recursive: true });
    const markdown = serializeDroid({
      name: 'scout',
      description: 'look',
      model: 'fast',
      tools: ['Read'],
      systemPrompt: 'Go look.',
    });
    await writeFile(path.join(root, '.cortex', 'droids', 'scout.md'), markdown, 'utf8');
    await writeFile(
      path.join(root, '.cortex', 'skills', 'fix.md'),
      '---\nname: /fix\ndescription: Fix CI\n---\nDo it.\n',
      'utf8',
    );
    const droids = await loadDroidsFromWorkspace(root);
    expect(droids[0]?.name).toBe('scout');
    const skills = await loadSkillsFromWorkspace(root);
    expect(skills[0]?.name).toBe('fix');
    expect(parseComposerPrefixes('!ls').kind).toBe('shell');
    expect(parseComposerPrefixes('/fix now').kind).toBe('command');
    expect(parseComposerPrefixes('#snip').kind).toBe('snippet');
    expect(parseComposerPrefixes('@file a').kind).toBe('mention');
    expect(parseComposerPrefixes('hello').kind).toBe('prompt');
  });
});

describe('CheckpointStore', () => {
  it('creates, lists, restores, and rejects an unknown id', () => {
    const store = new CheckpointStore();
    const created = store.create([{ role: 'user', content: 'hi' }], 'start', [
      { path: 'a.ts', content: 'x' },
    ]);
    expect(store.get(created.id)?.label).toBe('start');
    expect(store.list()).toHaveLength(1);
    expect(store.restore(created.id)[0]?.content).toBe('hi');
    expect(store.restoreFiles(created.id)[0]?.path).toBe('a.ts');
    expect(() => store.restore('missing')).toThrow(/Unknown checkpoint/);
  });
});

describe('MissionOrchestrator extras', () => {
  it('fails and lists missions from the store', async () => {
    const rows = new Map<string, MissionRecord>();
    const orchestrator = new MissionOrchestrator({
      create: (mission) => {
        rows.set(mission.id, mission);
        return mission;
      },
      update: (id, patch) => {
        const current = rows.get(id);
        if (current) rows.set(id, { ...current, ...patch });
      },
      get: (id) => rows.get(id) ?? null,
      list: (workspaceId) => [...rows.values()].filter((row) => row.workspaceId === workspaceId),
    });
    const mission = await orchestrator.create({
      workspaceId: 'ws',
      name: 'Ship',
      description: '',
      steps: ['A'],
    });
    await orchestrator.start(mission.id);
    const failed = await orchestrator.fail(mission.id, 'boom');
    expect(failed.status).toBe('failed');
    expect(failed.steps[0]?.error).toBe('boom');
    expect(await orchestrator.list('ws')).toHaveLength(1);
  });
});

describe('AgentServer session API', () => {
  it('forks, switches, compacts, reverts, and merges todos', async () => {
    const saved: string[] = [];
    const server = new AgentServer({
      persist: {
        save: (session) => {
          saved.push(session.id);
        },
        saveMessage: () => undefined,
      },
    });
    const session = server.createSession({
      providerId: 'mock',
      title: 'New session',
      workspacePath: '/tmp',
    });
    expect(server.getSession(session.id)?.id).toBe(session.id);
    expect(server.listSessions()).toHaveLength(1);
    server.setMode(session.id, 'plan');
    const forked = server.forkSession(session.id);
    expect(forked.parentId).toBe(session.id);
    const child = server.createChildSession(session.id, 'Child');
    expect(child.title).toBe('Child');
    server.switchModel(session.id, 'other', 'm1');
    expect(server.getSession(session.id)?.providerId).toBe('other');

    session.messages = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `m${index}`,
      })),
    ];
    const compacted = server.compactSession(session.id, 4);
    expect(compacted.messages.some((message) => message.content.startsWith('Compacted'))).toBe(true);

    session.messages = [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ];
    server.revertLastTurn(session.id);
    expect(server.getSession(session.id)?.messages).toEqual([]);

    const ckpt = server.checkpoints.create([{ role: 'user', content: 'saved' }], 'snap');
    server.restoreCheckpoint(session.id, ckpt.id);
    expect(server.getSession(session.id)?.messages[0]?.content).toBe('saved');

    server.mergeTodos(session.id, [{ id: 't1', content: 'a', status: 'pending' }], false);
    server.mergeTodos(session.id, [{ id: 't1', content: 'b', status: 'completed' }], true);
    expect(server.getSession(session.id)?.todos[0]?.content).toBe('b');
    server.resolvePermission(session.id, 'none', 'deny');
    server.resolveQuestion(session.id, 'none', 'yes');
    expect(saved.length).toBeGreaterThan(0);

    const events: string[] = [];
    for await (const event of server.runTurn(session.id, 'hi', {
      chat: async () => {
        throw new Error('offline');
      },
      executor: { execute: async () => ({ ok: true, output: '' }) },
    })) {
      events.push(event.type);
    }
    expect(events).toContain('error');
  });
});
