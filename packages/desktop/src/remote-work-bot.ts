import type { CortexClient, BotCreateRequest, BotUpdateRequest, BotTaskCreateRequest, BotMessageCreateRequest, BotMessageCreateResponse } from "@cortex/sdk";
import type { BotCapabilities, RealtimeMessage } from "@cortex/api-types";
import { WorkBotView, WorkJob, WorkBotSnapshot, WorkBotParentResponse } from "@cortex/schema";
import { CortexError, type WorkBotBinding } from "@cortex/core";
import type { MainRemoteChatBinding } from "./remote-chat";
import { BotCopyStatus, BotCopyIssued, BotCopyInvite, BotCopyInbox, BotCopyPreview, BotCopyResult, BotCopyDecline } from "@cortex/schema";
import type { BotShareCreateRequest, BotShareInviteRequest, BotShareAcceptRequest } from "@cortex/sdk";
import { createBotAppsBinding } from "./remote-bot-apps";
import { createWorkRoutinesBinding } from "./remote-work-routines";
import { createWorkInboxBinding } from "./remote-work-inbox";
import { createWorkChannelsBinding } from "./remote-work-channels";
import { createWorkActivityBinding } from "./remote-work-activity";

export function createRemoteWorkBotBinding(client: CortexClient, chat: MainRemoteChatBinding, check: () => void, openExternal?: (url: string) => Promise<void>): WorkBotBinding {
  const guard = () => { chat.signal.throwIfAborted(); check(); };
  return {
    epoch: chat.epoch, signal: chat.signal,
    apps: createBotAppsBinding(client, guard, openExternal),
    routines: createWorkRoutinesBinding(client, guard),
    inbox: createWorkInboxBinding(client, chat.signal, guard),
    activity: createWorkActivityBinding(client, chat.signal, guard),
    channels: createWorkChannelsBinding(client, guard),
    copy: {
      async status(id) { guard(); const result = await client.mascots.share.list({ path: { id } }); guard(); return BotCopyStatus.parse(result); },
      async create(id, input) { guard(); const body: BotShareCreateRequest = input; const result = await client.mascots.share.create({ path: { id }, body }); guard(); return BotCopyIssued.parse(result); },
      async invite(id, email) { guard(); const body: BotShareInviteRequest = { email }; const result = await client.mascots.share.invites.create({ path: { id }, body }); guard(); return BotCopyInvite.parse(result); },
      async revoke(id) { guard(); await client.mascots.share.delete({ path: { id } }); guard(); },
      async inbox() { guard(); const result = await client.bot.shareInvites.list(); guard(); return BotCopyInbox.array().parse(result); },
      async preview(id) { guard(); const result = await client.bot.shareInvites.get({ path: { id } }); guard(); return BotCopyPreview.parse(result); },
      async accept(id, input) { guard(); const body: BotShareAcceptRequest = input; const result = await client.bot.shareInvites.accept.create({ path: { id }, body }); guard(); return BotCopyResult.parse(result); },
      async decline(id) { guard(); const result = BotCopyDecline.parse(await client.bot.shareInvites.decline.create({ path: { id } })); guard(); if (result.id !== id) throw new CortexError("provider_error", "Invitation identity did not match"); return result; },
    },
    async list() { guard(); const page = await client.mascots.list(); guard(); return page.items.map(bot => WorkBotView.parse(bot)); },
    async create(config) {
      guard(); const body: BotCreateRequest = config;
      const bot = await client.mascots.create({ body }); guard(); return WorkBotView.parse(bot);
    },
    async update(id, config) {
      guard(); const body: BotUpdateRequest = config;
      const bot = await client.mascots.update({ path: { id }, body }); guard(); return WorkBotView.parse(bot);
    },
    async snapshot(id) {
      guard();
      const [bot, tasks, messages, capabilities] = await Promise.all([
        client.mascots.get({ path: { id } }), client.mascots.tasks.list({ path: { id } }),
        client.mascots.messages.list({ path: { id } }), client.bot.capabilities.list(),
      ]);
      guard();
      // The shared admitted capability DTO is the canonical boundary; unrelated generic fields stay private.
      const available = typeof capabilities === "object" && capabilities !== null && "computer" in capabilities && typeof capabilities.computer === "object" && capabilities.computer !== null && "available" in capabilities.computer ? capabilities.computer.available : undefined;
      if (typeof available !== "boolean") throw new CortexError("provider_error", "Bot computer capability is unavailable");
      const computerAvailable: BotCapabilities["computer"]["available"] = available;
      const snapshot = WorkBotSnapshot.omit({ epoch: true }).parse({ bot, jobs: tasks.items, messages: messages.items, computerAvailable });
      if (snapshot.bot.id !== id) throw new CortexError("provider_error", "Bot identity did not match");
      return snapshot;
    },
    async enqueue(id, input) {
      guard(); const body: BotTaskCreateRequest = input;
      const task = await client.mascots.tasks.create({ path: { id }, body }); guard(); return WorkJob.parse(task);
    },
    async parent(id, text) {
      guard(); const body: BotMessageCreateRequest = { text };
      const result: BotMessageCreateResponse = await client.mascots.messages.create({ path: { id }, body });
      guard(); return WorkBotParentResponse.parse(result);
    },
    async cancel(id, tid) {
      guard(); const task = await client.mascots.tasks.cancel.create({ path: { id, tid } }); guard(); return WorkJob.parse(task);
    },
    watch(changed, disconnected) {
      const controller = new AbortController(); let resolve!: () => void, reject!: (error: unknown) => void;
      const ready = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
      void (async () => {
        try {
          for await (const event of client.subscribe<RealtimeMessage>({ signal: AbortSignal.any([controller.signal, chat.signal]), maxReconnects: 0, onResponse: () => { guard(); resolve(); } })) {
            guard();
            if (event.type === "bot") changed(event.mascot_id);
            else if (event.type === "resync") changed();
          }
        } catch (error) { reject(error); }
        finally { disconnected(); }
      })();
      return { ready, close: () => controller.abort() };
    },
  };
}

/** Separate policy; existing Chat/Code allowlist and authentication logic remain intact. */
export async function workBotFetch(request: Request, owner: { origin: string; fetch: typeof fetch; signal: AbortSignal; check(): void; unauthorized(): void }): Promise<Response> {
  owner.check();
  const url = new URL(request.url), uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const item = new RegExp(`^/v1/mascots/${uuid}$`), tasks = new RegExp(`^/v1/mascots/${uuid}/tasks$`);
  const activityEvents = request.method === "GET" && new RegExp(`^/v1/mascots/${uuid}/events$`).test(url.pathname);
  const activityStream = activityEvents && (request.headers.get("accept") ?? "").includes("text/event-stream");
  if (activityEvents && (activityStream ? url.search !== "" : [...url.searchParams].some(([key, value]) => key !== "limit" || !/^(?:[1-9]|[1-9][0-9]|1[0-9][0-9]|200)$/.test(value)))) throw new CortexError("invalid_request", "Invalid activity query");
  const stream = request.method === "GET" && url.pathname === "/v1/realtime/events" || activityStream;
  const channelList = url.pathname === "/v1/channels", channelItem = new RegExp(`^/v1/channels/${uuid}$`).test(url.pathname);
  const channel = channelList && ["GET", "POST"].includes(request.method) || channelItem && ["GET", "PATCH", "DELETE"].includes(request.method);
  if (channel && ["GET", "DELETE"].includes(request.method) && (await request.clone().arrayBuffer()).byteLength) throw new CortexError("invalid_request", "Channel read or removal requires an empty body");
  const routineList = new RegExp(`^/v1/mascots/${uuid}/routines$`).test(url.pathname);
  const routineItem = new RegExp(`^/v1/mascots/${uuid}/routines/${uuid}$`).test(url.pathname);
  const routineControl = request.method === "POST" && new RegExp(`^/v1/mascots/${uuid}/routines/${uuid}/(?:pause|resume)$`).test(url.pathname);
  const routineEvent = request.method === "POST" && url.pathname === "/v1/bot/routines/events";
  const inboxRead = request.method === "GET" && url.pathname === "/v1/bot/inbox";
  const inboxWrite = request.method === "POST" && url.pathname === "/v1/bot/inbox/read";
  const notifications = request.method === "GET" && url.pathname === "/v1/notifications";
  const notificationWrite = request.method === "POST" && (url.pathname === "/v1/notifications/read-all" || /^\/v1\/notifications\/ntf_[0-9A-HJKMNP-TV-Z]{26}\/read$/i.test(url.pathname));
  if (notifications && Array.from(url.searchParams).some(([key, value]) => key !== "unread" && key !== "limit" || key === "unread" && value !== "true" && value !== "false" || key === "limit" && !/^\d+$/.test(value))) throw new CortexError("invalid_request", "Invalid notification query");
  if (notificationWrite && (await request.clone().arrayBuffer()).byteLength) throw new CortexError("invalid_request", "Notification read requires an empty body");
  const routine = request.method === "GET" && (routineList || routineItem || new RegExp(`^/v1/mascots/${uuid}/routines/${uuid}/runs$`).test(url.pathname)) || request.method === "POST" && routineList || ["PATCH", "DELETE"].includes(request.method) && routineItem || routineControl || routineEvent;
  if ((routineControl || routineItem && request.method === "DELETE") && (await request.clone().arrayBuffer()).byteLength) throw new CortexError("invalid_request", "Routine control requires an empty body");
  const copyShare = new RegExp(`^/v1/mascots/${uuid}/share$`).test(url.pathname);
  const copyInvite = request.method === "POST" && new RegExp(`^/v1/mascots/${uuid}/share/invites$`).test(url.pathname);
  const copyRead = request.method === "GET" && (copyShare || url.pathname === "/v1/bot/share-invites" || new RegExp(`^/v1/bot/share-invites/${uuid}$`).test(url.pathname));
  const copyAccept = request.method === "POST" && new RegExp(`^/v1/bot/share-invites/${uuid}/accept$`).test(url.pathname);
  const copyDecline = request.method === "POST" && new RegExp(`^/v1/bot/share-invites/${uuid}/decline$`).test(url.pathname);
  if (copyDecline && (await request.clone().arrayBuffer()).byteLength) throw new CortexError("invalid_request", "Decline requires an empty body");
  const copyWrite = copyInvite || copyAccept || copyDecline || copyShare && ["POST", "DELETE"].includes(request.method);
  const plugin = new RegExp("^/v1/plugins/[a-z0-9][a-z0-9_-]{0,119}$").test(url.pathname);
  const pluginConnect = request.method === "POST" && new RegExp("^/v1/plugins/[a-z0-9][a-z0-9_-]{0,119}/connect$").test(url.pathname);
  const catalog = request.method === "GET" && url.pathname === "/v1/plugins/catalog" && [...url.searchParams.keys()].every(key => key === "q" || key === "limit");
  const appRead = request.method === "GET" && (catalog || url.pathname === "/v1/plugins/connections" || new RegExp(`^/v1/mascots/${uuid}/(?:connectors|approvals|tool-policy)$`).test(url.pathname));
  const evaluations = request.method === "GET" && new RegExp(`^/v1/mascots/${uuid}/tool-policy/evaluations$`).test(url.pathname) && [...url.searchParams.keys()].every(key => key === "limit") && (!url.searchParams.has("limit") || /^(?:[1-9]|[1-9][0-9]|100)$/.test(url.searchParams.get("limit")!));
  const pendingRead = request.method === "GET" && (url.pathname === "/v1/bot/approvals" || new RegExp(`^/v1/mascots/${uuid}/approvals/pending$`).test(url.pathname));
  const decision = request.method === "POST" && new RegExp(`^/v1/mascots/${uuid}/messages/${uuid}/respond$`).test(url.pathname);
  if (decision) {
    const body: unknown = await request.clone().json();
    if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || !("action" in body) || !["allow", "deny"].includes(String(body.action))) throw new CortexError("invalid_request", "Invalid approval decision");
  }
  const appWrite = pluginConnect || plugin && ["PATCH", "DELETE"].includes(request.method) || request.method === "PUT" && new RegExp(`^/v1/mascots/${uuid}/connectors/pcn_[0-7][0-9A-HJKMNP-TV-Z]{25}$`).test(url.pathname) || request.method === "POST" && new RegExp(`^/v1/mascots/${uuid}/approvals$`).test(url.pathname) || request.method === "DELETE" && new RegExp(`^/v1/mascots/${uuid}/approvals/${uuid}$`).test(url.pathname);
  const get = request.method === "GET" && (url.pathname === "/v1/mascots" || url.pathname === "/v1/bot/capabilities" || item.test(url.pathname) || tasks.test(url.pathname) || new RegExp(`^/v1/mascots/${uuid}/(?:messages|tasks/${uuid})$`).test(url.pathname));
  const write = request.method === "POST" && (url.pathname === "/v1/mascots" || tasks.test(url.pathname) || new RegExp(`^/v1/mascots/${uuid}/(?:messages|tasks/${uuid}/cancel)$`).test(url.pathname)) || request.method === "PATCH" && item.test(url.pathname);
  if (url.origin !== owner.origin || url.search && !catalog && !evaluations && !notifications && !activityEvents || !get && !write && !stream && !activityEvents && !copyRead && !copyWrite && !appRead && !appWrite && !pendingRead && !decision && !evaluations && !routine && !inboxRead && !inboxWrite && !notifications && !notificationWrite && !channel) throw new CortexError("invalid_request", "Invalid Bot request");
  const signal = AbortSignal.any([request.signal, owner.signal, ...(stream ? [] : [AbortSignal.timeout(10000)])]);
  let response: Response | undefined;
  let rejectAbort!: (error: unknown) => void;
  const cancelled = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const onAbort = () => rejectAbort(new CortexError("aborted", "Bot owner changed"));
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  try {
    response = await Promise.race([owner.fetch(new Request(request, { signal, redirect: "error", credentials: "omit" })).then(res => { if (signal.aborted) { void res.body?.cancel().catch(() => undefined); signal.throwIfAborted(); } return res; }), cancelled]);
    owner.check(); signal.throwIfAborted();
    if (response.redirected || response.url && new URL(response.url).origin !== owner.origin) throw new Error("Bot redirect refused");
    if (response.status === 401) owner.unauthorized();
    const expected = channelList && request.method === "POST" ? 201 : notificationWrite ? 204 : copyDecline ? 200 : (copyShare || plugin) && request.method === "DELETE" ? 204 : copyWrite || request.method === "POST" && (routineList || new RegExp(`^/v1/mascots/${uuid}/approvals$`).test(url.pathname)) ? 201 : request.method === "POST" && url.pathname === "/v1/mascots" ? 201 : request.method === "POST" && tasks.test(url.pathname) ? 202 : 200;
    if (channel && response.status !== expected) throw new CortexError(response.status === 404 ? "not_found" : response.status === 422 ? "invalid_request" : response.status === 409 ? "conflict" : response.status === 401 || response.status === 403 ? "provider_auth_failed" : "provider_error", "Channel request did not complete");
    if (response.status !== expected) throw new CortexError(response.status === 401 ? "provider_auth_failed" : (notificationWrite || routine || decision || pendingRead || evaluations || activityEvents) && response.status === 404 ? "not_found" : (inboxWrite || notificationWrite || routine || decision || pendingRead || evaluations) && response.status === 422 ? "invalid_request" : "provider_error", "Bot request did not complete");
    if (expected === 204) { owner.check(); return new Response(null, { status: 204 }); }
    if (stream) {
      if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) throw new Error("Invalid Bot events");
      const reader = response.body.getReader();
      const abort = () => { void reader.cancel().catch(() => undefined); };
      signal.addEventListener("abort", abort, { once: true });
      return new Response(new ReadableStream<Uint8Array>({
        async pull(controller) {
          try { const chunk = await reader.read(); owner.check(); signal.throwIfAborted(); if (chunk.done) { signal.removeEventListener("abort", abort); controller.close(); } else controller.enqueue(chunk.value); }
          catch (error) { signal.removeEventListener("abort", abort); controller.error(error); void reader.cancel().catch(() => undefined); }
        },
        cancel() { signal.removeEventListener("abort", abort); return reader.cancel(); },
      }), { headers: { "Content-Type": "text/event-stream" } });
    }
    const reader = response.body?.getReader(), chunks: Uint8Array[] = []; let size = 0;
    try {
      while (reader) { const chunk = await Promise.race([reader.read(), cancelled]); if (chunk.done) break; size += chunk.value.byteLength; if (size > 4 * 1024 * 1024) throw new Error("Bot response too large"); chunks.push(chunk.value); }
      owner.check(); signal.throwIfAborted();
      return new Response(Buffer.concat(chunks), { status: expected, headers: { "Content-Type": "application/json" } });
    } finally { void reader?.cancel().catch(() => undefined); }
  } catch (error) { void response?.body?.cancel().catch(() => undefined); throw error instanceof CortexError ? error : new CortexError("provider_error", "Bot request did not complete"); }
  finally { signal.removeEventListener("abort", onAbort); }
}
