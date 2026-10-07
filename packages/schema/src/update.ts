// Desktop updater state: plain data shared by Electron main and the renderer bridge.
export type UpdateError = "unsupported" | "not_configured" | "feed_invalid" | "not_signed" | "check_failed"
export type UpdateState =
  | { state: "idle"; current: string }
  | { state: "checking"; current: string }
  | { state: "up-to-date"; current: string; checkedAt: string }
  | { state: "available"; current: string }
  | { state: "downloading"; current: string }
  | { state: "ready"; current: string; version: string; notes: string }
  | { state: "error"; current: string; code: UpdateError }
