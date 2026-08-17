import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { autonomyAllowsExecute, isForbiddenShellWrite } from './autonomy';
import { builtinSubagent, toDroid } from './builtin-subagents';
import { canonicalToolName } from './tool-names';
import type {
  AutonomyLevel,
  DroidDefinition,
  SkillDefinition,
  TodoItem,
  ToolCall,
  ToolExecutor,
  ToolResult,
} from './types';

const execFileAsync = promisify(execFile);

export interface WorkspaceToolHostOptions {
  workspaceRoot: string;
  droids?: DroidDefinition[];
  runDroid?: (droid: DroidDefinition, prompt: string) => Promise<string>;
  runBash?: (command: string, cwd: string) => Promise<{ stdout: string; stderr: string }>;
  onBeforeWrite?: (relativePath: string, previous: string) => void;
  onTodos?: (todos: TodoItem[], merge: boolean) => TodoItem[];
  fetchImpl?: typeof fetch;
  skills?: SkillDefinition[];
  autonomy?: AutonomyLevel;
  delegationDepth?: number;
}

export class WorkspaceToolExecutor implements ToolExecutor {
  constructor(private readonly options: WorkspaceToolHostOptions) {}

  async execute(call: ToolCall): Promise<ToolResult> {
    try {
      const name = canonicalToolName(call.name);
      switch (name) {
        case 'Read':
          return await this.read(call.arguments);
        case 'Create':
          return await this.write(call.arguments);
        case 'Edit':
          return await this.edit(call.arguments);
        case 'ApplyPatch':
          return await this.applyPatch(call.arguments);
        case 'TodoWrite':
          return this.todoWrite(call.arguments);
        case 'AskUser':
          return { ok: true, output: String(call.arguments.prompt ?? '') };
        case 'FetchUrl':
          return await this.webfetch(call.arguments);
        case 'WebSearch':
          return await this.webSearch(call.arguments);
        case 'Grep':
          return await this.grep(call.arguments);
        case 'Glob':
          return await this.glob(call.arguments);
        case 'LS':
          return await this.ls(call.arguments);
        case 'Execute':
          return await this.bash(call.arguments);
        case 'Git':
          return await this.git(call.arguments);
        case 'Task':
          return await this.task(call.arguments);
        case 'Skill':
          return this.skill(call.arguments);
        case 'ExitSpecMode':
          return this.exitSpecMode(call.arguments);
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
    const raw = String(rel ?? '');
    const target = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
    if (target !== root && !target.startsWith(root + path.sep)) {
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

  private async ls(args: Record<string, unknown>): Promise<ToolResult> {
    const dir = this.resolve(String(args.path ?? this.options.workspaceRoot));
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const lines = entries
      .filter((entry) => entry.name !== 'node_modules' && entry.name !== '.git')
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));
    return { ok: true, output: lines.join('\n') || '(empty)' };
  }

  private async bash(args: Record<string, unknown>): Promise<ToolResult> {
    const command = String(args.command ?? '');
    if (isForbiddenShellWrite(command)) {
      return {
        ok: false,
        output: 'Execute cannot write files. Use Create, Edit, or ApplyPatch.',
      };
    }
    const autonomy = this.options.autonomy ?? 'medium';
    if (!autonomyAllowsExecute(autonomy, command)) {
      return {
        ok: false,
        output: `Execute blocked by autonomy=${autonomy} or the never-run blocklist.`,
      };
    }
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
      return { ok: false, output: `git ${sub} is not a read-only helper; use Execute after permission` };
    }
    return this.bash({ command: `git ${sub} ${extra}`.trim() });
  }

  private skill(args: Record<string, unknown>): ToolResult {
    const name = String(args.name ?? '').replace(/^\//, '');
    const skill = this.options.skills?.find((item) => item.name === name);
    if (!skill) {
      return { ok: false, output: `Unknown skill "${name}"` };
    }
    return { ok: true, output: `# /${skill.name}\n${skill.description}\n\n${skill.body}` };
  }

  private exitSpecMode(args: Record<string, unknown>): ToolResult {
    if (hasUnresolvedOptions(args)) {
      return {
        ok: false,
        output: 'Do not ExitSpecMode with unresolved Option A/B. Use AskUser first.',
      };
    }
    return {
      ok: true,
      output: JSON.stringify({
        title: String(args.title ?? 'Plan'),
        rationale: String(args.rationale ?? ''),
        steps: args.steps,
      }),
    };
  }

  private async task(args: Record<string, unknown>): Promise<ToolResult> {
    if ((this.options.delegationDepth ?? 0) > 0) {
      return { ok: false, output: 'No nested Task. Complete the handoff on this thread.' };
    }
    const prompt = String(args.prompt ?? '');
    const subagentName = String(args.subagent ?? args.droid ?? '');
    const builtin = builtinSubagent(subagentName);
    const droid =
      builtin != null
        ? toDroid(builtin)
        : this.options.droids?.find((item) => item.name === subagentName);
    if (!droid) {
      return { ok: false, output: `Unknown droid or subagent "${subagentName}"` };
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
      return { ok: false, output: 'TodoWrite expects JSON todos' };
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

  private async webSearch(args: Record<string, unknown>): Promise<ToolResult> {
    const query = String(args.query ?? '').trim();
    if (!query) return { ok: false, output: 'WebSearch requires query' };
    const fetchFn = this.options.fetchImpl ?? fetch;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetchFn(url, { redirect: 'follow' });
    const html = await response.text();
    const hits: string[] = [];
    const link = /uddg=([^&"]+)[^>]*>([^<]+)/g;
    let match: RegExpExecArray | null;
    while ((match = link.exec(html)) !== null && hits.length < 8) {
      hits.push(`- ${decodeURIComponent(match[2] ?? '')}: ${decodeURIComponent(match[1] ?? '')}`);
    }
    return {
      ok: response.ok,
      output: hits.join('\n') || html.replace(/<[^>]+>/g, ' ').slice(0, 4_000),
    };
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

export function hasUnresolvedOptions(args: Record<string, unknown>): boolean {
  if (args.unresolved_choices === true) return true;
  const text = `${args.title ?? ''} ${args.rationale ?? ''} ${stringify(args.steps)}`;
  const hasPair = /\bOption A\b/i.test(text) && /\bOption B\b/i.test(text);
  const resolved = /\b(chose|choose|chosen|selected|picking|picked)\b/i.test(text);
  return hasPair && !resolved;
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value ?? '');
  } catch {
    return '';
  }
}

function matchGlob(file: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::GLOBSTAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::GLOBSTAR::/g, '.*');
  return new RegExp(`^${escaped}$`).test(file);
}
