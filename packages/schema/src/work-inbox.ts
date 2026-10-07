import { z } from "zod"
import { WorkBotOwner, WorkBotID } from "./work-bot"

export const WorkInboxItem = z.object({
  kind: z.string(), id: WorkBotID, mascot_id: WorkBotID, from_id: WorkBotID.optional(),
  text: z.string().optional(), tool_name: z.string().optional(), message_id: WorkBotID.optional(), at: z.string(), unread: z.boolean(),
})
export const WorkHomeInbox = z.object({ items: WorkInboxItem.array(), working_mascot_ids: WorkBotID.array() })
export const WorkInboxRead = z.object({ item_ids: WorkBotID.array().optional(), all: z.boolean().nullable().optional(), unread: z.boolean().nullable().optional() }).strict().refine(v => !(v.all && v.unread) && (v.all || !!v.item_ids?.length))
export const WorkInboxReadInput = WorkBotOwner.extend({ read: WorkInboxRead }).strict()
export const WorkInboxReadResult = z.object({ ok: z.literal(true), updated: z.number().int().nonnegative() })
export const WorkNotificationID = z.string().regex(/^ntf_[0-9A-HJKMNP-TV-Z]{26}$/i)
export const WorkNotification = z.object({ id: WorkNotificationID, kind: z.string(), title: z.string(), body: z.string(), conversation_id: z.string().optional(), code_session_id: z.string().optional(), mascot_id: z.string().optional(), task_id: WorkBotID.optional(), read: z.boolean(), created_at: z.string() })
export const WorkNotificationPage = z.object({ items: WorkNotification.array(), has_more: z.literal(false) })
export const WorkInboxSnapshot = WorkHomeInbox.extend({ notifications: WorkNotificationPage })
export type WorkInboxSnapshot = z.infer<typeof WorkInboxSnapshot>
export type WorkInboxReadInput = z.infer<typeof WorkInboxReadInput>
export type WorkInboxReadResult = z.infer<typeof WorkInboxReadResult>
export type WorkNotification = z.infer<typeof WorkNotification>
