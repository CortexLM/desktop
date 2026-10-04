import { newId, SpaceCreateInput, SpaceUpdateInput, type SpaceItem } from "@cortex/schema"
import { CortexError } from "./error"
import type { Storage } from "./storage"

export class SpaceService {
  constructor(private storage: Storage) {}

  list(kind?: SpaceItem["kind"]): SpaceItem[] {
    return this.storage.listDocs<SpaceItem>("space").filter((i) => !kind || i.kind === kind)
  }
  /** Most recently opened (or updated) first. */
  recents(limit = 10): SpaceItem[] {
    const at = (i: SpaceItem) => Math.max(i.time.opened ?? 0, i.time.updated)
    return this.list().sort((a, b) => at(b) - at(a)).slice(0, limit)
  }
  get(id: string): SpaceItem {
    const i = this.storage.getDoc<SpaceItem>("space", id)
    if (!i) throw new CortexError("not_found", `Unknown space item ${id}`)
    return i
  }
  create(input: unknown): SpaceItem {
    const i = SpaceCreateInput.parse(input)
    const now = Date.now()
    const item: SpaceItem = { id: newId("space"), ...i, time: { created: now, updated: now } }
    this.storage.putDoc("space", item.id, item, undefined, now)
    return item
  }
  update(id: string, input: unknown): SpaceItem {
    const cur = this.get(id)
    const { opened, ...patch } = SpaceUpdateInput.parse(input)
    const now = Date.now()
    const item: SpaceItem = {
      ...cur,
      ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
      time: { ...cur.time, updated: Object.keys(patch).length ? now : cur.time.updated, opened: opened ? now : cur.time.opened },
    }
    this.storage.putDoc("space", id, item, undefined, item.time.created)
    return item
  }
  delete(id: string) {
    this.get(id)
    this.storage.deleteDoc("space", id)
  }
}
