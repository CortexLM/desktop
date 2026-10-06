import { z } from "zod"
import { WorkBotOwner } from "./work-bot"

export const BotCopyCreate = WorkBotOwner.extend({ mode: z.string().nullable().optional() }).strict()
export const BotCopyInviteInput = WorkBotOwner.extend({ email: z.string().trim().min(1).max(320).refine(v => v.includes("@")) }).strict()
export const BotCopyAccept = WorkBotOwner.extend({ mascot_id: z.string().uuid().nullable().optional() }).strict()
export const BotCopyInvite = z.object({ id: z.string().uuid(), email_normalized: z.string(), accept_url: z.string(), state: z.enum(["pending", "accepted", "declined"]).optional(), declined_at: z.string().datetime({ offset: true }).optional() })
export const BotCopyDecline = z.object({ id: z.string().uuid(), state: z.literal("declined"), declined_at: z.string().datetime({ offset: true }) }).strict()
export const BotCopyStatus = z.object({ kind: z.enum(["template", "routine"]), active: z.boolean(), clone_count: z.number(), invites: z.array(BotCopyInvite) })
export const BotCopyIssued = z.object({ kind: z.enum(["template", "routine"]), active: z.literal(true), token: z.string(), share_url: z.string(), token_issued: z.literal(true) })
export const BotCopyInbox = z.object({ id: z.string().uuid(), kind: z.enum(["template", "routine"]), name: z.string(), look: z.string(), description: z.string(), created_at: z.string() })
const Routine = z.object({ name: z.string(), prompt: z.string(), body: z.string(), schedule: z.string(), quiet_if_empty: z.boolean(), trigger: z.object({ kind: z.string(), event: z.string().optional(), timezone: z.string().optional(), utc_offset_minutes: z.unknown().optional() }) })
export const BotCopyPreview = z.object({ kind: z.enum(["template", "routine"]), name: z.string(), look: z.string(), shape: z.string(), description: z.string(), label: z.string(), plugins: z.array(z.string()), skills: z.array(z.string()), routines: z.array(Routine), routine: Routine.optional(), copies_independent: z.literal(true), reconnect_required: z.literal(true) })
export const BotCopyResult = z.object({ mascot_id: z.string().uuid().optional(), routine_id: z.string().uuid().optional(), copies_independent: z.literal(true), reconnect_plugins: z.array(z.string()) })
export type BotCopyCreate = z.infer<typeof BotCopyCreate>
export type BotCopyInviteInput = z.infer<typeof BotCopyInviteInput>
export type BotCopyAccept = z.infer<typeof BotCopyAccept>
export type BotCopyInvite = z.infer<typeof BotCopyInvite>
export type BotCopyStatus = z.infer<typeof BotCopyStatus>
export type BotCopyIssued = z.infer<typeof BotCopyIssued>
export type BotCopyInbox = z.infer<typeof BotCopyInbox>
export type BotCopyPreview = z.infer<typeof BotCopyPreview>
export type BotCopyResult = z.infer<typeof BotCopyResult>
export type BotCopyDecline = z.infer<typeof BotCopyDecline>
