import type { CortexClient } from "@cortex/sdk";
import type { RealtimeMessage } from "@cortex/api-types";
import { WorkInboxSnapshot, WorkInboxReadResult } from "@cortex/schema";
import type { WorkInboxBinding } from "@cortex/core";

/** Only safe public DTOs cross main. Events invalidate; they never project arbitrary payloads. */
export function createWorkInboxBinding(client: CortexClient, signal: AbortSignal, guard: () => void): WorkInboxBinding {
  return {
    async snapshot() {
      guard();
      const [home, notifications] = await Promise.all([client.bot.inbox.list(), client.notifications.list({ query: { limit: 100, unread: false } })]);
      guard();
      return WorkInboxSnapshot.parse({ ...home, notifications });
    },
    async read(input) { guard(); const result = await client.bot.inbox.read.create({ body: input }); guard(); return WorkInboxReadResult.parse(result); },
    async notificationRead(id) { guard(); await client.notifications.read.create({ path: { id } }); guard(); },
    async notificationsReadAll() { guard(); await client.notifications.readAll.create(); guard(); },
    watch(changed, connected, disconnected) {
      const controller = new AbortController();
      let resolve!: () => void, reject!: (error: unknown) => void;
      const ready = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
      void (async () => {
        try {
          for await (const frame of client.subscribe<RealtimeMessage>({ signal: AbortSignal.any([signal, controller.signal]), maxReconnects: 0, onResponse: () => { guard(); connected(); resolve(); } })) {
            guard(); if (controller.signal.aborted) break;
            if (frame.type === "notification" || frame.type === "resync" || frame.type === "bot") changed();
          }
        } catch (error) { reject(error); }
        finally { if (!controller.signal.aborted && !signal.aborted) { try { guard(); disconnected(); } catch { /* Owner replaced. */ } } }
      })();
      return { ready, close: () => controller.abort() };
    },
  };
}
