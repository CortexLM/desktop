import { projectAgentEvent, type CortexClient } from "@cortex/sdk";
import { WorkActivity } from "@cortex/schema";
import type { WorkActivityBinding } from "@cortex/core";

// Only `projectAgentEvent` output crosses main; payload/user_id never reach IPC.
const project = (id: string, event: unknown) => {
  const activity = projectAgentEvent(event);
  return activity && activity.resource === "mascot" && activity.resource_id === id.toLowerCase() ? WorkActivity.parse(activity) : undefined;
};

/** Process-local SSE hints invalidate a fresh JSON page; no since cursor, durable feed or replay. */
export function createWorkActivityBinding(client: CortexClient, signal: AbortSignal, guard: () => void): WorkActivityBinding {
  return {
    async list(id) {
      guard(); const page = await client.mascots.events.list({ path: { id }, query: { limit: 200 } }); guard();
      return page.items.flatMap(event => project(id, event) ?? []).reverse();
    },
    watch(id, changed, connected, disconnected) {
      const controller = new AbortController();
      let resolve!: () => void, reject!: (error: unknown) => void;
      const ready = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
      void (async () => {
        try {
          for await (const frame of client.subscribePath(`/v1/mascots/${encodeURIComponent(id)}/events`, { signal: AbortSignal.any([signal, controller.signal]), maxReconnects: 0, onResponse: () => { guard(); connected(); resolve(); } })) {
            guard(); if (controller.signal.aborted) break;
            if (project(id, frame)) changed();
          }
        } catch (error) { reject(error); }
        finally { if (!controller.signal.aborted && !signal.aborted) { try { guard(); disconnected(); } catch { /* Owner replaced. */ } } }
      })();
      return { ready, close: () => controller.abort() };
    },
  };
}
