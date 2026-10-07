import { z } from "zod"
import { WorkBotID } from "./work-bot"

// Mirrors the approved SDK `projectAgentEvent` output; strict objects keep payload/user_id/detail out of IPC.
const meta = { id: WorkBotID, resource_id: WorkBotID, at: z.string() }
export const WorkActivity = z.discriminatedUnion("opaque", [
  z.object({ opaque: z.literal(true), ...meta, kind: z.string(), resource: z.string() }).strict(),
  z.discriminatedUnion("kind", [
    z.object({ opaque: z.literal(false), ...meta, kind: z.literal("ask_user"), resource: z.literal("mascot"), message_id: WorkBotID, widget: z.enum(["question", "multi_select", "secret_request", "confirm", "notice", "waiting"]) }).strict(),
    z.object({ opaque: z.literal(false), ...meta, kind: z.literal("video_ready"), resource: z.literal("mascot"), video_id: WorkBotID, title: z.string() }).strict(),
    z.object({ opaque: z.literal(false), ...meta, kind: z.literal("environment_progress"), resource: z.literal("code_runtime"), phase: z.enum(["note", "shell", "read_file", "write_file", "list_dir", "environment_ready", "environment_failed"]) }).strict(),
    z.object({ opaque: z.literal(false), ...meta, kind: z.literal("host_connected"), resource: z.literal("code_session"), host_id: WorkBotID, hostname: z.string().min(1) }).strict(),
    z.object({ opaque: z.literal(false), ...meta, kind: z.literal("host_disconnected"), resource: z.literal("code_session") }).strict(),
  ]),
])
export type WorkActivity = z.infer<typeof WorkActivity>
