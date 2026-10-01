import { describe, expect, it } from "vitest"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { computerUsePreset, createCore, findCuaDriver, isComputerUseInput, memoryCredentials, COMPUTER_USE_SERVER } from "../src"

describe("computer use (Cua Driver over MCP)", () => {
  it("classifies observe vs input tools", () => {
    expect(isComputerUseInput("computer-use_screenshot")).toBe(false)
    expect(isComputerUseInput("computer-use_list_windows")).toBe(false)
    expect(isComputerUseInput("computer-use_click")).toBe(true)
    expect(isComputerUseInput("computer-use_type_text")).toBe(true)
    expect(isComputerUseInput("other_click")).toBe(false)
  })

  it("finds the driver on PATH or in the app bundle", () => {
    const files = new Set(["/opt/bin/cua-driver"])
    expect(findCuaDriver({ PATH: "/usr/bin:/opt/bin" }, (p) => files.has(p))).toBe("/opt/bin/cua-driver")
    expect(findCuaDriver({ PATH: "/usr/bin" }, () => false)).toBeUndefined()
  })

  it("registers a disabled preset and never stores 'always' for input actions", async () => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    await core.start({ computerUse: "/opt/bin/cua-driver" })
    const preset = core.mcp.get(COMPUTER_USE_SERVER)!
    expect(preset).toMatchObject({ type: "stdio", command: "/opt/bin/cua-driver", args: ["mcp"], enabled: false, status: "disabled" })
    expect(computerUsePreset("x").enabled).toBe(false)

    // Fake driver: one input tool, one observe tool.
    const server = new McpServer({ name: "fake-cua", version: "0" })
    server.tool("click", { x: z.number(), y: z.number() }, async () => ({ content: [{ type: "text", text: "clicked" }] }))
    server.tool("screenshot", {}, async () => ({ content: [{ type: "text", text: "png" }] }))
    const [a, b] = InMemoryTransport.createLinkedPair()
    await server.connect(b)
    core.mcp.transportFactory = () => a
    await core.mcp.setEnabled(COMPUTER_USE_SERVER, true)
    expect(core.mcp.tools().map((t) => t.name).sort()).toEqual(["computer-use_click", "computer-use_screenshot"])

    const ask = () => core.permissions.ask({ sessionID: "s1", callID: "c", tool: "computer-use_click", pattern: "{}", input: {}, rules: [], project: "global", signal: new AbortController().signal })
    const first = ask()
    await new Promise((r) => setTimeout(r, 0))
    core.permissions.reply(core.permissions.list()[0]!.id, "always")
    await first
    const second = ask()
    await new Promise((r) => setTimeout(r, 0))
    expect(core.permissions.list()).toHaveLength(1)
    core.permissions.reply(core.permissions.list()[0]!.id, "reject")
    await expect(second).rejects.toThrow()
    await core.close()
  })
})
