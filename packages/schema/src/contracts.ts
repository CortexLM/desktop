import { z } from "zod"

// Closed table of Todo 3 producer contract routes the renderer may invoke through main (see desktop remote-contracts.ts).
export type ContractOp = { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; slow?: boolean }
export const CONTRACT_OPS = {
  "code.attempts": { method: "GET", path: "/code/sessions/{session}/attempts" },
  "code.attempts.retry": { method: "POST", path: "/code/sessions/{session}/attempts", slow: true },
  "code.attempts.choose": { method: "POST", path: "/code/sessions/{session}/attempts/{attempt}/choose" },
  "code.comments": { method: "GET", path: "/code/sessions/{session}/diff/comments" },
  "code.comments.add": { method: "POST", path: "/code/sessions/{session}/diff/comments" },
  "code.comments.remove": { method: "DELETE", path: "/code/sessions/{session}/diff/comments/{comment}" },
  "code.diff.resolve": { method: "POST", path: "/code/sessions/{session}/diff/resolve", slow: true },
  "code.pr.review": { method: "POST", path: "/code/sessions/{session}/pull-request/review" },
  "code.pr.reviewers": { method: "GET", path: "/code/sessions/{session}/pull-request/reviewers" },
  "code.pr.reviewers.request": { method: "POST", path: "/code/sessions/{session}/pull-request/reviewers" },
  "code.grant": { method: "POST", path: "/code/sessions/{session}/permissions/session-grant" },
  "code.grant.revoke": { method: "DELETE", path: "/code/sessions/{session}/permissions/session-grant" },
  "code.runtimes": { method: "GET", path: "/code/runtimes" },
  "code.runtime.lifecycle": { method: "POST", path: "/code/runtimes/{runtime}/lifecycle", slow: true },
  "code.runtime.remove": { method: "DELETE", path: "/code/runtimes/{runtime}", slow: true },
  "code.secrets": { method: "GET", path: "/code/runtimes/{runtime}/secrets" },
  "code.secrets.put": { method: "PUT", path: "/code/runtimes/{runtime}/secrets/{secret}" },
  "code.secrets.remove": { method: "DELETE", path: "/code/runtimes/{runtime}/secrets/{secret}" },
  "code.egress": { method: "GET", path: "/code/runtimes/{runtime}/egress" },
  "code.egress.put": { method: "PUT", path: "/code/runtimes/{runtime}/egress", slow: true },
  "code.repository.put": { method: "PUT", path: "/code/repositories/{owner}/{repo}" },
  "code.repository.remove": { method: "DELETE", path: "/code/repositories/{owner}/{repo}" },
  "bot.status": { method: "PATCH", path: "/mascots/{bot}" },
  "bot.task.pause": { method: "POST", path: "/mascots/{bot}/tasks/{task}/pause" },
  "bot.task.resume": { method: "POST", path: "/mascots/{bot}/tasks/{task}/resume" },
  "bot.task.retry": { method: "POST", path: "/mascots/{bot}/tasks/{task}/retry" },
  "bot.takeover": { method: "POST", path: "/mascots/{bot}/computer/takeover" },
  "bot.draft.send": { method: "POST", path: "/mascots/{bot}/tasks/{task}/drafts/{draft}/send" },
  "bot.draft.cancel": { method: "POST", path: "/mascots/{bot}/tasks/{task}/drafts/{draft}/cancel" },
  "bot.credentials": { method: "POST", path: "/mascots/{bot}/tasks/{task}/credentials" },
  "bot.approval.transfer": { method: "POST", path: "/bot/approvals/{approval}/transfer" },
} as const satisfies Record<string, ContractOp>
export type ContractOpName = keyof typeof CONTRACT_OPS
export const ContractCall = z.object({
  epoch: z.string().min(1).max(256),
  op: z.enum(Object.keys(CONTRACT_OPS) as [ContractOpName, ...ContractOpName[]]),
  params: z.record(z.string(), z.string().max(200)).default({}),
  body: z.record(z.string(), z.unknown()).optional(),
}).strict()
export type ContractCall = z.input<typeof ContractCall>
export type ContractResult = { status: number; data: unknown }
