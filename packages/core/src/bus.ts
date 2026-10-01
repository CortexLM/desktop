import type { Event, EventOf, EventType } from "@cortex/schema"
import { DURABLE, type Storage } from "./storage"

type Listener = (e: Event) => void

/** Typed in-process pub/sub. Durable events are committed to storage before listeners run. */
export class Bus {
  private listeners = new Set<Listener>()
  constructor(private storage?: Storage) {}

  publish<T extends EventType>(type: T, properties: EventOf<T>["properties"]) {
    // clone: publishers keep mutating their working objects after publishing
    const e = { type, properties: structuredClone(properties) } as Event
    if (this.storage && DURABLE.has(type)) this.storage.append(e)
    for (const l of [...this.listeners]) {
      try {
        l(e)
      } catch {
        // a faulty subscriber must not break the publisher
      }
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  on<T extends EventType>(type: T, fn: (e: EventOf<T>) => void): () => void {
    return this.subscribe((e) => e.type === type && fn(e as EventOf<T>))
  }
}
