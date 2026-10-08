import { afterEach, describe, expect, it, vi } from "vitest"
import { BotUpdateInput, Event, EVENT_TYPES, McpConfig, newId, Part, Schedule, TaskUpdateInput } from "../src/index"

describe("schema", () => {
  afterEach(() => vi.restoreAllMocks())

  it("ids stay unique, prefixed and ascending without Math.random", () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.now())
    vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Insecure randomness is disabled") })
    const ids = Array.from({ length: 50 }, () => newId("message"))
    expect(ids.every((i) => /^msg_[0-9a-f]{32}$/.test(i))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(ids)
  })
  it("parses events and parts", () => {
    expect(Event.parse({ type: "part.delta", properties: { sessionID: "s", messageID: "m", partID: "p", field: "reasoning", delta: "x" } }).type).toBe("part.delta")
    expect(() => Event.parse({ type: "part.delta", properties: { field: "other" } })).toThrow()
    expect(Part.parse({ id: "p", sessionID: "s", messageID: "m", type: "tool", callID: "c", tool: "read", state: { status: "pending" } }).type).toBe("tool")
    expect(EVENT_TYPES).toContain("permission.asked")
  })
  it("validates mcp configs and schedules", () => {
    expect(McpConfig.parse({ name: "fs", type: "stdio", command: "npx" })).toMatchObject({ args: [], enabled: true })
    expect(() => McpConfig.parse({ name: "bad name", type: "remote", url: "https://x.test" })).toThrow()
    expect(() => Schedule.parse({ type: "daily", time: "9am" })).toThrow()
  })
  it("leaves omitted Bot and task PATCH fields omitted", () => {
    expect(BotUpdateInput.parse({ name: "Renamed" })).toEqual({ name: "Renamed" })
    expect(TaskUpdateInput.parse({ title: "Renamed" })).toEqual({ title: "Renamed" })
  })
})
