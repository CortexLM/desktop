import { expect, it, vi } from "vitest";

// The parser is pure; the renderer modules it shares a file with only need a window to load in node.
vi.stubGlobal("window", { navigation: new EventTarget() });
vi.stubGlobal("location", new URL("cortex://app/"));
const { approvalSummary } = await import("./bot-pending");

const sealed = (reason: string, action: object) =>
  `Allow bash?\n${reason}\n${JSON.stringify(action, null, 2)}\nAlways grants this tool for this Bot until its approval rule is removed.`;

it("summarizes the action command", () => {
  expect(approvalSummary(sealed("Runs a build", { command: "bun run build" })).summary).toBe("bun run build");
});

it("keeps the command summary when the reason contains braces", () => {
  expect(approvalSummary(sealed("Expands ${HOME} and {a,b} globs", { command: "ls {a,b}" })).summary).toBe("ls {a,b}");
});
