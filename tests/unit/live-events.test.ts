import { afterEach, expect, it, vi } from "vitest";

type Options = { onError: (error: unknown) => void; onOpen?: () => void };
const subscriptions = vi.hoisted(() => [] as { stop: ReturnType<typeof vi.fn>; error: (error: unknown) => void; open: () => void }[]);
vi.mock("../../packages/app/src/api", () => ({ api: { subscribe: (_event: unknown, options: Options) => {
  const stop = vi.fn();
  subscriptions.push({ stop, error: options.onError, open: () => options.onOpen?.() });
  return stop;
} } }));
import { onEvent } from "../../packages/app/src/state/live";

afterEach(() => { vi.useRealTimers(); subscriptions.length = 0; });

it("reconnects an errored stream and closes it when its last listener leaves", () => {
  vi.useFakeTimers();
  const refresh = vi.fn();
  const stop = onEvent(() => undefined, refresh);
  expect(subscriptions).toHaveLength(1);
  subscriptions[0].open();
  subscriptions[0].error(new Error("transport closed"));
  vi.runOnlyPendingTimers();
  expect(subscriptions).toHaveLength(2);
  stop();
  expect(subscriptions[1].stop).toHaveBeenCalledOnce();
  vi.runOnlyPendingTimers();
  expect(subscriptions).toHaveLength(2);
  expect(refresh).not.toHaveBeenCalled();
});

it("resyncs only after a replacement stream opens, surviving a failed reopen", () => {
  vi.useFakeTimers();
  const refresh = vi.fn();
  const stop = onEvent(() => undefined, refresh);
  subscriptions[0].open();
  expect(refresh).not.toHaveBeenCalled();
  subscriptions[0].error(new Error("transport closed"));
  expect(refresh).not.toHaveBeenCalled();
  vi.runOnlyPendingTimers();
  subscriptions[1].error(new Error("still down"));
  expect(refresh).not.toHaveBeenCalled();
  vi.runOnlyPendingTimers();
  subscriptions[2].open();
  expect(refresh).toHaveBeenCalledOnce();
  stop();
});
