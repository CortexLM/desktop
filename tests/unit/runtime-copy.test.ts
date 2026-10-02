import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator, LOCALES, type Locale } from "@cortex/i18n";
import { nodeCatalogs } from "@cortex/i18n/node";
import type { ToolPart } from "@cortex/schema";
import { Mascot, DEFAULT_MASCOT, STATES } from "../../packages/app/src/mascot/Mascot";
import { CodeSession } from "../../packages/app/src/screens/code/code";
import { toolName, toolTitle } from "../../packages/app/src/state/tool-label";

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

// ponytail: static markup only reads preferences; add storage writes for interaction tests.
beforeEach(() => { vi.stubGlobal("localStorage", { getItem: () => null }); });
afterEach(() => { view.terminal = false; view.parts = []; vi.unstubAllGlobals(); });

describe("runtime copy", () => {
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
