import { expect, it } from "/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/node_modules/vitest/dist/index.js";
import { RemoteSession } from "./source/packages/desktop/src/remote-session";
import type { MainRemoteAdmission, MainRemoteObserver } from "./source/packages/desktop/src/remote-chat";

const origin = "https://replay-review.example.test";
const suffix = "01h45ytscbeewvwm6xr90nbxp4";
const ids = { conversationID: `cnv_${suffix}`, assistantID: `msg_${suffix}` };
const prompt = { message: "Original request", modelSlug: "review", attachmentIDs: [] };
const delta = { type: "text_delta", message_id: ids.assistantID, delta: "A" };
const done = { type: "done", message_id: ids.assistantID, finish_reason: "stop" };
const frame = (id: number, event: unknown) => `id: ${id}\ndata: ${JSON.stringify(event)}\n\n`;
const stream = (body: BodyInit) => new Response(body, { headers: {
  "content-type": "text/event-stream", "x-conversation-id": ids.conversationID, "x-message-id": ids.assistantID,
} });
const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
};
const bounded = async <T>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Probe did not settle within 1s")), 1000);
  })]); } finally { clearTimeout(timer!); }
};
type Post = { path: string; method: string; body: string; key: string | null; cursor: string | null };
const setup = async (reply: (attempt: number) => Response | Promise<Response>) => {
  const posts: Post[] = [];
  const session = new RemoteSession({ fetch: async (value, init) => {
    const request = value instanceof Request ? value : new Request(value, init);
    const path = new URL(request.url).pathname;
    if (path === "/v1/auth/magic-auth") return new Response(null, { status: 204 });
    if (path === "/v1/auth/magic-auth/verify") return Response.json({ status: "session", access_token: "review-fixture-token" });
    if (path === "/v1/instance") return Response.json({ mode: "cloud", auth: { mode: "cortex", required: true } });
    if (path === "/v1/models") return Response.json({ items: [{ slug: "review", display_name: "Review", description: "", context_tokens: 8192,
      max_output_tokens: 1024, supports_reasoning: false, supports_tools: false, supports_vision: false, kind: "chat" }], has_more: false });
    if (path === "/v1/conversations/turns") {
      posts.push({ path, method: request.method, body: await request.text(), key: request.headers.get("idempotency-key"), cursor: request.headers.get("last-event-id") });
      return reply(posts.length);
    }
    throw new Error(`Unexpected fixture request: ${path}`);
  } });
  await session.authenticate(origin, { action: "email", email: "review@example.test" });
  await session.authenticate(origin, { action: "code", code: "123456" });
  return { session, binding: session.bind(origin), posts };
};
const errorCode = (error: unknown) => (error as { code?: string }).code;

it("re-notifies a fresh admission waiter when the preceding admitted callback threw before acceptance", async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const { session, binding, posts } = await setup((attempt) => attempt === 1 ? stream(frame(1, done)) : stream(new ReadableStream({
    start(ctrl) { controller = ctrl; ctrl.enqueue(new TextEncoder().encode(frame(1, delta))); },
  })));
  try {
    let firstCalls = 0;
    const firstEvents: string[] = [];
    const delivery = binding.turn(prompt, {
      admitted() { firstCalls++; throw new Error("fixture-consumer-refused-admission"); },
      event(event) { firstEvents.push(event.type); },
    });
    const failure = await bounded(delivery.completion.then(() => undefined, errorCode));
    expect(failure).toBe("provider_error");
    expect(firstCalls).toBe(1); expect(firstEvents).toEqual([]);
    expect(binding.signal.aborted).toBe(false);
    expect(delivery.admissionState).toBe("admitted");

    const freshWaiter = deferred<MainRemoteAdmission>(), textArrived = deferred();
    let freshWaiterSettled = false, resumedSettled = false;
    const order: string[] = [];
    void freshWaiter.promise.then(() => { freshWaiterSettled = true; });
    const resumed = delivery.resume({
      admitted(admission) { order.push("admitted"); freshWaiter.resolve(admission); },
      event(event) { order.push(event.type); if (event.type === "text_delta") textArrived.resolve(); },
    });
    const resultPromise = resumed.then((result) => { resumedSettled = true; return result; });
    await bounded(textArrived.promise);
    const beforeTerminal = { freshWaiterSettled, resumedSettled, order: [...order] };
    controller.enqueue(new TextEncoder().encode(frame(2, done))); controller.close();
    const result = await bounded(resultPromise);
    expect(result.admission).toEqual(ids);
    expect(posts).toHaveLength(2); expect(posts[1]).toEqual(posts[0]);
    expect(posts[0].path).toBe("/v1/conversations/turns"); expect(posts[0].method).toBe("POST");
    console.log(JSON.stringify({ case: "throw-before-consumer-admission", failure, admissionState: delivery.admissionState,
      beforeTerminal, freshWaiterSettled, order, completionCarriesIDs: result.admission, samePostIdentity: true }));
    expect.soft(beforeTerminal.freshWaiterSettled).toBe(true);
    expect.soft(order).toEqual(["admitted", "text_delta", "done"]);
    expect.soft(freshWaiterSettled).toBe(true);
  } finally { session.clear(); }
});

it("a replacement observer after accepted admission can reuse the core's known IDs", async () => {
  const { session, binding, posts } = await setup((attempt) => stream(attempt === 1 ? frame(1, delta) : frame(2, done)));
  try {
    let accepted: MainRemoteAdmission | undefined, notifications = 0, replacementNotifications = 0;
    const first: MainRemoteObserver = { admitted(value) { accepted = value; notifications++; }, event() {} };
    const delivery = binding.turn(prompt, first);
    expect(await bounded(delivery.completion.then(() => undefined, errorCode))).toBe("provider_error");
    expect(accepted).toEqual(ids);
    const result = await bounded(delivery.resume({
      admitted(value) { expect(value).toEqual(accepted); replacementNotifications++; },
      event(event) { expect(accepted).toEqual(ids); expect(event.type).toBe("done"); },
    }));
    expect(result.admission).toEqual(accepted);
    expect(notifications).toBe(1); expect(replacementNotifications).toBe(0);
    expect(posts[1]).toEqual({ ...posts[0], cursor: "1" });
    console.log(JSON.stringify({ case: "already-accepted-replacement", notifications, replacementNotifications, samePostIdentity: true, cursor: posts[1].cursor }));
  } finally { session.clear(); }
});

it.each(["before-headers", "inside-admitted"] as const)("account abort %s outranks consumer failure and prohibits replay", async (stage) => {
  const postStarted = deferred(), releaseHeaders = deferred<Response>();
  const { session, binding, posts } = await setup(() => {
    postStarted.resolve();
    return stage === "before-headers" ? releaseHeaders.promise : stream(frame(1, done));
  });
  try {
    let admissions = 0, events = 0, resumedAdmissions = 0;
    const delivery = binding.turn(prompt, {
      admitted() { admissions++; session.clear(); throw new Error("fixture-consumer-error-after-account-abort"); },
      event() { events++; },
    });
    const completed = delivery.completion.then(() => undefined, errorCode);
    if (stage === "before-headers") {
      await bounded(postStarted.promise); session.clear(); releaseHeaders.resolve(stream(frame(1, done)));
    }
    expect(await bounded(completed)).toBe("aborted");
    expect(binding.signal.aborted).toBe(true);
    expect(admissions).toBe(stage === "before-headers" ? 0 : 1); expect(events).toBe(0);
    const replayError = await bounded(delivery.resume({ admitted() { resumedAdmissions++; }, event() { events++; } }).then(() => undefined, errorCode));
    expect(replayError).toBe("aborted"); expect(resumedAdmissions).toBe(0); expect(posts).toHaveLength(1);
    console.log(JSON.stringify({ case: "account-abort", stage, admissions, events, replayError, posts: posts.length, admissionState: delivery.admissionState }));
  } finally { session.clear(); }
});
