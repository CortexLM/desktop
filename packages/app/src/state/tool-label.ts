import type { T } from "@cortex/i18n";
import type { ToolPart } from "@cortex/schema";

export function bashOutput(t: T, p: ToolPart): string {
  const s = p.state;
  if (s.status === "error") return t("chat.err.tool_failed.body");
  if (s.status !== "completed") return "";
  const { outputLength, truncated, exit } = s.metadata ?? {};
  // ponytail: legacy/unrecognized records stay verbatim; migrate only with a verified raw-output boundary.
  if (p.tool !== "bash" || typeof outputLength !== "number" || !Number.isSafeInteger(outputLength) || outputLength < 0 || outputLength > s.output.length
    || typeof truncated !== "number" || !Number.isSafeInteger(truncated) || truncated < 0
    || !(exit === null || typeof exit === "string" || typeof exit === "number" && Number.isSafeInteger(exit))) return s.output;
  const suffix = (truncated ? `\n… [truncated ${truncated} characters]` : "") + (exit ? `\n[exit code ${exit}]` : "");
  if (s.output.slice(outputLength) !== suffix) return s.output;
  return s.output.slice(0, outputLength)
    + (truncated ? `\n… [${t("code.terminal.truncated", { count: truncated })}]` : "")
    + (exit ? `\n[${typeof exit === "number" ? t("code.terminal.exitCode", { code: exit }) : t("chat.err.tool_failed.body")}]` : "");
}

const NAMES: Record<string, string> = {
  bash: "bots.set.tool.bash", write: "bots.set.tool.write", edit: "bots.set.tool.edit", webfetch: "bots.set.tool.webfetch",
  read: "common.tool.read", list: "common.tool.list", glob: "common.tool.glob", grep: "common.tool.grep",
  todowrite: "common.tool.todowrite", task: "common.tool.task", skill: "common.tool.skill", external_directory: "common.tool.external_directory",
};

export const toolName = (t: T, id: string): string => Object.hasOwn(NAMES, id) ? t(NAMES[id]) : id;

export function toolTitle(t: T, p: ToolPart): string {
  if (p.state.status === "error") return t("chat.err.tool_failed.title");
  const input = p.state.input && typeof p.state.input === "object" ? p.state.input as Record<string, unknown> : {};
  if (p.tool === "todowrite") {
    const todos = input.todos;
    if (Array.isArray(todos) && todos.every((item: unknown) => item && typeof item === "object" && "status" in item
      && typeof item.status === "string" && ["pending", "in_progress", "completed", "cancelled"].includes(item.status))) {
      return t("common.tool.todos", { count: todos.filter((item) => item.status !== "completed").length });
    }
    return toolName(t, p.tool);
  }
  if ("title" in p.state && p.state.title) return p.state.title;
  for (const key of ["command", "path", "pattern", "url"]) if (typeof input[key] === "string" && input[key]) return input[key];
  return toolName(t, p.tool);
}
