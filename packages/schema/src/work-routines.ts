import { z } from "zod"
import { WorkBotOwner } from "./work-bot"

const kind = z.enum(["cron", "slack", "github"])
export const WorkRoutineTrigger = z.object({ kind, event: z.string().optional(), timezone: z.string().optional(), utc_offset_minutes: z.number().int().optional() }).catchall(z.json())
export const WorkRoutine = z.object({
  id: z.string().uuid(), name: z.string(), prompt: z.string(), body: z.string(), schedule: z.string(),
  trigger: WorkRoutineTrigger, paused: z.boolean(), quiet_if_empty: z.boolean(),
  last_run_at: z.string().nullable(), created_at: z.string(), timezone: z.string().optional(), utc_offset_minutes: z.number().int().optional(),
})
export type WorkRoutine = z.infer<typeof WorkRoutine>
export const WorkRoutineBody = z.object({
  name: z.string().trim().min(1).refine(v => [...v].length <= 80), prompt: z.string().trim().min(1).refine(v => [...v].length <= 4000),
  schedule: z.string().trim().min(1), trigger: WorkRoutineTrigger.optional(), quiet_if_empty: z.boolean().optional(), body: z.string().optional(),
  timezone: z.string().regex(/^(?:UTC|Etc\/UTC|[A-Za-z0-9_+-]+\/[A-Za-z0-9_+/-]+)$/).max(64).optional(),
  utc_offset_minutes: z.number().int().min(-720).max(840).optional(),
}).strict()
export const WorkRoutineInput = WorkBotOwner.extend({ routine: WorkRoutineBody }).strict()
export type WorkRoutineInput = z.infer<typeof WorkRoutineInput>
export const WorkRoutineEvent = WorkBotOwner.extend({ kind: z.enum(["slack", "github"]), event: z.string().min(1).max(80).regex(/^[A-Za-z0-9_\-.:/]+$/), delivery_id: z.string().uuid(), mascot_id: z.string().uuid() }).strict()
export type WorkRoutineEvent = z.infer<typeof WorkRoutineEvent>
export const WorkRoutineRun = z.object({ id: z.string().uuid(), status: z.enum(["running", "completed", "failed", "interrupted"]), error_code: z.string().nullable(), created_at: z.string(), finished_at: z.string().nullable() })
export type WorkRoutineRun = z.infer<typeof WorkRoutineRun>
export const WorkRoutineFired = z.object({ fired: z.number().int().nonnegative() })
