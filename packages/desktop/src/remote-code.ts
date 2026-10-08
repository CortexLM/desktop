import { z } from "zod";
import type { CortexClient, CodeSession, CodeSessionCreateRequest, CodeTurnRequest, CodeLocalTaskResult, CodeCloudTaskResult } from "@cortex/sdk";
import { CodeSnapshot, CodeEnvironmentView, CodeUsageView, CodeRepositoriesView, CodeBranchesView, type CodeCreateInput, type CodeFileView, type CodeSessionView, type CodeSettingsView, type CodeWorkspaceView } from "@cortex/schema";
import { CortexError, type CodeBinding } from "@cortex/core";
import { CodeWorkspaceRefused, type MainRemoteChatBinding } from "./remote-chat";

// Live workspace read: real `git diff` from the session's own runtime, or the producer's refusal tag. No local fallback.
async function workspace(client: CortexClient, path: { id: string }): Promise<CodeWorkspaceView> {
  try {
    const result = z.object({ diff: z.string().max(4 * 1024 * 1024), exit_code: z.number().int() }).parse(await client.code.sessions.diff.list({ path }));
    return result.exit_code === 0 ? { state: "ready", diff: result.diff } : { state: "refused", reason: "unavailable" };
  } catch (error) {
    if (error instanceof CodeWorkspaceRefused) return { state: "refused", reason: error.reason };
    throw error;
  }
}

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
    return { id: id(session.id), epoch: chat.epoch, runtime: session.runtime, modelSlug: session.model_slug, title: session.title, state: session.state, delivery: "ready",
      ...(session.repo ? { repo: session.repo } : {}), ...(session.branch ? { branch: session.branch } : {}), ...(session.base_branch ? { baseBranch: session.base_branch } : {}) };
  };
  const cloud = async (): Promise<{ available: boolean; reason?: "code_compute_not_configured" }> => {
    guard();
    const result = z.object({ runtimes: z.object({ available: z.boolean(), unavailable_reason: z.string().optional() }) }).parse(await client.code.capabilities.list());
    guard();
    return result.runtimes.available ? { available: true } : { available: false, reason: "code_compute_not_configured" };
  };
  // Main-process refusal: no cloud create or prompt reaches the producer unless it admits a cloud runtime now.
  const admitCloud = async () => {
    if (!(await cloud()).available) throw new CortexError("provider_unsupported", "Cloud runtimes are not available for this account");
  };
  return {
    epoch: chat.epoch, accountID: chat.accountID, signal: chat.signal,
    models: () => chat.models(),
    cloud,
    async list() {
      guard();
      const page = await client.code.sessions.list();
      guard();
      return page.items.filter(s => s.runtime === "local" || s.runtime === "cloud").map(view);
    },
    async create(input: CodeCreateInput) {
      guard();
      if (input.epoch !== chat.epoch || input.runtime === "local" && (input.repo || input.branch)) throw new CortexError("invalid_request", "LOCAL uses the configured owned developer workspace");
      if (input.runtime === "cloud") await admitCloud();
      const body: CodeSessionCreateRequest = { runtime: input.runtime, model_slug: input.modelSlug, interaction: "agent", title: input.title, ...(input.runtime === "cloud" && input.repo ? { repo: input.repo, ...(input.branch ? { branch: input.branch } : {}) } : {}) };
      const session = await client.code.sessions.create({ body });
      guard();
      return view(session);
    },
    async snapshot(rawID: string) {
      guard();
      const path = { id: id(rawID) };
      const session = view(await client.code.sessions.get({ path }));
      const [messages, permissions, live] = await Promise.all([client.code.sessions.messages.list({ path }), client.code.sessions.permissions.list({ path }), workspace(client, path)]);
      guard();
      const result = CodeSnapshot.parse({ session, messages: z.object({ items: CodeSnapshot.shape.messages }).parse(messages).items, permissions: permissions.items, workspace: live });
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
        if (view(await client.code.sessions.get({ path: { id: sessionID }, signal: AbortSignal.any([controller.signal, chat.signal]) })).runtime === "cloud") await admitCloud();
        guard();
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
    // Read-only environment state: cloud availability and the owner's runtimes/images. No start, prepare or restore here.
    async environment() {
      const [capabilities, runtimes, images] = await Promise.all([cloud(), client.code.runtimes.list(), client.code.runtimes.images.list()]);
      guard();
      return CodeEnvironmentView.parse({ epoch: chat.epoch, cloud: capabilities, runtimes: runtimes.items, images: images.items });
    },
    async usage() {
      guard();
      const result = CodeUsageView.omit({ epoch: true }).parse(await client.code.usage.list());
      guard();
      return { epoch: chat.epoch, ...result };
    },
    // Producer pickers. GitHub access state and its public error text come from the producer; nothing is cached.
    async repositories() {
      guard();
      const raw = z.object({ items: z.array(z.object({ full_name: z.string(), default_branch: z.string().optional(), private: z.boolean(), enabled: z.boolean().optional(), source: z.enum(["github", "session"]) })), github_connected: z.boolean(), github_state: z.string(), github_error: z.string().optional() }).parse(await client.code.repositories.list());
      guard();
      return CodeRepositoriesView.parse({ epoch: chat.epoch, items: raw.items.map(r => ({ fullName: r.full_name, ...(r.default_branch ? { defaultBranch: r.default_branch } : {}), private: r.private, ...(r.enabled === undefined ? {} : { enabled: r.enabled }), source: r.source })), githubConnected: raw.github_connected, githubState: raw.github_state, ...(raw.github_error ? { githubError: raw.github_error } : {}) });
    },
    async branches(repo) {
      guard();
      const raw = z.object({ items: z.array(z.string()), github_connected: z.boolean(), github_state: z.string(), github_error: z.string().optional() }).parse(await client.http.get({ url: "/v1/code/branches", query: { repo }, throwOnError: true }));
      guard();
      return CodeBranchesView.parse({ epoch: chat.epoch, repo, items: raw.items, githubConnected: raw.github_connected, githubState: raw.github_state, ...(raw.github_error ? { githubError: raw.github_error } : {}) });
    },
    async settings(): Promise<CodeSettingsView> {
      guard();
      const result = z.object({ providers: z.array(z.object({ key: z.string(), models: z.array(z.object({ id: z.string(), name: z.string() })) })), settings: z.object({ default_model: z.string().nullable() }) }).parse(await client.code.providers.list());
      guard();
      return { epoch: chat.epoch, defaultModel: result.settings.default_model, models: result.providers.flatMap(p => p.models.map(m => ({ ref: `${p.key}/${m.id}`, name: m.name }))) };
    },
    async setDefaultModel(ref) {
      guard();
      z.object({ ok: z.literal(true) }).parse(await client.code.settings.put({ body: { default_model: ref } }));
      guard();
    },
    // Draft PR preparation: title/branch/base stored on the session. Nothing is pushed and no PR is opened.
    async prepare(rawID, input) {
      guard();
      const session = await client.code.sessions.update({ path: { id: id(rawID) }, body: { ...(input.title !== undefined ? { title: input.title } : {}), ...(input.branch ? { branch: input.branch } : {}), ...(input.baseBranch ? { base_branch: input.baseBranch } : {}) } });
      guard();
      return view(session);
    },
    // Per-file live-diff review on the session's cloud guest; the producer refuses LOCAL with its runtime tag.
    async review(rawID, path, decision) {
      guard();
      const result = z.object({ path: z.string(), decision: z.enum(["approve", "reject"]), exit_code: z.literal(0) }).parse(await client.code.sessions.diff.review.create({ path: { id: id(rawID) }, body: { path, decision } }));
      guard();
      return { path: result.path, decision: result.decision };
    },
    async instructions(rawID): Promise<CodeFileView> {
      guard();
      try {
        const result = z.object({ path: z.literal("AGENTS.md"), content: z.string().max(262144) }).parse(await client.http.get({ url: "/v1/code/sessions/{id}/file", path: { id: id(rawID) }, query: { path: "AGENTS.md" }, throwOnError: true }));
        guard();
        return { state: "ready", ...result };
      } catch (error) {
        if (error instanceof CodeWorkspaceRefused) return { state: "refused", reason: error.reason };
        // A bound workspace that refuses this one fixed path answers not-found: the repository has no AGENTS.md.
        if (error instanceof CortexError && error.code === "invalid_request") return { state: "missing" };
        throw error;
      }
    },
  };
}
