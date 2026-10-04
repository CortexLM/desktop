import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import type { Skill } from "@cortex/schema"
import type { Storage } from "./storage"

/** Minimal YAML frontmatter reader: `key: value` lines only (quotes stripped). */
export function frontmatter(text: string): { data: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!m) return { data: {}, body: text }
  const data: Record<string, string> = {}
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(\S.*)?$/.exec(line)
    if (kv) data[kv[1]!] = (kv[2] ?? "").trim().replace(/^(['"])(.*)\1$/, "$2")
  }
  return { data, body: text.slice(m[0].length) }
}

export interface SkillDirs {
  builtin?: string
  personal?: string
  public?: string
}

/** SKILL.md discovery across builtin, personal, public and project `.cortex/skills` dirs. Later sources shadow earlier ones by name. */
export class SkillService {
  constructor(
    private dirs: SkillDirs,
    private storage: Storage,
  ) {}

  async list(project?: string): Promise<Skill[]> {
    const sources: [Skill["source"], string | undefined][] = [
      ["builtin", this.dirs.builtin],
      ["public", this.dirs.public],
      ["personal", this.dirs.personal],
      ["project", project && join(project, ".cortex", "skills")],
    ]
    const byName = new Map<string, Skill>()
    for (const [source, dir] of sources) {
      if (!dir) continue
      for (const s of await scan(dir)) {
        const state = this.storage.getDoc<{ enabled: boolean }>("skill-state", s.name)
        byName.set(s.name, { ...s, source, enabled: state?.enabled ?? true })
      }
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  setEnabled(name: string, enabled: boolean) {
    this.storage.putDoc("skill-state", name, { enabled })
  }

  async load(name: string, project?: string): Promise<{ skill: Skill; content: string } | undefined> {
    const skill = (await this.list(project)).find((s) => s.name === name && s.enabled)
    if (!skill) return undefined
    return { skill, content: frontmatter(await readFile(skill.path, "utf8")).body }
  }
}

async function scan(dir: string): Promise<Omit<Skill, "source" | "enabled">[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const out: Omit<Skill, "source" | "enabled">[] = []
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const path = join(dir, e.name, "SKILL.md")
    const text = await readFile(path, "utf8").catch(() => undefined)
    if (text === undefined) continue
    const { data } = frontmatter(text)
    out.push({ name: data.name || e.name, description: data.description ?? "", path })
  }
  return out
}
