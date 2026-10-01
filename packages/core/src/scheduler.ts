import { newId, TaskCreateInput, TaskUpdateInput, type ScheduledTask, type TaskRun } from "@cortex/schema"
import type { Bus } from "./bus"
import { nextRun, validateSchedule } from "./cron"
import { CortexError, toErrorInfo } from "./error"
import type { SessionService } from "./session"
import type { Storage } from "./storage"

const RUN_HISTORY = 50
type Stored = Omit<ScheduledTask, "runs">

/** Process-local scheduler: tasks and run history are persisted, the timer is not. */
export class Scheduler {
  private timer?: ReturnType<typeof setInterval>
  private active = new Set<string>()
  constructor(
    private storage: Storage,
    private bus: Bus,
    private sessions: SessionService,
  ) {}

  private view(t: Stored): ScheduledTask {
    return { ...t, runs: this.storage.listDocs<TaskRun>("run", t.id).slice(0, RUN_HISTORY) }
  }
  list(filter: { botID?: string } = {}): ScheduledTask[] {
    return this.storage
      .listDocs<Stored>("task")
      .filter((t) => (filter.botID ? t.botID === filter.botID : true))
      .map((t) => this.view(t))
  }
  get(id: string): ScheduledTask {
    const t = this.storage.getDoc<Stored>("task", id)
    if (!t) throw new CortexError("not_found", `Unknown task ${id}`)
    return this.view(t)
  }
  private save(t: Stored) {
    this.storage.putDoc("task", t.id, t, undefined, t.time.created)
  }

  create(input: unknown): ScheduledTask {
    const i = TaskCreateInput.parse(input)
    if (!validateSchedule(i.schedule)) throw new CortexError("invalid_request", "Invalid schedule")
    const now = Date.now()
    const t: Stored = { id: newId("task"), ...i, nextRun: i.enabled ? nextRun(i.schedule, new Date(now)) : undefined, time: { created: now, updated: now } }
    this.save(t)
    return this.view(t)
  }
  update(id: string, input: unknown): ScheduledTask {
    const { runs: _r, ...cur } = this.get(id)
    const patch = Object.fromEntries(Object.entries(TaskUpdateInput.parse(input)).filter(([, v]) => v !== undefined))
    const t: Stored = { ...cur, ...patch, time: { ...cur.time, updated: Date.now() } }
    if (!validateSchedule(t.schedule)) throw new CortexError("invalid_request", "Invalid schedule")
    t.nextRun = t.enabled ? nextRun(t.schedule, new Date()) : undefined
    this.save(t)
    return this.view(t)
  }
  delete(id: string) {
    this.get(id)
    this.storage.deleteDocs("run", id)
    this.storage.deleteDoc("task", id)
  }

  /** Run now: creates a session and prompts it. Resolves with the finished run. */
  async run(id: string): Promise<TaskRun> {
    const task = this.get(id)
    const run: TaskRun = { id: newId("run"), taskID: id, status: "running", time: { start: Date.now() } }
    const saveRun = () => {
      this.storage.putDoc("run", run.id, run, id, run.time.start)
      this.bus.publish("task.run", { run: { ...run } })
    }
    this.active.add(id)
    try {
      const session = this.sessions.create({
        title: task.title,
        model: task.model,
        agent: task.agent,
        directory: task.directory,
        kind: task.botID ? "bot" : "chat",
        botID: task.botID,
      })
      run.sessionID = session.id
      saveRun()
      await this.sessions.promptAndWait(session.id, { parts: [{ type: "text", text: task.prompt }] })
      run.status = "success"
    } catch (err) {
      run.status = "error"
      run.error = toErrorInfo(err)
    } finally {
      this.active.delete(id)
      run.time.end = Date.now()
      saveRun()
      const cur = this.storage.getDoc<Stored>("task", id)
      if (cur) this.save({ ...cur, lastRun: run.time.start })
    }
    return run
  }

  /** Fire every due, enabled task once; occurrences missed while offline are not backfilled. */
  async tick(now = Date.now()): Promise<TaskRun[]> {
    const due = this.storage.listDocs<Stored>("task").filter((t) => t.enabled && t.nextRun !== undefined && t.nextRun <= now && !this.active.has(t.id))
    for (const t of due) this.save({ ...t, nextRun: nextRun(t.schedule, new Date(now)), enabled: t.schedule.type === "once" ? false : t.enabled })
    return Promise.all(due.map((t) => this.run(t.id)))
  }

  start(intervalMs = 30_000) {
    this.stop()
    this.timer = setInterval(() => void this.tick().catch(() => undefined), intervalMs)
    this.timer.unref?.()
  }
  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }
}
