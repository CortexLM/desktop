import { z } from "zod";
import type { CortexClient, CodeSession, CodeSessionCreateRequest, CodeTurnRequest, CodeLocalTaskResult, CodeCloudTaskResult } from "@cortex/sdk";
import { CodeSnapshot, type CodeCreateInput, type CodeSessionView } from "@cortex/schema";
import { CortexError, type CodeBinding } from "@cortex/core";
import type { MainRemoteChatBinding } from "./remote-chat";

const id = (value: string) => {
  if (!/^cnv_[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/.test(value)) throw new CortexError("invalid_request", "Invalid Code session");
  return value;
};
const TaskCompleted = z.object({ type: z.literal("task_completed"), id: z.string(), kind: z.enum(["explore", "research", "executor", "general-purpose"]), status: z.literal("completed"), summary: z.string() });
const TaskFailed = TaskCompleted.extend({ type: z.literal("task_failed"), status: z.enum(["failed", "interrupted", "incomplete", "cancelled", "execution_unknown"]) });
const Started = TaskCompleted.omit({ status: true, summary: true }).extend({ type: z.literal("task_started"), status: z.literal("queued").optional() });
// Exact public LOCAL/cloud discriminants; task results remain part of the original parent transcript.
const taskResult = (value: unknown, runtime: "local" | "cloud"): CodeLocalTaskResult | CodeCloudTaskResult => {
  const result = z.union([TaskCompleted, TaskFailed, Started]).parse(value);
  if (result.type === "task_started" && (runtime === "local" ? result.status !== "queued" : result.status !== undefined)) throw new Error("Invalid Code task boundary");
  if (result.type === "task_failed" && (runtime === "local" ? !["failed", "interrupted"].includes(result.status) : !["incomplete", "cancelled", "execution_unknown"].includes(result.status))) throw new Error("Invalid Code task result");
  return result as CodeLocalTaskResult | CodeCloudTaskResult;
};

export function createRemoteCodeBinding(client: CortexClient, chat: MainRemoteChatBinding, check: () => void): CodeBinding {
  const guard = () => { check(); chat.signal.throwIfAborted(); };
  const view = (session: CodeSession): CodeSessionView => {
    if (session.runtime !== "local" && session.runtime !== "cloud") throw new CortexError("provider_unsupported", "This Code runtime is outside the admitted desktop subset");
    return { id: id(session.id), epoch: chat.epoch, runtime: session.runtime, modelSlug: session.model_slug, title: session.title, state: session.state, delivery: "ready" };
  };
  return {
    epoch: chat.epoch, accountID: chat.accountID, signal: chat.signal,
    models: () => chat.models(),
    async list() {
      guard();
      const page = await client.code.sessions.list();
      guard();
      return page.items.filter(s => s.runtime === "local" || s.runtime === "cloud").map(view);
    },
    async create(input: CodeCreateInput) {
      guard();
      if (input.epoch !== chat.epoch || input.runtime === "local" && input.repo) throw new CortexError("invalid_request", "LOCAL uses the configured owned developer workspace");
      const body: CodeSessionCreateRequest = { runtime: input.runtime, model_slug: input.modelSlug, interaction: "agent", title: input.title, ...(input.runtime === "cloud" && input.repo ? { repo: input.repo } : {}) };
      const session = await client.code.sessions.create({ body });
      guard();
      return view(session);
    },
    async snapshot(rawID: string) {
      guard();
      const path = { id: id(rawID) };
      const session = view(await client.code.sessions.get({ path }));
      const [messages, permissions] = await Promise.all([client.code.sessions.messages.list({ path }), client.code.sessions.permissions.list({ path })]);
      guard();
      const result = CodeSnapshot.parse({ session, messages: z.object({ items: CodeSnapshot.shape.messages }).parse(messages).items, permissions: permissions.items });
      for (const message of result.messages) for (const tool of message.tools) if (tool.tool_name === "task" && tool.result) {
        let parsed: unknown;
        try { parsed = JSON.parse(tool.result); } catch { continue; }
        if (parsed && typeof parsed === "object" && "type" in parsed) taskResult(parsed, session.runtime);
      }
      return result;
    },
    turn(rawID, message, admitted, changed) {
      guard();
      const sessionID = id(rawID), controller = new AbortController();
      const body: CodeTurnRequest = { message, mode: "code", interaction: "agent" };
      const done = (async () => {
        for await (const event of client.streamCodeTurn(sessionID, { body, idempotencyKey: crypto.randomUUID() }, {
          signal: AbortSignal.any([controller.signal, chat.signal]), maxReconnects: 0,
          onResponse(response) {
            guard();
            if (response.headers.get("x-conversation-id") !== sessionID || !/^msg_[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/.test(response.headers.get("x-message-id") ?? "")) throw new Error("Invalid Code admission");
            admitted();
          },
        })) {
          guard();
          changed();
          if (event.type === "error") throw new CortexError("provider_error", "Code turn failed");
          if (event.type === "done" && event.finish_reason !== "stop") throw new CortexError("provider_error", "Code did not finish successfully");
        }
      })();
      return { done, detach: () => controller.abort() };
    },
    watch(rawID, changed) {
      guard();
      const controller = new AbortController();
      let resolveReady!: () => void, rejectReady!: (error: unknown) => void;
      const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
      void (async () => {
        try {
          for await (const event of client.subscribePath(`/v1/code/sessions/${id(rawID)}/events`, {
            signal: AbortSignal.any([controller.signal, chat.signal]), maxReconnects: 0,
            onResponse: () => { guard(); resolveReady(); },
          })) {
            guard();
            if (event.resource !== "code_session") throw new Error("Invalid Code event owner");
            changed();
          }
        } catch (error) { rejectReady(error); }
      })();
      return { ready, close: () => controller.abort() };
    },
    async decide(rawID, permissionID, decision) {
      guard();
      if (!/^prm_[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/.test(permissionID)) throw new CortexError("invalid_request", "Invalid Code permission");
      await client.code.sessions.permissions.create({ path: { id: id(rawID), prompt_id: permissionID }, body: { decision } });
      guard();
    },
    async stop(rawID) { guard(); await client.code.sessions.cancel.create({ path: { id: id(rawID) } }); guard(); },
  };
}
