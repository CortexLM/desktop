import { exec } from "node:child_process"
import { glob as fsGlob, mkdir, open, readdir, readlink, realpath, stat, writeFile } from "node:fs/promises"
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path"
import { z } from "zod"
import type { BrowserBridge } from "./browser"
import { CortexError, fail } from "./error"

export interface ToolResult {
  title?: string
  output: string
  metadata?: Record<string, unknown>
}

export interface ToolContext {
  sessionID: string
  messageID: string
  callID: string
  /** Session working directory; file tools are only offered when set. */
  directory?: string
  signal: AbortSignal
  /** Ask the permission service for `tool` on `pattern`; resolves when allowed. */
  ask(pattern: string, input: unknown, tool?: string): Promise<void>
  /** Host services used by `task` and `skill`. */
  services: ToolServices
}

export interface ToolServices {
  runSubagent(input: { parentID: string; agent: string; prompt: string; description: string; signal: AbortSignal }): Promise<{ sessionID: string; text: string }>
  loadSkill(name: string, directory?: string): Promise<string | undefined>
  todos: { get(sessionID: string): unknown[]; set(sessionID: string, todos: unknown[]): void }
  fetch: typeof fetch
  /** Local browser bridge; only tabs the user shared are readable. */
  browser?: BrowserBridge
}

export interface ToolDef<P extends z.ZodType = z.ZodType> {
  name: string
  description: string
  parameters: P
  /** File-system tools need a session directory. */
  needsDirectory?: boolean
  execute(input: z.infer<P>, ctx: ToolContext): Promise<ToolResult>
}

export const defineTool = <P extends z.ZodType>(t: ToolDef<P>): ToolDef => t as unknown as ToolDef

const MAX_OUTPUT = 50_000
export const truncate = (s: string, max = MAX_OUTPUT) => (s.length > max ? s.slice(0, max) + `\n… [truncated ${s.length - max} characters]` : s)

/** Resolve against the session directory; paths escaping it need an `external_directory` approval. */
async function target(ctx: ToolContext, p: string): Promise<string> {
  const dir = ctx.directory!
  let abs = isAbsolute(p) ? resolve(p) : resolve(dir, p)
  let parent = abs
  const missing: string[] = []
  for (;;) {
    try { abs = join(await realpath(parent), ...missing); break }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || dirname(parent) === parent) throw error
      // A dangling link is not a missing component: follow it so its outside target is checked.
      const link = await readlink(parent).catch(() => undefined)
      if (link !== undefined) { parent = resolve(dirname(parent), link); continue }
      missing.unshift(basename(parent)); parent = dirname(parent)
    }
  }
  const rel = relative(await realpath(dir), abs)
  if (rel.startsWith("..") || isAbsolute(rel)) await ctx.ask(abs, { path: abs }, "external_directory")
  return abs
}

/**
 * Read the approved canonical path through one descriptor, refusing it when a link swapped in after
 * approval redirects the open. ponytail: a double swap between open and the identity check still
 * races; Node has no openat2(RESOLVE_NO_SYMLINKS). Upgrade to a native resolver if that matters.
 */
async function readApproved(abs: string, max = Infinity): Promise<string | undefined> {
  const fh = await open(abs, "r")
  try {
    const [held, named] = await Promise.all([fh.stat({ bigint: true }), stat(abs, { bigint: true })])
    if (await realpath(abs) !== abs || held.dev !== named.dev || held.ino !== named.ino) throw new CortexError("tool_failed", "The file changed while it was being opened")
    if (!held.isFile() || held.size > max) return undefined
    return await fh.readFile("utf8")
  } finally { await fh.close() }
}

/** Per-candidate checks in glob/grep: a refusal must not reveal the candidate's name. */
async function quiet<T>(check: () => Promise<T>): Promise<T> {
  try { return await check() } catch (error) {
    throw new CortexError(error instanceof CortexError ? error.code : "tool_failed", "A matching file is not readable under the current permissions")
  }
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", ".next", "build"])
const skip = (p: string) => SKIP_DIRS.has(basename(p))

const read = defineTool({
  name: "read",
  description: "Read a text file. Returns numbered lines. Use offset/limit (1-based lines) for large files.",
  needsDirectory: true,
  parameters: z.object({ path: z.string(), offset: z.number().int().min(1).optional(), limit: z.number().int().min(1).optional() }),
  async execute({ path, offset = 1, limit = 2000 }, ctx) {
    const file = await target(ctx, path)
    await ctx.ask(file, { path: file })
    const content = await readApproved(file)
    if (content === undefined) throw new CortexError("tool_failed", "Not a regular file")
    const lines = content.split("\n")
    const slice = lines.slice(offset - 1, offset - 1 + limit)
    return { title: relative(ctx.directory!, file) || file, output: truncate(slice.map((l, i) => `${offset + i}: ${l}`).join("\n")), metadata: { lines: lines.length } }
  },
})

const write = defineTool({
  name: "write",
  description: "Create or overwrite a file with the given content.",
  needsDirectory: true,
  parameters: z.object({ path: z.string(), content: z.string() }),
  async execute({ path, content }, ctx) {
    const file = await target(ctx, path)
    await ctx.ask(file, { path: file, bytes: content.length })
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, content)
    return { title: relative(ctx.directory!, file), output: `Wrote ${content.length} characters to ${file}` }
  },
})

const edit = defineTool({
  name: "edit",
  description: "Replace an exact string in a file. oldString must occur exactly once unless replaceAll is true.",
  needsDirectory: true,
  parameters: z.object({ path: z.string(), oldString: z.string().min(1), newString: z.string(), replaceAll: z.boolean().optional() }),
  async execute({ path, oldString, newString, replaceAll }, ctx) {
    const file = await target(ctx, path)
    const text = await readApproved(file)
    if (text === undefined) throw new CortexError("tool_failed", "Not a regular file")
    const count = text.split(oldString).length - 1
    if (count === 0) throw new CortexError("tool_failed", "oldString not found in file")
    if (count > 1 && !replaceAll) throw new CortexError("tool_failed", `oldString occurs ${count} times; add context or set replaceAll`)
    await ctx.ask(file, { path: file, oldString, newString })
    await writeFile(file, replaceAll ? text.split(oldString).join(newString) : text.replace(oldString, () => newString))
    return { title: relative(ctx.directory!, file), output: `Replaced ${replaceAll ? count : 1} occurrence(s)` }
  },
})

const list = defineTool({
  name: "list",
  description: "List the entries of a directory (directories end with /).",
  needsDirectory: true,
  parameters: z.object({ path: z.string().default(".") }),
  async execute({ path }, ctx) {
    const dir = await target(ctx, path)
    await ctx.ask(dir, { path: dir }, "read")
    const entries = await readdir(dir, { withFileTypes: true })
    const out = entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name)).sort()
    return { title: relative(ctx.directory!, dir) || ".", output: truncate(out.join("\n")), metadata: { count: out.length } }
  },
})

const glob = defineTool({
  name: "glob",
  description: "Find files by glob pattern (e.g. **/*.ts) relative to the session directory.",
  needsDirectory: true,
  parameters: z.object({ pattern: z.string(), path: z.string().optional() }),
  async execute({ pattern, path }, ctx) {
    const cwd = await target(ctx, path ?? ".")
    await ctx.ask(cwd, { path: cwd }, "read")
    const out: string[] = []
    for await (const f of fsGlob(pattern, { cwd, exclude: skip })) {
      await quiet(async () => { const abs = await target(ctx, join(cwd, f)); await ctx.ask(abs, { path: abs }, "read") })
      out.push(f)
      if (out.length >= 1000) break
    }
    return { title: pattern, output: out.sort().join("\n") || "No files found", metadata: { count: out.length } }
  },
})

const grep = defineTool({
  name: "grep",
  description: "Search file contents with a regular expression. Optional include glob filters files.",
  needsDirectory: true,
  parameters: z.object({ pattern: z.string(), path: z.string().optional(), include: z.string().optional() }),
  async execute({ pattern, path, include }, ctx) {
    const cwd = await target(ctx, path ?? ".")
    await ctx.ask(cwd, { path: cwd }, "read")
    let re: RegExp
    try {
      re = new RegExp(pattern)
    } catch {
      throw new CortexError("tool_failed", "Invalid regular expression")
    }
    const hits: string[] = []
    // ponytail: pure-JS scan, fine for project-sized trees; swap for ripgrep if large monorepos get slow.
    for await (const f of fsGlob(include ?? "**/*", { cwd, exclude: skip })) {
      const abs = await quiet(() => target(ctx, join(cwd, f)))
      const st = await stat(abs).catch(() => undefined)
      if (!st?.isFile() || st.size > 1_000_000) continue
      await quiet(() => ctx.ask(abs, { path: abs }, "read"))
      const text = await readApproved(abs, 1_000_000).catch(() => undefined)
      if (text === undefined || text.includes("\u0000")) continue
      text.split("\n").forEach((line, i) => {
        if (hits.length < 500 && re.test(line)) hits.push(`${f}:${i + 1}: ${line.slice(0, 300)}`)
      })
      if (hits.length >= 500) break
    }
    return { title: pattern, output: hits.join("\n") || "No matches", metadata: { count: hits.length } }
  },
})

const bash = defineTool({
  name: "bash",
  description: "Run a shell command in the session directory. Runs with the user's own permissions.",
  needsDirectory: true,
  parameters: z.object({ command: z.string(), timeout: z.number().int().min(1).max(600_000).optional(), description: z.string().optional() }),
  async execute({ command, timeout = 120_000, description }, ctx) {
    await ctx.ask(command, { command })
    const { code, out } = await new Promise<{ code: number | null; out: string }>((done) => {
      const child = exec(command, { cwd: ctx.directory, timeout, signal: ctx.signal, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) =>
        done({ code: err ? ((err as { code?: number }).code ?? 1) : 0, out: `${stdout}${stderr}` }),
      )
      child.stdin?.end()
    })
    // UTF-16 units, matching slice: retained command output and omitted count; output stays model-facing English.
    return { title: description ?? command, output: truncate(out) + (code ? `\n[exit code ${code}]` : ""), metadata: { exit: code, outputLength: Math.min(out.length, MAX_OUTPUT), truncated: Math.max(0, out.length - MAX_OUTPUT) } }
  },
})

const webfetch = defineTool({
  name: "webfetch",
  description: "Fetch a URL over HTTP(S) and return its text content.",
  parameters: z.object({ url: z.string().url() }),
  async execute({ url }, ctx) {
    if (!/^https?:/i.test(url)) throw new CortexError("tool_failed", "Only http and https URLs are supported")
    await ctx.ask(url, { url })
    const res = await ctx.services.fetch(url, { signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(30_000)]) })
    const text = await res.text()
    const type = res.headers.get("content-type") ?? ""
    // ponytail: best-effort model text, not HTML sanitization; use an HTML parser if extraction fidelity is needed.
    const body = type.includes("html") ? text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : text
    return { title: url, output: truncate(body), metadata: { status: res.status } }
  },
})

const needBrowser = (ctx: ToolContext) => ctx.services.browser ?? fail("tool_failed", "No local browser is available")

const browserTabs = defineTool({
  name: "browser_tabs",
  description: "List the browser tabs the user explicitly shared with Cortex (id, title, URL). Other tabs are not visible.",
  parameters: z.object({}),
  async execute(_input, ctx) {
    const b = needBrowser(ctx)
    const tabs = b.status().tabs
    return { title: "Shared tabs", output: tabs.length ? tabs.map((t) => `${t.id}\t${t.title}\t${t.url}`).join("\n") : "No tab is shared. Ask the user to share a tab from the Cortex Chrome extension.", metadata: { count: tabs.length } }
  },
})

const browserRead = defineTool({
  name: "browser_read",
  description: "Read the title, URL and visible text of one tab the user shared (see browser_tabs). Refused for any other tab.",
  parameters: z.object({ tabId: z.number().int() }),
  async execute({ tabId }, ctx) {
    const b = needBrowser(ctx)
    await ctx.ask(String(tabId), { tabId })
    const page = await b.read(tabId, ctx.signal)
    return { title: page.title, output: truncate(`${page.title}\n${page.url}\n\n${page.text}`), metadata: { url: page.url } }
  },
})

const Todo = z.object({ content: z.string(), status: z.enum(["pending", "in_progress", "completed", "cancelled"]), priority: z.enum(["high", "medium", "low"]).optional() })
const todowrite = defineTool({
  name: "todowrite",
  description: "Replace the session todo list to track multi-step work.",
  parameters: z.object({ todos: z.array(Todo) }),
  async execute({ todos }, ctx) {
    ctx.services.todos.set(ctx.sessionID, todos)
    return { title: `${todos.filter((t) => t.status !== "completed").length} todos`, output: JSON.stringify(todos, null, 2), metadata: { todos } }
  },
})

const task = defineTool({
  name: "task",
  description: "Delegate a self-contained task to a subagent (general or explore). Returns its final report.",
  parameters: z.object({ description: z.string(), prompt: z.string(), agent: z.string().default("general") }),
  async execute({ description, prompt, agent }, ctx) {
    await ctx.ask(agent, { agent, description })
    const r = await ctx.services.runSubagent({ parentID: ctx.sessionID, agent, prompt, description, signal: ctx.signal })
    return { title: description, output: r.text || "(no output)", metadata: { sessionID: r.sessionID } }
  },
})

const skill = defineTool({
  name: "skill",
  description: "Load the instructions of an available skill by name.",
  parameters: z.object({ name: z.string() }),
  async execute({ name }, ctx) {
    const content = await ctx.services.loadSkill(name, ctx.directory)
    if (content === undefined) throw new CortexError("tool_failed", `Skill ${name} not found`)
    return { title: name, output: content }
  },
})

export const BUILTIN_TOOLS: ToolDef[] = [read, write, edit, list, glob, grep, bash, webfetch, todowrite, task, skill, browserTabs, browserRead]
