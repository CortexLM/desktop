import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { hasUnresolvedOptions, WorkspaceToolExecutor } from '../workspace-tools';

async function workspace() {
  return mkdtemp(path.join(tmpdir(), 'cortex-tools-'));
}

function call(name: string, args: Record<string, unknown>) {
  return { id: 'c1', name, arguments: args };
}

describe('WorkspaceToolExecutor', () => {
  it('reads, writes, and edits files', async () => {
    const root = await workspace();
    const before = vi.fn();
    const executor = new WorkspaceToolExecutor({ workspaceRoot: root, onBeforeWrite: before });
    await expect(executor.execute(call('Create', { path: 'a.ts', contents: 'hello\n' }))).resolves.toMatchObject({
      ok: true,
    });
    expect(before).toHaveBeenCalled();
    const read = await executor.execute(call('Read', { path: 'a.ts', offset: 1, limit: 1 }));
    expect(read.output).toContain('1|hello');
    await executor.execute(call('Create', { path: 'a.ts', contents: 'hello\nworld\n' }));
    const edited = await executor.execute(
      call('Edit', { path: 'a.ts', old_string: 'world', new_string: 'there' }),
    );
    expect(edited.ok).toBe(true);
    expect(await readFile(path.join(root, 'a.ts'), 'utf8')).toContain('there');
    const mismatch = await executor.execute(
      call('Edit', { path: 'a.ts', old_string: 'missing', new_string: 'x' }),
    );
    expect(mismatch.ok).toBe(false);
  });

  it('greps, globs, and lists the workspace', async () => {
    const root = await workspace();
    await mkdir(path.join(root, 'src'), { recursive: true });
    await writeFile(path.join(root, 'src/a.ts'), 'export const x = 1;\n', 'utf8');
    await writeFile(path.join(root, 'README.md'), 'hello\n', 'utf8');
    const executor = new WorkspaceToolExecutor({ workspaceRoot: root });
    const grep = await executor.execute(call('Grep', { pattern: 'export', glob: '*.ts' }));
    expect(grep.output).toContain('src/a.ts');
    const none = await executor.execute(call('Grep', { pattern: 'zzzz' }));
    expect(none.output).toBe('No matches');
    const glob = await executor.execute(call('Glob', { pattern: '**/*.ts' }));
    expect(glob.output).toContain('src/a.ts');
    const emptyGlob = await executor.execute(call('Glob', { pattern: '**/*.rs' }));
    expect(emptyGlob.output).toBe('No files');
    const ls = await executor.execute(call('LS', { path: '.' }));
    expect(ls.output).toContain('src/');
  });

  it('runs git helpers and injects Execute', async () => {
    const root = await workspace();
    const runBash = vi.fn(async () => ({ stdout: 'ok', stderr: '' }));
    const executor = new WorkspaceToolExecutor({
      workspaceRoot: root,
      runBash,
      autonomy: 'high',
      env: { TOKEN: 'secret' },
    });
    expect((await executor.execute(call('Git', { subcommand: 'push' }))).ok).toBe(false);
    expect((await executor.execute(call('Git', { subcommand: 'status' }))).output).toBe('ok');
    expect(runBash).toHaveBeenCalledWith('git status', root);
    const blocked = await executor.execute(call('Execute', { command: 'echo hi > file' }));
    expect(blocked.ok).toBe(false);
    const denied = new WorkspaceToolExecutor({ workspaceRoot: root, autonomy: 'off', runBash });
    expect((await denied.execute(call('Execute', { command: 'curl https://x' }))).ok).toBe(false);
    const real = new WorkspaceToolExecutor({ workspaceRoot: root, autonomy: 'high' });
    const echo = await real.execute(call('Execute', { command: 'echo ok' }));
    expect(echo.ok).toBe(true);
    expect(echo.output).toContain('ok');
  });

  it('writes todos, fetches URLs, and searches the web', async () => {
    const root = await workspace();
    const onTodos = vi.fn((todos) => todos);
    // Cast at the seam: `typeof fetch` carries `preconnect`, which a stub has no
    // reason to implement and which nothing under test calls.
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('duckduckgo')) {
        return new Response('uddg=https%3A%2F%2Fex.com&">Example</a>', { status: 200 });
      }
      return new Response('body', { status: 200 });
    });
    const executor = new WorkspaceToolExecutor({
      workspaceRoot: root,
      onTodos,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const todos = await executor.execute(
      call('TodoWrite', { todos: JSON.stringify([{ id: '1', content: 'a', status: 'pending' }]), merge: true }),
    );
    expect(todos.ok).toBe(true);
    expect(onTodos).toHaveBeenCalled();
    expect((await executor.execute(call('TodoWrite', { todos: '{bad' }))).ok).toBe(false);
    expect((await executor.execute(call('FetchUrl', { url: 'not a url' }))).ok).toBe(false);
    expect((await executor.execute(call('FetchUrl', { url: 'file:///etc/passwd' }))).ok).toBe(false);
    expect((await executor.execute(call('FetchUrl', { url: 'https://ex.com' }))).output).toBe('body');
    expect((await executor.execute(call('WebSearch', { query: '' }))).ok).toBe(false);
    const search = await executor.execute(call('WebSearch', { query: 'cortex' }));
    expect(search.output).toContain('Example');
    const plain = new WorkspaceToolExecutor({
      workspaceRoot: root,
      fetchImpl: (async () =>
        new Response('<p>no links</p>', { status: 200 })) as unknown as typeof fetch,
    });
    expect((await plain.execute(call('WebSearch', { query: 'none' }))).output).toContain('no links');
  });

  it('delegates Task, loads Skill, and applies patches', async () => {
    const root = await workspace();
    const runDroid = vi.fn(async () => 'done');
    const executor = new WorkspaceToolExecutor({
      workspaceRoot: root,
      runDroid,
      skills: [{ name: 'fix', description: 'Fix it', body: 'steps' }],
      droids: [{ name: 'scout', description: 'look', systemPrompt: 'go' }],
    });
    expect((await executor.execute(call('Task', { subagent: 'unknown', prompt: 'x' }))).ok).toBe(false);
    const nested = new WorkspaceToolExecutor({ workspaceRoot: root, delegationDepth: 1 });
    expect((await nested.execute(call('Task', { subagent: 'explorer', prompt: 'x' }))).ok).toBe(false);
    const delegated = await executor.execute(call('Task', { subagent: 'explorer', prompt: 'look' }));
    expect(delegated.ok).toBe(true);
    expect(runDroid).toHaveBeenCalled();
    const noRunner = new WorkspaceToolExecutor({ workspaceRoot: root });
    expect((await noRunner.execute(call('Task', { subagent: 'explorer', prompt: 'x' }))).output).toMatch(
      /no runner configured/,
    );
    const skill = await executor.execute(call('Skill', { name: '/fix' }));
    expect(skill.output).toContain('# /fix');
    expect((await executor.execute(call('Skill', { name: 'missing' }))).ok).toBe(false);
    expect((await executor.execute(call('ApplyPatch', { patch: 'no hunks' }))).ok).toBe(false);
    const patched = await executor.execute(
      call('ApplyPatch', {
        patch: '*** Add File: new.ts\n+export const n = 1;\n',
      }),
    );
    expect(patched.ok).toBe(true);
    expect(await readFile(path.join(root, 'new.ts'), 'utf8')).toContain('export const n = 1');
    await writeFile(path.join(root, 'edit.ts'), 'old\n', 'utf8');
    const updated = await executor.execute(
      call('ApplyPatch', { patch: '*** Update File: edit.ts\n-old\n+new\n' }),
    );
    expect(updated.ok).toBe(true);
    const miss = await executor.execute(
      call('ApplyPatch', { patch: '*** Update File: edit.ts\n-missing\n+x\n' }),
    );
    expect(miss.ok).toBe(false);
  });

  it('rejects path escape and unknown tools', async () => {
    const root = await workspace();
    const executor = new WorkspaceToolExecutor({ workspaceRoot: root });
    const escape = await executor.execute(call('Read', { path: '../outside.txt' }));
    expect(escape.ok).toBe(false);
    expect(escape.output).toMatch(/escapes the workspace/);
    expect((await executor.execute(call('Nope', {}))).output).toMatch(/Unknown tool/);
    expect((await executor.execute(call('AskUser', { prompt: 'Wake?' }))).output).toBe('Wake?');
    expect(
      (await executor.execute(call('ExitSpecMode', { title: 'Plan', rationale: 'go', steps: ['a'] }))).ok,
    ).toBe(true);
  });
});

describe('hasUnresolvedOptions', () => {
  it('blocks ExitSpecMode when Option A/B are still open', () => {
    expect(hasUnresolvedOptions({ unresolved_choices: true })).toBe(true);
    expect(hasUnresolvedOptions({ title: 'Option A or Option B' })).toBe(true);
    expect(hasUnresolvedOptions({ title: 'Option A or Option B chosen' })).toBe(false);
    expect(hasUnresolvedOptions({ title: 'Ship it' })).toBe(false);
  });
});
