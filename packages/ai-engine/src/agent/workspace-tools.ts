import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { DroidDefinition, TodoItem, ToolCall, ToolExecutor, ToolResult } from './types';

const execFileAsync = promisify(execFile);

export interface WorkspaceToolHostOptions {
  workspaceRoot: string;
  droids?: DroidDefinition[];
  runDroid?: (droid: DroidDefinition, prompt: string) => Promise<string>;
  runBash?: (command: string, cwd: string) => Promise<{ stdout: string; stderr: string }>;
  onBeforeWrite?: (relativePath: string, previous: string) => void;
  onTodos?: (todos: TodoItem[], merge: boolean) => TodoItem[];
  fetchImpl?: typeof fetch;
}

export class WorkspaceToolExecutor implements ToolExecutor {
  constructor(private readonly options: WorkspaceToolHostOptions) {}

  async execute(call: ToolCall): Promise<ToolResult> {
    try {
      switch (call.name) {
        case 'read':
          return await this.read(call.arguments);
        case 'write':
          return await this.write(call.arguments);
        case 'edit':
          return await this.edit(call.arguments);
        case 'apply_patch':
          return await this.applyPatch(call.arguments);
        case 'todowrite':
          return this.todoWrite(call.arguments);
        case 'question':
          return { ok: true, output: String(call.arguments.prompt ?? '') };
        case 'webfetch':
          return await this.webfetch(call.arguments);
        case 'grep':
          return await this.grep(call.arguments);
        case 'glob':
          return await this.glob(call.arguments);
        case 'bash':
          return await this.bash(call.arguments);
        case 'git':
          return await this.git(call.arguments);
        case 'task':
          return await this.task(call.arguments);
        default:
          return { ok: false, output: `Unknown tool: ${call.name}` };
      }
    } catch (error) {
      return {
        ok: false,
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private resolve(rel: string): string {
    const root = path.resolve(this.options.workspaceRoot);
    const target = path.resolve(root, rel);
    if (!target.startsWith(root)) {
      throw new Error('Path escapes the workspace');
    }
    return target;
  }

  private async read(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = this.resolve(String(args.path ?? ''));
    const text = await fs.readFile(filePath, 'utf8');
    const lines = text.split('\n');
    const offset = typeof args.offset === 'number' ? Math.max(1, args.offset) : 1;
    const limit = typeof args.limit === 'number' ? args.limit : lines.length;
    const slice = lines.slice(offset - 1, offset - 1 + limit);
    const numbered = slice.map((line, index) => `${offset + index}|${line}`).join('\n');
    return { ok: true, output: numbered };
  }

  private async write(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = this.resolve(String(args.path ?? ''));
    const contents = String(args.contents ?? '');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    let previous = '';
    try {
      previous = await fs.readFile(filePath, 'utf8');
    } catch {
      previous = '';
    }
    this.options.onBeforeWrite?.(String(args.path ?? ''), previous);
    await fs.writeFile(filePath, contents, 'utf8');
    return {
      ok: true,
      output: `Wrote ${args.path}`,
      additions: contents.split('\n').length,
      deletions: previous ? previous.split('\n').length : 0,
    };
  }

  private async edit(args: Record<string, unknown>): Promise<ToolResult> {
    const filePath = this.resolve(String(args.path ?? ''));
    const oldString = String(args.old_string ?? '');
    const newString = String(args.new_string ?? '');
    const current = await fs.readFile(filePath, 'utf8');
    this.options.onBeforeWrite?.(String(args.path ?? ''), current);
    const count = current.split(oldString).length - 1;
    if (count !== 1) {
      return {
        ok: false,
        output: `edit expected exactly one match of old_string, found ${count}`,
      };
    }
    await fs.writeFile(filePath, current.replace(oldString, newString), 'utf8');
    return {
      ok: true,
      output: `Edited ${args.path}`,
      additions: newString.split('\n').length,
      deletions: oldString.split('\n').length,
    };
  }

  private async grep(args: Record<string, unknown>): Promise<ToolResult> {
    const pattern = String(args.pattern ?? '');
    const start = this.resolve(typeof args.path === 'string' ? args.path : '.');
    const regex = new RegExp(pattern);
    const hits: string[] = [];
    await walk(start, async (file) => {
      if (typeof args.glob === 'string' && !file.endsWith(args.glob.replace(/^\*/, ''))) {
        return;
      }
      const text = await fs.readFile(file, 'utf8').catch(() => '');
      text.split('\n').forEach((line, index) => {
        if (regex.test(line)) {
          hits.push(`${rel(this.options.workspaceRoot, file)}:${index + 1}:${line}`);
        }
      });
    });
    return { ok: true, output: hits.slice(0, 200).join('\n') || 'No matches' };
  }

  private async glob(args: Record<string, unknown>): Promise<ToolResult> {
    const pattern = String(args.pattern ?? '**/*');
    const files: string[] = [];
    await walk(this.options.workspaceRoot, async (file) => {
      const relative = rel(this.options.workspaceRoot, file);
      if (matchGlob(relative, pattern)) files.push(relative);
    });
    return { ok: true, output: files.slice(0, 500).join('\n') || 'No files' };
  }

  private async bash(args: Record<string, unknown>): Promise<ToolResult> {
    const command = String(args.command ?? '');
    const cwd = typeof args.cwd === 'string' ? this.resolve(args.cwd) : this.options.workspaceRoot;
    if (this.options.runBash) {
      const result = await this.options.runBash(command, cwd);
      return { ok: true, output: [result.stdout, result.stderr].filter(Boolean).join('\n') };
    }
    const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
      cwd,
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, output: [stdout, stderr].filter(Boolean).join('\n') };
  }

  private async git(args: Record<string, unknown>): Promise<ToolResult> {
    const sub = String(args.subcommand ?? 'status');
    const extra = typeof args.args === 'string' ? args.args : '';
    const allowed = new Set(['status', 'diff', 'log', 'branch']);
    if (!allowed.has(sub)) {
      return { ok: false, output: `git ${sub} is not a read-only helper; use bash after permission` };
    }
    return this.bash({ command: `git ${sub} ${extra}`.trim() });
  }

  private async task(args: Record<string, unknown>): Promise<ToolResult> {
    const name = String(args.droid ?? '');
    const prompt = String(args.prompt ?? '');
    const droid = this.options.droids?.find((item) => item.name === name);
    if (!droid) {
      return { ok: false, output: `Unknown droid "${name}"` };
    }
    if (!this.options.runDroid) {
      return {
        ok: true,
        output: `Delegated to ${droid.name} (no runner configured): ${prompt}`,
      };
    }
    const output = await this.options.runDroid(droid, prompt);
    return { ok: true, output };
  }

  private todoWrite(args: Record<string, unknown>): ToolResult {
    const merge = args.merge === true;
    let parsed: TodoItem[] = [];
    try {
      const raw = typeof args.todos === 'string' ? args.todos : JSON.stringify(args.todos ?? []);
      parsed = JSON.parse(raw) as TodoItem[];
    } catch {
      return { ok: false, output: 'todowrite expects JSON todos' };
    }
    const next = this.options.onTodos?.(parsed, merge) ?? parsed;
    return { ok: true, output: JSON.stringify(next) };
  }

  private async webfetch(args: Record<string, unknown>): Promise<ToolResult> {
    const url = String(args.url ?? '');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, output: 'Invalid URL' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, output: 'Only http(s) URLs are allowed' };
    }
    const fetchFn = this.options.fetchImpl ?? fetch;
    const response = await fetchFn(parsed, { redirect: 'follow' });
    const text = await response.text();
    return { ok: response.ok, output: text.slice(0, 80_000) };
  }

  private async applyPatch(args: Record<string, unknown>): Promise<ToolResult> {
    const patch = String(args.patch ?? '');
    const files = parsePatchFiles(patch);
    if (files.length === 0) {
      return { ok: false, output: 'apply_patch: no file hunks found' };
    }
    const results: string[] = [];
    let additions = 0;
    let deletions = 0;
    for (const file of files) {
      const filePath = this.resolve(file.path);
      let current = '';
      try {
        current = await fs.readFile(filePath, 'utf8');
      } catch {
        current = '';
      }
      this.options.onBeforeWrite?.(file.path, current);
      const next = applyHunks(current, file.hunks);
      if (next == null) {
        return { ok: false, output: `apply_patch failed to match hunks in ${file.path}` };
      }
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, next, 'utf8');
      additions += Math.max(0, next.split('\n').length - current.split('\n').length);
      deletions += Math.max(0, current.split('\n').length - next.split('\n').length);
      results.push(`patched ${file.path}`);
    }
    return { ok: true, output: results.join('\n'), additions, deletions };
  }
}

interface PatchFile {
  path: string;
  hunks: Array<{ minus: string[]; plus: string[] }>;
}

function parsePatchFiles(patch: string): PatchFile[] {
  const files: PatchFile[] = [];
  const begin = /\*\*\* (?:Update|Add) File: (.+)$/gm;
  let match: RegExpExecArray | null;
  const markers: Array<{ path: string; index: number }> = [];
  while ((match = begin.exec(patch)) !== null) {
    markers.push({ path: match[1].trim(), index: match.index + match[0].length });
  }
  if (markers.length > 0) {
    for (let i = 0; i < markers.length; i += 1) {
      const end = i + 1 < markers.length ? markers[i + 1].index : patch.length;
      files.push({ path: markers[i].path, hunks: hunksFrom(patch.slice(markers[i].index, end)) });
    }
    return files;
  }
  const unified = /^--- (?:a\/)?(.+)$/m.exec(patch);
  const plus = /^\+\+\+ (?:b\/)?(.+)$/m.exec(patch);
  if (unified || plus) {
    files.push({ path: (plus?.[1] ?? unified?.[1] ?? '').trim(), hunks: hunksFrom(patch) });
  }
  return files.filter((file) => file.path && file.path !== '/dev/null');
}

function hunksFrom(text: string): Array<{ minus: string[]; plus: string[] }> {
  const minus: string[] = [];
  const plus: string[] = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) plus.push(line.slice(1));
    else if (line.startsWith('-') && !line.startsWith('---')) minus.push(line.slice(1));
  }
  return minus.length || plus.length ? [{ minus, plus }] : [];
}

function applyHunks(current: string, hunks: Array<{ minus: string[]; plus: string[] }>): string | null {
  let next = current;
  for (const hunk of hunks) {
    if (hunk.minus.length === 0) {
      next = next.endsWith('\n') || next.length === 0 ? `${next}${hunk.plus.join('\n')}\n` : `${next}\n${hunk.plus.join('\n')}\n`;
      continue;
    }
    const needle = hunk.minus.join('\n');
    if (!next.includes(needle)) return null;
    next = next.replace(needle, hunk.plus.join('\n'));
  }
  return next;
}

async function walk(dir: string, visit: (file: string) => Promise<void>): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, visit);
    } else if (entry.isFile()) {
      await visit(full);
    }
  }
}

function rel(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

function matchGlob(file: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::GLOBSTAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::GLOBSTAR::/g, '.*');
  return new RegExp(`^${escaped}$`).test(file);
}
