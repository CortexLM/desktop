import { z } from "zod"
import { WorkBotOwner, WorkBotID } from "./work-bot"

const name = z.string().refine(value => [...value.trim()].length <= 80)
export const WorkChannel = z.object({ id: WorkBotID, name: z.string(), members: WorkBotID.array() })
export type WorkChannel = z.infer<typeof WorkChannel>
export const WorkChannelCreate = z.object({ name: name.refine(value => value.trim().length > 0), members: WorkBotID.array().nullable().optional() }).strict()
export const WorkChannelUpdate = z.object({ name: name.nullable().optional(), members: WorkBotID.array().nullable().optional() }).strict()
export const WorkChannelCreateInput = WorkBotOwner.extend({ channel: WorkChannelCreate }).strict()
export const WorkChannelUpdateInput = WorkBotOwner.extend({ channel: WorkChannelUpdate }).strict()
export type WorkChannelCreateInput = z.infer<typeof WorkChannelCreateInput>
export type WorkChannelUpdateInput = z.infer<typeof WorkChannelUpdateInput>
