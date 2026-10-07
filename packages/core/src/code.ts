import { ChatFeatureCall, type ChatFeatureResult, ContractCall, type ContractResult, CodeCreateInput, CodePromptInput, CodeSnapshot, CodeOwner, CodeDecisionInput, CodeSessionPatch, CodeSettingsInput, CodeInstructionsInput, CodeReviewInput, CodeLocalInstructionsInput, CodeBranchesInput, type CodeReviewView, type CodeRepositoriesView, type CodeBranchesView, type CodeEnvironmentView, type CodeFileView, type CodeSessionView, type CodeSettingsView, type CodeUsageView, type RemoteModel } from "@cortex/schema"
import { lstat, readFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
import { CortexError } from "./error"
import type { Bus } from "./bus"
import type { ConnectionService } from "./connection"

export interface CodeBinding {
  readonly epoch: string
  readonly accountID?: string
  readonly signal: AbortSignal
  models(): Promise<RemoteModel[]>
  cloud(): Promise<{ available: boolean; reason?: "code_compute_not_configured" }>
  list(): Promise<CodeSessionView[]>
  create(input: CodeCreateInput): Promise<CodeSessionView>
  snapshot(id: string): Promise<CodeSnapshot>
  turn(id: string, message: string, admitted: () => void, changed: () => void): { done: Promise<void>; detach(): void }
  watch(id: string, changed: () => void): { ready: Promise<void>; close(): void }
  decide(id: string, permissionID: string, decision: "allow" | "deny"): Promise<void>
  stop(id: string): Promise<void>
  environment(): Promise<CodeEnvironmentView>
  usage(): Promise<CodeUsageView>
  repositories(): Promise<CodeRepositoriesView>
  branches(repo: string): Promise<CodeBranchesView>
  settings(): Promise<CodeSettingsView>
  setDefaultModel(ref: string): Promise<void>
  prepare(id: string, input: Omit<CodeSessionPatch, "epoch">): Promise<CodeSessionView>
  instructions(id: string): Promise<CodeFileView>
  review(id: string, path: string, decision: "approve" | "reject"): Promise<CodeReviewView>
  contract?(input: ContractCall): Promise<ContractResult>
  chatFeature?(input: ChatFeatureCall): Promise<ChatFeatureResult>
}
export interface CodeHost { bindCode(origin: string): CodeBinding }
type RecordState = { owner: CodeBinding; view: CodeSessionView; admission?: symbol; stopping?: boolean; delivery?: ReturnType<CodeBinding["turn"]>; watch?: ReturnType<CodeBinding["watch"]> }
const refused = () => new CortexError("provider_error", "Code could not complete this request")

/** Backend owns execution and durable parent receipts. No local executor or credentials here. */
export class CodeService {
  private owner?: CodeBinding
  private records = new Map<string, RecordState>()
  constructor(private bus: Bus, private connection: ConnectionService, private host?: CodeHost) {}
  private binding(): CodeBinding {
    if (!this.host) throw new CortexError("provider_unsupported", "Code transport is unavailable")
    const owner = this.host.bindCode(this.connection.remoteOrigin())
    owner.signal.throwIfAborted()
    if (owner !== this.owner) {
      this.close()
      this.owner = owner
      owner.signal.addEventListener("abort", () => { if (this.owner === owner) this.close() }, { once: true })
    }
    return owner
  }
  private guard(owner: CodeBinding) {
    if (this.binding() !== owner || owner.signal.aborted) throw new CortexError("aborted", "Code account changed")
  }
  private record(id: string, epoch: string): RecordState {
    const owner = this.binding()
    if (owner.epoch !== epoch) throw new CortexError("aborted", "Code owner changed")
    let record = this.records.get(id)
    if (!record) {
      record = { owner, view: { id, epoch, runtime: "local", modelSlug: "", title: "", state: "waiting", delivery: "history_required" } }
      this.records.set(id, record)
    }
    return record
  }
  private changed(record: RecordState) {
    this.guard(record.owner)
    this.bus.publish("code.session.changed", { sessionID: record.view.id, epoch: record.owner.epoch }, "remote")
  }
  async models() {
    const owner = this.binding(), models = await owner.models()
    this.guard(owner)
    return { epoch: owner.epoch, models: models.filter(m => m.tools === true) }
  }
  async capabilities() {
    const owner = this.binding(), cloud = await owner.cloud()
    this.guard(owner)
    return { epoch: owner.epoch, cloud }
  }
  async list() {
    const owner = this.binding(), rows = await owner.list()
    this.guard(owner)
    return rows
  }
  async create(input: unknown) {
    const body = CodeCreateInput.parse(input), owner = this.binding()
    if (owner.epoch !== body.epoch) throw new CortexError("aborted", "Code owner changed")
    const view = await owner.create(body)
    this.guard(owner)
    const record: RecordState = { owner, view }
    this.records.set(view.id, record)
    this.changed(record)
    return view
  }
  async snapshot(id: string, input: unknown) {
    const { epoch } = CodeOwner.parse(input), record = this.record(id, epoch)
    if (!record.watch) {
      const watch = record.owner.watch(id, () => { try { this.changed(record) } catch { /* Replaced owners cannot publish. */ } })
      record.watch = watch
      void watch.ready.catch(() => {
        if (this.owner === record.owner && !record.owner.signal.aborted && record.watch === watch) { record.watch = undefined; record.view.errorCode = "provider_error"; this.changed(record) }
      })
      this.guard(record.owner)
    }
    const snapshot = CodeSnapshot.parse(await record.owner.snapshot(id))
    this.guard(record.owner)
    snapshot.session.delivery = record.view.delivery === "history_required" && !snapshot.permissions.some(p => !p.decision) && !["running", "permission_blocked"].includes(snapshot.session.state) ? "settled" : record.view.delivery
    snapshot.session.errorCode = record.view.errorCode
    record.view = snapshot.session
    return snapshot
  }
  async prompt(id: string, input: unknown) {
    const body = CodePromptInput.parse(input), record = this.record(id, body.epoch)
    if (record.delivery || record.admission || record.stopping) throw new CortexError("session_busy", "Code is running")
    const admission = Symbol()
    record.admission = admission
    try { await this.snapshot(id, { epoch: body.epoch }) }
    catch (error) { if (record.admission === admission) record.admission = undefined; throw error }
    this.guard(record.owner)
    if (record.admission !== admission) throw new CortexError("aborted", "Code admission stopped")
    record.view.delivery = "admitting"
    record.view.errorCode = undefined
    let accepted = false
    let resolveAdmission!: () => void, rejectAdmission!: (error: unknown) => void
    const admitted = new Promise<void>((resolve, reject) => { resolveAdmission = resolve; rejectAdmission = reject })
    const delivery = record.owner.turn(id, body.message, () => {
      this.guard(record.owner)
      if (record.admission !== admission) { rejectAdmission(new CortexError("aborted", "Code admission stopped")); return }
      accepted = true
      record.view.delivery = "streaming"
      resolveAdmission()
      this.changed(record)
    }, () => { try { this.changed(record) } catch { /* Detached owner. */ } })
    record.delivery = delivery
    void delivery.done.then(() => {
      if (this.owner !== record.owner || record.owner.signal.aborted || record.delivery !== delivery) { rejectAdmission(refused()); return }
      record.view.delivery = "settled"
      this.changed(record)
    }, () => {
      try {
        this.guard(record.owner)
        if (record.delivery !== delivery) { rejectAdmission(refused()); return }
        record.view.delivery = accepted ? "history_required" : "ready"
        record.view.errorCode = "provider_error"
        rejectAdmission(refused())
        this.changed(record)
      } catch { rejectAdmission(refused()) }
    }).finally(() => { if (record.delivery === delivery) record.delivery = undefined; if (record.admission === admission) record.admission = undefined })
    await admitted
    this.guard(record.owner)
    return record.view
  }
  async decide(id: string, permissionID: string, input: unknown) {
    const body = CodeDecisionInput.parse(input), record = this.record(id, body.epoch)
    await record.owner.decide(id, permissionID, body.decision)
    this.guard(record.owner)
    this.changed(record)
  }
  async stop(id: string, input: unknown) {
    const { epoch } = CodeOwner.parse(input), record = this.record(id, epoch)
    record.admission = undefined
    record.stopping = true
    try { await record.owner.stop(id) }
    finally { record.stopping = false }
    this.guard(record.owner)
    record.delivery?.detach()
    record.delivery = undefined
    record.view.delivery = "history_required"
    this.changed(record)
  }
  // Owner-fenced producer reads/writes outside a turn. An owner change while in flight refuses the result.
  private async owned<T>(epoch: string, run: (owner: CodeBinding) => Promise<T>): Promise<T> {
    const owner = this.binding()
    if (owner.epoch !== epoch) throw new CortexError("aborted", "Code owner changed")
    const result = await run(owner)
    this.guard(owner)
    return result
  }
  async contract(input: unknown) {
    const call = ContractCall.parse(input)
    return this.owned(call.epoch, owner => { if (!owner.contract) throw new CortexError("provider_unsupported", "Remote contracts are unavailable"); return owner.contract(call) })
  }
  async chatFeature(input: unknown) {
    const call = ChatFeatureCall.parse(input)
    return this.owned(call.epoch, owner => { if (!owner.chatFeature) throw new CortexError("provider_unsupported", "Remote chat features are unavailable"); return owner.chatFeature(call) })
  }
  async environment(input: unknown) { return this.owned(CodeOwner.parse(input).epoch, owner => owner.environment()) }
  async usage(input: unknown) { return this.owned(CodeOwner.parse(input).epoch, owner => owner.usage()) }
  async repositories(input: unknown) { return this.owned(CodeOwner.parse(input).epoch, owner => owner.repositories()) }
  async branches(input: unknown) { const { epoch, repo } = CodeBranchesInput.parse(input); return this.owned(epoch, owner => owner.branches(repo)) }
  async settings(input: unknown) { return this.owned(CodeOwner.parse(input).epoch, owner => owner.settings()) }
  async setDefaultModel(input: unknown) {
    const { epoch, defaultModel } = CodeSettingsInput.parse(input)
    await this.owned(epoch, owner => owner.setDefaultModel(defaultModel))
    return this.settings({ epoch })
  }
  async prepare(id: string, input: unknown) {
    const { epoch, ...patch } = CodeSessionPatch.parse(input), record = this.record(id, epoch)
    const view = await this.owned(epoch, owner => owner.prepare(id, patch))
    record.view = { ...record.view, ...view, delivery: record.view.delivery, errorCode: record.view.errorCode }
    this.changed(record)
    return view
  }
  async instructions(id: string, input: unknown) { return this.owned(CodeInstructionsInput.parse(input).epoch, owner => owner.instructions(id)) }
  /** Reads `<dir>/AGENTS.md` on this computer: absolute folder, regular file only (no symlink), 256 KiB cap. */
  async localInstructions(input: unknown): Promise<CodeFileView> {
    const { dir } = CodeLocalInstructionsInput.parse(input)
    if (!isAbsolute(dir)) throw new CortexError("invalid_request", "Choose a repository folder")
    const file = join(dir, "AGENTS.md")
    const info = await lstat(file).catch(() => undefined)
    if (!info) return { state: "missing" }
    if (!info.isFile() || info.size > 262144) throw new CortexError("invalid_request", "AGENTS.md must be a regular file of at most 256 KiB")
    return { state: "ready", path: "AGENTS.md", content: await readFile(file, "utf8") }
  }
  async review(id: string, input: unknown) {
    const { epoch, path, decision } = CodeReviewInput.parse(input), record = this.record(id, epoch)
    const view = await this.owned(epoch, owner => owner.review(id, path, decision))
    this.changed(record)
    return view
  }
  close() {
    for (const record of this.records.values()) { record.delivery?.detach(); record.watch?.close() }
    this.records.clear()
    this.owner = undefined
  }
}
