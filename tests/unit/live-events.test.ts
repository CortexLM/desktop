import { afterEach, expect, it, vi } from "vitest";

const subscriptions = vi.hoisted(() => [] as { stop: ReturnType<typeof vi.fn>; error: (error: unknown) => void }[]);
vi.mock("../../packages/app/src/api", () => ({ api: { subscribe: (_event: unknown, options: { onError: (error: unknown) => void }) => {
  const stop = vi.fn();
  subscriptions.push({ stop, error: options.onError });
  return stop;
} } }));
import { onEvent } from "../../packages/app/src/state/live";

afterEach(() => { vi.useRealTimers(); subscriptions.length = 0; });

it("reconnects an errored stream and closes it when its last listener leaves", () => {
  vi.useFakeTimers();
  const refresh = vi.fn();
  const stop = onEvent(() => undefined, refresh);
  expect(subscriptions).toHaveLength(1);
  subscriptions[0].error(new Error("transport closed"));
  expect(refresh).toHaveBeenCalledOnce();
  vi.runOnlyPendingTimers();
  expect(subscriptions).toHaveLength(2);
  stop();
  expect(subscriptions[1].stop).toHaveBeenCalledOnce();
  vi.runOnlyPendingTimers();
  expect(subscriptions).toHaveLength(2);
});
