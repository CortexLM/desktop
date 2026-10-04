import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { capabilities, Provider, type Model, type ModelCapabilities, type ModelInfo, type ProviderSummary } from "@cortex/schema"
import { z } from "zod"
import { CortexError } from "./error"
import { isSupportedNpm } from "./provider"

export const CATALOG_URL = "https://models.dev/api.json"

export function parseCatalog(json: unknown): Record<string, Provider> {
  const raw = z.record(z.string(), z.unknown()).parse(json)
  const out: Record<string, Provider> = {}
  for (const [id, value] of Object.entries(raw)) {
    const p = Provider.safeParse(value)
    if (!p.success) continue // skip malformed providers rather than failing the whole catalog
    out[id] = p.data
  }
  return out
}

export interface CatalogOptions {
  /** Where models.json is cached; no cache when omitted. */
  cacheDir?: string
  url?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

/** models.dev catalog: network first with timeout, falls back to the on-disk cache when offline. */
export class Catalog {
  private data?: Record<string, Provider>
  private loading?: Promise<Record<string, Provider>>
  source: "network" | "cache" | "memory" | "none" = "none"
  constructor(private opts: CatalogOptions) {}

  private get file() {
    return this.opts.cacheDir && join(this.opts.cacheDir, "models.json")
  }

  /** Inject data directly (tests, embedded fixtures). */
  set(json: unknown) {
    this.data = parseCatalog(json)
    this.source = "memory"
  }

  async refresh(): Promise<Record<string, Provider>> {
    const f = this.opts.fetch ?? fetch
    try {
      const res = await f(this.opts.url ?? CATALOG_URL, { signal: AbortSignal.timeout(this.opts.timeoutMs ?? 10_000) })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const text = await res.text()
      this.data = parseCatalog(JSON.parse(text))
      this.source = "network"
      if (this.opts.cacheDir) await mkdir(this.opts.cacheDir, { recursive: true }).then(() => writeFile(this.file!, text)).catch(() => undefined)
      return this.data
    } catch {
      try {
        if (!this.file) throw new Error("no cache")
        this.data = parseCatalog(JSON.parse(await readFile(this.file, "utf8")))
        this.source = "cache"
        return this.data
      } catch {
        if (this.data) return this.data
        throw new CortexError("catalog_unavailable", "Model catalog unavailable: network failed and no cache present")
      }
    }
  }

  async load(): Promise<Record<string, Provider>> {
    if (this.data) return this.data
    this.loading ??= this.refresh().finally(() => (this.loading = undefined))
    return this.loading
  }

  async providers(): Promise<ProviderSummary[]> {
    const data = await this.load()
    return Object.values(data).map(({ models, ...p }) => ({ ...p, supported: isSupportedNpm(p.npm, p.api), modelCount: Object.keys(models).length }))
  }

  async provider(id: string): Promise<Provider | undefined> {
    return (await this.load())[id]
  }

  async models(providerID: string): Promise<ModelInfo[]> {
    const p = await this.provider(providerID)
    if (!p) throw new CortexError("not_found", `Unknown provider ${providerID}`)
    return Object.values(p.models).map((m) => info(providerID, m))
  }

  async model(providerID: string, modelID: string): Promise<Model | undefined> {
    return (await this.provider(providerID))?.models[modelID]
  }

  async capabilities(providerID: string, modelID: string): Promise<ModelCapabilities | undefined> {
    const m = await this.model(providerID, modelID)
    return m && capabilities(m)
  }

  /** Case-insensitive substring search over provider and model ids/names; all terms must match. */
  async search(query: string, limit = 50): Promise<ModelInfo[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    const data = await this.load()
    const out: ModelInfo[] = []
    for (const p of Object.values(data)) {
      for (const m of Object.values(p.models)) {
        const hay = `${p.id} ${p.name} ${m.id} ${m.name} ${m.family ?? ""}`.toLowerCase()
        if (terms.every((t) => hay.includes(t))) out.push(info(p.id, m))
        if (out.length >= limit) return out
      }
    }
    return out
  }
}

const info = (providerID: string, m: Model): ModelInfo => ({ ...m, providerID, capabilities: capabilities(m) })
