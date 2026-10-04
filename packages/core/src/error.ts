import type { ErrorCode, ErrorInfo } from "@cortex/schema"

/** Typed engine error. `message` is a neutral English developer string; the UI maps `code` to copy. */
export class CortexError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "CortexError"
  }
  toJSON(): ErrorInfo {
    return { code: this.code, message: this.message }
  }
}

export const fail = (code: ErrorCode, message: string): never => {
  throw new CortexError(code, message)
}

export function toErrorInfo(err: unknown): ErrorInfo {
  if (err instanceof CortexError) return err.toJSON()
  const outer = err as { name?: string; lastError?: unknown } | undefined
  if (outer?.name === "AI_RetryError" && outer.lastError) return toErrorInfo(outer.lastError)
  const e = err as { name?: string; statusCode?: number } | undefined
  if (e?.name === "AbortError") return { code: "aborted", message: "Request aborted" }
  const status = e?.statusCode
  if (status === 401 || status === 403) return { code: "provider_auth_failed", message: `Provider rejected the credentials (status ${status})` }
  if (status === 429) return { code: "provider_rate_limited", message: "Provider rate limit reached" }
  if (typeof status === "number") return { code: "provider_error", message: `Provider request failed (status ${status})` }
  if (e?.name === "AI_APICallError") return { code: "provider_error", message: "Could not reach the provider" }
  return { code: "internal", message: "Internal error" }
}
