import { z } from "zod"

export const WorkBotID = z.string().uuid()
export const WorkBotOwner = z.object({ epoch: z.string().min(1).max(256) }).strict()
export const WorkBotConfig = z.object({
  name: z.string().trim().min(1).refine(v => [...v].length <= 40),
  description: z.string().max(2000).default(""), label: z.string().max(40).default(""),
  look: z.enum(["meadow", "teal", "terracotta", "amber", "plum", "slate"]).default("meadow"),
  shape: z.enum(["dots", "slit", "wink", "peek", "smile", "glance"]).default("dots"),
  lead_id: WorkBotID.nullable().optional(),
})
export const WorkBotCreate = WorkBotOwner.extend({ config: WorkBotConfig }).strict()
export type WorkBotCreate = z.infer<typeof WorkBotCreate>
export const WorkBotUpdate = WorkBotOwner.extend({ config: WorkBotConfig.extend({
  description: WorkBotConfig.shape.description.removeDefault(), label: WorkBotConfig.shape.label.removeDefault(),
  look: WorkBotConfig.shape.look.removeDefault(), shape: WorkBotConfig.shape.shape.removeDefault(),
  notifications: z.boolean(), status: z.enum(["awake", "idle", "hibernating"]),
}).partial().strict() }).strict()
export type WorkBotUpdate = z.infer<typeof WorkBotUpdate>
export const WorkBotView = WorkBotConfig.extend({ id: WorkBotID, lead_id: WorkBotID.nullable(), notifications: z.boolean(), status: z.string(), computer_kind: z.string(), updated_at: z.string() })
export type WorkBotView = z.infer<typeof WorkBotView>
export const WorkJobCreate = WorkBotOwner.extend({ kind: z.enum(["explore", "general-purpose"]), goal: z.string().trim().min(1).refine(v => [...v].length <= 4000) }).strict()
export type WorkJobCreate = z.infer<typeof WorkJobCreate>
export const WorkBotParentInput = WorkBotOwner.extend({ text: z.string().trim().min(1).refine(v => [...v].length <= 20000) }).strict()
export type WorkBotParentInput = z.infer<typeof WorkBotParentInput>
export const WorkJob = z.object({ id: WorkBotID, kind: z.string(), goal: z.string(), status: z.enum(["queued", "running", "done", "failed", "cancelled"]), created_at: z.string(), error_code: z.string().optional(), result: z.unknown().optional() })
export type WorkJob = z.infer<typeof WorkJob>
export const WorkBotMessage = z.object({ id: WorkBotID, sender: z.string(), kind: z.string(), text: z.string(), at: z.string(), dismissed: z.boolean(), responded: z.boolean(), payload: z.unknown().optional() })
export const WorkBotParentResponse = z.object({ message: WorkBotMessage, replies: z.array(WorkBotMessage), reply: WorkBotMessage.optional() })
export type WorkBotParentResponse = z.infer<typeof WorkBotParentResponse>
export const WorkBotSnapshot = z.object({ epoch: z.string(), bot: WorkBotView, jobs: z.array(WorkJob), messages: z.array(WorkBotMessage), computerAvailable: z.boolean() })
export type WorkBotSnapshot = z.infer<typeof WorkBotSnapshot>
