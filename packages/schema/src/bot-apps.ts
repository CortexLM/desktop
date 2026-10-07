import { z } from "zod"
import { WorkBotOwner } from "./work-bot"

export const AppSlug = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,119}$/)
export const ConnectionID = z.string().regex(/^pcn_[0-7][0-9A-HJKMNP-TV-Z]{25}$/)
export const AppApprovalMode = z.enum(["always", "changes", "important"])
const Surfaces = z.object({ chat: z.boolean(), bot: z.boolean() }).strict()
export const AppConsent = WorkBotOwner.extend({ surfaces: Surfaces.refine(v => v.chat || v.bot), approval_mode: AppApprovalMode }).strict()
export const AppCatalogInput = WorkBotOwner.extend({ q: z.string().max(200).optional() }).strict()
export const AppConnection = z.object({ id: ConnectionID, slug: AppSlug, provider: z.string(), status: z.enum(["pending", "active", "needs_auth", "failed", "disabled"]), surfaces: Surfaces, approval_mode: AppApprovalMode, connected_at: z.string().optional(), updated_at: z.string(), status_reason: z.string().optional() })
export const AppConnections = z.object({ items: z.array(AppConnection), has_more: z.literal(false) })
export const AppCatalog = z.object({ items: z.array(z.object({ slug: AppSlug, name: z.string(), description: z.string(), category: z.string(), auth: z.string(), managed_auth: z.boolean(), tool_count: z.number().int(), logo_url: z.string().optional(), app_url: z.string().optional() })), is_live: z.boolean(), provider: z.string(), source: z.enum(["marketplace", "cache", "cache_stale", "unavailable"]), unavailable_reason: z.string().optional() })
export const OwnedConnector = AppConnection.extend({ bot_enabled: z.boolean(), blocked_reason: z.enum(["account_off", "pending", "needs_auth", "failed", "disabled"]).optional() })
export const OwnedConnectors = z.object({ items: z.array(OwnedConnector) })
export const ConnectorEnable = WorkBotOwner.extend({ enabled: z.boolean() }).strict()
export const ToolRuleBody = z.object({ effect: z.enum(["always_allow", "require_approval", "deny"]), match_kind: z.enum(["tool", "connector", "category"]), match_value: z.string().trim().min(1).refine(v => [...v].length <= 120), reason: z.string().trim().refine(v => [...v].length <= 200).optional() }).strict()
export const ToolRuleInput = WorkBotOwner.extend(ToolRuleBody.shape).strict()
export const ToolRule = ToolRuleBody.extend({ id: z.string().uuid(), reason: z.string() })
export const ToolRules = z.object({ items: z.array(ToolRule) })
export const EffectiveToolRule = ToolRule.extend({ scope: z.enum(["bot", "organization"]) })
export const EffectiveToolPolicy = z.object({ bot_rules: z.array(EffectiveToolRule), admin_rules: z.array(EffectiveToolRule) })
export type AppConsent = z.infer<typeof AppConsent>
export type AppCatalogInput = z.infer<typeof AppCatalogInput>
export type AppConnection = z.infer<typeof AppConnection>
export type AppConnections = z.infer<typeof AppConnections>
export type AppCatalog = z.infer<typeof AppCatalog>
export type OwnedConnector = z.infer<typeof OwnedConnector>
export type OwnedConnectors = z.infer<typeof OwnedConnectors>
export type ConnectorEnable = z.infer<typeof ConnectorEnable>
export type ToolRuleInput = z.infer<typeof ToolRuleInput>
export type ToolRules = z.infer<typeof ToolRules>
export type EffectiveToolPolicy = z.infer<typeof EffectiveToolPolicy>

export const PendingApproval = z.object({ id: z.string().uuid(), mascot_id: z.string().uuid(), tool_name: z.string(), created_at: z.string(), message_id: z.string().uuid().optional() })
export const PendingApprovals = z.object({ items: z.array(PendingApproval) })
export const ApprovalDecision = WorkBotOwner.extend({ action: z.enum(["allow", "deny"]), always: z.literal(true).optional() }).strict().refine(v => !v.always || v.action === "allow", { message: "Always requires allow", path: ["always"] })
// Only decision metadata crosses IPC; tool content/reply may contain private material.
export const ApprovalAcknowledged = z.object({ ok: z.literal(true), dismissed: z.boolean(), resumed: z.boolean().optional() })
export const PolicyEvaluations = z.object({ items: z.array(z.object({ id: z.string().uuid(), mascot_id: z.string().uuid(), call_id: z.string(), tool_name: z.string(), evaluation: z.enum(["run", "deny", "pause"]), source: z.enum(["bot_rule", "admin_rule", "default"]), via_plugin: z.boolean(), created_at: z.string() })) })
export type PendingApprovals = z.infer<typeof PendingApprovals>
export type ApprovalDecision = z.infer<typeof ApprovalDecision>
// Skills (producer /v1/skills). Upload sends the full SKILL.md text; the producer parses frontmatter and scans it.
export const SkillSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)
export const SkillView = z.object({ slug: SkillSlug, name: z.string(), description: z.string(), enabled: z.boolean(), owner: z.enum(["user", "global"]), scan_verdict: z.string(), scan_findings: z.array(z.string()) })
export const SkillList = z.object({ items: z.array(SkillView) })
export const SkillUpload = WorkBotOwner.extend({ source: z.string().min(1).refine(v => new TextEncoder().encode(v).length <= 65536, "Skill file is larger than 64 KiB") }).strict()
export const SkillEnable = WorkBotOwner.extend({ enabled: z.boolean(), acknowledged: z.string().max(32).optional(), findings: z.array(z.string().max(500)).max(50).optional() }).strict()
export const SkillEnabled = z.object({ ok: z.literal(true), enabled: z.boolean() })
export type SkillView = z.infer<typeof SkillView>
export type SkillList = z.infer<typeof SkillList>
export type SkillUpload = z.infer<typeof SkillUpload>
export type SkillEnable = z.infer<typeof SkillEnable>
export type ApprovalAcknowledged = z.infer<typeof ApprovalAcknowledged>
export type PolicyEvaluations = z.infer<typeof PolicyEvaluations>
