// Browser-safe contracts shared by core, protocol, server and client. zod only.
// Shared contracts must initialize under the renderer's CSP without probing dynamic evaluation.
import "./jitless"
import { z } from "zod"

export * from "./code"
export * from "./contracts"
export * from "./work-bot"
export * from "./bot-copy"
export * from "./bot-apps"
export * from "./work-routines"
export * from "./work-inbox"
export * from "./work-activity"
export * from "./work-channels"
export * from "./work-memory"
export * from "./update"

// ---------- ids ----------
const PREFIX = { session: "ses", message: "msg", part: "prt", permission: "per", bot: "bot", memory: "mem", task: "tsk", run: "run", space: "spc", project: "prj" } as const
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

// ---------- runtime settings ----------
export const RuntimeSettings = z.object({ memoryEnabled: z.boolean() }).strict()
export type RuntimeSettings = z.infer<typeof RuntimeSettings>

// ---------- projects ----------
export const ProjectID = z.string().min(1).max(100)
export const Project = z.object({
  id: ProjectID,
  name: z.string().trim().min(1).max(48),
  icon: z.enum(["folder", "rocket", "calendar", "image", "mail", "globe", "code", "bolt"]),
  color: z.enum(["#8448FF", "#1E7BFF", "#12B8A0", "#FF6A13", "#EE3A97", "#5F6B7E"]),
  instructions: z.string().max(4000),
  time: z.object({ created: z.number(), updated: z.number() }),
})
export type Project = z.infer<typeof Project>

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
  projectID: ProjectID.optional(),
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

// ---------- process-only remote Chat views (not local engine sessions) ----------
const RemoteName = z.string().trim().min(1).max(1024)
const RemoteCount = z.number().int().nonnegative().safe()
const RemoteTime = z.number().finite().nonnegative()
const remoteID = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$`))
export const RemoteEpoch = z.string().min(1).max(256)
export const RemoteEffort = z.enum(["low", "medium", "high"])
export const RemoteFinish = z.enum(["stop", "length", "tool_calls", "interrupted", "error"])
export const RemoteTerminalOutcome = z.enum(["incomplete", "blocked", "cancelled"])
export const RemoteTerminationReason = z.enum(["upstream_eof", "output_limit", "missing_tool_calls", "round_budget", "tool_budget", "tool_refused", "content_filter", "error", "contradictory_terminal"])
export const RemoteDeliveryState = z.enum(["ready", "admitting", "streaming", "detached", "uncertain", "history_required", "settled"])
export const RemoteModel = z.object({
  slug: RemoteName, name: RemoteName,
  reasoning: z.union([z.boolean(), z.literal("unknown")]), vision: z.union([z.boolean(), z.literal("unknown")]), tools: z.union([z.boolean(), z.literal("unknown")]),
  contextTokens: RemoteCount.optional(), outputTokens: RemoteCount.optional(),
  source: z.enum(["cloud", "models.dev", "cache", "cache_stale", "unavailable"]),
})
export type RemoteModel = z.infer<typeof RemoteModel>
export const RemoteFile = z.object({
  id: remoteID("lbf"), filename: RemoteName, contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  byteSize: RemoteCount.positive().max(8 * 1024 * 1024), conversationID: remoteID("cnv").optional(),
})
export type RemoteFile = z.infer<typeof RemoteFile>
export const RemoteUploadInput = z.object({
  filename: RemoteFile.shape.filename,
  oneOffModelSlug: RemoteName.optional(),
  mime: RemoteFile.shape.contentType,
  data: z.string().min(1).max(11184812).refine((text) => {
    if (!text.length || text.length > 11184812) return false
    const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0
    const length = text.length - padding, tail = length % 4
    if (!length || tail === 1 || (padding && (text.length % 4 !== 0 || padding !== 4 - tail))) return false
    if (Math.floor(length * 3 / 4) > 8 * 1024 * 1024 || /[^A-Za-z0-9+/]/.test(text.slice(0, length))) return false
    const last = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(text[length - 1])
    return (tail !== 2 || (last & 15) === 0) && (tail !== 3 || (last & 3) === 0)
  }),
}).strict()
export type RemoteUploadInput = z.infer<typeof RemoteUploadInput>
export const RemoteSessionCreateInput = z.object({ epoch: RemoteEpoch, modelSlug: RemoteName, effort: RemoteEffort.optional() }).strict()
export type RemoteSessionCreateInput = z.infer<typeof RemoteSessionCreateInput>
export const RemotePromptInput = z.object({
  message: z.string().max(100000).trim().refine((v) => [...v].length <= 50000), attachmentIDs: z.array(remoteID("lbf")).max(20),
  oneOffModelSlug: RemoteName.optional(),
}).strict().refine((v) => !!v.message || v.attachmentIDs.length > 0).refine((v) => new Set(v.attachmentIDs).size === v.attachmentIDs.length)
export type RemotePromptInput = z.infer<typeof RemotePromptInput>
export const RemoteOutcome = z.object({
  state: RemoteDeliveryState, complete: z.boolean(), partial: z.boolean(), finishReason: RemoteFinish.optional(), errorCode: ErrorCode.optional(),
  terminalOutcome: RemoteTerminalOutcome.optional(), terminationReason: RemoteTerminationReason.optional(),
})
export type RemoteOutcome = z.infer<typeof RemoteOutcome>
export const RemoteSessionView = z.object({
  id: z.string(), source: z.literal("remote"), epoch: RemoteEpoch, scope: z.enum(["process", "account"]),
  conversationID: remoteID("cnv").optional(), title: z.string().max(1024), modelSlug: RemoteName, effort: RemoteEffort.optional(),
  state: RemoteDeliveryState, time: z.object({ created: RemoteTime, updated: RemoteTime }), outcome: RemoteOutcome.optional(),
})
export type RemoteSessionView = z.infer<typeof RemoteSessionView>
// Non-navigable plain text; referral addresses are copy, never HTML or href fields.
export const RemoteNoticeText = z.string().max(8192)
export const RemotePart = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("text"), text: z.string() }),
  z.object({ id: z.string(), type: z.literal("reasoning"), text: z.string(), durationMs: RemoteTime.optional() }),
  z.object({ id: z.string(), type: z.literal("file"), file: RemoteFile }),
  z.object({ id: z.string(), type: z.literal("disclosure"), reason: z.enum(["conversation_start", "periodic_reminder", "direct_question"]), text: RemoteNoticeText, blocking: z.boolean() }),
  z.object({ id: z.string(), type: z.literal("safety"), severity: z.enum(["concern", "acute"]), text: RemoteNoticeText, referral: z.object({ name: RemoteNoticeText, contact: RemoteNoticeText, note: RemoteNoticeText }) }),
  z.object({ id: z.string(), type: z.literal("tool"), invocationID: remoteID("tci"), status: z.enum(["running", "ok", "error", "timeout", "refused", "interrupted"]), durationMs: RemoteTime.optional() }),
  z.object({ id: z.string(), type: z.literal("unsupported"), kind: z.enum(["tool_result", "permission", "media", "structured", "unknown", "history", "transport"]), blocking: z.boolean() }),
])
export type RemotePart = z.infer<typeof RemotePart>
export const RemoteMessageView = z.object({
  id: z.string(), sessionID: z.string(), remoteID: remoteID("msg").optional(), role: z.enum(["user", "assistant"]),
  time: z.object({ created: RemoteTime, completed: RemoteTime.optional() }), parts: z.array(RemotePart), partial: z.boolean(),
  finishReason: RemoteFinish.optional(), errorCode: ErrorCode.optional(), terminalOutcome: RemoteTerminalOutcome.optional(), terminationReason: RemoteTerminationReason.optional(),
  usage: z.object({ input: RemoteCount.optional(), output: RemoteCount.optional(), reasoning: RemoteCount.optional(), cached: RemoteCount.optional(), cost: RemoteTime.optional() }).optional(),
})
export type RemoteMessageView = z.infer<typeof RemoteMessageView>
export const RemoteHistoryPart = z.object({
  id: z.string().min(1).max(256), sequence: RemoteCount.nullable(),
  kind: z.enum(["text", "reasoning", "tool_call", "tool_result", "citation", "artifact", "summary", "research_plan", "research_report", "code_plan", "generated_image", "generated_file", "origin_check", "user_attachment", "chart", "data_dashboard"]),
  text: z.string().max(4 * 1024 * 1024).optional(), metadata: z.record(z.string(), z.json()).optional(),
  retention: z.enum(["retained", "deleted", "unavailable", "not_retained"]),
})
export type RemoteHistoryPart = z.infer<typeof RemoteHistoryPart>
const RemoteHistoryMetadata = z.object({ file_id: remoteID("lbf").optional(), filename: RemoteName.optional(), content_type: RemoteName.optional(), byte_size: RemoteCount.optional(), retention: RemoteHistoryPart.shape.retention.optional() }).catchall(z.json())
export const RemoteHistoryWindow = z.object({
  conversationID: remoteID("cnv"), title: z.string().max(1024), modelSlug: RemoteName,
  items: z.array(z.object({
    id: remoteID("msg"), parent_message_id: remoteID("msg").nullable(), role: z.enum(["user", "assistant", "system", "tool"]), text: z.string().max(4 * 1024 * 1024),
    created_at: z.iso.datetime({ offset: true }), version_index: RemoteCount, version_count: RemoteCount.positive(), is_active_version: z.literal(true),
    finish_reason: RemoteFinish.optional(), model_name: RemoteName.optional(),
    reasoning: z.string().max(4 * 1024 * 1024).optional(), reasoning_duration_ms: RemoteTime.optional(),
    parts: z.array(RemoteHistoryPart).max(20000).optional(),
    attachments: z.array(RemoteHistoryMetadata).max(20).optional(),
    bounty_terms: z.record(z.string(), z.json()).optional(), bounty_link: z.record(z.string(), z.json()).optional(),
    research_plan: z.record(z.string(), z.json()).optional(),
    citations: z.array(z.record(z.string(), z.json())).optional(), generated_images: z.array(z.record(z.string(), z.json())).optional(),
    generated_files: z.array(z.record(z.string(), z.json())).optional(), charts: z.array(z.record(z.string(), z.json())).optional(),
    origin_checks: z.array(z.record(z.string(), z.json())).optional(), data_dashboards: z.array(z.record(z.string(), z.json())).optional(),
  })).max(10000).refine((items) => new Set(items.map((m) => m.id)).size === items.length),
  limit: z.literal(200), limited: z.literal(false), projection: z.literal("retained-parts"), reasoningAndTools: z.literal("retained"),
})
export type RemoteHistoryWindow = z.infer<typeof RemoteHistoryWindow>

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
export const RemoteAuthOwner = z.object({ origin: ConnectionUrl, revision: z.uuid() })
export type RemoteAuthOwner = z.infer<typeof RemoteAuthOwner>
export const RemoteAuthState = z.object({
  status: z.enum(["signed_out", "code_sent", "device_pending", "signed_in", "verify_email", "mfa_challenge", "mfa_enrollment"]),
  signedIn: z.boolean(),
  email: z.string().email().optional(),
  owner: RemoteAuthOwner.nullable(),
  candidate: z.uuid().optional(),
  device: z.object({ userCode: z.string(), verificationURL: z.string().url() }).optional(),
}).refine((state) => state.owner !== null || (state.status === "signed_out" && !state.signedIn && state.candidate === undefined && state.email === undefined))
export type RemoteAuthState = z.infer<typeof RemoteAuthState>
export const RemoteAuthInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("device"), owner: RemoteAuthOwner }),
  z.object({ action: z.literal("device_poll"), owner: RemoteAuthOwner }),
  z.object({ action: z.literal("email"), owner: RemoteAuthOwner, email: z.string().email().max(254) }),
  z.object({ action: z.literal("code"), owner: RemoteAuthOwner, code: z.string().length(6).regex(/^\d{6}$/) }),
  z.object({ action: z.literal("local"), owner: RemoteAuthOwner, email: z.string().email().max(254), password: z.string().min(1).max(4096) }),
  z.object({ action: z.literal("verify_email"), owner: RemoteAuthOwner, code: z.string().trim().min(1).max(128) }),
  z.object({ action: z.literal("mfa"), owner: RemoteAuthOwner, code: z.string().length(6).regex(/^\d{6}$/) }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("cancel"), origin: ConnectionUrl, candidate: z.uuid() }),
])
export type RemoteAuthInput = z.infer<typeof RemoteAuthInput>

// ---------- request inputs ----------
export const RuntimeSettingsUpdateInput = RuntimeSettings.extend({ initializeOnly: z.literal(true).optional() }).strict()
export type RuntimeSettingsUpdateInput = z.infer<typeof RuntimeSettingsUpdateInput>
export const ProjectCreateInput = z.object({
  name: Project.shape.name,
  icon: Project.shape.icon.default("calendar"),
  color: Project.shape.color.default("#8448FF"),
  instructions: Project.shape.instructions.default(""),
}).strict()
export type ProjectCreateInput = z.input<typeof ProjectCreateInput>
export const ProjectUpdateInput = Project.omit({ id: true, time: true }).partial().strict()
export type ProjectUpdateInput = z.infer<typeof ProjectUpdateInput>
export const SessionCreateInput = z.object({
  title: z.string().optional(),
  agent: z.string().optional(),
  model: ModelRef,
  directory: z.string().optional(),
  parentID: z.string().optional(),
  kind: SessionKind.default("chat"),
  botID: z.string().optional(),
  projectID: ProjectID.optional(),
}).strict()
export type SessionCreateInput = z.input<typeof SessionCreateInput>
export const SessionUpdateInput = z.object({ title: z.string().optional(), agent: z.string().optional(), model: ModelRef.optional(), projectID: ProjectID.nullable().optional() }).strict()
export type SessionUpdateInput = z.infer<typeof SessionUpdateInput>
export const PromptPartInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("file"), mime: z.string(), filename: z.string().optional(), url: z.string().optional(), data: z.string().optional() }),
])
export type PromptPartInput = z.infer<typeof PromptPartInput>
export const PromptInput = z.object({
  parts: z.array(PromptPartInput).min(1),
  expectedProjectID: ProjectID.nullable().optional(),
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
  ev("settings.changed", {}),
  ev("project.changed", { projectID: ProjectID }),
  ev("project.deleted", { projectID: ProjectID }),
  ev("remote.session.changed", { sessionID: z.string(), epoch: RemoteEpoch }),
  ev("remote.session.removed", { sessionID: z.string(), epoch: RemoteEpoch }),
  ev("code.session.changed", { sessionID: z.string(), epoch: RemoteEpoch }),
  ev("workBot.changed", { botID: z.string().optional(), epoch: RemoteEpoch }),
  ev("workInbox.changed", { epoch: RemoteEpoch, state: z.enum(["changed", "connected", "disconnected"]) }),
  ev("workActivity.changed", { epoch: RemoteEpoch, botID: z.string(), state: z.enum(["changed", "connected", "disconnected"]) }),
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
