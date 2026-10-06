import { WorkBotCreate, WorkBotUpdate, WorkBotOwner, WorkBotID, WorkJobCreate, WorkBotParentInput, type WorkBotParentResponse, type WorkBotView, type WorkJob, type WorkBotSnapshot } from "@cortex/schema"
import { CortexError } from "./error"
import type { ConnectionService } from "./connection"
import type { Bus } from "./bus"
import { AppCatalogInput, AppConsent, AppSlug, ConnectionID, ConnectorEnable, ToolRuleInput, type AppCatalog, type AppConnections, type AppConnection, type OwnedConnector, type OwnedConnectors, type ToolRules, type EffectiveToolPolicy } from "@cortex/schema"
import { BotCopyCreate, BotCopyInviteInput, BotCopyAccept, type BotCopyDecline, type BotCopyStatus, type BotCopyIssued, type BotCopyInvite, type BotCopyInbox, type BotCopyPreview, type BotCopyResult } from "@cortex/schema"
import { ApprovalDecision, type PendingApprovals, type ApprovalAcknowledged, type PolicyEvaluations } from "@cortex/schema"
import { WorkRoutineInput, WorkRoutineEvent, type WorkRoutine, type WorkRoutineRun } from "@cortex/schema"
import { WorkInboxReadInput, WorkNotificationID, type WorkInboxSnapshot, type WorkInboxReadResult } from "@cortex/schema"
import { WorkChannelCreateInput, WorkChannelUpdateInput, type WorkChannel } from "@cortex/schema"
import type { WorkActivity } from "@cortex/schema"

/** Process-local, non-durable Bot activity: projected public metadata only, never actions. */
export interface WorkActivityBinding {
  list(id: string): Promise<WorkActivity[]>
  watch(id: string, changed: () => void, connected: () => void, disconnected: () => void): { ready: Promise<void>; close(): void }
}

export interface WorkChannelsBinding {
  list(): Promise<WorkChannel[]>
  get(id: string): Promise<WorkChannel>
  create(input: WorkChannelCreateInput["channel"]): Promise<WorkChannel>
  update(id: string, input: WorkChannelUpdateInput["channel"]): Promise<WorkChannel>
  remove(id: string): Promise<{ deleted: true }>
}

export interface WorkInboxBinding {
  snapshot(): Promise<WorkInboxSnapshot>
  read(input: WorkInboxReadInput["read"]): Promise<WorkInboxReadResult>
  notificationRead(id: string): Promise<void>
  notificationsReadAll(): Promise<void>
  watch(changed: () => void, connected: () => void, disconnected: () => void): { ready: Promise<void>; close(): void }
}

export interface WorkRoutinesBinding {
  list(id: string): Promise<WorkRoutine[]>
  get(id: string, rid: string): Promise<WorkRoutine>
  create(id: string, input: WorkRoutineInput["routine"]): Promise<WorkRoutine>
  update(id: string, rid: string, input: WorkRoutineInput["routine"]): Promise<WorkRoutine>
  remove(id: string, rid: string): Promise<{ deleted: true }>
  pause(id: string, rid: string): Promise<WorkRoutine>
  resume(id: string, rid: string): Promise<WorkRoutine>
  history(id: string, rid: string): Promise<WorkRoutineRun[]>
  event(input: Omit<WorkRoutineEvent, "epoch">): Promise<{ fired: number }>
}

export interface BotCopyBinding {
  status(id: string): Promise<BotCopyStatus>
  create(id: string, input: Omit<BotCopyCreate, "epoch">): Promise<BotCopyIssued>
  invite(id: string, email: string): Promise<BotCopyInvite>
  revoke(id: string): Promise<void>
  inbox(): Promise<BotCopyInbox[]>
  preview(id: string): Promise<BotCopyPreview>
  accept(id: string, input: Omit<BotCopyAccept, "epoch">): Promise<BotCopyResult>
  decline(id: string): Promise<BotCopyDecline>
}

export interface BotAppsBinding {
  catalog(q?: string): Promise<AppCatalog>
  connections(): Promise<AppConnections>
  connect(slug: string, input: Omit<AppConsent, "epoch">): Promise<AppConnection>
  authorize(slug: string): Promise<void>
  consent(slug: string, input: Omit<AppConsent, "epoch">): Promise<AppConnection>
  revoke(slug: string): Promise<void>
  connectors(id: string): Promise<OwnedConnectors>
  enable(id: string, connectionID: string, enabled: boolean): Promise<OwnedConnector>
  rules(id: string): Promise<ToolRules>
  upsert(id: string, input: Omit<ToolRuleInput, "epoch">): Promise<ToolRules>
  remove(id: string, rid: string): Promise<{ deleted: number }>
  policy(id: string): Promise<EffectiveToolPolicy>
  pending(id?: string): Promise<PendingApprovals>
  decide(id: string, messageID: string, action: "allow" | "deny"): Promise<ApprovalAcknowledged>
  evaluations(id: string): Promise<PolicyEvaluations>
}

export interface WorkBotBinding {
  readonly channels?: WorkChannelsBinding
  readonly inbox?: WorkInboxBinding
  readonly activity?: WorkActivityBinding
  readonly routines?: WorkRoutinesBinding
  readonly apps?: BotAppsBinding
  readonly copy?: BotCopyBinding
  readonly epoch: string
  readonly signal: AbortSignal
  list(): Promise<WorkBotView[]>
  create(input: WorkBotCreate["config"]): Promise<WorkBotView>
  update(id: string, input: WorkBotUpdate["config"]): Promise<WorkBotView>
  snapshot(id: string): Promise<Omit<WorkBotSnapshot, "epoch">>
  enqueue(id: string, input: Pick<WorkJobCreate, "kind" | "goal">): Promise<WorkJob>
  cancel(id: string, taskID: string): Promise<WorkJob>
  parent(id: string, text: string): Promise<WorkBotParentResponse>
  watch(changed: (id?: string) => void, disconnected: () => void): { ready: Promise<void>; close(): void }
}
export interface WorkBotHost { bindWorkBot(origin: string): WorkBotBinding }

/** Backend task rows and retained parent messages are authoritative; no local worker. */
export class WorkBotService {
  private pending = new Map<string, symbol>()
  private inboxWatches = new Map<string, { owner: WorkBotBinding; close(): void }>()
  private watching?: { owner: WorkBotBinding; ready: Promise<void>; close(): void }
  constructor(private bus: Bus, private connection: ConnectionService, private host?: WorkBotHost) {}
  private owner(epoch?: string) {
    if (!this.host) throw new CortexError("provider_unsupported", "Bot transport is unavailable")
    const owner = this.host.bindWorkBot(this.connection.remoteOrigin())
    owner.signal.throwIfAborted()
    if (epoch !== undefined && owner.epoch !== epoch) throw new CortexError("aborted", "Bot owner changed")
    return owner
  }
  private guard(owner: WorkBotBinding) {
    if (this.owner() !== owner || owner.signal.aborted) throw new CortexError("aborted", "Bot owner changed")
  }
  async list() {
    const owner = this.owner(), bots = await owner.list()
    this.guard(owner)
    return { epoch: owner.epoch, bots }
  }
  private async channelRequest<T>(epoch: string, id: string | undefined, action: (channels: WorkChannelsBinding) => Promise<T>) {
    if (id !== undefined) WorkBotID.parse(id)
    const owner = this.owner(epoch)
    if (!owner.channels) throw new CortexError("provider_unsupported", "Channel transport is unavailable")
    const result = await action(owner.channels)
    this.guard(owner)
    return result
  }
  channelList(input: unknown) { return this.channelRequest(WorkBotOwner.parse(input).epoch, undefined, channels => channels.list()) }
  channelGet(id: string, input: unknown) { return this.channelRequest(WorkBotOwner.parse(input).epoch, id, channels => channels.get(id)) }
  channelCreate(input: unknown) { const { epoch, channel } = WorkChannelCreateInput.parse(input); return this.channelRequest(epoch, undefined, channels => channels.create(channel)) }
  channelUpdate(id: string, input: unknown) { const { epoch, channel } = WorkChannelUpdateInput.parse(input); return this.channelRequest(epoch, id, channels => channels.update(id, channel)) }
  channelRemove(id: string, input: unknown) { return this.channelRequest(WorkBotOwner.parse(input).epoch, id, channels => channels.remove(id)) }
  private async inboxRequest<T>(epoch: string, action: (inbox: WorkInboxBinding) => Promise<T>) {
    const owner = this.owner(epoch)
    if (!owner.inbox) throw new CortexError("provider_unsupported", "Inbox transport is unavailable")
    const result = await action(owner.inbox)
    this.guard(owner)
    return result
  }
  inboxSnapshot(input: unknown) { return this.inboxRequest(WorkBotOwner.parse(input).epoch, inbox => inbox.snapshot()) }
  inboxRead(input: unknown) { const { epoch, read } = WorkInboxReadInput.parse(input); return this.inboxRequest(epoch, inbox => inbox.read(read)) }
  notificationRead(id: string, input: unknown) { WorkNotificationID.parse(id); return this.inboxRequest(WorkBotOwner.parse(input).epoch, async inbox => { await inbox.notificationRead(id); return { read: true as const } }) }
  notificationsReadAll(input: unknown) { return this.inboxRequest(WorkBotOwner.parse(input).epoch, async inbox => { await inbox.notificationsReadAll(); return { read: true as const } }) }
  async inboxSubscribe(input: unknown) {
    const { epoch } = WorkBotOwner.parse(input), owner = this.owner(epoch)
    if (!owner.inbox) throw new CortexError("provider_unsupported", "Inbox transport is unavailable")
    const emit = (state: "changed" | "connected" | "disconnected") => { try { this.guard(owner); this.bus.publish("workInbox.changed", { epoch, state }, "remote") } catch { /* Old owner emits nothing. */ } }
    const watch = owner.inbox.watch(() => emit("changed"), () => emit("connected"), () => emit("disconnected"))
    const token = crypto.randomUUID(), sub = { owner, close: watch.close }
    this.inboxWatches.set(token, sub)
    const abort = () => { watch.close(); this.inboxWatches.delete(token) }
    owner.signal.addEventListener("abort", abort, { once: true })
    try { await watch.ready; this.guard(owner); return { subscription: token } }
    catch (error) { abort(); throw error }
  }
  inboxUnsubscribe(input: unknown) {
    const body = WorkBotOwner.extend({ subscription: WorkBotID }).strict().parse(input), owner = this.owner(body.epoch), sub = this.inboxWatches.get(body.subscription)
    if (sub && sub.owner === owner) { sub.close(); this.inboxWatches.delete(body.subscription) }
    return { closed: true as const }
  }
  private activityOwner(epoch: string, id: string) {
    WorkBotID.parse(id)
    const owner = this.owner(epoch)
    if (!owner.activity) throw new CortexError("provider_unsupported", "Activity transport is unavailable")
    return { owner, activity: owner.activity }
  }
  async activityList(id: string, input: unknown) {
    const { owner, activity } = this.activityOwner(WorkBotOwner.parse(input).epoch, id), items = await activity.list(id)
    this.guard(owner)
    return items
  }
  async activitySubscribe(id: string, input: unknown) {
    const { epoch } = WorkBotOwner.parse(input), { owner, activity } = this.activityOwner(epoch, id)
    const emit = (state: "changed" | "connected" | "disconnected") => { try { this.guard(owner); this.bus.publish("workActivity.changed", { epoch, botID: id, state }, "remote") } catch { /* Old owner emits nothing. */ } }
    const watch = activity.watch(id, () => emit("changed"), () => emit("connected"), () => emit("disconnected"))
    const token = crypto.randomUUID()
    this.inboxWatches.set(token, { owner, close: watch.close })
    const abort = () => { watch.close(); this.inboxWatches.delete(token) }
    owner.signal.addEventListener("abort", abort, { once: true })
    try { await watch.ready; this.guard(owner); return { subscription: token } }
    catch (error) { abort(); throw error }
  }
  private async routineRequest<T>(epoch: string, id: string, rid: string | undefined, action: (routines: WorkRoutinesBinding) => Promise<T>) {
    WorkBotID.parse(id)
    if (rid !== undefined) WorkBotID.parse(rid)
    const owner = this.owner(epoch)
    if (!owner.routines) throw new CortexError("provider_unsupported", "Routine transport is unavailable")
    const result = await action(owner.routines)
    this.guard(owner)
    return result
  }
  routineList(id: string, input: unknown) { return this.routineRequest(WorkBotOwner.parse(input).epoch, id, undefined, routines => routines.list(id)) }
  routineGet(id: string, rid: string, input: unknown) { return this.routineRequest(WorkBotOwner.parse(input).epoch, id, rid, routines => routines.get(id, rid)) }
  routineCreate(id: string, input: unknown) { const { epoch, routine } = WorkRoutineInput.parse(input); return this.routineRequest(epoch, id, undefined, routines => routines.create(id, routine)) }
  routineUpdate(id: string, rid: string, input: unknown) { const { epoch, routine } = WorkRoutineInput.parse(input); return this.routineRequest(epoch, id, rid, routines => routines.update(id, rid, routine)) }
  routineRemove(id: string, rid: string, input: unknown) { return this.routineRequest(WorkBotOwner.parse(input).epoch, id, rid, routines => routines.remove(id, rid)) }
  routinePause(id: string, rid: string, input: unknown) { return this.routineRequest(WorkBotOwner.parse(input).epoch, id, rid, routines => routines.pause(id, rid)) }
  routineResume(id: string, rid: string, input: unknown) { return this.routineRequest(WorkBotOwner.parse(input).epoch, id, rid, routines => routines.resume(id, rid)) }
  routineHistory(id: string, rid: string, input: unknown) { return this.routineRequest(WorkBotOwner.parse(input).epoch, id, rid, routines => routines.history(id, rid)) }
  routineEvent(input: unknown) { const { epoch, ...body } = WorkRoutineEvent.parse(input); return this.routineRequest(epoch, body.mascot_id, undefined, routines => routines.event(body)) }
  async create(input: unknown) {
    const body = WorkBotCreate.parse(input), owner = this.owner(body.epoch)
    const bot = await owner.create(body.config)
    this.guard(owner)
    return { epoch: owner.epoch, bot }
  }
  async update(id: string, input: unknown) {
    WorkBotID.parse(id)
    const body = WorkBotUpdate.parse(input), owner = this.owner(body.epoch)
    const bot = await owner.update(id, body.config)
    this.guard(owner)
    return { epoch: owner.epoch, bot }
  }
  async snapshot(id: string, input: unknown) {
    WorkBotID.parse(id)
    const { epoch } = WorkBotOwner.parse(input), owner = this.owner(epoch)
    if (this.watching?.owner !== owner) {
      this.watching?.close()
      const watch = owner.watch(botID => { if (!owner.signal.aborted) { try { this.guard(owner); this.bus.publish("workBot.changed", { botID, epoch }, "remote") } catch { /* Old account cannot publish. */ } } }, () => { if (this.watching?.ready === watch.ready) this.watching = undefined })
      this.watching = { owner, ready: watch.ready, close: watch.close }
      void watch.ready.catch(() => { if (this.watching?.ready === watch.ready) this.watching = undefined })
    }
    await this.watching?.ready
    this.guard(owner)
    const snapshot = await owner.snapshot(id)
    this.guard(owner)
    if (snapshot.bot.id !== id) throw new CortexError("provider_error", "Bot identity did not match")
    return { epoch, ...snapshot }
  }
  async enqueue(id: string, input: unknown) {
    WorkBotID.parse(id)
    const body = WorkJobCreate.parse(input), owner = this.owner(body.epoch)
    const key = `${owner.epoch}:${id}`
    if (this.pending.has(key)) throw new CortexError("session_busy", "Task admission is pending")
    const token = Symbol(); this.pending.set(key, token)
    try {
      const result = await owner.enqueue(id, { kind: body.kind, goal: body.goal })
      this.guard(owner)
      return result
    } finally { if (this.pending.get(key) === token) this.pending.delete(key) }
  }
  async parent(id: string, input: unknown) {
    WorkBotID.parse(id)
    const body = WorkBotParentInput.parse(input), owner = this.owner(body.epoch)
    const key = `${owner.epoch}:${id}`
    if (this.pending.has(key)) throw new CortexError("session_busy", "Bot admission is pending")
    const token = Symbol(); this.pending.set(key, token)
    try {
      const result = await owner.parent(id, body.text)
      this.guard(owner)
      return result
    } finally { if (this.pending.get(key) === token) this.pending.delete(key) }
  }
  async cancel(id: string, taskID: string, input: unknown) {
    WorkBotID.parse(id); WorkBotID.parse(taskID)
    const { epoch } = WorkBotOwner.parse(input), owner = this.owner(epoch)
    const result = await owner.cancel(id, taskID)
    this.guard(owner)
    if (result.id !== taskID) throw new CortexError("provider_error", "Task identity did not match")
    return result
  }
  private async copyRequest<T>(epoch: string, action: (copy: BotCopyBinding) => Promise<T>) {
    const owner = this.owner(epoch)
    if (!owner.copy) throw new CortexError("provider_unsupported", "Independent copy transport is unavailable")
    const result = await action(owner.copy)
    this.guard(owner)
    return result
  }
  copyStatus(id: string, input: unknown) {
    WorkBotID.parse(id)
    return this.copyRequest(WorkBotOwner.parse(input).epoch, copy => copy.status(id))
  }
  copyCreate(id: string, input: unknown) {
    WorkBotID.parse(id)
    const { epoch, ...body } = BotCopyCreate.parse(input)
    return this.copyRequest(epoch, copy => copy.create(id, body))
  }
  copyInvite(id: string, input: unknown) {
    WorkBotID.parse(id)
    const { epoch, email } = BotCopyInviteInput.parse(input)
    return this.copyRequest(epoch, copy => copy.invite(id, email))
  }
  copyRevoke(id: string, input: unknown) {
    WorkBotID.parse(id)
    return this.copyRequest(WorkBotOwner.parse(input).epoch, async copy => { await copy.revoke(id); return { ok: true as const } })
  }
  copyInbox(input: unknown) { return this.copyRequest(WorkBotOwner.parse(input).epoch, copy => copy.inbox()) }
  copyPreview(id: string, input: unknown) {
    WorkBotID.parse(id)
    return this.copyRequest(WorkBotOwner.parse(input).epoch, copy => copy.preview(id))
  }
  copyAccept(id: string, input: unknown) {
    WorkBotID.parse(id)
    const { epoch, ...body } = BotCopyAccept.parse(input)
    return this.copyRequest(epoch, copy => copy.accept(id, body))
  }
  copyDecline(id: string, input: unknown) {
    WorkBotID.parse(id)
    return this.copyRequest(WorkBotOwner.parse(input).epoch, copy => copy.decline(id))
  }
  private async appsRequest<T>(epoch: string, action: (apps: BotAppsBinding) => Promise<T>) {
    const owner = this.owner(epoch)
    if (!owner.apps) throw new CortexError("provider_unsupported", "App configuration transport is unavailable")
    const result = await action(owner.apps)
    this.guard(owner)
    return result
  }
  appCatalog(input: unknown) { const { epoch, q } = AppCatalogInput.parse(input); return this.appsRequest(epoch, apps => apps.catalog(q)) }
  appConnections(input: unknown) { return this.appsRequest(WorkBotOwner.parse(input).epoch, apps => apps.connections()) }
  appConnect(slug: string, input: unknown) { AppSlug.parse(slug); const { epoch, ...body } = AppConsent.parse(input); return this.appsRequest(epoch, apps => apps.connect(slug, body)) }
  appAuthorize(slug: string, input: unknown) { AppSlug.parse(slug); return this.appsRequest(WorkBotOwner.parse(input).epoch, async apps => { await apps.authorize(slug); return { ok: true as const } }) }
  appConsent(slug: string, input: unknown) { AppSlug.parse(slug); const { epoch, ...body } = AppConsent.parse(input); return this.appsRequest(epoch, apps => apps.consent(slug, body)) }
  appRevoke(slug: string, input: unknown) { AppSlug.parse(slug); return this.appsRequest(WorkBotOwner.parse(input).epoch, async apps => { await apps.revoke(slug); return { ok: true as const } }) }
  appConnectors(id: string, input: unknown) { WorkBotID.parse(id); return this.appsRequest(WorkBotOwner.parse(input).epoch, apps => apps.connectors(id)) }
  appEnable(id: string, connectionID: string, input: unknown) { WorkBotID.parse(id); ConnectionID.parse(connectionID); const { epoch, enabled } = ConnectorEnable.parse(input); return this.appsRequest(epoch, apps => apps.enable(id, connectionID, enabled)) }
  toolRules(id: string, input: unknown) { WorkBotID.parse(id); return this.appsRequest(WorkBotOwner.parse(input).epoch, apps => apps.rules(id)) }
  toolRuleSet(id: string, input: unknown) { WorkBotID.parse(id); const { epoch, ...body } = ToolRuleInput.parse(input); return this.appsRequest(epoch, apps => apps.upsert(id, body)) }
  toolRuleRemove(id: string, rid: string, input: unknown) { WorkBotID.parse(id); WorkBotID.parse(rid); return this.appsRequest(WorkBotOwner.parse(input).epoch, apps => apps.remove(id, rid)) }
  toolPolicy(id: string, input: unknown) { WorkBotID.parse(id); return this.appsRequest(WorkBotOwner.parse(input).epoch, apps => apps.policy(id)) }
  pendingApprovals(input: unknown, id?: string) { if (id) WorkBotID.parse(id); return this.appsRequest(WorkBotOwner.parse(input).epoch, apps => apps.pending(id)) }
  approvalDecide(id: string, messageID: string, input: unknown) {
    WorkBotID.parse(id); WorkBotID.parse(messageID)
    const { epoch, action } = ApprovalDecision.parse(input)
    return this.appsRequest(epoch, apps => apps.decide(id, messageID, action))
  }
  policyEvaluations(id: string, input: unknown) { WorkBotID.parse(id); return this.appsRequest(WorkBotOwner.parse(input).epoch, apps => apps.evaluations(id)) }
  close() { this.watching?.close(); this.watching = undefined; for (const watch of this.inboxWatches.values()) watch.close(); this.inboxWatches.clear(); this.pending.clear() }
}
