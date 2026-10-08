import { describe, expect, it } from "vitest"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { computerUsePreset, createCore, DEFAULT_RULES, findCuaDriver, isComputerUseInput, memoryCredentials, COMPUTER_USE_SERVER } from "../src"

describe("computer use (Cua Driver over MCP)", () => {
  it("classifies observe vs input tools", () => {
    expect(isComputerUseInput("computer-use_screenshot")).toBe(false)
    expect(isComputerUseInput("computer-use_list_windows")).toBe(false)
    expect(isComputerUseInput("computer-use_click")).toBe(true)
    expect(isComputerUseInput("computer-use_type_text")).toBe(true)
    for (const name of ["launch_app", "quit_app", "click_element", "scroll_window", "close_window", "move_window", "resize_window", "focus_app"]) {
      expect(isComputerUseInput(`computer-use_${name}`)).toBe(true)
    }
    expect(isComputerUseInput("other_click")).toBe(false)
  })

  it("finds the driver on PATH or in the app bundle", () => {
    const files = new Set(["/opt/bin/cua-driver"])
    expect(findCuaDriver({ PATH: "/usr/bin:/opt/bin" }, (p) => files.has(p))).toBe("/opt/bin/cua-driver")
    expect(findCuaDriver({ PATH: "/usr/bin" }, () => false)).toBeUndefined()
  })

  it.each(["defaults", "agent wildcard allow", "saved allow"])("asks for input despite %s", async (source) => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    try {
      const rules = [...DEFAULT_RULES]
      if (source === "agent wildcard allow") rules.push({ tool: "computer-use_*", pattern: "*", action: "allow" })
      if (source === "saved allow") {
        rules.push({ tool: "computer-use_*", pattern: "*", action: "ask" })
        core.storage.putDoc("approval", "legacy", { tool: "*", pattern: "*", action: "allow" }, "global")
      }
      const pending = core.permissions.ask({ sessionID: "s1", tool: "computer-use_click", pattern: "{}", input: {}, rules, project: "global" })
      expect(core.permissions.list()).toHaveLength(1)
      core.permissions.reply(core.permissions.list()[0]!.id, "once")
      await pending
      expect(core.permissions.list()).toHaveLength(0)
    } finally {
      await core.close()
    }
  })

  it("keeps configured input denial ahead of saved allow", async () => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    try {
      core.storage.putDoc("approval", "legacy", { tool: "*", pattern: "*", action: "allow" }, "global")
      await expect(core.permissions.ask({ sessionID: "s1", tool: "computer-use_click", pattern: "{}", input: {}, rules: [...DEFAULT_RULES, { tool: "computer-use_*", pattern: "*", action: "deny" }], project: "global" })).rejects.toMatchObject({ code: "permission_denied" })
      expect(core.permissions.list()).toHaveLength(0)
    } finally {
      await core.close()
    }
  })

  it.each(["computer-use_screenshot", "other_click"])("preserves configured and saved allow for %s", async (tool) => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    try {
      const input = { sessionID: "s1", tool, pattern: "{}", input: {}, project: "global" }
      await core.permissions.ask({ ...input, rules: DEFAULT_RULES })
      core.storage.putDoc("approval", "saved", { tool, pattern: "*", action: "allow" }, "global")
      await core.permissions.ask({ ...input, rules: [{ tool: "*", pattern: "*", action: "ask" }] })
      expect(core.permissions.list()).toHaveLength(0)
    } finally {
      await core.close()
    }
  })

  it("registers a disabled preset and never stores 'always' for input actions", async () => {
    const core = createCore({ dataDir: ":memory:", credentials: memoryCredentials() })
    await core.start({ computerUse: "/opt/bin/cua-driver" })
    const preset = core.mcp.get(COMPUTER_USE_SERVER)!
    expect(preset).toEqual({ name: COMPUTER_USE_SERVER, type: "stdio", enabled: false, status: "disabled", tools: [] })
    expect(computerUsePreset("x").enabled).toBe(false)

    // Fake driver: one input tool, one observe tool.
    const server = new McpServer({ name: "fake-cua", version: "0" })
    server.tool("click", { x: z.number(), y: z.number() }, async () => ({ content: [{ type: "text", text: "clicked" }] }))
    server.tool("screenshot", {}, async () => ({ content: [{ type: "text", text: "png" }] }))
    const [a, b] = InMemoryTransport.createLinkedPair()
    await server.connect(b)
    core.mcp.transportFactory = (cfg) => {
      expect(cfg).toMatchObject({ command: "/opt/bin/cua-driver", args: ["mcp"] })
      return a
    }
    await core.mcp.setEnabled(COMPUTER_USE_SERVER, true)
    expect(core.mcp.tools().map((t) => t.name).sort()).toEqual(["computer-use_click", "computer-use_screenshot"])

    const ask = () => core.permissions.ask({ sessionID: "s1", callID: "c", tool: "computer-use_click", pattern: "{}", input: {}, rules: DEFAULT_RULES, project: "global", signal: new AbortController().signal })
    const first = ask()
    expect(core.permissions.list()).toHaveLength(1)
    core.permissions.reply(core.permissions.list()[0]!.id, "always")
    await first
    expect(core.storage.listDocs("approval", "global")).toHaveLength(0)
    const second = ask()
    expect(core.permissions.list()).toHaveLength(1)
    core.permissions.reply(core.permissions.list()[0]!.id, "reject")
    await expect(second).rejects.toThrow()
    await core.close()
  })
})
