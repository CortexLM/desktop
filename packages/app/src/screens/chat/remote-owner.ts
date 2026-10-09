import type { RemoteSessionView } from "@cortex/schema";
import { api } from "../../api";
import { shared } from "../../state/shared";

// All Chat catalogue readers must load the same endpoint: concurrent core reads retire one another.
export const remoteChatModels = () => shared("chat-feature-models", () => api.remoteSessions.models());

// Either scope belongs to the current binding: "account" when main verified `/v1/me.id`, "process" otherwise.
export const ownsRemoteSession = (value: RemoteSessionView, id: string, epoch: string) =>
  value.source === "remote" && value.id === id && value.epoch === epoch;
