import type { Model, ModelCapabilities, PromptPartInput } from "@cortex/schema"
import { capabilities } from "@cortex/schema"
import { CortexError } from "./error"
import type { SdkFamily } from "./provider"

export const DEFAULT_MAX_OUTPUT = 32_000
const IMAGE_TOKEN_ESTIMATE = 1_500

/** Reject attachments the model cannot read. Typed codes are mapped to copy by the UI. */
export function assertInputSupported(caps: ModelCapabilities, parts: PromptPartInput[]) {
  for (const p of parts) {
    if (p.type !== "file") continue
    if (p.mime.startsWith("image/") && !caps.imageInput) throw new CortexError("model_no_image_input", "The selected model does not accept image input")
    if (p.mime === "application/pdf" && !caps.pdfInput) throw new CortexError("model_no_pdf_input", "The selected model does not accept PDF input")
  }
}

/** Rough token estimate: 4 characters per token, fixed cost per image. */
export function estimateTokens(texts: string[], images = 0): number {
  return Math.ceil(texts.reduce((n, t) => n + t.length, 0) / 4) + images * IMAGE_TOKEN_ESTIMATE
}

export function assertContextFits(caps: ModelCapabilities, estimated: number) {
  if (caps.contextWindow > 0 && estimated > caps.contextWindow)
    throw new CortexError("context_window_exceeded", `Estimated input of ${estimated} tokens exceeds the ${caps.contextWindow} token context window`)
}

export interface CallOptions {
  maxOutputTokens?: number
  providerOptions: Record<string, Record<string, unknown>>
  useTools: boolean
}

/** Capability-gated call options: tools only with tool_call, thinking only with reasoning, output clamped. */
export function callOptions(model: Model, family: SdkFamily, estimatedInput = 0): CallOptions {
  const caps = capabilities(model)
  let maxOutputTokens: number | undefined = DEFAULT_MAX_OUTPUT
  if (caps.maxOutput > 0) maxOutputTokens = Math.min(maxOutputTokens, caps.maxOutput)
  if (caps.contextWindow > 0) maxOutputTokens = Math.max(1, Math.min(maxOutputTokens, caps.contextWindow - estimatedInput))
  const providerOptions: CallOptions["providerOptions"] = {}
  if (caps.reasoning) {
    const opts = model.reasoning_options ?? []
    if (family === "anthropic") {
      const b = opts.find((o) => o.type === "budget_tokens")
      const min = Math.max(1024, b?.min ?? 0)
      const budget = Math.max(min, Math.min(b?.max ?? 16_000, 16_000, Math.floor(maxOutputTokens / 2)))
      if (maxOutputTokens <= budget) maxOutputTokens = Math.min(budget + 4096, caps.maxOutput || budget + 4096)
      if (maxOutputTokens > budget) providerOptions.anthropic = { thinking: { type: "enabled", budgetTokens: budget } }
    } else if (family === "openai") {
      const values = (opts.find((o) => o.type === "effort")?.values ?? ["medium"]).filter((v): v is string => !!v && v !== "none")
      providerOptions.openai = { reasoningEffort: values.includes("medium") ? "medium" : (values[0] ?? "medium"), reasoningSummary: "auto" }
    } else if (family === "google") {
      providerOptions.google = { thinkingConfig: { includeThoughts: true } }
    }
    // openai-compatible: reasoning arrives as `reasoning_content` deltas; nothing to enable.
  }
  return { maxOutputTokens, providerOptions, useTools: caps.tools }
}

export function costOf(caps: ModelCapabilities, u: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): number {
  const c = caps.cost
  return (u.input * c.input + u.output * c.output + (u.cacheRead ?? 0) * c.cacheRead + (u.cacheWrite ?? 0) * c.cacheWrite) / 1_000_000
}
