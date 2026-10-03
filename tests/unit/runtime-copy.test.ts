import * as React from "react";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator, LOCALES, type Locale } from "@cortex/i18n";
import { nodeCatalogs } from "@cortex/i18n/node";
import type { MessageWithParts, ToolPart } from "@cortex/schema";
import { Mascot, DEFAULT_MASCOT, STATES } from "../../packages/app/src/mascot/Mascot";
import { CodeSession } from "../../packages/app/src/screens/code/code";
import { bashOutput, toolName, toolTitle } from "../../packages/app/src/state/tool-label";
import { BUILTIN_TOOLS, type ToolContext } from "../../packages/core/src/tool";
import { toModelMessages } from "../../packages/core/src/session";

const view = vi.hoisted(() => ({ locale: "en" as Locale, terminal: false, changes: "", terminalLabel: "", parts: [] as ToolPart[] }));
const catalogs = nodeCatalogs(new URL("../../packages/i18n/locales", import.meta.url).pathname);

vi.mock("../../packages/app/src/i18n", async () => {
  const { createTranslator } = await import("@cortex/i18n");
  const { nodeCatalogs } = await import("@cortex/i18n/node");
  const load = nodeCatalogs(new URL("../../packages/i18n/locales", import.meta.url).pathname);
  return { useT: () => createTranslator(view.locale, load), useI18n: () => ({ t: createTranslator(view.locale, load), locale: view.locale }) };
});
vi.mock("../../packages/app/src/api", () => ({ api: {} }));
vi.mock("../../packages/app/src/preview", () => ({ isPreview: () => false, useFixtures: () => ({}) }));
vi.mock("../../packages/app/src/shell/nav", () => ({ useNav: () => ({ params: new URLSearchParams("id=session"), go: vi.fn() }) }));
vi.mock("../../packages/app/src/kit/ui", async (original) => ({
  ...await original<typeof import("../../packages/app/src/kit/ui")>(), useToast: () => ({ add: vi.fn() }),
}));
vi.mock("../../packages/app/src/state/live", () => ({
  useQuery: (_load: unknown, [key]: unknown[]) => ({ state: "ready", data: key === "session" ? { title: "User task", model: { providerID: "fake", modelID: "reasoner" } } : [] }),
  useMessages: () => ({ status: "idle", msgs: [{ info: { id: "message", role: "assistant" }, parts: view.parts }] }),
  usePermissions: () => ({ state: "ready", data: [] }),
}));
// Render the actual terminal branch without a DOM or a second component just for tests.
vi.mock("react", async (original) => {
  const actual = await original<typeof React>();
  return { ...actual, useState(initial: unknown) {
    const pair = actual.useState(initial);
    return view.terminal && initial === view.changes ? [view.terminalLabel, pair[1]] : pair;
  } };
});

const part = (tool: string, state: ToolPart["state"]): ToolPart => ({ id: tool, callID: tool, sessionID: "session", messageID: "message", type: "tool", tool, state });
const todos = part("todowrite", { status: "completed", input: { todos: [{ status: "pending" }, { status: "completed" }] }, title: "1 todos", output: "[]", time: { start: 0, end: 1 } });
const failed = part("bash", { status: "error", input: { command: "pwd" }, error: "PRIVATE_ENGINE_ERROR: Tool execution was interrupted", time: { start: 0, end: 1 } });
const shell = (output: string, metadata?: Record<string, unknown>) => part("bash", { status: "completed", input: { command: "fixture" }, output, metadata, time: { start: 0, end: 1 } });

// ponytail: static markup only reads preferences; add storage writes for interaction tests.
beforeEach(() => { vi.stubGlobal("localStorage", { getItem: () => null }); });
afterEach(() => { view.terminal = false; view.parts = []; vi.unstubAllGlobals(); });

describe("runtime copy", () => {
  it("keeps real shell output and model replay exact while recording the raw boundary", async () => {
    const directory = mkdtempSync(join(tmpdir(), "cortex-terminal-copy-"));
    const command = `"${process.execPath}" "${join(directory, "output.cjs")}"`;
    const ask = vi.fn(async () => {});
    const ctx: ToolContext = { sessionID: "session", messageID: "message", callID: "bash", directory, signal: new AbortController().signal, ask,
      services: { runSubagent: async () => { throw new Error("Unused"); }, loadSkill: async () => undefined, todos: { get: () => [], set: () => {} }, fetch } };
    try {
      for (const [stdout, stderr, exit, kept, omitted] of [
        ["", "", 7, 0, 0], ["X".repeat(49999), "", 0, 49999, 0], ["X".repeat(50000), "", 0, 50000, 0],
        ["X".repeat(50001), "", 0, 50000, 1],
        ["[exit code 7]\n… [truncated 9 characters]\r\n<&é🚀>", "stderr\r\n", 7, 56, 0],
        ["é".repeat(49999) + "🚀", "err", 7, 50000, 4],
      ] as const) {
        writeFileSync(join(directory, "output.cjs"), `require("node:fs").writeSync(1, ${JSON.stringify(stdout)}); require("node:fs").writeSync(2, ${JSON.stringify(stderr)}); process.exitCode = ${exit};`);
        ask.mockClear();
        const result = await BUILTIN_TOOLS.find((tool) => tool.name === "bash")!.execute({ command }, ctx);
        const expected = (stdout + stderr).slice(0, kept) + (omitted ? `\n… [truncated ${omitted} characters]` : "") + (exit ? `\n[exit code ${exit}]` : "");
        expect(result.output).toBe(expected);
        expect(result.metadata).toEqual({ exit, outputLength: kept, truncated: omitted });
        expect(ask).toHaveBeenCalledExactlyOnceWith(command, { command });
        const history = (metadata: Record<string, unknown> | undefined) => [{ info: { role: "assistant" }, parts: [shell(result.output, metadata)] }] as MessageWithParts[];
        for (const tools of [true, false]) expect(toModelMessages(history(result.metadata), tools)).toEqual(toModelMessages(history({ exit }), tools));
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });

  it.each(LOCALES)("localizes only verified terminal suffixes; preserves legacy and lookalikes in %s", (locale) => {
    const t = createTranslator(locale, catalogs);
    view.locale = locale; view.changes = t("code.session.changes"); view.terminalLabel = t("code.session.terminal"); view.terminal = true;
    const raw = "[exit code 7]\n… [truncated 9 characters]\r\n<&é🚀>\tstderr";
    for (const count of [0, 1, 2]) {
      const output = raw + (count ? `\n… [truncated ${count} characters]` : "") + "\n[exit code 7]";
      const fresh = shell(output, { outputLength: raw.length, truncated: count, exit: 7 });
      const localized = raw + (count ? `\n… [${t("code.terminal.truncated", { count })}]` : "") + `\n[${t("code.terminal.exitCode", { code: 7 })}]`;
      expect(localized).not.toContain("code.terminal.");
      for (const [p, expected] of [[fresh, localized], [shell(output, { exit: 7 }), output], [shell(raw, { outputLength: raw.length, truncated: 0, exit: 0 }), raw]] as const) {
        expect(bashOutput(t, p)).toBe(expected);
        view.parts = [JSON.parse(JSON.stringify(p))];
        const html = renderToStaticMarkup(React.createElement(CodeSession));
        expect(html).toContain(renderToStaticMarkup(React.createElement("pre", { className: "term" }, `$ fixture\n${expected}`)));
      }
    }
  });

  it("preserves unverified output and masks symbolic Cortex exit annotations", () => {
    const t = createTranslator("fr", catalogs), raw = "USER\n[exit code 7]", output = raw + "\n… [truncated 1 characters]\n[exit code 7]";
    const metadata = { outputLength: raw.length, truncated: 1, exit: 7 };
    for (const bad of [undefined, { exit: 7 }, ...[
      { outputLength: -1 }, { outputLength: 0 }, { outputLength: output.length + 1 }, { outputLength: 1.5 }, { outputLength: "4" },
      { truncated: -1 }, { truncated: false }, { truncated: 1.5 }, { exit: {} }, { exit: 2.5 },
    ].map((patch) => ({ ...metadata, ...patch }))]) expect(bashOutput(t, shell(output, bad))).toBe(output);
    expect(bashOutput(t, shell(output + "USER TAIL", metadata))).toBe(output + "USER TAIL");
    expect(bashOutput(t, { ...shell(output, metadata), tool: "extension_tool" })).toBe(output);
    expect(bashOutput(t, shell(raw, { outputLength: raw.length, truncated: 0, exit: null }))).toBe(raw);
    expect(bashOutput(t, shell(raw + "\n[exit code PRIVATE_ERROR]", { outputLength: raw.length, truncated: 0, exit: "PRIVATE_ERROR" }))).toBe(raw + `\n[${t("chat.err.tool_failed.body")}]`);
    expect(bashOutput(t, failed)).toBe(t("chat.err.tool_failed.body"));
    expect(bashOutput(t, part("bash", { status: "pending" }))).toBe("");
  });

  it.each(LOCALES)("renders translated mascot accessibility in %s", (locale) => {
    view.locale = locale;
    const t = createTranslator(locale, catalogs);
    for (const { id, label } of STATES) {
      const html = renderToStaticMarkup(React.createElement(Mascot, { cfg: { ...DEFAULT_MASCOT, name: "Nova" }, state: id }));
      expect(html).toContain(`aria-label="${t("common.mascotLabel", { name: "Nova", state: t(label) })}"`);
      expect(html).not.toContain("mascot.state.");
    }
    const explicit = renderToStaticMarkup(React.createElement(Mascot, { cfg: { ...DEFAULT_MASCOT, name: "Nova" }, title: "User title" }));
    expect(explicit).toContain('aria-label="User title"');
  });

  it.each(LOCALES)("localizes built-in tool metadata while preserving data in %s", (locale) => {
    const t = createTranslator(locale, catalogs);
    for (const id of ["read", "write", "edit", "list", "glob", "grep", "bash", "webfetch", "todowrite", "task", "skill", "external_directory"]) {
      expect(toolName(t, id)).not.toBe(id);
      expect(toolName(t, id)).not.toMatch(/^(common|bots)\./);
    }
    expect(toolName(t, "My plugin tool")).toBe("My plugin tool");
    expect(toolName(t, "toString")).toBe("toString");
    expect(toolTitle(t, todos)).toBe(t("common.tool.todos", { count: 1 }));
    expect(toolTitle(t, part("todowrite", { status: "running", input: { todos: [{ status: "pending" }, { status: "in_progress" }] }, time: { start: 0 } }))).toBe(t("common.tool.todos", { count: 2 }));
    expect(toolTitle(t, part("todowrite", { status: "pending", input: { todos: [null] } }))).toBe(toolName(t, "todowrite"));
    expect(toolTitle(t, part("read", { status: "running", input: { path: "notes.md" }, time: { start: 0 } }))).toBe("notes.md");
    expect(toolTitle(t, part("bash", { status: "running", input: { command: "git status" }, time: { start: 0 } }))).toBe("git status");
    expect(toolTitle(t, failed)).toBe(t("chat.err.tool_failed.title"));
  });

  it.each(LOCALES)("renders Code tool titles and excludes raw tool errors in %s", (locale) => {
    view.locale = locale;
    view.parts = [todos, failed];
    const t = createTranslator(locale, catalogs);
    view.changes = t("code.session.changes");
    view.terminalLabel = t("code.session.terminal");
    for (const terminal of [false, true]) {
      view.terminal = terminal;
      const html = renderToStaticMarkup(React.createElement(CodeSession));
      expect(html).toContain(t("common.tool.todos", { count: 1 }));
      expect(html).toContain(t("chat.err.tool_failed.title"));
      expect(html).not.toContain("1 todos");
      expect(html).not.toContain(failed.state.status === "error" ? failed.state.error : "PRIVATE_ENGINE_ERROR");
      if (terminal) {
        expect(html).toContain("$ pwd");
        expect(html).toContain(t("chat.err.tool_failed.body"));
      }
    }
  });
});
