import { z } from "zod"

// Closed table of trunk Chat feature routes the renderer may read or call through main (desktop remote-chat-features.ts).
// Kept apart from CONTRACT_OPS. Path segments are validated in main; only `q` may be sent as a query parameter.
export type ChatFeatureOp = { method: "GET" | "POST" | "DELETE"; path: string }
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
} as const satisfies Record<string, ChatFeatureOp>
export type ChatFeatureOpName = keyof typeof CHAT_FEATURE_OPS
export const ChatFeatureCall = z.object({
  epoch: z.string().min(1).max(256),
  op: z.enum(Object.keys(CHAT_FEATURE_OPS) as [ChatFeatureOpName, ...ChatFeatureOpName[]]),
  params: z.record(z.string(), z.string().max(200)).default({}),
  q: z.string().max(200).optional(),
}).strict()
export type ChatFeatureCall = z.input<typeof ChatFeatureCall>
export type ChatFeatureResult = { status: number; data: unknown }
