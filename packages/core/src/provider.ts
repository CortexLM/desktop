import { createAnthropic } from "@ai-sdk/anthropic"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createOpenAI } from "@ai-sdk/openai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"
import type { Model, Provider, ProviderConfig, ProviderUpdateInput } from "@cortex/schema"
import { CortexError } from "./error"
import type { Storage } from "./storage"

/** Host-provided key store (desktop main implements it with safeStorage). Keys never leave core. */
export interface Credentials {
  get(providerID: string): Promise<string | undefined> | string | undefined
  set(providerID: string, key: string): Promise<void> | void
  delete(providerID: string): Promise<void> | void
}

export function memoryCredentials(init: Record<string, string> = {}): Credentials {
  const m = new Map(Object.entries(init))
  return { get: (id) => m.get(id), set: (id, k) => void m.set(id, k), delete: (id) => void m.delete(id) }
}

export type SdkFamily = "anthropic" | "openai" | "google" | "openai-compatible"

export function sdkFamily(npm: string | undefined, api: string | undefined): SdkFamily | undefined {
  if (npm === "@ai-sdk/anthropic") return "anthropic"
  if (npm === "@ai-sdk/openai") return "openai"
  if (npm === "@ai-sdk/google") return "google"
  if (npm === "@ai-sdk/openai-compatible" && api) return "openai-compatible"
  return undefined
}
export const isSupportedNpm = (npm?: string, api?: string) => sdkFamily(npm, api) !== undefined

interface StoredConfig {
  enabled: boolean
  keyHint?: string
  baseURL?: string
}

/** Per-provider configuration (enabled, base URL override, key hint). The key goes to Credentials. */
export class ProviderSettings {
  constructor(
    private storage: Storage,
    private credentials: Credentials,
  ) {}
  private read(id: string): StoredConfig {
    return this.storage.getDoc<StoredConfig>("provider", id) ?? { enabled: true }
  }
  async get(id: string): Promise<ProviderConfig> {
    const c = this.read(id)
    const key = await this.credentials.get(id)
    return { providerID: id, enabled: c.enabled, hasKey: !!key, keyHint: key ? c.keyHint : undefined, baseURL: c.baseURL }
  }
  async list(): Promise<ProviderConfig[]> {
    const ids = this.storage.listDocs<StoredConfig & { id: string }>("provider").map((c) => c.id)
    return Promise.all(ids.map((id) => this.get(id)))
  }
  private write(id: string, c: StoredConfig) {
    this.storage.putDoc("provider", id, { ...c, id })
  }
  async setKey(id: string, key: string): Promise<ProviderConfig> {
    if (!key.trim()) throw new CortexError("invalid_request", "Key must not be empty")
    await this.credentials.set(id, key.trim())
    this.write(id, { ...this.read(id), keyHint: key.trim().slice(-4) })
    return this.get(id)
  }
  async removeKey(id: string): Promise<ProviderConfig> {
    await this.credentials.delete(id)
    const { keyHint: _drop, ...rest } = this.read(id)
    this.write(id, rest)
    return this.get(id)
  }
  async update(id: string, input: ProviderUpdateInput): Promise<ProviderConfig> {
    const c = this.read(id)
    if (input.enabled !== undefined) c.enabled = input.enabled
    if (input.baseURL !== undefined) c.baseURL = input.baseURL ?? undefined
    this.write(id, c)
    return this.get(id)
  }
  key(id: string) {
    return this.credentials.get(id)
  }
}

export interface ResolvedModel {
  family: SdkFamily
  language: LanguageModel
  provider: Provider
  model: Model
}

/** Map a models.dev provider `npm` to an AI SDK factory. */
export async function resolveModel(provider: Provider, model: Model, settings: ProviderSettings, fetchImpl?: typeof fetch): Promise<ResolvedModel> {
  const cfg = await settings.get(provider.id)
  if (!cfg.enabled) throw new CortexError("provider_disabled", `Provider ${provider.id} is disabled`)
  const baseURL = cfg.baseURL ?? provider.api
  const family = sdkFamily(provider.npm, baseURL)
  if (!family) throw new CortexError("provider_unsupported", `Provider ${provider.id} uses an unsupported SDK`)
  const apiKey = (await settings.key(provider.id)) ?? undefined
  if (!apiKey && family !== "openai-compatible") throw new CortexError("provider_key_missing", `No key configured for provider ${provider.id}`)
  const common = { apiKey, fetch: fetchImpl, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) }
  const language: LanguageModel =
    family === "anthropic"
      ? createAnthropic(common)(model.id)
      : family === "openai"
        ? createOpenAI(common)(model.id)
        : family === "google"
          ? createGoogleGenerativeAI(common)(model.id)
          : createOpenAICompatible({ name: provider.id, baseURL: baseURL!, apiKey, fetch: fetchImpl, includeUsage: true })(model.id)
  return { family, language, provider, model }
}
