import { expect, it, vi } from "vitest";
import { RemoteSessionView } from "@cortex/schema";
vi.mock("../../api", () => ({ api: { remoteSessions: { models: vi.fn() } } }));
import { api } from "../../api";
import { forget } from "../../state/shared";
import { ownsRemoteSession, remoteChatModels } from "./remote-owner";

const view = (scope: "process" | "account") => RemoteSessionView.parse({
  id: "ses_1", source: "remote", epoch: "epoch-1", scope, title: "", modelSlug: "cortex-1-mini", effort: "medium", state: "ready", time: { created: 1, updated: 1 },
});

it("owns process and account scoped sessions of the current binding only", () => {
  expect(ownsRemoteSession(view("process"), "ses_1", "epoch-1")).toBe(true);
  expect(ownsRemoteSession(view("account"), "ses_1", "epoch-1")).toBe(true);
  expect(ownsRemoteSession(view("account"), "ses_2", "epoch-1")).toBe(false);
  expect(ownsRemoteSession(view("account"), "ses_1", "epoch-2")).toBe(false);
});

it("coalesces concurrent Chat catalogues but rereads after settlement", async () => {
  forget("chat-feature-models");
  const catalog = { epoch: "epoch-1", models: [] };
  let release!: (value: typeof catalog) => void;
  const pending = new Promise<typeof catalog>(resolve => { release = resolve; });
  vi.mocked(api.remoteSessions.models).mockReturnValueOnce(pending).mockResolvedValueOnce(catalog);
  const chat = remoteChatModels(), share = remoteChatModels();
  expect(share).toBe(chat);
  expect(api.remoteSessions.models).toHaveBeenCalledTimes(1);
  release(catalog);
  expect(await Promise.all([chat, share])).toEqual([catalog, catalog]);
  expect(await remoteChatModels()).toEqual(catalog);
  expect(api.remoteSessions.models).toHaveBeenCalledTimes(2);
});
