// Browser-safe contracts shared by core, protocol, server and client. zod only.
import { z } from "zod"

// Shared contracts must initialize under the renderer's CSP without probing dynamic evaluation.
z.config({ jitless: true })

// ---------- ids ----------
const PREFIX = { session: "ses", message: "msg", part: "prt", permission: "per", bot: "bot", memory: "mem", task: "tsk", run: "run", space: "spc" } as const
export type IdKind = keyof typeof PREFIX
let lastTime = 0
let counter = 0
/** Sortable id: `<prefix>_<time hex><counter><random>`; ascending within a process. */
export function newId(kind: IdKind): string {
  const now = Date.now()
  counter = now === lastTime ? counter + 1 : 0
  lastTime = now
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("")
  return `${PREFIX[kind]}_${now.toString(16).padStart(12, "0")}${counter.toString(16).padStart(4, "0")}${rand}`
}

// ---------- errors ----------
export const ErrorCode = z.enum([
  "invalid_request",
  "not_found",
  "conflict",
  "session_busy",
  "model_not_found",
  "model_no_image_input",
  "model_no_pdf_input",
  "context_window_exceeded",
  "provider_unsupported",
  "provider_disabled",
  "provider_key_missing",
  "provider_auth_failed",
  "provider_rate_limited",
  "provider_error",
  "catalog_unavailable",
  "permission_rejected",
  "permission_denied",
  "aborted",
  "tool_failed",
  "mcp_connect_failed",
  "plugin_load_failed",
  "internal",
])
export type ErrorCode = z.infer<typeof ErrorCode>
export const ApiError = z.object({ error: z.object({ code: ErrorCode, message: z.string() }) })
export type ApiError = z.infer<typeof ApiError>
export const ErrorInfo = z.object({ code: ErrorCode, message: z.string() })
export type ErrorInfo = z.infer<typeof ErrorInfo>

// ---------- models.dev catalog ----------
const num = z.number().optional()
export const ReasoningOption = z.object({
  type: z.string(),
  values: z.array(z.string().nullable()).optional(),
  min: num,
  max: num,
})
export const Model = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string().optional(),
  attachment: z.boolean().default(false),
  reasoning: z.boolean().default(false),
  reasoning_options: z.array(ReasoningOption).optional(),
  tool_call: z.boolean().default(false),
  temperature: z.boolean().optional(),
  modalities: z
    .object({ input: z.array(z.string()).default(["text"]), output: z.array(z.string()).default(["text"]) })
    .default({ input: ["text"], output: ["text"] }),
  limit: z.object({ context: z.number().default(0), output: z.number().default(0) }).default({ context: 0, output: 0 }),
  cost: z
    .object({ input: z.number().default(0), output: z.number().default(0), cache_read: num, cache_write: num })
    .optional(),
  knowledge: z.string().optional(),
  release_date: z.string().optional(),
  open_weights: z.boolean().optional(),
})
export type Model = z.infer<typeof Model>
export const Provider = z.object({
  id: z.string(),
  name: z.string(),
  env: z.array(z.string()).default([]),
  npm: z.string().optional(),
  api: z.string().optional(),
  doc: z.string().optional(),
  models: z.record(z.string(), Model).default({}),
})
export type Provider = z.infer<typeof Provider>

export const ModelCost = z.object({ input: z.number(), output: z.number(), cacheRead: z.number(), cacheWrite: z.number() })
export const ModelCapabilities = z.object({
  reasoning: z.boolean(),
  imageInput: z.boolean(),
  pdfInput: z.boolean(),
  tools: z.boolean(),
  contextWindow: z.number(),
  maxOutput: z.number(),
  cost: ModelCost,
})
export type ModelCapabilities = z.infer<typeof ModelCapabilities>

export function capabilities(model: Model): ModelCapabilities {
  const input = model.modalities.input
  return {
    reasoning: model.reasoning,
    imageInput: input.includes("image"),
    pdfInput: input.includes("pdf"),
    tools: model.tool_call,
    contextWindow: model.limit.context,
    maxOutput: model.limit.output,
    cost: {
      input: model.cost?.input ?? 0,
      output: model.cost?.output ?? 0,
      cacheRead: model.cost?.cache_read ?? 0,
      cacheWrite: model.cost?.cache_write ?? 0,
    },
  }
}

/** Provider summary for listings: models omitted, support flag added. */
export const ProviderSummary = Provider.omit({ models: true }).extend({ supported: z.boolean(), modelCount: z.number() })
export type ProviderSummary = z.infer<typeof ProviderSummary>
export const ModelInfo = Model.extend({ providerID: z.string(), capabilities: ModelCapabilities })
export type ModelInfo = z.infer<typeof ModelInfo>

/** Never carries the key itself. */
export const ProviderConfig = z.object({
  providerID: z.string(),
  enabled: z.boolean(),
  hasKey: z.boolean(),
  keyHint: z.string().optional(),
  baseURL: z.string().optional(),
})
export type ProviderConfig = z.infer<typeof ProviderConfig>

// ---------- sessions ----------
export const ModelRef = z.object({ providerID: z.string(), modelID: z.string() })
export type ModelRef = z.infer<typeof ModelRef>
export const SessionKind = z.enum(["chat", "code", "bot"])
export const Session = z.object({
  id: z.string(),
  title: z.string(),
  agent: z.string(),
  model: ModelRef,
  directory: z.string().optional(),
  parentID: z.string().optional(),
  kind: SessionKind,
  botID: z.string().optional(),
  time: z.object({ created: z.number(), updated: z.number() }),
})
export type Session = z.infer<typeof Session>

export const Usage = z.object({ input: z.number(), output: z.number(), reasoning: z.number(), cost: z.number() })
export type Usage = z.infer<typeof Usage>
export const Message = z.object({
  id: z.string(),
  sessionID: z.string(),
  role: z.enum(["user", "assistant"]),
  time: z.object({ created: z.number(), completed: z.number().optional() }),
  model: ModelRef,
  agent: z.string().optional(),
  usage: Usage,
  error: ErrorInfo.optional(),
})
export type Message = z.infer<typeof Message>

const PartBase = { id: z.string(), sessionID: z.string(), messageID: z.string() }
export const ToolState = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending"), input: z.unknown().optional() }),
  z.object({ status: z.literal("running"), input: z.unknown(), title: z.string().optional(), time: z.object({ start: z.number() }) }),
  z.object({
    status: z.literal("completed"),
    input: z.unknown(),
    output: z.string(),
    title: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    time: z.object({ start: z.number(), end: z.number() }),
  }),
  z.object({ status: z.literal("error"), input: z.unknown().optional(), error: z.string(), time: z.object({ start: z.number(), end: z.number() }) }),
])
export type ToolState = z.infer<typeof ToolState>
export const TextPart = z.object({ ...PartBase, type: z.literal("text"), text: z.string(), synthetic: z.boolean().optional() })
export const ReasoningPart = z.object({ ...PartBase, type: z.literal("reasoning"), text: z.string() })
export const FilePart = z.object({
  ...PartBase,
  type: z.literal("file"),
  mime: z.string(),
  filename: z.string().optional(),
  url: z.string().optional(),
  data: z.string().optional(), // base64
})
export const ToolPart = z.object({ ...PartBase, type: z.literal("tool"), callID: z.string(), tool: z.string(), state: ToolState })
export const StepStartPart = z.object({ ...PartBase, type: z.literal("step-start") })
export const StepFinishPart = z.object({ ...PartBase, type: z.literal("step-finish"), reason: z.string(), usage: Usage })
export const Part = z.discriminatedUnion("type", [TextPart, ReasoningPart, FilePart, ToolPart, StepStartPart, StepFinishPart])
export type Part = z.infer<typeof Part>
export type TextPart = z.infer<typeof TextPart>
export type ToolPart = z.infer<typeof ToolPart>
export type FilePart = z.infer<typeof FilePart>
export const MessageWithParts = z.object({ info: Message, parts: z.array(Part) })
export type MessageWithParts = z.infer<typeof MessageWithParts>

export const SessionStatus = z.discriminatedUnion("type", [
  z.object({ type: z.literal("idle") }),
  z.object({ type: z.literal("busy") }),
  z.object({ type: z.literal("retry"), attempt: z.number(), next: z.number() }),
  z.object({ type: z.literal("error"), error: ErrorInfo }),
])
export type SessionStatus = z.infer<typeof SessionStatus>

// ---------- permissions / agents ----------
export const PermissionAction = z.enum(["allow", "ask", "deny"])
export const PermissionRule = z.object({ tool: z.string(), pattern: z.string().default("*"), action: PermissionAction })
export type PermissionRule = z.infer<typeof PermissionRule>
export const Permission = z.object({
  id: z.string(),
  sessionID: z.string(),
  callID: z.string().optional(),
  tool: z.string(),
  pattern: z.string(),
  input: z.string(), // preview, bounded
  time: z.number(),
})
export type Permission = z.infer<typeof Permission>
export const PermissionReply = z.enum(["once", "always", "reject"])
export type PermissionReply = z.infer<typeof PermissionReply>

export const ToolFilter = z.object({ allow: z.array(z.string()).optional(), deny: z.array(z.string()).optional() })
export type ToolFilter = z.infer<typeof ToolFilter>
export const Agent = z.object({
  name: z.string(),
  description: z.string(),
  mode: z.enum(["primary", "subagent"]),
  prompt: z.string(),
  tools: ToolFilter,
  permission: z.array(PermissionRule),
})
export type Agent = z.infer<typeof Agent>

// ---------- extensions ----------
export const Skill = z.object({
  name: z.string(),
  description: z.string(),
  path: z.string(),
  source: z.enum(["builtin", "personal", "public", "project"]),
  enabled: z.boolean(),
})
export type Skill = z.infer<typeof Skill>
export const Plugin = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  source: z.enum(["installed", "public", "personal"]),
  enabled: z.boolean(),
  hooks: z.array(z.string()),
  tools: z.array(z.string()),
  error: ErrorInfo.optional(),
})
export type Plugin = z.infer<typeof Plugin>
export const McpConfig = z.discriminatedUnion("type", [
  z.object({
    name: z.string().regex(/^[A-Za-z0-9_-]+$/),
    type: z.literal("stdio"),
    command: z.string().min(1),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
    enabled: z.boolean().default(true),
  }),
  z.object({
    name: z.string().regex(/^[A-Za-z0-9_-]+$/),
    type: z.literal("remote"),
    url: z.url({ protocol: /^https?$/ }),
    headers: z.record(z.string(), z.string()).optional(),
    enabled: z.boolean().default(true),
  }),
])
export type McpConfig = z.infer<typeof McpConfig>
export const McpStatus = z.enum(["connected", "failed", "disabled", "disconnected"])
// Connection material is write-only, including URLs/arguments which may embed credentials.
export const McpServer = z.object({
  name: z.string(),
  type: z.enum(["stdio", "remote"]),
  enabled: z.boolean(),
  status: McpStatus,
  tools: z.array(z.object({ name: z.string(), description: z.string().optional() })),
  error: ErrorInfo.optional(),
})
export type McpServer = z.infer<typeof McpServer>

// ---------- scheduler ----------
export const Schedule = z.discriminatedUnion("type", [
  z.object({ type: z.literal("cron"), expr: z.string() }),
  z.object({ type: z.literal("daily"), time: z.string().regex(/^\d{1,2}:\d{2}$/) }),
  z.object({ type: z.literal("weekly"), day: z.number().int().min(0).max(6), time: z.string().regex(/^\d{1,2}:\d{2}$/) }),
  z.object({ type: z.literal("once"), at: z.number() }),
])
export type Schedule = z.infer<typeof Schedule>
export const TaskRun = z.object({
  id: z.string(),
  taskID: z.string(),
  sessionID: z.string().optional(),
  status: z.enum(["running", "success", "error"]),
  error: ErrorInfo.optional(),
  time: z.object({ start: z.number(), end: z.number().optional() }),
})
export type TaskRun = z.infer<typeof TaskRun>
export const ScheduledTask = z.object({
  id: z.string(),
  title: z.string(),
  prompt: z.string(),
  schedule: Schedule,
  model: ModelRef,
  agent: z.string().optional(),
  botID: z.string().optional(),
  directory: z.string().optional(),
  enabled: z.boolean(),
  lastRun: z.number().optional(),
  nextRun: z.number().optional(),
  runs: z.array(TaskRun),
  time: z.object({ created: z.number(), updated: z.number() }),
})
export type ScheduledTask = z.infer<typeof ScheduledTask>

// ---------- bots ----------
export const Mascot = z.object({
  shape: z.string(),
  color: z.string(),
  eyes: z.string(),
  mouth: z.string(),
  accessories: z.array(z.string()).default([]),
})
export type Mascot = z.infer<typeof Mascot>
export const MemoryEntry = z.object({ id: z.string(), botID: z.string(), content: z.string(), time: z.number() })
export type MemoryEntry = z.infer<typeof MemoryEntry>
export const Bot = z.object({
  id: z.string(),
  name: z.string(),
  persona: z.string(),
  mascot: Mascot,
  model: ModelRef,
  tools: ToolFilter,
  permission: z.array(PermissionRule),
  memory: z.array(MemoryEntry),
  routines: z.array(ScheduledTask),
  time: z.object({ created: z.number(), updated: z.number() }),
})
export type Bot = z.infer<typeof Bot>

// ---------- space / connection ----------
export const SpaceItem = z.object({
  id: z.string(),
  kind: z.enum(["page", "site", "image"]),
  title: z.string(),
  content: z.string().optional(),
  url: z.string().optional(),
  time: z.object({ created: z.number(), updated: z.number(), opened: z.number().optional() }),
})
export type SpaceItem = z.infer<typeof SpaceItem>
export const ConnectionUrl = z.string().url().refine((value) => {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return ["http:", "https:"].includes(url.protocol) && url.href === `${url.origin}/`
})
export const ConnectionMode = z.object({ mode: z.enum(["local", "cloud", "selfhost"]), url: ConnectionUrl.optional(), signedIn: z.boolean() })
export type ConnectionMode = z.infer<typeof ConnectionMode>
export const ConnectionProbe = z.object({
  status: z.enum(["reachable", "unreachable", "incompatible", "not_applicable"]),
  httpStatus: z.number().optional(),
  authRequired: z.boolean().optional(),
  models: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
})
export type ConnectionProbe = z.infer<typeof ConnectionProbe>
export const RemoteAuthState = z.object({
  status: z.enum(["signed_out", "code_sent", "signed_in", "verify_email", "mfa_challenge", "mfa_enrollment"]),
  signedIn: z.boolean(),
  email: z.string().email().optional(),
})
export type RemoteAuthState = z.infer<typeof RemoteAuthState>
export const RemoteAuthInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("email"), email: z.string().email().max(254) }),
  z.object({ action: z.literal("code"), code: z.string().length(6).regex(/^\d{6}$/) }),
  z.object({ action: z.literal("local"), email: z.string().email().max(254), password: z.string().min(1).max(4096) }),
  z.object({ action: z.literal("verify_email"), code: z.string().trim().min(1).max(128) }),
  z.object({ action: z.literal("mfa"), code: z.string().length(6).regex(/^\d{6}$/) }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("cancel") }),
])
export type RemoteAuthInput = z.infer<typeof RemoteAuthInput>

// ---------- request inputs ----------
export const SessionCreateInput = z.object({
  title: z.string().optional(),
  agent: z.string().optional(),
  model: ModelRef,
  directory: z.string().optional(),
  parentID: z.string().optional(),
  kind: SessionKind.default("chat"),
  botID: z.string().optional(),
})
export type SessionCreateInput = z.input<typeof SessionCreateInput>
export const SessionUpdateInput = z.object({ title: z.string().optional(), agent: z.string().optional(), model: ModelRef.optional() })
export type SessionUpdateInput = z.infer<typeof SessionUpdateInput>
export const PromptPartInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("file"), mime: z.string(), filename: z.string().optional(), url: z.string().optional(), data: z.string().optional() }),
])
export type PromptPartInput = z.infer<typeof PromptPartInput>
export const PromptInput = z.object({
  parts: z.array(PromptPartInput).min(1),
  agent: z.string().optional(),
  model: ModelRef.optional(),
  /** Extended thinking. Ignored (never sent) for models without the reasoning capability; defaults to on for them. */
  reasoning: z.boolean().optional(),
})
export type PromptInput = z.infer<typeof PromptInput>
export const ProviderUpdateInput = z.object({ enabled: z.boolean().optional(), baseURL: z.string().url().nullable().optional() })
export type ProviderUpdateInput = z.infer<typeof ProviderUpdateInput>
export const BotCreateInput = z.object({
  name: z.string().min(1),
  persona: z.string().default(""),
  mascot: Mascot.default({ shape: "pebble", color: "meadow", eyes: "round", mouth: "smile", accessories: [] }),
  model: ModelRef,
  tools: ToolFilter.default({}),
  permission: z.array(PermissionRule).default([]),
})
export type BotCreateInput = z.input<typeof BotCreateInput>
export const BotUpdateInput = BotCreateInput.partial()
export type BotUpdateInput = z.input<typeof BotUpdateInput>
export const TaskCreateInput = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  schedule: Schedule,
  model: ModelRef,
  agent: z.string().optional(),
  botID: z.string().optional(),
  directory: z.string().optional(),
  enabled: z.boolean().default(true),
})
export type TaskCreateInput = z.input<typeof TaskCreateInput>
export const TaskUpdateInput = TaskCreateInput.partial()
export type TaskUpdateInput = z.input<typeof TaskUpdateInput>
export const SpaceCreateInput = z.object({ kind: SpaceItem.shape.kind, title: z.string().min(1), content: z.string().optional(), url: z.string().optional() })
export type SpaceCreateInput = z.infer<typeof SpaceCreateInput>
export const SpaceUpdateInput = SpaceCreateInput.omit({ kind: true }).partial().extend({ opened: z.boolean().optional() })
export type SpaceUpdateInput = z.infer<typeof SpaceUpdateInput>

// ---------- live bus events ----------
const ev = <T extends string, P extends z.ZodRawShape>(type: T, properties: P) =>
  z.object({ type: z.literal(type), properties: z.object(properties) })
export const Event = z.discriminatedUnion("type", [
  ev("session.created", { session: Session }),
  ev("session.updated", { session: Session }),
  ev("session.deleted", { sessionID: z.string() }),
  ev("session.status", { sessionID: z.string(), status: SessionStatus }),
  ev("message.updated", { message: Message }),
  ev("part.updated", { part: Part }),
  ev("part.delta", { sessionID: z.string(), messageID: z.string(), partID: z.string(), field: z.enum(["text", "reasoning"]), delta: z.string() }),
  ev("permission.asked", { permission: Permission }),
  ev("permission.replied", { sessionID: z.string(), permissionID: z.string(), reply: PermissionReply }),
  ev("mcp.status", { name: z.string(), status: McpStatus, error: ErrorInfo.optional() }),
  ev("task.run", { run: TaskRun }),
])
export type Event = z.infer<typeof Event>
export type EventType = Event["type"]
export type EventOf<T extends EventType> = Extract<Event, { type: T }>
export const EVENT_TYPES = Event.options.map((o) => o.shape.type.value) as EventType[]
