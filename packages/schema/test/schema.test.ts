import { describe, expect, it } from "vitest"
import { Event, EVENT_TYPES, McpConfig, newId, Part, Schedule } from "../src/index"

describe("schema", () => {
  it("ids are prefixed and ascending", () => {
    const ids = Array.from({ length: 50 }, () => newId("message"))
    expect(ids.every((i) => i.startsWith("msg_"))).toBe(true)
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
})
