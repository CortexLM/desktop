import { newId, ProjectCreateInput, ProjectID, ProjectUpdateInput, type Project } from "@cortex/schema"
import type { Bus } from "./bus"
import { CortexError } from "./error"
import type { Storage } from "./storage"

export class ProjectService {
  isBusy?: (sessionID: string) => boolean
  constructor(private storage: Storage, private bus: Bus) {}

  list(): Project[] {
    return this.storage.listDocs<Project>("project").sort((a, b) => b.time.updated - a.time.updated || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  }
  get(id: string): Project {
    const project = this.storage.getDoc<Project>("project", ProjectID.parse(id))
    if (!project) throw new CortexError("not_found", "Project not found")
    return project
  }
  create(input: unknown): Project {
    const fields = ProjectCreateInput.parse(input)
    const id = newId("project")
    if (this.storage.getDoc("project", id)) throw new CortexError("conflict", "Project ID already exists")
    const now = Date.now()
    const project: Project = { id, ...fields, time: { created: now, updated: now } }
    this.storage.putDoc("project", id, project, undefined, now)
    this.bus.publish("project.changed", { projectID: id })
    return project
  }
  update(id: string, input: unknown): Project {
    const current = this.get(id)
    const patch = Object.fromEntries(Object.entries(ProjectUpdateInput.parse(input)).filter(([, value]) => value !== undefined))
    const project: Project = { ...current, ...patch, time: { ...current.time, updated: Date.now() } }
    this.storage.putDoc("project", id, project, undefined, project.time.updated)
    this.bus.publish("project.changed", { projectID: id })
    return project
  }
  delete(id: string) {
    this.get(id)
    if (this.storage.sessions().some((s) => s.projectID === id && this.isBusy?.(s.id)))
      throw new CortexError("session_busy", "Project has an active conversation")
    this.bus.publish("project.deleted", { projectID: id })
  }
}
