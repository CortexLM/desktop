// Browser-safe typed client. Works with any fetch implementation (window.fetch, IPC-backed, app.fetch).
import {
  Event,
  type Agent,
  type ApiError,
  type Bot,
  type BotCreateInput,
  type BotUpdateInput,
  type ConnectionMode,
  type ConnectionProbe,
  type CodeCreateInput,
  type CodePromptInput,
  type CodeSessionView,
  type CodeSnapshot, type CodeCapabilitiesView, type CodeEnvironmentView, type CodeUsageView, type CodeSettingsView, type CodeFileView, type CodeSessionPatch, type CodeReviewInput, type CodeReviewView, type CodeRepositoriesView, type CodeBranchesView,
  type WorkBotView, type WorkBotCreate, type WorkBotUpdate, type WorkBotSnapshot, type WorkJobCreate, type WorkJob, type WorkBotParentInput, type WorkBotParentResponse,
  type BotCopyStatus, type BotCopyIssued, type BotCopyInvite, type BotCopyInbox, type BotCopyPreview, type BotCopyResult, type BotCopyCreate, type BotCopyInviteInput, type BotCopyAccept, type BotCopyDecline,
  type SkillList, type SkillView, type SkillUpload, type SkillEnable,
  type AppCatalogInput, type AppConsent, type AppCatalog, type AppConnections, type AppConnection, type OwnedConnector, type OwnedConnectors, type WorkMemoryItem, type WorkMemoryAdd, type ConnectorEnable, type ToolRuleInput, type ToolRules, type EffectiveToolPolicy,
  type PendingApprovals, type ApprovalDecision, type ApprovalAcknowledged, type PolicyEvaluations,
  type WorkRoutine, type WorkRoutineInput, type WorkRoutineRun, type WorkRoutineEvent,
  type WorkInboxSnapshot, type WorkInboxReadInput, type WorkInboxReadResult, type WorkActivity,
  type WorkChannel, type WorkChannelCreateInput, type WorkChannelUpdateInput,
  type ErrorCode,
  type McpConfig,
  type McpServer,
  type MemoryEntry,
  type MessageWithParts,
  type ModelInfo,
  type Permission,
  type PermissionReply,
  type PermissionRule,
  type Plugin,
  type Project,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  type PromptInput,
  type ProviderConfig,
  type ProviderSummary,
  type ProviderUpdateInput,
  type RemoteAuthInput,
  type RemoteAuthState,
  type RemoteFile,
  type RemoteUploadInput,
  type RemoteHistoryWindow,
  type RemoteMessageView,
  type RemoteModel,
  type RemotePromptInput,
  type RemoteSessionCreateInput,
  type RemoteSessionView,
  type RuntimeSettings,
  type RuntimeSettingsUpdateInput,
  type ScheduledTask,
  type Session,
  type SessionCreateInput,
  type SessionUpdateInput,
  type Skill,
  type SpaceCreateInput,
  type SpaceItem,
  type SpaceUpdateInput,
  type TaskCreateInput,
  type TaskUpdateInput,
} from "@cortex/schema"

export class CortexApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "CortexApiError"
  }
}

export interface ClientOptions {
  fetch?: (input: Request) => Promise<Response> | Response
  /** e.g. "http://127.0.0.1:4096" or "cortex://engine"; routes are appended (`/api/...`). */
  baseUrl: string
}

type Ok = { ok: true }
const enc = encodeURIComponent

/** Parse an SSE byte stream into events. Comments and malformed frames are ignored. */
export async function* parseSSE(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<Event> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  const onAbort = () => void reader.cancel().catch(() => undefined)
  signal?.addEventListener("abort", onAbort, { once: true })
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true }).replace(/\r\n?/g, "\n")
      let i: number
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const frame = buf.slice(0, i)
        buf = buf.slice(i + 2)
        const data = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).replace(/^ /, ""))
          .join("\n")
        if (!data) continue
        try {
          const parsed = Event.safeParse(JSON.parse(data))
          if (parsed.success) yield parsed.data
        } catch {
          // skip malformed frame
        }
      }
    }
  } finally {
    signal?.removeEventListener("abort", onAbort)
    reader.releaseLock()
  }
}

export function createClient(opts: ClientOptions) {
  const doFetch = opts.fetch ?? ((r: Request) => fetch(r))
  const base = opts.baseUrl.replace(/(?<!\/)\/+$/, "")

  async function call<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const qs = query ? Object.entries(query).filter(([, v]) => v !== undefined).map(([k, v]) => `${enc(k)}=${enc(String(v))}`).join("&") : ""
    const req = new Request(`${base}${path}${qs ? `?${qs}` : ""}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const res = await doFetch(req)
    const json = (await res.json().catch(() => undefined)) as unknown
    if (!res.ok) {
      const err = (json as ApiError | undefined)?.error
      throw new CortexApiError(err?.code ?? "internal", err?.message ?? `Request failed with status ${res.status}`, res.status)
    }
    return json as T
  }
  const get = <T>(p: string, q?: Record<string, string | number | undefined>) => call<T>("GET", p, undefined, q)
  const post = <T>(p: string, b?: unknown) => call<T>("POST", p, b ?? (undefined as unknown))
  const put = <T>(p: string, b: unknown) => call<T>("PUT", p, b)
  const patch = <T>(p: string, b: unknown) => call<T>("PATCH", p, b)
  const del = <T = Ok>(p: string) => call<T>("DELETE", p)

  return {
    health: () => get<{ ok: true; version: string }>("/api/health"),

    /** Subscribe to the live bus. Returns an unsubscribe function. Reconnect is the caller's choice. */
    subscribe(onEvent: (e: Event) => void, o: { onError?: (err: unknown) => void } = {}): () => void {
      const ctrl = new AbortController()
      void (async () => {
        try {
          const res = await doFetch(new Request(`${base}/api/events`, { headers: { accept: "text/event-stream" }, signal: ctrl.signal }))
          if (!res.ok || !res.body) throw new CortexApiError("internal", `Event stream failed with status ${res.status}`, res.status)
          for await (const e of parseSSE(res.body, ctrl.signal)) onEvent(e)
        } catch (err) {
          if (!ctrl.signal.aborted) o.onError?.(err)
        }
      })()
      return () => ctrl.abort()
    },

    settings: {
      get: () => get<RuntimeSettings>("/api/settings"),
      update: (b: RuntimeSettingsUpdateInput) => put<RuntimeSettings>("/api/settings", b),
    },
    projects: {
      list: () => get<Project[]>("/api/projects"),
      create: (b: ProjectCreateInput) => post<Project>("/api/projects", b),
      get: (id: string) => get<Project>(`/api/projects/${enc(id)}`),
      update: (id: string, b: ProjectUpdateInput) => patch<Project>(`/api/projects/${enc(id)}`, b),
      delete: (id: string) => del(`/api/projects/${enc(id)}`),
    },
    sessions: {
      list: (q: { kind?: Session["kind"]; botID?: string; parentID?: string; projectID?: string } = {}) => get<Session[]>("/api/sessions", q),
      create: (b: SessionCreateInput) => post<Session>("/api/sessions", b),
      get: (id: string) => get<Session>(`/api/sessions/${enc(id)}`),
      update: (id: string, b: SessionUpdateInput) => patch<Session>(`/api/sessions/${enc(id)}`, b),
      delete: (id: string) => del(`/api/sessions/${enc(id)}`),
      messages: (id: string) => get<MessageWithParts[]>(`/api/sessions/${enc(id)}/messages`),
      prompt: (id: string, b: PromptInput) => post<{ messageID: string }>(`/api/sessions/${enc(id)}/prompt`, b),
      abort: (id: string) => post<Ok>(`/api/sessions/${enc(id)}/abort`),
    },
    remoteSessions: {
      upload: (id: string, b: RemoteUploadInput) => post<RemoteFile>(`/api/remote/sessions/${enc(id)}/upload`, b),
      models: () => get<{ epoch: string; models: RemoteModel[] }>("/api/remote/models"),
      list: () => get<RemoteSessionView[]>("/api/remote/sessions"),
      create: (b: RemoteSessionCreateInput) => post<RemoteSessionView>("/api/remote/sessions", b),
      get: (id: string) => get<RemoteSessionView>(`/api/remote/sessions/${enc(id)}`),
      messages: (id: string) => get<RemoteMessageView[]>(`/api/remote/sessions/${enc(id)}/messages`),
      prompt: (id: string, b: RemotePromptInput) => post<{ messageID: string }>(`/api/remote/sessions/${enc(id)}/prompt`, b),
      detach: (id: string) => post<RemoteSessionView>(`/api/remote/sessions/${enc(id)}/detach`),
      resume: (id: string) => post<{ messageID: string }>(`/api/remote/sessions/${enc(id)}/resume`),
      history: (id: string) => get<RemoteHistoryWindow>(`/api/remote/sessions/${enc(id)}/history`),
    },
    code: {
      models: () => get<{ epoch: string; models: RemoteModel[] }>("/api/code/models"),
      capabilities: () => get<CodeCapabilitiesView>("/api/code/capabilities"),
      list: () => get<CodeSessionView[]>("/api/code/sessions"),
      create: (body: CodeCreateInput) => post<CodeSessionView>("/api/code/sessions", body),
      snapshot: (id: string, epoch: string) => post<CodeSnapshot>(`/api/code/sessions/${enc(id)}/snapshot`, { epoch }),
      prompt: (id: string, body: CodePromptInput) => post<CodeSessionView>(`/api/code/sessions/${enc(id)}/prompt`, body),
      stop: (id: string, epoch: string) => post<Ok>(`/api/code/sessions/${enc(id)}/stop`, { epoch }),
      decide: (id: string, permissionID: string, epoch: string, decision: "allow" | "deny") => post<Ok>(`/api/code/sessions/${enc(id)}/permissions/${enc(permissionID)}`, { epoch, decision }),
      environment: (epoch: string) => post<CodeEnvironmentView>("/api/code/environment", { epoch }),
      usage: (epoch: string) => post<CodeUsageView>("/api/code/usage", { epoch }),
      repositories: (epoch: string) => post<CodeRepositoriesView>("/api/code/repositories", { epoch }),
      branches: (epoch: string, repo: string) => post<CodeBranchesView>("/api/code/branches", { epoch, repo }),
      settings: (epoch: string) => post<CodeSettingsView>("/api/code/settings", { epoch }),
      setDefaultModel: (epoch: string, defaultModel: string) => put<CodeSettingsView>("/api/code/settings", { epoch, defaultModel }),
      prepare: (id: string, body: CodeSessionPatch) => patch<CodeSessionView>(`/api/code/sessions/${enc(id)}`, body),
      instructions: (id: string, epoch: string) => post<CodeFileView>(`/api/code/sessions/${enc(id)}/instructions`, { epoch, path: "AGENTS.md" }),
      localInstructions: (dir: string) => post<CodeFileView>("/api/code/local-instructions", { dir }),
      review: (id: string, body: CodeReviewInput) => post<CodeReviewView>(`/api/code/sessions/${enc(id)}/review`, body),
    },
    workBot: {
      channels: {
        list: (epoch: string) => post<WorkChannel[]>("/api/work-channels", { epoch }),
        get: (id: string, epoch: string) => post<WorkChannel>(`/api/work-channels/${enc(id)}/get`, { epoch }),
        create: (input: WorkChannelCreateInput) => post<WorkChannel>("/api/work-channels/create", input),
        update: (id: string, input: WorkChannelUpdateInput) => patch<WorkChannel>(`/api/work-channels/${enc(id)}`, input),
        remove: (id: string, epoch: string) => post<{ deleted: true }>(`/api/work-channels/${enc(id)}/remove`, { epoch }),
      },
      inbox: {
        snapshot: (epoch: string) => post<WorkInboxSnapshot>("/api/work-inbox", { epoch }),
        read: (input: WorkInboxReadInput) => post<WorkInboxReadResult>("/api/work-inbox/read", input),
        notificationRead: (id: string, epoch: string) => post<{ read: true }>(`/api/work-notifications/${enc(id)}/read`, { epoch }),
        readAllNotifications: (epoch: string) => post<{ read: true }>("/api/work-notifications/read-all", { epoch }),
        subscribe: (epoch: string) => post<{ subscription: string }>("/api/work-inbox/subscribe", { epoch }),
        unsubscribe: (epoch: string, subscription: string) => post<{ closed: true }>("/api/work-inbox/unsubscribe", { epoch, subscription }),
      },
      activity: {
        list: (id: string, epoch: string) => post<WorkActivity[]>(`/api/work-bot/${enc(id)}/activity`, { epoch }),
        subscribe: (id: string, epoch: string) => post<{ subscription: string }>(`/api/work-bot/${enc(id)}/activity/subscribe`, { epoch }),
        // Shares the owner-fenced watch registry with inbox subscriptions.
        unsubscribe: (epoch: string, subscription: string) => post<{ closed: true }>("/api/work-inbox/unsubscribe", { epoch, subscription }),
      },
      routines: {
        list: (id: string, epoch: string) => post<WorkRoutine[]>(`/api/work-bot/${enc(id)}/routines`, { epoch }),
        get: (id: string, rid: string, epoch: string) => post<WorkRoutine>(`/api/work-bot/${enc(id)}/routines/${enc(rid)}/get`, { epoch }),
        create: (id: string, body: WorkRoutineInput) => post<WorkRoutine>(`/api/work-bot/${enc(id)}/routines/create`, body),
        update: (id: string, rid: string, body: WorkRoutineInput) => patch<WorkRoutine>(`/api/work-bot/${enc(id)}/routines/${enc(rid)}`, body),
        remove: (id: string, rid: string, epoch: string) => post<{ deleted: true }>(`/api/work-bot/${enc(id)}/routines/${enc(rid)}/remove`, { epoch }),
        pause: (id: string, rid: string, epoch: string) => post<WorkRoutine>(`/api/work-bot/${enc(id)}/routines/${enc(rid)}/pause`, { epoch }),
        resume: (id: string, rid: string, epoch: string) => post<WorkRoutine>(`/api/work-bot/${enc(id)}/routines/${enc(rid)}/resume`, { epoch }),
        history: (id: string, rid: string, epoch: string) => post<WorkRoutineRun[]>(`/api/work-bot/${enc(id)}/routines/${enc(rid)}/history`, { epoch }),
        event: (body: WorkRoutineEvent) => post<{ fired: number }>("/api/work-routines/events", body),
      },
      appCatalog: (body: AppCatalogInput) => post<AppCatalog>("/api/bot-apps/catalog", body),
      appConnections: (epoch: string) => post<AppConnections>("/api/bot-apps/connections", { epoch }),
      appConnect: (slug: string, body: AppConsent) => post<AppConnection>(`/api/bot-apps/${enc(slug)}/connect`, body),
      appAuthorize: (slug: string, epoch: string) => post<Ok>(`/api/bot-apps/${enc(slug)}/authorize`, { epoch }),
      appConsent: (slug: string, body: AppConsent) => post<AppConnection>(`/api/bot-apps/${enc(slug)}/consent`, body),
      appRevoke: (slug: string, epoch: string) => post<Ok>(`/api/bot-apps/${enc(slug)}/revoke`, { epoch }),
      memoryList: (id: string, epoch: string) => post<WorkMemoryItem[]>(`/api/work-bot/${enc(id)}/memory`, { epoch }),
      memoryAdd: (id: string, input: WorkMemoryAdd) => post<WorkMemoryItem>(`/api/work-bot/${enc(id)}/memory/add`, input),
      memoryRemove: (id: string, memoryID: string, epoch: string) => post<{ deleted: number }>(`/api/work-bot/${enc(id)}/memory/${enc(memoryID)}/remove`, { epoch }),
      appConnectors: (id: string, epoch: string) => post<OwnedConnectors>(`/api/work-bot/${enc(id)}/connectors`, { epoch }),
      appEnable: (id: string, connectionID: string, body: ConnectorEnable) => post<OwnedConnector>(`/api/work-bot/${enc(id)}/connectors/${enc(connectionID)}`, body),
      toolRules: (id: string, epoch: string) => post<ToolRules>(`/api/work-bot/${enc(id)}/rules`, { epoch }),
      skills: (id: string, epoch: string) => post<SkillList>(`/api/work-bot/${enc(id)}/skills`, { epoch }),
      skillUpload: (input: SkillUpload) => post<SkillView>("/api/work-bot-skills", input),
      skillEnable: (id: string, slug: string, input: SkillEnable) => post<{ ok: true; enabled: boolean }>(`/api/work-bot/${enc(id)}/skills/${enc(slug)}`, input),
      toolRuleSet: (id: string, body: ToolRuleInput) => post<ToolRules>(`/api/work-bot/${enc(id)}/rules/set`, body),
      toolRuleRemove: (id: string, rid: string, epoch: string) => post<{ deleted: number }>(`/api/work-bot/${enc(id)}/rules/${enc(rid)}/remove`, { epoch }),
      toolPolicy: (id: string, epoch: string) => post<EffectiveToolPolicy>(`/api/work-bot/${enc(id)}/tool-policy`, { epoch }),
      pendingApprovals: (epoch: string, id?: string) => post<PendingApprovals>(id ? `/api/work-bot/${enc(id)}/pending` : "/api/work-bot/pending", { epoch }),
      approvalDecide: (id: string, messageID: string, body: ApprovalDecision) => post<ApprovalAcknowledged>(`/api/work-bot/${enc(id)}/messages/${enc(messageID)}/decision`, body),
      policyEvaluations: (id: string, epoch: string) => post<PolicyEvaluations>(`/api/work-bot/${enc(id)}/evaluations`, { epoch }),
      copyStatus: (id: string, epoch: string) => post<BotCopyStatus>(`/api/work-bot/${enc(id)}/copy/status`, { epoch }),
      copyCreate: (id: string, body: BotCopyCreate) => post<BotCopyIssued>(`/api/work-bot/${enc(id)}/copy`, body),
      copyInvite: (id: string, body: BotCopyInviteInput) => post<BotCopyInvite>(`/api/work-bot/${enc(id)}/copy/invites`, body),
      copyRevoke: (id: string, epoch: string) => post<Ok>(`/api/work-bot/${enc(id)}/copy/revoke`, { epoch }),
      copyInbox: (epoch: string) => post<BotCopyInbox[]>("/api/bot-copy/invites", { epoch }),
      copyPreview: (id: string, epoch: string) => post<BotCopyPreview>(`/api/bot-copy/invites/${enc(id)}/preview`, { epoch }),
      copyAccept: (id: string, body: BotCopyAccept) => post<BotCopyResult>(`/api/bot-copy/invites/${enc(id)}/accept`, body),
      copyDecline: (id: string, epoch: string) => post<BotCopyDecline>(`/api/bot-copy/invites/${enc(id)}/decline`, { epoch }),
      list: () => get<{ epoch: string; bots: WorkBotView[] }>("/api/work-bot"),
      create: (body: WorkBotCreate) => post<{ epoch: string; bot: WorkBotView }>("/api/work-bot", body),
      update: (id: string, body: WorkBotUpdate) => patch<{ epoch: string; bot: WorkBotView }>(`/api/work-bot/${enc(id)}`, body),
      snapshot: (id: string, epoch: string) => post<WorkBotSnapshot>(`/api/work-bot/${enc(id)}/snapshot`, { epoch }),
      parent: (id: string, body: WorkBotParentInput) => post<WorkBotParentResponse>(`/api/work-bot/${enc(id)}/messages`, body),
      enqueue: (id: string, body: WorkJobCreate) => post<WorkJob>(`/api/work-bot/${enc(id)}/jobs`, body),
      cancel: (id: string, taskID: string, epoch: string) => post<WorkJob>(`/api/work-bot/${enc(id)}/jobs/${enc(taskID)}/cancel`, { epoch }),
    },
    permissions: {
      list: () => get<Permission[]>("/api/permissions"),
      reply: (id: string, reply: PermissionReply) => post<Ok>(`/api/permissions/${enc(id)}/reply`, { reply }),
      rules: () => get<PermissionRule[]>("/api/permissions/rules"),
      setRules: (rules: PermissionRule[]) => put<PermissionRule[]>("/api/permissions/rules", { rules }),
    },
    catalog: {
      providers: () => get<ProviderSummary[]>("/api/catalog/providers"),
      models: (providerID: string) => get<ModelInfo[]>(`/api/catalog/providers/${enc(providerID)}/models`),
      search: (q: string, limit?: number) => get<ModelInfo[]>("/api/catalog/search", { q, limit }),
      refresh: () => post<{ source: string }>("/api/catalog/refresh"),
    },
    providers: {
      list: () => get<ProviderConfig[]>("/api/providers"),
      get: (id: string) => get<ProviderConfig>(`/api/providers/${enc(id)}`),
      update: (id: string, b: ProviderUpdateInput) => patch<ProviderConfig>(`/api/providers/${enc(id)}`, b),
      /** Write-only: the key is never returned. */
      setKey: (id: string, key: string) => put<ProviderConfig>(`/api/providers/${enc(id)}/key`, { key }),
      removeKey: (id: string) => del<ProviderConfig>(`/api/providers/${enc(id)}/key`),
    },
    agents: { list: () => get<Agent[]>("/api/agents") },
    skills: {
      list: (directory?: string) => get<Skill[]>("/api/skills", { directory }),
      setEnabled: (name: string, enabled: boolean) => patch<Ok>(`/api/skills/${enc(name)}`, { enabled }),
    },
    plugins: {
      list: () => get<Plugin[]>("/api/plugins"),
      setEnabled: (id: string, enabled: boolean) => patch<Plugin>(`/api/plugins/${enc(id)}`, { enabled }),
      rescan: () => post<Plugin[]>("/api/plugins/rescan"),
    },
    mcp: {
      list: () => get<McpServer[]>("/api/mcp"),
      add: (cfg: McpConfig) => post<McpServer>("/api/mcp", cfg),
      setEnabled: (name: string, enabled: boolean) => patch<McpServer>(`/api/mcp/${enc(name)}`, { enabled }),
      remove: (name: string) => del(`/api/mcp/${enc(name)}`),
      connect: (name: string) => post<McpServer>(`/api/mcp/${enc(name)}/connect`),
      disconnect: (name: string) => post<McpServer>(`/api/mcp/${enc(name)}/disconnect`),
    },
    bots: {
      list: () => get<Bot[]>("/api/bots"),
      create: (b: BotCreateInput) => post<Bot>("/api/bots", b),
      get: (id: string) => get<Bot>(`/api/bots/${enc(id)}`),
      update: (id: string, b: BotUpdateInput) => patch<Bot>(`/api/bots/${enc(id)}`, b),
      delete: (id: string) => del(`/api/bots/${enc(id)}`),
      sessions: (id: string) => get<Session[]>(`/api/bots/${enc(id)}/sessions`),
      createSession: (id: string, b: { title?: string; directory?: string } = {}) => post<Session>(`/api/bots/${enc(id)}/sessions`, b),
      memory: {
        list: (id: string) => get<MemoryEntry[]>(`/api/bots/${enc(id)}/memory`),
        add: (id: string, content: string) => post<MemoryEntry>(`/api/bots/${enc(id)}/memory`, { content }),
        delete: (id: string, memoryID: string) => del(`/api/bots/${enc(id)}/memory/${enc(memoryID)}`),
      },
    },
    tasks: {
      list: (q: { botID?: string } = {}) => get<ScheduledTask[]>("/api/tasks", q),
      create: (b: TaskCreateInput) => post<ScheduledTask>("/api/tasks", b),
      get: (id: string) => get<ScheduledTask>(`/api/tasks/${enc(id)}`),
      update: (id: string, b: TaskUpdateInput) => patch<ScheduledTask>(`/api/tasks/${enc(id)}`, b),
      delete: (id: string) => del(`/api/tasks/${enc(id)}`),
      run: (id: string) => post<{ accepted: true }>(`/api/tasks/${enc(id)}/run`),
    },
    space: {
      list: (kind?: SpaceItem["kind"]) => get<SpaceItem[]>("/api/space", { kind }),
      recents: (limit?: number) => get<SpaceItem[]>("/api/space/recents", { limit }),
      create: (b: SpaceCreateInput) => post<SpaceItem>("/api/space", b),
      get: (id: string) => get<SpaceItem>(`/api/space/${enc(id)}`),
      update: (id: string, b: SpaceUpdateInput) => patch<SpaceItem>(`/api/space/${enc(id)}`, b),
      delete: (id: string) => del(`/api/space/${enc(id)}`),
    },
    connection: {
      get: () => get<ConnectionMode>("/api/connection"),
      set: (c: ConnectionMode) => put<ConnectionMode>("/api/connection", c),
      probe: () => get<ConnectionProbe>("/api/connection/probe"),
      auth: {
        get: () => get<RemoteAuthState>("/api/connection/auth"),
        submit: (input: RemoteAuthInput) => post<RemoteAuthState>("/api/connection/auth", input),
      },
    },
  }
}

export type CortexClient = ReturnType<typeof createClient>
