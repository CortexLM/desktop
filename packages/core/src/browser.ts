import { randomBytes, randomInt, timingSafeEqual, createHash } from "node:crypto"
import { CortexError } from "./error"

/** One tab the user chose to share. Only title, URL and readable text ever leave the browser. */
export interface SharedTab {
  id: number
  title: string
  url: string
  sharedAt: number
}
export interface BrowserStatus {
  /** The local pairing endpoint accepts connections. */
  listening: boolean
  port?: number
  /** The extension polled recently. */
  connected: boolean
  pairing?: { code: string; expiresAt: number }
  tabs: SharedTab[]
}
export type BrowserCommand = { id: string; type: "read"; tabId: number } | { id: string; type: "revoke"; tabId: number }
export interface TabText {
  title: string
  url: string
  text: string
}

export const PAIRING_TTL_MS = 5 * 60_000
export const MAX_PAIRING_ATTEMPTS = 5
const CONNECTED_MS = 40_000
const READ_TIMEOUT_MS = 15_000
const MAX_TEXT = 50_000
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

const digest = (s: string) => createHash("sha256").update(s).digest()
const sameSecret = (a: string, b: string) => timingSafeEqual(digest(a), digest(b))

/** Only web pages can be shared: never chrome://, file:, extension or devtools pages. */
export const shareableUrl = (url: string) => {
  try {
    const u = new URL(url)
    return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password
  } catch {
    return false
  }
}

/**
 * Local browser bridge: one-time pairing, per-tab consent and read requests.
 * State lives in memory on purpose: restarting the app drops every pairing and every consent.
 */
export class BrowserBridge {
  private pairing?: { code: string; expiresAt: number; failures: number }
  private token?: string
  private lastSeen = 0
  private tabs = new Map<number, SharedTab>()
  private queue: BrowserCommand[] = []
  private waiters: (() => void)[] = []
  private pending = new Map<string, { tabId: number; resolve(t: TabText): void; reject(e: Error): void }>()
  private listeners = new Set<() => void>()
  private endpoint: { port?: number; listening: boolean } = { listening: false }

  constructor(private now: () => number = Date.now) {}

  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  private emit() {
    for (const fn of this.listeners) fn()
  }

  setEndpoint(e: { port?: number; listening: boolean }) {
    this.endpoint = e
    this.emit()
  }

  status(): BrowserStatus {
    const pairing = this.pairing && this.pairing.expiresAt > this.now() ? { code: this.pairing.code, expiresAt: this.pairing.expiresAt } : undefined
    return { ...this.endpoint, connected: !!this.token && this.now() - this.lastSeen < CONNECTED_MS, pairing, tabs: [...this.tabs.values()] }
  }

  /** New single-use code; replaces any earlier one. */
  startPairing() {
    const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")
    this.pairing = { code, expiresAt: this.now() + PAIRING_TTL_MS, failures: 0 }
    this.emit()
    return { code, expiresAt: this.pairing.expiresAt }
  }

  /** Consumes the code. A wrong, expired or reused code never yields a token; five wrong guesses burn the code. */
  pair(input: string): string {
    const p = this.pairing
    const code = input.replace(/[\s-]/g, "").toUpperCase()
    if (!p || p.expiresAt <= this.now()) throw new CortexError("permission_denied", "No active pairing code")
    if (!sameSecret(code, p.code)) {
      if (++p.failures >= MAX_PAIRING_ATTEMPTS) this.pairing = undefined
      this.emit()
      throw new CortexError("permission_denied", "Wrong pairing code")
    }
    this.pairing = undefined
    this.resetSession()
    this.token = randomBytes(32).toString("hex")
    this.lastSeen = this.now()
    this.emit()
    return this.token
  }

  authenticate(token: string | undefined): boolean {
    if (!token || !this.token || !sameSecret(token, this.token)) return false
    this.lastSeen = this.now()
    return true
  }

  /** Drops the pairing, every consent and every pending read. */
  disconnect() {
    this.resetSession()
    this.token = undefined
    this.pairing = undefined
    this.emit()
  }
  private resetSession() {
    this.tabs.clear()
    this.queue = []
    for (const p of this.pending.values()) p.reject(new CortexError("tool_failed", "Browser disconnected"))
    this.pending.clear()
    this.wake()
  }
  private wake() {
    for (const w of this.waiters.splice(0)) w()
  }

  /** The user shared this tab from the extension. */
  share(tab: { id: number; title: string; url: string }) {
    if (!Number.isInteger(tab.id) || !shareableUrl(tab.url)) throw new CortexError("invalid_request", "This page cannot be shared")
    this.tabs.set(tab.id, { id: tab.id, title: String(tab.title ?? "").slice(0, 300), url: tab.url, sharedAt: this.now() })
    this.emit()
  }

  /** Revoked from the extension (`notify` false) or from the desktop page (`notify` true tells the extension). */
  revoke(tabId: number, notify = false) {
    if (!this.tabs.delete(tabId)) return
    for (const [id, p] of this.pending) {
      if (p.tabId !== tabId) continue
      this.pending.delete(id)
      p.reject(new CortexError("permission_denied", "Tab access was revoked"))
    }
    if (notify) {
      this.queue.push({ id: randomBytes(8).toString("hex"), type: "revoke", tabId })
      this.wake()
    }
    this.emit()
  }

  /** Long-poll: resolves with queued commands, or an empty list after `waitMs`. */
  async poll(waitMs: number, signal?: AbortSignal): Promise<BrowserCommand[]> {
    if (!this.queue.length && waitMs > 0 && !signal?.aborted) {
      await new Promise<void>((resolve) => {
        const done = () => (clearTimeout(timer), signal?.removeEventListener("abort", done), resolve())
        const timer = setTimeout(done, waitMs)
        signal?.addEventListener("abort", done, { once: true })
        this.waiters.push(done)
      })
    }
    return this.queue.splice(0)
  }

  /** Extension answer to a read command. */
  complete(id: string, result: { ok: true; title: string; url: string; text: string } | { ok: false; error: string }) {
    const p = this.pending.get(id)
    if (!p) return
    this.pending.delete(id)
    const tab = this.tabs.get(p.tabId)
    if (!result.ok) return p.reject(new CortexError("tool_failed", result.error.slice(0, 200)))
    // The page may have navigated after consent: drop the consent instead of returning another page.
    if (!tab || result.url !== tab.url) {
      this.revoke(p.tabId, true)
      return p.reject(new CortexError("permission_denied", "The shared tab changed pages; share it again"))
    }
    p.resolve({ title: result.title, url: result.url, text: result.text.slice(0, MAX_TEXT) })
  }

  /** Agent side: readable text of a consented tab; anything else is refused before reaching the browser. */
  read(tabId: number, signal?: AbortSignal): Promise<TabText> {
    if (!this.tabs.has(tabId)) return Promise.reject(new CortexError("permission_denied", "The user has not shared this tab"))
    if (!this.status().connected) return Promise.reject(new CortexError("tool_failed", "The browser extension is not connected"))
    const id = randomBytes(8).toString("hex")
    return new Promise<TabText>((resolve, reject) => {
      const timer = setTimeout(() => fail(new CortexError("tool_failed", "The browser did not answer")), READ_TIMEOUT_MS)
      const fail = (e: Error) => (clearTimeout(timer), this.pending.delete(id), reject(e))
      signal?.addEventListener("abort", () => fail(new CortexError("aborted", "Read aborted")), { once: true })
      this.pending.set(id, { tabId, resolve: (t) => (clearTimeout(timer), resolve(t)), reject: (e) => (clearTimeout(timer), reject(e)) })
      this.queue.push({ id, type: "read", tabId })
      this.wake()
    })
  }
}
