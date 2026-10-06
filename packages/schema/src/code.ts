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
  repo: z.string().optional(), branch: z.string().optional(), baseBranch: z.string().optional(),
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
// Producer `box_error` tags that refuse a session workspace. Anything else is `unavailable`, never a fallback.
export const CodeWorkspaceRefusal = z.enum(["code_compute_not_configured", "code_runtime_not_attached", "code_runtime_not_running", "environment_preparing", "github_not_connected", "github_needs_reconnect", "repo_unresolved", "host_not_connected", "unavailable"])
export type CodeWorkspaceRefusal = z.infer<typeof CodeWorkspaceRefusal>
export const CodeWorkspaceView = z.discriminatedUnion("state", [
  z.object({ state: z.literal("ready"), diff: Text }),
  z.object({ state: z.literal("refused"), reason: CodeWorkspaceRefusal }),
])
export type CodeWorkspaceView = z.infer<typeof CodeWorkspaceView>
// Only whether isolated cloud runtimes exist; the unavailable reason is the producer's public tag.
export const CodeCapabilitiesView = z.object({ epoch: z.string(), cloud: z.object({ available: z.boolean(), reason: z.literal("code_compute_not_configured").optional() }) })
export type CodeCapabilitiesView = z.infer<typeof CodeCapabilitiesView>
// Producer environments: cloud availability plus the owner's runtimes and saved images. LOCAL has no runtime row.
export const CodeEnvironmentView = z.object({
  epoch: z.string(), cloud: CodeCapabilitiesView.shape.cloud,
  runtimes: z.array(z.object({ id: z.string(), status: z.string(), prepare_status: z.string(), repo_url: z.string(), repo_ref: z.string(), environment_version: z.string() })),
  images: z.array(z.object({ id: z.string(), repo_url: z.string(), repo_ref: z.string(), environment_version: z.string() })),
})
export type CodeEnvironmentView = z.infer<typeof CodeEnvironmentView>
const Sums = { quantity: z.number(), input_tokens: z.number(), output_tokens: z.number(), cost_usd: z.number() }
export const CodeUsageView = z.object({
  epoch: z.string(), from: z.string(), to: z.string(), days: z.number(), total_cost_usd: z.number(), total_quantity: z.number(),
  by_kind: z.array(z.object({ kind: z.string(), ...Sums })), by_model: z.array(z.object({ model_slug: z.string(), ...Sums })),
})
export type CodeUsageView = z.infer<typeof CodeUsageView>
// Producer model refs are `provider/model`.
const ModelRef = z.string().min(3).max(200).regex(/^[^/\s][^\s]*\/[^\s]+$/)
export const CodeSettingsView = z.object({ epoch: z.string(), defaultModel: z.string().nullable(), models: z.array(z.object({ ref: z.string(), name: z.string() })) })
export type CodeSettingsView = z.infer<typeof CodeSettingsView>
export const CodeSettingsInput = CodeOwner.extend({ defaultModel: ModelRef }).strict()
export type CodeSettingsInput = z.infer<typeof CodeSettingsInput>
// Mirrors the producer `gitRefName` (code-sessions.ts): check-ref-format rules plus a strict charset, so shell
// metacharacters never reach a stored branch.
const Ref = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._/+-]+$/).refine((v) => !(v.startsWith("-") || v.startsWith("/") || v.endsWith("/") || v.endsWith(".") || v.includes("..") || v.includes("//") || v === "@" || v.split("/").some((p) => p.startsWith(".") || p.endsWith(".lock"))))
// Draft PR preparation persists only what the producer session stores; it never opens a PR.
export const CodeSessionPatch = CodeOwner.extend({ title: z.string().trim().max(200).optional(), branch: Ref.optional(), baseBranch: Ref.optional() }).strict()
export type CodeSessionPatch = z.infer<typeof CodeSessionPatch>
// Only the repository instructions file is readable from the desktop.
export const CodeInstructionsInput = CodeOwner.extend({ path: z.literal("AGENTS.md") }).strict()
export const CodeFileView = z.discriminatedUnion("state", [
  z.object({ state: z.literal("ready"), path: z.string(), content: Text }),
  z.object({ state: z.literal("missing") }),
  z.object({ state: z.literal("refused"), reason: CodeWorkspaceRefusal }),
])
export type CodeFileView = z.infer<typeof CodeFileView>
export const CodeSnapshot = z.object({ session: CodeSessionView, messages: z.array(CodeMessageView), permissions: z.array(CodePermissionView), workspace: CodeWorkspaceView.optional() })
export type CodeSnapshot = z.infer<typeof CodeSnapshot>
