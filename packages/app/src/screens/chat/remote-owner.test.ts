import { expect, it } from "vitest";
import { RemoteSessionView } from "@cortex/schema";
import { ownsRemoteSession } from "./remote-owner";

const view = (scope: "process" | "account") => RemoteSessionView.parse({
  id: "ses_1", source: "remote", epoch: "epoch-1", scope, title: "", modelSlug: "cortex-1-mini", effort: "medium", state: "ready", time: { created: 1, updated: 1 },
});

it("owns process and account scoped sessions of the current binding only", () => {
  expect(ownsRemoteSession(view("process"), "ses_1", "epoch-1")).toBe(true);
  expect(ownsRemoteSession(view("account"), "ses_1", "epoch-1")).toBe(true);
  expect(ownsRemoteSession(view("account"), "ses_2", "epoch-1")).toBe(false);
  expect(ownsRemoteSession(view("account"), "ses_1", "epoch-2")).toBe(false);
});
