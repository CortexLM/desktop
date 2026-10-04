import type { Agent } from "@cortex/schema"
import { wildcard } from "./permission"

const READ_ONLY = ["read", "list", "glob", "grep", "webfetch", "todowrite", "skill"]

export const AGENTS: Agent[] = [
  {
    name: "build",
    description: "Default agent with full tool access.",
    mode: "primary",
    prompt: "You are Cortex, a capable assistant and coding agent. Use the available tools when they help; be concise and accurate.",
    tools: {},
    permission: [],
  },
  {
    name: "plan",
    description: "Read-only planning agent; cannot modify files or run commands.",
    mode: "primary",
    prompt: "You are Cortex in planning mode. Analyse and propose a plan. You must not modify files or run commands.",
    tools: { allow: [...READ_ONLY, "task"] },
    permission: [
      { tool: "write", pattern: "*", action: "deny" },
      { tool: "edit", pattern: "*", action: "deny" },
      { tool: "bash", pattern: "*", action: "deny" },
    ],
  },
  {
    name: "general",
    description: "General-purpose subagent for multi-step research and execution.",
    mode: "subagent",
    prompt: "You are a Cortex subagent. Complete the delegated task and reply with a concise final report.",
    tools: { deny: ["task", "todowrite"] },
    permission: [],
  },
  {
    name: "explore",
    description: "Fast read-only subagent for searching a codebase.",
    mode: "subagent",
    prompt: "You are a Cortex exploration subagent. Search and read files to answer the question; report findings with file paths.",
    tools: { allow: READ_ONLY.filter((t) => t !== "todowrite") },
    permission: [],
  },
]

export const getAgent = (name: string) => AGENTS.find((a) => a.name === name)

export function toolAllowed(filter: Agent["tools"], name: string): boolean {
  if (filter.deny?.some((p) => wildcard(p, name))) return false
  if (filter.allow) return filter.allow.some((p) => wildcard(p, name))
  return true
}
