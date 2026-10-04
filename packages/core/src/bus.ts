import type { Event, EventOf, EventType } from "@cortex/schema"
import { DURABLE, type Storage } from "./storage"

type Source = "local" | "remote"
type Listener = (e: Event, source: Source) => void

/** Typed in-process pub/sub. Local durable events commit before delivery; source is never serialized. */
export class Bus {
  private listeners = new Set<Listener>()
  constructor(private storage?: Storage) {}

  publish<T extends EventType>(type: T, properties: EventOf<T>["properties"], source: Source = "local") {
    // clone: publishers keep mutating their working objects after publishing
    const e = { type, properties: structuredClone(properties) } as Event
    if (source === "local" && this.storage && DURABLE.has(type)) this.storage.append(e)
    for (const l of [...this.listeners]) {
      try {
        l(e, source)
      } catch {
        // a faulty subscriber must not break the publisher
      }
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  on<T extends EventType>(type: T, fn: (e: EventOf<T>, source: Source) => void): () => void {
    return this.subscribe((e, source) => e.type === type && fn(e as EventOf<T>, source))
  }
}
