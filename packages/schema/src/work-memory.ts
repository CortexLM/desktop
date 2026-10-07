import { z } from "zod"
import { WorkBotOwner } from "./work-bot"

// Producer tiers and limits (backend bot-memory.ts): profile <= 4000 chars, log/note <= 500, notes fade after 48h.
export const WorkMemoryTier = z.enum(["profile", "log", "note"])
export type WorkMemoryTier = z.infer<typeof WorkMemoryTier>
const text = z.string().trim().min(1)
export const WorkMemoryAdd = WorkBotOwner.extend({ tier: WorkMemoryTier, text }).strict().refine(v => [...v.text].length <= (v.tier === "profile" ? 4000 : 500), { path: ["text"] })
export type WorkMemoryAdd = z.infer<typeof WorkMemoryAdd>
export const WorkMemoryItem = z.object({ id: z.string().uuid(), tier: WorkMemoryTier, text: z.string(), at: z.string() })
export type WorkMemoryItem = z.infer<typeof WorkMemoryItem>
export const WorkMemoryList = z.object({ items: z.array(WorkMemoryItem).max(600) })
export type WorkMemoryList = z.infer<typeof WorkMemoryList>
export const WorkMemoryDeleted = z.object({ deleted: z.number().int().nonnegative() })
export type WorkMemoryDeleted = z.infer<typeof WorkMemoryDeleted>
