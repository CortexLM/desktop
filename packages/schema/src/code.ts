import { z } from "zod"

const ID = z.string().regex(/^cnv_[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/)
const Text = z.string().max(4 * 1024 * 1024)
export const CodeOwner = z.object({ epoch: z.string().min(1).max(256) }).strict()
export const CodeCreateInput = CodeOwner.extend({ runtime: z.enum(["local", "cloud"]), modelSlug: z.string().min(1).max(1024), repo: z.string().max(200).optional(), title: z.string().max(200).optional() }).strict()
export type CodeCreateInput = z.infer<typeof CodeCreateInput>
export const CodePromptInput = CodeOwner.extend({ message: z.string().trim().min(1).max(8000) }).strict()
export type CodePromptInput = z.infer<typeof CodePromptInput>
export const CodeDecisionInput = CodeOwner.extend({ decision: z.enum(["allow", "deny"]) }).strict()
export const CodeSessionView = z.object({
  id: ID, epoch: z.string(), runtime: z.enum(["local", "cloud"]), modelSlug: z.string(), title: z.string(),
  state: z.enum(["cloud_only", "connecting", "connected", "disconnected", "running", "permission_blocked", "failed", "unpaired", "waiting", "completed", "interrupted", "local"]),
  delivery: z.enum(["ready", "admitting", "streaming", "history_required", "settled"]), errorCode: z.string().optional(),
})
export type CodeSessionView = z.infer<typeof CodeSessionView>
export const CodePermissionView = z.object({
  id: z.string().regex(/^prm_[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/), session_id: ID, tool_name: z.string(),
  detail: Text, summary: Text, created_at: z.string(), decision: z.enum(["allow", "always", "deny"]).optional(),
  exact_action_preview: Text.optional(), proposed_diff: Text.optional(), path: z.string().optional(),
})
export type CodePermissionView = z.infer<typeof CodePermissionView>
export const CodeToolView = z.object({
  tool_name: z.string(), arguments: z.unknown(), outcome: z.string().optional(), result: Text.optional(),
  arguments_omitted_chars: z.number().optional(), result_omitted_chars: z.number().optional(), result_truncated_chars: z.number().optional(),
})
export const CodeMessageView = z.object({
  id: z.string(), role: z.string(), text: Text, created_at: z.string(), finish_reason: z.string().optional(),
  tools: z.array(CodeToolView).default([]),
})
export type CodeMessageView = z.infer<typeof CodeMessageView>
export const CodeSnapshot = z.object({ session: CodeSessionView, messages: z.array(CodeMessageView), permissions: z.array(CodePermissionView) })
export type CodeSnapshot = z.infer<typeof CodeSnapshot>
