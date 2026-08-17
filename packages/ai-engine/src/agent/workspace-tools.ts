import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ToolCall, ToolExecutor, ToolResult } from './types';
import type { DroidDefinition } from './types';

const execFileAsync = promisify(execFile);

export interface WorkspaceToolHostOptions {
  workspaceRoot: string;
  droids?: DroidDefinition[];
  runDroid?: (droid: DroidDefinition, prompt: string) => Promise<string>;
  runBash?: (command: string, cwd: string) => Promise<{ stdout: string; stderr: string }>;
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
