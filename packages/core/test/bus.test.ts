import { expect, it } from "vitest"
import { Event, type Message, type Session, type TextPart } from "@cortex/schema"
import { Bus, createCore, memoryCredentials, Storage } from "../src/index"

const session: Session = {
  id: "remote-session", title: "Remote conversation", kind: "chat", agent: "build",
  model: { providerID: "test", modelID: "test" }, time: { created: 1, updated: 1 },
}
const message: Message = {
  id: "remote-message", sessionID: session.id, role: "assistant", model: session.model,
  time: { created: 1 }, usage: { input: 0, output: 0, reasoning: 0, cost: 0 },
}
const part: TextPart = {
  id: "remote-part", sessionID: session.id, messageID: message.id, type: "text", text: "Remote response",
}
const remoteEvents: Event[] = [
  { type: "session.created", properties: { session } },
  { type: "session.updated", properties: { session: { ...session, title: "Renamed remote conversation" } } },
  { type: "message.updated", properties: { message } },
  { type: "part.updated", properties: { part } },
  { type: "part.delta", properties: { sessionID: session.id, messageID: message.id, partID: part.id, field: "text", delta: " more remote text" } },
  { type: "session.status", properties: { sessionID: session.id, status: { type: "busy" } } },
  { type: "session.deleted", properties: { sessionID: session.id } },
]

it("delivers remote events live without journaling, projecting or notifying plugins; local CRUD still works", async () => {
  const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
  try {
    const live: Event[] = [], pluginEvents: Event[] = [], sources: string[] = [], deltaSources: string[] = []
    const rowCounts = () => ["event", "session", "message", "part"].map((table) =>
      (core.storage.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n)
    const rowsAtDelivery: number[][] = [], rowsAtPlugin: number[][] = []
    core.plugins.register("event-observer", { event: (e) => { pluginEvents.push(e); rowsAtPlugin.push(rowCounts()) } })
    core.bus.subscribe((e) => { live.push(e); rowsAtDelivery.push(rowCounts()) })
    core.bus.subscribe((_e, source) => { sources.push(source) })
    core.bus.on("part.delta", (_e, source) => { deltaSources.push(source) })

    const safeEvents = remoteEvents.map((e) => Event.parse(e))
    for (const safeEvent of safeEvents) core.bus.publish(safeEvent.type, safeEvent.properties, "remote")
    await Promise.resolve()
    expect(live).toEqual(safeEvents)
    expect(JSON.parse(JSON.stringify(live))).toEqual(safeEvents)
    expect.soft(rowsAtDelivery).toEqual(safeEvents.map(() => [0, 0, 0, 0]))
    expect.soft(rowCounts()).toEqual([0, 0, 0, 0])
    expect.soft(pluginEvents).toEqual([])
    expect.soft(sources).toEqual(Array(7).fill("remote"))
    expect.soft(deltaSources).toEqual(["remote"])

    const local = core.sessions.create({ title: "Local conversation", model: session.model })
    const updated = core.sessions.update(local.id, { title: "Renamed local conversation" })
    const localMessage = { ...message, id: "local-message", sessionID: local.id }
    const localPart = { ...part, id: "local-part", sessionID: local.id, messageID: localMessage.id, text: "Local response" }
    const localDelta = { sessionID: local.id, messageID: localMessage.id, partID: localPart.id, field: "text" as const, delta: " more local text" }
    core.bus.publish("message.updated", { message: localMessage })
    core.bus.publish("part.updated", { part: localPart })
    core.bus.publish("part.delta", localDelta, "local")
    core.bus.publish("session.status", { sessionID: local.id, status: { type: "busy" } })
    expect(core.sessions.get(local.id)).toEqual(updated)
    expect(core.sessions.messages(local.id)).toEqual([{ info: localMessage, parts: [localPart] }])
    await core.sessions.delete(local.id)
    expect(core.sessions.list()).toEqual([])
    expect(core.storage.messages(local.id)).toEqual([])

    const localEvents: Event[] = [
      { type: "session.created", properties: { session: local } },
      { type: "session.updated", properties: { session: updated } },
      { type: "message.updated", properties: { message: localMessage } },
      { type: "part.updated", properties: { part: localPart } },
      { type: "part.delta", properties: localDelta },
      { type: "session.status", properties: { sessionID: local.id, status: { type: "busy" } } },
      { type: "session.deleted", properties: { sessionID: local.id } },
    ]
    expect(live).toEqual([...safeEvents, ...localEvents])
    expect.soft(pluginEvents).toEqual(localEvents)
    expect.soft(sources).toEqual([...Array(7).fill("remote"), ...Array(7).fill("local")])
    expect.soft(deltaSources).toEqual(["remote", "local"])
    const localCounts = [[1, 1, 0, 0], [2, 1, 0, 0], [3, 1, 1, 0], [4, 1, 1, 1], [4, 1, 1, 1], [4, 1, 1, 1], [5, 0, 0, 0]]
    expect.soft(rowsAtDelivery.slice(7)).toEqual(localCounts)
    expect.soft(rowsAtPlugin).toEqual(localCounts)
    expect(core.storage.events(local.id)).toEqual(localEvents.filter((e) => e.type !== "part.delta" && e.type !== "session.status")
      .map((e, i) => ({ seq: i + 1, type: e.type, data: JSON.parse(JSON.stringify(e.properties)) })))
    expect.soft(core.storage.events(session.id)).toEqual([])
    expect.soft(rowCounts()).toEqual([5, 0, 0, 0])
  } finally {
    await core.close()
  }
})

it("isolates listener faults and snapshots publisher data after committing default-local events", () => {
  const storage = new Storage(":memory:")
  try {
    const bus = new Bus(storage)
    const properties = { session: structuredClone(session) }
    const expected = structuredClone(properties)
    const live: Event[] = [], committed: (Session | undefined)[] = []
    let faults = 0
    bus.subscribe(() => { faults++; throw new Error("Faulty listener") })
    const unsubscribe = bus.subscribe((e) => { live.push(e); committed.push(storage.session(session.id)) })
    expect(() => bus.publish("session.created", properties)).not.toThrow()
    properties.session.title = "Changed after publish"
    properties.session.model.modelID = "changed"
    properties.session.time.updated = 99
    expect(live).toEqual([{ type: "session.created", properties: expected }])
    expect(committed).toEqual([expected.session])
    expect(storage.session(session.id)).toEqual(expected.session)
    expect(storage.events(session.id)).toEqual([{ seq: 1, type: "session.created", data: expected }])
    unsubscribe()
    expect(() => bus.publish("session.deleted", { sessionID: session.id })).not.toThrow()
    expect(faults).toBe(2)
    expect(live).toHaveLength(1)
    expect(storage.session(session.id)).toBeUndefined()
  } finally {
    storage.close()
  }
})
