import type { RemoteSessionView } from "@cortex/schema";

// Either scope belongs to the current binding: "account" when main verified `/v1/me.id`, "process" otherwise.
export const ownsRemoteSession = (value: RemoteSessionView, id: string, epoch: string) =>
  value.source === "remote" && value.id === id && value.epoch === epoch;
