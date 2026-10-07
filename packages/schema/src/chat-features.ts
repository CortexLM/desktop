import { z } from "zod"

// Closed table of trunk Chat feature routes the renderer may read or call through main (desktop remote-chat-features.ts).
// Kept apart from CONTRACT_OPS. Path segments are validated in main; only `q` may be sent as a query parameter.
// `turn` posts a validated ChatTurnBody and returns the admitted ids; `image` returns an owned library image as a data URL.
export type ChatFeatureOp = { method: "GET" | "POST" | "DELETE"; path: string; kind?: "turn" | "image"; query?: Record<string, string> }
export const CHAT_FEATURE_OPS = {
  "conversations": { method: "GET", path: "/conversations" },
  "messages": { method: "GET", path: "/conversations/{conversation}/messages" },
  "shares": { method: "GET", path: "/conversation-shares" },
  "share.create": { method: "POST", path: "/conversations/{conversation}/shares" },
  "share.revoke": { method: "DELETE", path: "/conversation-shares/{share}" },
  "canvases": { method: "GET", path: "/conversations/{conversation}/canvases" },
  "canvas": { method: "GET", path: "/conversations/{conversation}/canvases/{canvas}" },
  "search": { method: "GET", path: "/search" },
  "research": { method: "GET", path: "/conversations/{conversation}/research" },
  "audio.capabilities": { method: "GET", path: "/audio/capabilities" },
  "live.preferences": { method: "GET", path: "/live/preferences" },
  "turn.start": { method: "POST", path: "/conversations/turns", kind: "turn" },
  "turn.continue": { method: "POST", path: "/conversations/{conversation}/turns", kind: "turn" },
  "library.images": { method: "GET", path: "/library", query: { artifact_kind: "image", limit: "8" } },
  "file.content": { method: "GET", path: "/library/{file}/content", kind: "image" },
} as const satisfies Record<string, ChatFeatureOp>
export type ChatFeatureOpName = keyof typeof CHAT_FEATURE_OPS
export const ChatFeatureCall = z.object({
  epoch: z.string().min(1).max(256),
  op: z.enum(Object.keys(CHAT_FEATURE_OPS) as [ChatFeatureOpName, ...ChatFeatureOpName[]]),
  params: z.record(z.string(), z.string().max(200)).default({}),
  q: z.string().max(200).optional(),
  body: z.unknown().optional(),
}).strict()
export type ChatFeatureCall = z.input<typeof ChatFeatureCall>
export type ChatFeatureResult = { status: number; data: unknown }

// Chat tool turns (web search, deep research, images, temporary chat). The model chooses its tools; only Deep Research is explicit.
const ResearchPlanBody = z.object({
  title: z.string().trim().min(1).max(500),
  questions: z.array(z.string().trim().min(1).max(1000)).min(1).max(32),
  outline: z.array(z.string().max(1000)).max(64).optional(),
}).strict()
export const ChatTurnBody = z.object({
  message: z.string().trim().min(1).max(50000),
  model_slug: z.string().min(1).max(200).optional(),
  temporary: z.literal(true).optional(),
  research: z.discriminatedUnion("action", [
    z.object({ action: z.literal("plan") }).strict(),
    z.object({ action: z.literal("run"), plan: ResearchPlanBody }).strict(),
  ]).optional(),
}).strict()
export type ChatTurnBody = z.infer<typeof ChatTurnBody>
export type ChatTurnAdmission = { conversation_id: string; message_id: string }
