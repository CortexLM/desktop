import { dynamicTool, isStepCount, jsonSchema, streamText, type ModelMessage, type ToolSet } from "ai"
import {
  capabilities,
  newId,
  PromptInput,
  SessionCreateInput,
  type Agent,
  type ErrorInfo,
  type Message,
  type MessageWithParts,
  type Part,
  type PermissionRule,
  type PromptPartInput,
  type Session,
  type SessionUpdateInput,
  type ToolPart,
  type Usage,
} from "@cortex/schema"
import { getAgent, toolAllowed } from "./agent"
import type { Bus } from "./bus"
import type { Catalog } from "./catalog"
import { CortexError, toErrorInfo } from "./error"
import { assertContextFits, assertInputSupported, callOptions, costOf, estimateTokens } from "./llm"
import type { McpService } from "./mcp"
import { DEFAULT_RULES, type PermissionService } from "./permission"
import type { ChatParams, PluginRegistry } from "./plugin"
import { resolveModel, type ProviderSettings } from "./provider"
import type { SkillService } from "./skill"
import type { Storage } from "./storage"
import { BUILTIN_TOOLS, type ToolContext, type ToolDef, type ToolServices } from "./tool"

export const DEFAULT_TITLE = ""
export const MAX_STEPS = 25

/** Extra context for bot sessions, supplied by the bot service. */
export interface BotContext {
  system: string
  tools: Agent["tools"]
  permission: PermissionRule[]
}

export interface SessionDeps {
  storage: Storage
  bus: Bus
  catalog: Catalog
  providers: ProviderSettings
  permissions: PermissionService
  skills: SkillService
  plugins: PluginRegistry
  mcp: McpService
  fetch?: typeof fetch
  botContext?: (botID: string) => BotContext | undefined
  /** Global user permission rules (Settings), layered after defaults. */
  rules?: () => PermissionRule[]
  maxSteps?: number
}

const zeroUsage = (): Usage => ({ input: 0, output: 0, reasoning: 0, cost: 0 })

export class SessionService {
  private running = new Map<string, { controller: AbortController; done: Promise<void> }>()
  private todos = new Map<string, unknown[]>()
  constructor(private d: SessionDeps) {}

  // ---------- CRUD ----------
  create(input: unknown): Session {
    const i = SessionCreateInput.parse(input)
    if (i.parentID && !this.d.storage.session(i.parentID)) throw new CortexError("not_found", `Unknown parent session ${i.parentID}`)
    const now = Date.now()
    const s: Session = {
      id: newId("session"),
      title: i.title ?? DEFAULT_TITLE,
      agent: i.agent ?? "build",
      model: i.model,
      directory: i.directory,
      parentID: i.parentID,
      kind: i.kind,
      botID: i.botID,
      time: { created: now, updated: now },
    }
    if (!getAgent(s.agent)) throw new CortexError("invalid_request", `Unknown agent ${s.agent}`)
    this.d.bus.publish("session.created", { session: s })
    return s
  }
  get(id: string): Session {
    const s = this.d.storage.session(id)
    if (!s) throw new CortexError("not_found", `Unknown session ${id}`)
    return s
  }
  list(filter?: { kind?: string; botID?: string; parentID?: string | null }) {
    return this.d.storage.sessions(filter)
  }
  update(id: string, patch: SessionUpdateInput): Session {
    const s = { ...this.get(id), ...stripUndefined(patch) }
    if (!getAgent(s.agent)) throw new CortexError("invalid_request", `Unknown agent ${s.agent}`)
    s.time = { ...s.time, updated: Date.now() }
    this.d.bus.publish("session.updated", { session: s })
    return s
  }
  async delete(id: string) {
    this.get(id)
    this.running.get(id)?.controller.abort()
    for (const child of this.list({ parentID: id })) await this.delete(child.id)
    await this.abort(id)
    this.todos.delete(id)
    this.d.bus.publish("session.deleted", { sessionID: id })
  }
  messages(id: string): MessageWithParts[] {
    this.get(id)
    return this.d.storage.messages(id)
  }
  isBusy(id: string) {
    return this.running.has(id)
  }

  async abort(id: string) {
    const r = this.running.get(id)
    if (!r) return
    r.controller.abort()
    await r.done
  }

  /** Admit the prompt (validated, persisted) and start the run; resolves once admitted. */
  async prompt(sessionID: string, input: unknown): Promise<{ messageID: string; done: Promise<void> }> {
    const p = PromptInput.parse(input)
    if (this.running.has(sessionID)) throw new CortexError("session_busy", "Session is already running")
    let session = this.get(sessionID)
    const candidate = { ...session, ...stripUndefined({ model: p.model, agent: p.agent }) }
    if (!getAgent(candidate.agent)) throw new CortexError("invalid_request", `Unknown agent ${candidate.agent}`)
    session = candidate
    const controller = new AbortController()
    let complete!: () => void
    const done = new Promise<void>((r) => (complete = r))
    const finish = () => { this.running.delete(sessionID); complete() }
    // Reserve before asynchronous validation; abort/delete must also see pending admission.
    this.running.set(sessionID, { controller, done })
    try {
      const model = await this.d.catalog.model(session.model.providerID, session.model.modelID)
      if (!model) throw new CortexError("model_not_found", `Unknown model ${session.model.providerID}/${session.model.modelID}`)
      const caps = capabilities(model)
      assertInputSupported(caps, p.parts)
      const history = this.d.storage.messages(sessionID)
      for (const m of history) if (m.info.role === "user") assertInputSupported(caps, m.parts.filter((part) => part.type === "file"))
      assertContextFits(caps, estimateHistory(history, p.parts))
      const resolved = await resolveModel((await this.d.catalog.provider(session.model.providerID))!, model, this.d.providers, this.d.fetch)
      if (controller.signal.aborted) throw new CortexError("aborted", "Request aborted")

      if (p.model || p.agent) session = this.update(sessionID, { model: session.model, agent: session.agent })
      if (controller.signal.aborted) throw new CortexError("aborted", "Request aborted")
      const user = this.admit(session, p.parts)
      if (session.title === DEFAULT_TITLE) {
        const text = p.parts.find((x) => x.type === "text")?.text.trim()
        if (text) session = this.update(sessionID, { title: text.split("\n")[0]!.slice(0, 60) })
      }
      void this.run(session, resolved, controller, p.reasoning ?? true)
        .catch(() => undefined)
        .finally(finish)
      return { messageID: user.id, done }
    } catch (err) {
      finish()
      throw err
    }
  }

  /** Prompt and wait for completion; returns the final assistant text. */
  async promptAndWait(sessionID: string, input: unknown): Promise<string> {
    const { done } = await this.prompt(sessionID, input)
    await done
    const last = this.d.storage.messages(sessionID).filter((m) => m.info.role === "assistant").at(-1)
    if (last?.info.error) throw new CortexError(last.info.error.code, last.info.error.message)
    return last?.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("") ?? ""
  }

  private admit(session: Session, parts: PromptPartInput[]): Message {
    const msg: Message = { id: newId("message"), sessionID: session.id, role: "user", time: { created: Date.now() }, model: session.model, agent: session.agent, usage: zeroUsage() }
    this.d.bus.publish("message.updated", { message: msg })
    for (const p of parts) {
      const base = { id: newId("part"), sessionID: session.id, messageID: msg.id }
      const part: Part = p.type === "text" ? { ...base, type: "text", text: p.text } : { ...base, type: "file", mime: p.mime, filename: p.filename, url: p.url, data: p.data }
      this.d.bus.publish("part.updated", { part })
    }
    return msg
  }

  private rules(session: Session, agent: Agent, bot?: BotContext): PermissionRule[] {
    return [...DEFAULT_RULES, ...(this.d.rules?.() ?? []), ...agent.permission, ...(bot?.permission ?? [])]
  }

  private toolServices(): ToolServices {
    return {
      fetch: this.d.fetch ?? fetch,
      todos: { get: (id) => this.todos.get(id) ?? [], set: (id, t) => void this.todos.set(id, t) },
      loadSkill: async (name, dir) => (await this.d.skills.load(name, dir))?.content,
      runSubagent: async ({ parentID, agent, prompt, description, signal }) => {
        const a = getAgent(agent)
        if (!a || a.mode !== "subagent") throw new CortexError("invalid_request", `Unknown subagent ${agent}`)
        const parent = this.get(parentID)
        const child = this.create({ title: description, agent, model: parent.model, directory: parent.directory, parentID, kind: parent.kind, botID: parent.botID })
        const onAbort = () => void this.abort(child.id)
        signal.addEventListener("abort", onAbort, { once: true })
        try {
          return { sessionID: child.id, text: await this.promptAndWait(child.id, { parts: [{ type: "text", text: prompt }] }) }
        } finally {
          signal.removeEventListener("abort", onAbort)
        }
      },
    }
  }

  /** Tool definitions offered to this session (before the model's tool_call capability gate). */
  availableTools(session: Session, agent: Agent, bot?: BotContext): ToolDef[] {
    const defs = [...BUILTIN_TOOLS, ...this.d.plugins.tools()]
    return defs.filter(
      (t) =>
        toolAllowed(agent.tools, t.name) &&
        (!bot || toolAllowed(bot.tools, t.name)) &&
        (!t.needsDirectory || !!session.directory) &&
        !(t.name === "task" && session.parentID), // no nested task
    )
  }

  private buildTools(session: Session, agent: Agent, bot: BotContext | undefined, messageID: string, signal: AbortSignal, onReject: () => void): ToolSet {
    const rules = this.rules(session, agent, bot)
    const project = session.directory ?? "global"
    const services = this.toolServices()
    const out: ToolSet = {}
    const wrap = (name: string, run: (args: unknown, ctx: ToolContext) => Promise<{ output: string; title?: string; metadata?: Record<string, unknown> }>) =>
      async (args: unknown, opts: { toolCallId: string }) => {
        const ctx: ToolContext = {
          sessionID: session.id,
          messageID,
          callID: opts.toolCallId,
          directory: session.directory,
          signal,
          services,
          ask: (pattern, input, tool = name) => this.d.permissions.ask({ sessionID: session.id, callID: opts.toolCallId, tool, pattern, input, rules, project, signal }),
        }
        try {
          await this.d.plugins.trigger("tool.execute.before", { tool: name, sessionID: session.id, callID: opts.toolCallId, args })
          const result = await run(args, ctx)
          await this.d.plugins.trigger("tool.execute.after", { tool: name, sessionID: session.id, callID: opts.toolCallId, args, result })
          return result
        } catch (err) {
          if (err instanceof CortexError && err.code === "permission_rejected") onReject()
          throw err
        }
      }
    for (const def of this.availableTools(session, agent, bot)) {
      out[def.name] = dynamicTool({
        description: def.description,
        inputSchema: def.parameters,
        execute: wrap(def.name, (args, ctx) => def.execute(args, ctx)),
      })
    }
    for (const t of this.d.mcp.tools()) {
      if (!toolAllowed(agent.tools, t.name) || (bot && !toolAllowed(bot.tools, t.name))) continue
      out[t.name] = dynamicTool({
        description: t.description ?? t.tool,
        inputSchema: jsonSchema(t.inputSchema as Parameters<typeof jsonSchema>[0]),
        execute: wrap(t.name, async (args, ctx) => {
          await ctx.ask(JSON.stringify(args ?? {}).slice(0, 200), args)
          const r = await this.d.mcp.call(t.server, t.tool, args, ctx.signal)
          if (r.isError) throw new CortexError("tool_failed", r.output || "MCP tool failed")
          return { output: r.output, title: t.tool }
        }),
      })
    }
    return out
  }

  private async run(session: Session, resolved: Awaited<ReturnType<typeof resolveModel>>, controller: AbortController, thinking = true) {
    const { bus } = this.d
    const agent = getAgent(session.agent)!
    const bot = session.botID ? this.d.botContext?.(session.botID) : undefined
    const caps = capabilities(resolved.model)
    const history = this.d.storage.messages(session.id)
    const assistant: Message = {
      id: newId("message"),
      sessionID: session.id,
      role: "assistant",
      time: { created: Date.now() },
      model: session.model,
      agent: session.agent,
      usage: zeroUsage(),
    }
    bus.publish("message.updated", { message: assistant })
    bus.publish("session.status", { sessionID: session.id, status: { type: "busy" } })

    const newPart = <T extends Part["type"]>(type: T, extra: Omit<Extract<Part, { type: T }>, "id" | "sessionID" | "messageID" | "type">) =>
      ({ id: newId("part"), sessionID: session.id, messageID: assistant.id, type, ...extra }) as unknown as Extract<Part, { type: T }>
    const put = (part: Part) => bus.publish("part.updated", { part })

    let error: ErrorInfo | undefined
    let rejected = false
    const tools = new Map<string, ToolPart>()
    const open = new Map<string, Extract<Part, { type: "text" | "reasoning" }>>()
    const close = (key: string) => {
      const p = open.get(key)
      if (!p) return
      open.delete(key)
      put(p)
    }
    try {
      const opts = callOptions(resolved.model, resolved.family, estimateHistory(history, []), thinking)
      const params: ChatParams = { sessionID: session.id, agent: agent.name, model: session.model, maxOutputTokens: opts.maxOutputTokens, providerOptions: opts.providerOptions }
      await this.d.plugins.trigger("chat.params", params)
      const toolset = opts.useTools
        ? this.buildTools(session, agent, bot, assistant.id, controller.signal, () => {
            rejected = true
            controller.abort()
          })
        : undefined
      const system = [agent.prompt, bot?.system, session.directory ? `Working directory: ${session.directory}` : undefined].filter(Boolean).join("\n\n")
      const result = streamText({
        model: resolved.language,
        instructions: system,
        messages: toModelMessages(history, opts.useTools),
        tools: toolset,
        stopWhen: isStepCount(this.d.maxSteps ?? MAX_STEPS),
        maxOutputTokens: params.maxOutputTokens,
        temperature: params.temperature,
        providerOptions: params.providerOptions as never,
        abortSignal: controller.signal,
        maxRetries: 2,
        onError: () => {}, // surfaced through the `error` stream part
      })
      for await (const ev of result.fullStream) {
        switch (ev.type) {
          case "start-step":
            put(newPart("step-start", {}))
            break
          case "text-start":
          case "reasoning-start": {
            const kind = ev.type === "text-start" ? "text" : "reasoning"
            const part = newPart(kind, { text: "" })
            open.set(`${kind}:${ev.id}`, part)
            put(part)
            break
          }
          case "text-delta":
          case "reasoning-delta": {
            const field = ev.type === "text-delta" ? "text" : "reasoning"
            const key = `${field}:${ev.id}`
            let part = open.get(key)
            if (!part) {
              part = newPart(field, { text: "" })
              open.set(key, part)
              put(part)
            }
            part.text += ev.text
            bus.publish("part.delta", { sessionID: session.id, messageID: assistant.id, partID: part.id, field, delta: ev.text })
            break
          }
          case "text-end":
            close(`text:${ev.id}`)
            break
          case "reasoning-end":
            close(`reasoning:${ev.id}`)
            break
          case "tool-input-start": {
            const part = newPart("tool", { callID: ev.id, tool: ev.toolName, state: { status: "pending" } })
            tools.set(ev.id, part)
            put(part)
            break
          }
          case "tool-call": {
            const part = tools.get(ev.toolCallId) ?? newPart("tool", { callID: ev.toolCallId, tool: ev.toolName, state: { status: "pending" } })
            part.state = { status: "running", input: ev.input, time: { start: Date.now() } }
            tools.set(ev.toolCallId, part)
            put(part)
            break
          }
          case "tool-result": {
            const part = tools.get(ev.toolCallId)
            if (!part) break
            const out = ev.output as { output?: string; title?: string; metadata?: Record<string, unknown> } | undefined
            const start = part.state.status === "running" ? part.state.time.start : Date.now()
            part.state = { status: "completed", input: ev.input, output: out?.output ?? JSON.stringify(ev.output), title: out?.title, metadata: out?.metadata, time: { start, end: Date.now() } }
            put(part)
            break
          }
          case "tool-error": {
            const part = tools.get(ev.toolCallId)
            if (!part) break
            const start = part.state.status === "running" ? part.state.time.start : Date.now()
            part.state = { status: "error", input: ev.input, error: toolErrorText(ev.error), time: { start, end: Date.now() } }
            put(part)
            break
          }
          case "finish-step": {
            const u = ev.usage
            const step: Usage = {
              input: u.inputTokens ?? 0,
              output: u.outputTokens ?? 0,
              reasoning: u.outputTokenDetails?.reasoningTokens ?? 0,
              cost: costOf(caps, { input: u.inputTokens ?? 0, output: u.outputTokens ?? 0, cacheRead: u.inputTokenDetails?.cacheReadTokens, cacheWrite: u.inputTokenDetails?.cacheWriteTokens }),
            }
            assistant.usage = { input: assistant.usage.input + step.input, output: assistant.usage.output + step.output, reasoning: assistant.usage.reasoning + step.reasoning, cost: assistant.usage.cost + step.cost }
            for (const k of [...open.keys()]) close(k)
            put(newPart("step-finish", { reason: ev.finishReason, usage: step }))
            bus.publish("message.updated", { message: assistant })
            break
          }
          case "error":
            error = toErrorInfo(ev.error)
            break
          case "abort":
            error = rejected ? { code: "permission_rejected", message: "User rejected a tool call" } : { code: "aborted", message: "Request aborted" }
            break
        }
      }
    } catch (err) {
      error = controller.signal.aborted ? (rejected ? { code: "permission_rejected", message: "User rejected a tool call" } : { code: "aborted", message: "Request aborted" }) : toErrorInfo(err)
    } finally {
      for (const k of [...open.keys()]) close(k)
      for (const part of tools.values()) {
        if (part.state.status !== "pending" && part.state.status !== "running") continue
        const start = part.state.status === "running" ? part.state.time.start : Date.now()
        part.state = { status: "error", input: part.state.input, error: "Tool execution was interrupted", time: { start, end: Date.now() } }
        put(part)
      }
      assistant.time.completed = Date.now()
      if (error) assistant.error = error
      bus.publish("message.updated", { message: assistant })
      this.update(session.id, {})
      if (error && error.code !== "aborted") bus.publish("session.status", { sessionID: session.id, status: { type: "error", error } })
      bus.publish("session.status", { sessionID: session.id, status: { type: "idle" } })
    }
  }
}

function toolErrorText(err: unknown): string {
  if (err instanceof CortexError) return err.message
  if (err instanceof Error && err.name === "AI_InvalidToolInputError") return "Invalid tool input"
  if (err instanceof Error) return err.message.slice(0, 2000)
  return "Tool failed"
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}

function estimateHistory(history: MessageWithParts[], extra: PromptPartInput[]): number {
  const texts: string[] = []
  let images = 0
  const visit = (p: Part | PromptPartInput) => {
    if (p.type === "text") texts.push(p.text)
    else if (p.type === "file") {
      if (p.mime.startsWith("image/")) images++
      else if (p.data) texts.push(p.data.slice(0, Math.ceil((p.data.length * 3) / 4)))
    } else if (p.type === "tool") texts.push(JSON.stringify(p.state))
  }
  for (const m of history) m.parts.forEach(visit)
  extra.forEach(visit)
  return estimateTokens(texts, images)
}

/** Projected history → AI SDK messages. Reasoning is not replayed; tool calls/results are, when tools are on. */
export function toModelMessages(history: MessageWithParts[], useTools: boolean): ModelMessage[] {
  const out: ModelMessage[] = []
  for (const { info, parts } of history) {
    if (info.role === "user") {
      const content: Exclude<Extract<ModelMessage, { role: "user" }>["content"], string> = []
      for (const p of parts) {
        if (p.type === "text") content.push({ type: "text", text: p.text })
        if (p.type !== "file") continue
        const data = p.data ?? (p.url ? new URL(p.url) : undefined)
        if (!data) continue
        content.push({ type: "file", data, mediaType: p.mime, filename: p.filename })
      }
      if (content.length) out.push({ role: "user", content })
      continue
    }
    // split assistant parts into steps
    let content: Exclude<Extract<ModelMessage, { role: "assistant" }>["content"], string> = []
    let results: Extract<ModelMessage, { role: "tool" }>["content"] = []
    const flush = () => {
      if (content.length) out.push({ role: "assistant", content })
      if (results.length) out.push({ role: "tool", content: results })
      content = []
      results = []
    }
    for (const p of parts) {
      if (p.type === "step-start") flush()
      else if (p.type === "text" && p.text) content.push({ type: "text", text: p.text })
      else if (p.type === "tool") {
        const s = p.state
        const text = s.status === "completed" ? s.output : s.status === "error" ? s.error : "Tool execution was interrupted"
        if (!useTools) {
          content.push({ type: "text", text: `[tool ${p.tool}] ${text}` })
          continue
        }
        content.push({ type: "tool-call", toolCallId: p.callID, toolName: p.tool, input: s.input ?? {} })
        results.push({ type: "tool-result", toolCallId: p.callID, toolName: p.tool, output: s.status === "completed" ? { type: "text", value: text } : { type: "error-text", value: text } })
      }
    }
    flush()
  }
  return out
}
