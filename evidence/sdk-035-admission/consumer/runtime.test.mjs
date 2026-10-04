import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
const { createCortexClient, ApiError } = await import(process.env.SDK_TEST_PACKAGE ?? '../dist/index.js');

const baseUrl = 'http://sdk.test';
const sse = (id, event) => `id: ${id}\ndata: ${JSON.stringify(event)}\n\n`;
const response = (frames) => new Response(frames, { headers: { 'content-type': 'text/event-stream' } });
const problem = (code = 'unauthenticated', status = 401, extra = {}) => Response.json({
  type: 'about:blank', title: 'Request refused', code, status, request_id: 'req_test', ...extra,
}, { status });
const done = { type: 'done', message_id: 'msg_test', finish_reason: 'stop' };
const collect = async (stream) => { const events = []; for await (const e of stream) events.push(e); return events; };
const timeout = { timeout: 2000 };

test('AgentEvent automatically reconnects with UUID since, preserving query parameters', timeout, async () => {
  const ids = ['0199aaa0-0000-7000-8000-000000000001', '0199aaa0-0000-7000-8000-000000000002'];
  const requests = [], cursors = [];
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    requests.push(req);
    if (requests.length <= 2) return response(sse(ids[requests.length - 1], { id: ids[requests.length - 1], kind: 'ready' }));
    return problem('not_found', 404);
  } });
  const received = [];
  await assert.rejects(async () => {
    for await (const e of c.subscribePath('/v1/mascots/bot/events?limit=2', { retryDelayMs: 0, onEventId: (id) => cursors.push(id) })) received.push(e.id);
  }, (e) => e instanceof ApiError && e.code === 'not_found');
  assert.deepEqual(received, ids);
  assert.deepEqual(cursors, ids);
  assert.equal(new URL(requests[1].url).searchParams.get('since'), ids[0]);
  assert.equal(new URL(requests[2].url).searchParams.get('since'), ids[1]);
  assert.equal(new URL(requests[2].url).searchParams.get('limit'), '2');
  assert.ok(requests.every((r) => !r.headers.has('last-event-id')));
});

test('turn replay retains original POST, bytes, key and numeric Last-Event-ID', timeout, async () => {
  const requests = [];
  const body = { message: 'original', reasoning_effort: 'low' };
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    requests.push({ url: req.url, method: req.method, body: await req.text(), key: req.headers.get('idempotency-key'), cursor: req.headers.get('last-event-id') });
    return response(requests.length === 1 ? sse('12', { type: 'text_delta', message_id: 'msg_test', delta: 'first' }) : sse('13', done));
  } });
  const events = [];
  for await (const e of c.streamPath('/v1/conversations/c/messages/m/edit', { body, idempotencyKey: 'same-key' }, { retryDelayMs: 0 })) {
    events.push(e);
    body.message = 'changed draft';
  }
  assert.equal(events.at(-1).type, 'done');
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], { ...requests[0], cursor: '12' });
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].body, '{"message":"original","reasoning_effort":"low"}');
  assert.equal(requests[0].key, 'same-key');
});

test('fresh invocation needs original key; invalid replay identity makes no request', timeout, async () => {
  let calls = 0;
  const c = createCortexClient({ baseUrl, fetch: async () => { calls++; return response(sse('1', done)); } });
  assert.throws(() => c.streamTurn({ body: {} }, { lastEventId: '2' }), /original/);
  for (const key of ['', ' ', 'x'.repeat(201)]) await assert.rejects(collect(c.streamTurn({ body: {}, idempotencyKey: key })), /Idempotency-Key/);
  await assert.rejects(collect(c.streamTurn({ body: {}, idempotencyKey: 'k' }, { lastEventId: 'not-numeric' })), /numeric/);
  assert.equal(calls, 0);
});

test('stream_expired followed by socket failure never starts another turn; caller reloads durable transcript', timeout, async () => {
  const calls = [];
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    calls.push([req.method, new URL(req.url).pathname]);
    if (req.method === 'GET') return Response.json({ items: [] });
    let read = 0;
    return response(new ReadableStream({ pull(ctrl) {
      if (read++ === 0) ctrl.enqueue(new TextEncoder().encode(sse('3', { type: 'error', code: 'stream_expired', detail: 'Reload the conversation.', request_id: 'req_test' })));
      else ctrl.error(new TypeError('connection lost'));
    } }));
  } });
  const events = await collect(c.streamTurn({ conversationId: 'c', body: { message: 'original' }, idempotencyKey: 'original-key' }, { lastEventId: '2', retryDelayMs: 0 }));
  assert.equal(events[0].code, 'stream_expired');
  await c.conversations.messages.list({ path: { id: 'c' } });
  assert.deepEqual(calls, [['POST', '/v1/conversations/c/turns'], ['GET', '/v1/conversations/c/messages']]);
});

test('realtime advances fresh numeric sequence after room reset, never hello zero', timeout, async () => {
  const cursors = [], requests = [];
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    requests.push(req);
    return requests.length === 1 ? response(sse('0', { type: 'hello' }) + sse('1', { type: 'chat' }) + sse('2', { type: 'chat' })) : problem('not_found', 404);
  } });
  await assert.rejects(collect(c.subscribe({ lastEventId: '90', retryDelayMs: 0, onEventId: (id) => cursors.push(id) })), ApiError);
  assert.deepEqual(cursors, ['1', '2']);
  assert.equal(requests[1].headers.get('last-event-id'), '2');
});

test('refresh 401 through the same client rejects instead of waiting on itself', timeout, async () => {
  const calls = [];
  let refreshes = 0, c;
  c = createCortexClient({ baseUrl, auth: { token: 'old', refresh: async () => {
    refreshes++;
    return (await c.auth.refresh.create()).access_token;
  } }, fetch: async (req) => { calls.push(new URL(req.url).pathname); return problem(); } });
  await assert.rejects(c.me.list(), (e) => e instanceof ApiError && e.code === 'unauthenticated');
  assert.equal(refreshes, 1);
  assert.deepEqual(calls, ['/v1/me', '/v1/auth/refresh']);
});

test('concurrent 401s share one successful refresh, null does not resend stale credentials', timeout, async () => {
  let refreshes = 0, c;
  const requests = [];
  c = createCortexClient({ baseUrl, auth: { token: 'old', refresh: async () => {
    refreshes++;
    return (await c.auth.refresh.create()).access_token;
  } }, fetch: async (req) => {
    requests.push(req);
    if (req.url.endsWith('/auth/refresh')) return Response.json({ access_token: 'new' });
    return req.headers.get('authorization') === 'Bearer new' ? Response.json({ id: 'me' }) : problem();
  } });
  assert.deepEqual(await Promise.all([c.me.list(), c.me.list(), c.me.list()]), [{ id: 'me' }, { id: 'me' }, { id: 'me' }]);
  assert.equal(refreshes, 1);
  let tries = 0;
  const refused = createCortexClient({ baseUrl, auth: { refresh: async () => null }, fetch: async () => { tries++; return problem(); } });
  await assert.rejects(refused.me.list(), ApiError);
  assert.equal(tries, 1);
});

test('embedded Fetch subscriptions and turns abort an idle response body', timeout, async () => {
  for (const subscription of [true, false]) {
    const ac = new AbortController();
    let cancel = false;
    const c = createCortexClient({ baseUrl, fetch: async () => response(new ReadableStream({ cancel() { cancel = true; } })) });
    const iterator = subscription ? c.subscribe({ signal: ac.signal }) : c.streamTurn({ body: {} }, { signal: ac.signal });
    const next = iterator.next();
    setTimeout(() => ac.abort(), 5);
    if (subscription) assert.equal((await next).done, true);
    else await assert.rejects(next, (e) => e.name === 'AbortError');
    assert.equal(cancel, true);
  }
});

test('a terminal event ends an open socket and acknowledges its cursor', timeout, async () => {
  for (const event of [done, { type: 'error', code: 'stream_expired', detail: 'Reload', request_id: 'req_test' }]) {
    let cancelled = false;
    const cursors = [];
    const c = createCortexClient({ baseUrl, fetch: async () => response(new ReadableStream({
      start(ctrl) { ctrl.enqueue(new TextEncoder().encode(sse('4', event))); },
      cancel() { cancelled = true; },
    })) });
    const values = await collect(c.streamTurn({ body: {} }, { onEventId: (id) => cursors.push(id) }));
    assert.deepEqual(values, [event]);
    assert.deepEqual(cursors, ['4']);
    assert.equal(cancelled, true);
  }
});

test('turn done preserves same-chunk and delayed image completion before cancelling', timeout, async () => {
  const image = { type: 'image_generation', generation_id: 'image', status: 'generating' };
  const complete = { ...image, status: 'done', file_id: 'lbf_image' };
  for (const delayed of [false, true]) {
    let controller, cancelled = false;
    const cursors = [];
    const c = createCortexClient({ baseUrl, fetch: async () => response(new ReadableStream({
      start(ctrl) {
        controller = ctrl;
        ctrl.enqueue(new TextEncoder().encode(sse('1', image) + sse('2', done) + (delayed ? '' : sse('3', complete))));
      },
      cancel() { cancelled = true; },
    })) });
    const iterator = c.streamTurn({ body: {} }, { onEventId: (id) => cursors.push(id) });
    assert.deepEqual((await iterator.next()).value, image);
    assert.deepEqual((await iterator.next()).value, done);
    const tail = iterator.next();
    if (delayed) {
      assert.equal(await Promise.race([tail.then(() => 'ended'), new Promise((resolve) => setTimeout(() => resolve('waiting'), 5))]), 'waiting');
      controller.enqueue(new TextEncoder().encode(sse('3', complete)));
    }
    assert.deepEqual((await tail).value, complete);
    assert.equal((await iterator.next()).done, true);
    assert.deepEqual(cursors, ['1', '2', '3']);
    assert.equal(cancelled, true);
  }
});

test('pending image IDs settle independently; error and EOF still finish a turn', timeout, async () => {
  const image = (generation_id, status) => ({ type: 'image_generation', generation_id, status });
  const failure = { type: 'error', code: 'stream_expired', detail: 'Reload', request_id: 'req_test' };
  for (const [events, eof] of [
    [[image('a', 'queued'), image('a', 'generating'), image('b', 'generating'), done, image('a', 'done'), image('b', 'error')], false],
    [[image('a', 'generating'), failure], false],
    [[image('a', 'generating'), done], true],
  ]) {
    let requests = 0, cancelled = false;
    const cursors = [];
    const c = createCortexClient({ baseUrl, fetch: async () => {
      requests++;
      return response(new ReadableStream({
        start(ctrl) {
          ctrl.enqueue(new TextEncoder().encode(events.map((event, index) => sse(String(index + 1), event)).join('')));
          if (eof) ctrl.close();
        },
        cancel() { cancelled = true; },
      }));
    } });
    assert.deepEqual(await collect(c.streamTurn({ body: {} }, { onEventId: (id) => cursors.push(id) })), events);
    assert.equal(cursors.at(-1), String(events.length));
    assert.equal(requests, 1);
    if (!eof) assert.equal(cancelled, true);
  }
});

test('reader and account cancellation reject an idle post-done image tail', timeout, async () => {
  for (const account of [false, true]) {
    const abort = new AbortController();
    const reason = new DOMException('Image delivery cancelled', 'AbortError');
    let cancelled = false, requests = 0;
    const c = createCortexClient({ baseUrl, ...(account ? { auth: { signal: abort.signal } } : {}), fetch: async () => {
      requests++;
      return response(new ReadableStream({
        start(ctrl) { ctrl.enqueue(new TextEncoder().encode(sse('1', { type: 'image_generation', generation_id: 'image', status: 'generating' }) + sse('2', done))); },
        cancel() { cancelled = true; },
      }));
    } });
    const iterator = c.streamTurn({ body: {} }, account ? {} : { signal: abort.signal });
    assert.equal((await iterator.next()).value.type, 'image_generation');
    assert.equal((await iterator.next()).value.type, 'done');
    const tail = iterator.next();
    abort.abort(reason);
    await assert.rejects(tail, (error) => error === reason);
    assert.equal(cancelled, true);
    assert.equal(requests, 1);
  }
});

test('abort stops frames already buffered in the same chunk', timeout, async () => {
  for (const subscription of [true, false]) {
    const ac = new AbortController();
    const c = createCortexClient({ baseUrl, fetch: async () => response(
      sse('1', { type: 'text_delta', message_id: 'm', delta: 'a' }) + sse('2', { type: 'text_delta', message_id: 'm', delta: 'b' }) + sse('3', done),
    ) });
    const iterator = subscription ? c.subscribe({ signal: ac.signal }) : c.streamTurn({ body: {} }, { signal: ac.signal });
    assert.equal((await iterator.next()).value.delta, 'a');
    ac.abort();
    if (subscription) assert.equal((await iterator.next()).done, true);
    else await assert.rejects(iterator.next(), (e) => e.name === 'AbortError');
  }
});

test('a request and a turn replay never cross a changed token source', timeout, async () => {
  let token = 'account-a';
  const calls = [];
  const c = createCortexClient({ baseUrl, auth: { token: () => token, refresh: async () => 'renewed-a' }, fetch: async (req) => {
    calls.push(req.headers.get('authorization'));
    token = 'account-b';
    return req.url.endsWith('/turns') ? response(sse('1', { type: 'text_delta', message_id: 'm', delta: 'a' })) : problem();
  } });
  await assert.rejects(c.projects.create({ body: { title: 'private-a' } }), (e) => e.name === 'AbortError');
  assert.deepEqual(calls, ['Bearer account-a']);
  token = 'account-a';
  calls.length = 0;
  await assert.rejects(collect(c.streamTurn({ body: { message: 'private-a' } }, { retryDelayMs: 0 })), (e) => e.name === 'AbortError');
  assert.deepEqual(calls, ['Bearer account-a']);
});

test('new sign-in aborts a late refresh before it can replace the new cookie', timeout, async () => {
  let c, release, began;
  const started = new Promise((resolve) => { began = resolve; });
  let refreshSignal, finalCookie;
  c = createCortexClient({ baseUrl, auth: { refresh: async (signal) => (await c.auth.refresh.create({ signal })).access_token }, fetch: async (req) => {
    if (req.url.endsWith('/auth/refresh')) {
      refreshSignal = req.signal;
      began();
      await new Promise((resolve) => { release = resolve; });
      return Response.json({ access_token: 'account-a' }, { headers: { 'set-cookie': 'cortex_rt=cookie-a; Path=/' } });
    }
    if (req.url.endsWith('/auth/password')) return Response.json({ access_token: 'account-b' }, { headers: { 'set-cookie': 'cortex_rt=cookie-b; Path=/' } });
    if (req.url.endsWith('/models')) { finalCookie = req.headers.get('cookie'); return Response.json({ items: [] }); }
    return problem();
  } });
  const old = assert.rejects(c.me.list(), (e) => e.name === 'AbortError');
  await started;
  await c.auth.password.create({ body: { email: 'b@example.test', password: 'fixture' } });
  assert.equal(refreshSignal.aborted, true);
  release();
  await old;
  await c.models.list();
  assert.equal(finalCookie, 'cortex_rt=cookie-b');
});

test('adopting a sign-in token preserves its refresh cookie; a rejected sign-in preserves the guest', timeout, async () => {
  let token;
  const c = createCortexClient({ baseUrl, auth: { token: () => token }, fetch: async (req) => {
    const path = new URL(req.url).pathname;
    if (path === '/v1/auth/guest') return Response.json({ user_id: 'guest' }, { headers: { 'set-cookie': 'cortex_gt=guest; Path=/' } });
    if (path === '/v1/auth/magic-auth/verify') {
      const { code } = await req.json();
      return code === 'valid' ? Response.json({ status: 'session', access_token: 'signed-in' }, { headers: { 'set-cookie': 'cortex_rt=refresh; Path=/' } }) : problem();
    }
    if (path === '/v1/auth/refresh') {
      assert.match(req.headers.get('cookie'), /cortex_rt=refresh/);
      return Response.json({ access_token: 'renewed' });
    }
    assert.match(req.headers.get('cookie'), /cortex_gt=guest/);
    return Response.json({ is_guest: !req.headers.has('authorization') });
  } });
  await c.startGuest();
  await assert.rejects(c.auth.magicAuth.verify.create({ body: { email: 'me@example.test', code: 'wrong' } }), ApiError);
  assert.equal((await c.me.list()).is_guest, true);
  token = (await c.auth.magicAuth.verify.create({ body: { email: 'me@example.test', code: 'valid' } })).access_token;
  assert.equal((await c.me.list()).is_guest, false);
  assert.equal((await c.auth.refresh.create()).access_token, 'renewed');
});

test('a reactive request during refresh adopts the issued token and cookie', timeout, async () => {
  let token = 'old', c, reactive;
  c = createCortexClient({ baseUrl, auth: { token: () => token, refresh: async (signal) => {
    token = (await c.auth.refresh.create({ signal })).access_token;
    reactive = c.models.list();
    return token;
  } }, fetch: async (req) => {
    if (req.url.endsWith('/auth/refresh')) return Response.json({ access_token: 'new' }, { headers: { 'set-cookie': 'cortex_rt=rotated; Path=/' } });
    if (req.headers.get('authorization') === 'Bearer old') return problem();
    assert.equal(req.headers.get('authorization'), 'Bearer new');
    assert.match(req.headers.get('cookie'), /cortex_rt=rotated/);
    return Response.json({ ok: true });
  } });
  assert.deepEqual(await c.me.list(), { ok: true });
  assert.deepEqual(await reactive, { ok: true });
});

test('external refresh reconciles reactive token changes before replay', timeout, async () => {
  let token = 'old', c, reactive;
  c = createCortexClient({ baseUrl, auth: { token: () => token, refresh: async () => {
    token = 'new';
    reactive = c.models.list();
    return token;
  } }, fetch: async (req) => req.headers.get('authorization') === 'Bearer old' ? problem() : Response.json({ ok: true }) });
  assert.deepEqual(await c.me.list(), { ok: true });
  assert.deepEqual(await reactive, { ok: true });
});

test('external refresh can await another SDK call without waiting on itself', timeout, async () => {
  for (const refused of [false, true]) {
    let token = 'old', c;
    c = createCortexClient({ baseUrl, auth: { token: () => token, refresh: async () => {
      token = 'new';
      if (refused) await assert.rejects(c.models.list(), ApiError);
      else assert.deepEqual(await c.models.list(), { ok: true });
      return token;
    } }, fetch: async (req) => req.headers.get('authorization') === 'Bearer old' || (refused && req.url.endsWith('/models')) ? problem() : Response.json({ ok: true }) });
    assert.deepEqual(await c.me.list(), { ok: true });
  }
});

test('token removal refuses a private turn replay', timeout, async () => {
  let token = 'account-a', calls = 0;
  const c = createCortexClient({ baseUrl, auth: { token: () => token }, fetch: async () => {
    calls++;
    token = undefined;
    return response(sse('1', { type: 'text_delta', message_id: 'm', delta: 'private' }));
  } });
  await assert.rejects(collect(c.streamTurn({ body: { message: 'private-a' } }, { retryDelayMs: 0 })), (e) => e.name === 'AbortError');
  assert.equal(calls, 1);
});

test('successful sign-in invalidates a private request admitted during sign-in', timeout, async () => {
  let token = 'account-a', signed, project, signinStarted, projectStarted;
  const signInReady = new Promise((resolve) => { signinStarted = resolve; });
  const projectReady = new Promise((resolve) => { projectStarted = resolve; });
  const calls = [];
  const c = createCortexClient({ baseUrl, auth: { token: () => token, refresh: async () => token }, fetch: async (req) => {
    if (req.url.endsWith('/auth/password')) {
      signinStarted();
      await new Promise((resolve) => { signed = resolve; });
      return Response.json({ status: 'session', access_token: 'account-b' });
    }
    calls.push(req.headers.get('authorization'));
    projectStarted();
    await new Promise((resolve) => { project = resolve; });
    return problem();
  } });
  const login = c.auth.password.create({ body: { email: 'b@example.test', password: 'fixture' } });
  await signInReady;
  const pending = assert.rejects(c.projects.create({ body: { title: 'private-a' } }), (e) => e.name === 'AbortError');
  await projectReady;
  signed();
  token = (await login).access_token;
  project();
  await pending;
  assert.deepEqual(calls, ['Bearer account-a']);
});

test('native Fetch sign-in remains readable without cloning after replacing account lifetime', timeout, async () => {
  const server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'set-cookie': 'cortex_rt=new-session; Path=/' });
    res.end(JSON.stringify({ status: 'session', access_token: 'new-account' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const c = createCortexClient({ baseUrl: `http://127.0.0.1:${server.address().port}`, fetch: async (req) => {
      const res = await fetch(req);
      res.clone = () => { assert.fail('Successful auth responses must not be cloned'); };
      return res;
    } });
    assert.deepEqual(await c.auth.magicAuth.verify.create({ body: { email: 'owner@example.test', code: '123456' } }), { status: 'session', access_token: 'new-account' });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
});

test('auth JSON reads preserve original read errors and account abort reasons', timeout, async () => {
  const headers = { 'content-type': 'application/json' };
  const failure = new TypeError('fixture response read failed');
  const broken = createCortexClient({ baseUrl, fetch: async () => new Response(new ReadableStream({
    start(ctrl) { ctrl.error(failure); },
  }), { headers }) });
  await assert.rejects(broken.auth.refresh.create(), (error) => error === failure);

  const account = new AbortController();
  const reason = new DOMException('fixture account changed', 'AbortError');
  let started;
  const reading = new Promise((resolve) => { started = resolve; });
  const aborted = createCortexClient({ baseUrl, auth: { signal: account.signal }, fetch: async (req) => new Response(new ReadableStream({
    start(ctrl) {
      req.signal.addEventListener('abort', () => ctrl.error(req.signal.reason), { once: true });
      started();
    },
  }), { headers }) });
  const pending = assert.rejects(aborted.auth.refresh.create(), (error) => error === reason);
  await reading;
  account.abort(reason);
  await pending;
});

test('auth JSON accepts a bodyless 204 and refuses malformed JSON', timeout, async () => {
  const headers = { 'content-type': 'application/json' };
  const empty = createCortexClient({ baseUrl, fetch: async () => new Response(null, { status: 204, headers }) });
  assert.equal(await empty.auth.magicAuth.create({ body: { email: 'owner@example.test' } }), undefined);
  const malformed = createCortexClient({ baseUrl, fetch: async () => new Response('{bad', { headers }) });
  await assert.rejects(malformed.auth.password.create({ body: { email: 'owner@example.test', password: 'fixture' } }), ApiError);
});

test('successful logout clears an SDK-cached bearer', timeout, async () => {
  let loggedOut = false;
  const c = createCortexClient({ baseUrl, auth: { refresh: async () => 'account-a' }, fetch: async (req) => {
    if (req.url.endsWith('/auth/logout')) {
      loggedOut = true;
      return new Response(null, { status: 204 });
    }
    if (loggedOut) { assert.equal(req.headers.has('authorization'), false); return Response.json({ is_guest: true }); }
    return req.headers.has('authorization') ? Response.json({ is_guest: false }) : problem();
  } });
  assert.equal((await c.me.list()).is_guest, false);
  await c.auth.logout.create();
  assert.equal((await c.me.list()).is_guest, true);
});

test('account abort cancels buffered turn frames and an idle embedded subscription', timeout, async () => {
  for (const idle of [true, false]) {
    const account = new AbortController();
    let cancelled = false;
    const c = createCortexClient({ baseUrl, auth: { signal: account.signal }, fetch: async () => response(new ReadableStream({
      start(ctrl) { if (!idle) ctrl.enqueue(new TextEncoder().encode(sse('1', { type: 'text_delta', message_id: 'm', delta: 'a' }) + sse('2', done))); },
      cancel() { cancelled = true; },
    })) });
    const iterator = idle ? c.subscribe() : c.streamTurn({ body: {} });
    const first = iterator.next();
    if (!idle) assert.equal((await first).value.delta, 'a');
    if (idle) setTimeout(() => account.abort(), 5);
    else account.abort();
    if (idle) assert.equal((await first).done, true);
    else await assert.rejects(iterator.next(), (e) => e.name === 'AbortError');
    assert.equal(cancelled, true);
  }
});

test('generated OTP inputs, void acknowledgement, raw upload and public MFA error', timeout, async () => {
  const requests = [];
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    requests.push({ path: new URL(req.url).pathname, query: new URL(req.url).searchParams, type: req.headers.get('content-type'), body: await req.text() });
    if (req.url.endsWith('/magic-auth')) return new Response(null, { status: 204 });
    if (req.url.endsWith('/me/export')) return problem('invalid_state', 422, { mfa: 'reauth_required' });
    return Response.json({ status: 'session', access_token: 'fixture', id: 'lbf_test' });
  } });
  assert.equal(await c.auth.magicAuth.create({ body: { email: 'person@example.test' } }), undefined);
  await c.auth.magicAuth.verify.create({ body: { email: 'person@example.test', code: '123' } });
  await c.auth.mfa.verify.create({ body: { code: '456', authentication_challenge_id: 'challenge', pending_authentication_token: 'pending' } });
  await c.auth.verifyEmail.create({ body: { code: '789', pending_authentication_token: 'pending' } });
  const file = new Blob(['{"raw":true}'], { type: 'application/json' });
  await c.library.create({ body: file, query: { filename: 'data.json' } });
  assert.equal(requests[4].body, '{"raw":true}');
  assert.equal(requests[4].type, 'application/octet-stream');
  assert.equal(requests[4].query.get('filename'), 'data.json');
  assert.equal(JSON.parse(requests[2].body).pending_authentication_token, 'pending');
  await assert.rejects(c.me.export.create(), (e) => e instanceof ApiError && e.problem.mfa === 'reauth_required');
});

test('generated screenshot upload preserves File and Blob bytes and filename', timeout, async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 255, 0, 128]);
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    assert.equal(new URL(req.url).pathname, '/v1/feedback/bugs/screenshots');
    assert.equal(new URL(req.url).searchParams.get('filename'), 'screen.png');
    assert.equal(req.headers.get('content-type'), 'application/octet-stream');
    assert.deepEqual(new Uint8Array(await req.arrayBuffer()), bytes);
    return Response.json({ id: 'screenshot', filename: 'screen.png', content_type: 'image/png', byte_size: bytes.length });
  } });
  for (const body of [new Blob([bytes]), new File([bytes], 'screen.png', { type: 'image/png' })]) {
    const file = await c.feedback.bugs.screenshots.create({ body, query: { filename: 'screen.png' } });
    assert.equal(file.byte_size, bytes.length);
  }
});

test('generated methods preserve HeadersInit forms and explicit header removal', timeout, async () => {
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    assert.equal(req.headers.get('authorization'), 'Bearer caller');
    assert.equal(req.headers.get('x-caller'), 'present');
    assert.equal(req.headers.has('0'), false);
    const removed = new URL(req.url).searchParams.get('filename') === 'removed.png';
    assert.equal(req.headers.get('content-type'), removed ? null : req.url.includes('/screenshots') ? 'image/png' : 'application/json');
    return Response.json({ byte_size: 1 });
  } });
  const values = { authorization: 'Bearer caller', 'x-caller': 'present' };
  for (const form of [(headers) => headers, (headers) => new Headers(headers), (headers) => Object.entries(headers)]) {
    await c.feedback.bugs.screenshots.create({ body: new Blob(['x']), query: { filename: 'screen.png' }, headers: form({ ...values, 'Content-Type': 'image/png' }) });
    await c.feedback.bugs.create({ body: { title: 'Example' }, headers: form(values) });
  }
  await c.feedback.bugs.screenshots.create({ body: new Blob(['x']), query: { filename: 'removed.png' }, headers: { ...values, 'Content-Type': null } });
});

test('HTTP media types match parsers; generated SSE returns before EOF; WS plain HTTP refuses', timeout, async () => {
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    if (req.url.endsWith('/content')) return Response.json({ raw: true });
    if (req.url.endsWith('/memory/export')) return new Response('# memory', { headers: { 'content-type': 'text/markdown' } });
    if (req.url.endsWith('/turns')) return response(new ReadableStream({ start(ctrl) { ctrl.enqueue(new TextEncoder().encode(sse('1', done))); } }));
    if (req.url.endsWith('/events')) {
      assert.equal(req.headers.get('accept'), 'application/json');
      return Response.json({ items: [], stream: 'sse' });
    }
    return problem('bad_request', 400);
  } });
  const blob = await c.library.content.list({ path: { id: 'f' } });
  assert.ok(blob instanceof Blob);
  assert.equal(await blob.text(), '{"raw":true}');
  assert.equal(await c.memory.export.list(), '# memory');
  const stream = await c.conversations.turns.start();
  assert.ok(stream instanceof ReadableStream);
  await stream.cancel();
  assert.deepEqual(await c.mascots.events.list({ path: { id: 'bot' } }), { items: [], stream: 'sse' });
  await assert.rejects(c.realtime.list(), (e) => e instanceof ApiError && e.status === 400);
});

test('generated turn and edit methods accept legacy JSON bodies and return raw streams', timeout, async () => {
  const paths = [];
  const body = { message: 'Hello', reasoning_effort: 'high', attachment_ids: ['lbf_image'] };
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    paths.push(new URL(req.url).pathname);
    assert.equal(req.method, 'POST');
    assert.equal(req.headers.get('content-type'), 'application/json');
    assert.deepEqual(await req.json(), body);
    return response(new ReadableStream());
  } });
  for (const request of [
    () => c.conversations.turns.start({ body }),
    () => c.conversations.turns.create({ path: { id: 'thread' }, body }),
    () => c.code.sessions.turns.create({ path: { id: 'session' }, body }),
    () => c.conversations.messages.edit.create({ path: { id: 'thread', message_id: 'message' }, body }),
    () => c.conversations.messages.regenerate.create({ path: { id: 'thread', message_id: 'message' }, body }),
  ]) {
    const stream = await request();
    assert.ok(stream instanceof ReadableStream);
    await stream.cancel();
  }
  assert.deepEqual(paths, ['/v1/conversations/turns', '/v1/conversations/thread/turns', '/v1/code/sessions/session/turns', '/v1/conversations/thread/messages/message/edit', '/v1/conversations/thread/messages/message/regenerate']);
});

test('binding an account signal keeps explicit credentials and replay headers', timeout, async () => {
  const c = createCortexClient({ baseUrl, auth: { signal: new AbortController().signal }, fetch: async (req) => {
    assert.equal(req.headers.get('authorization'), 'Bearer explicit');
    assert.equal(req.headers.get('idempotency-key'), 'original-key');
    assert.equal(req.headers.get('last-event-id'), '12');
    assert.equal(await req.text(), '{"message":"original"}');
    return response(sse('13', done));
  } });
  const stream = await c.conversations.turns.start({ body: { message: 'original' }, headers: {
    authorization: 'Bearer explicit', 'idempotency-key': 'original-key', 'last-event-id': '12',
  } });
  await stream.cancel();
});

test('AgentEvent JSON methods preserve Headers and tuples and pin their transport', timeout, async () => {
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    assert.equal(req.headers.get('authorization'), 'Bearer explicit');
    assert.equal(req.headers.get('accept'), 'application/json');
    return Response.json({ items: [], stream: 'sse' });
  } });
  for (const headers of [new Headers({ authorization: 'Bearer explicit', accept: 'text/event-stream' }), [['authorization', 'Bearer explicit'], ['accept', 'text/event-stream']]]) {
    const result = await c.mascots.events.list({ path: { id: 'bot' }, headers, parseAs: 'text', responseStyle: 'fields' });
    assert.deepEqual(result, { items: [], stream: 'sse' });
  }
});

test('low-level SSE removes a reset cursor without dropping the initial caller cursor', timeout, async () => {
  const requests = [], controllers = [], errors = [];
  const c = createCortexClient({ baseUrl, fetch: async (req) => {
    requests.push(req.headers.get('last-event-id'));
    const attempt = requests.length;
    return response(new ReadableStream({ start(ctrl) {
      controllers.push(ctrl);
      ctrl.enqueue(new TextEncoder().encode(sse(attempt === 1 ? '7' : attempt === 2 ? '' : '9', { attempt })));
      if (attempt === 3) ctrl.close();
    } }));
  } });
  const { stream } = await c.http.sse.get({ url: '/v1/realtime/events', headers: new Headers({ 'Last-Event-ID': '5' }), sseSleepFn: async () => {}, sseMaxRetryAttempts: 3, onSseError: (error) => errors.push(error) });
  for (const attempt of [1, 2, 3]) {
    assert.deepEqual((await stream.next()).value, { attempt });
    if (attempt < 3) controllers[attempt - 1].error(new TypeError('connection dropped'));
  }
  assert.equal((await stream.next()).done, true);
  assert.deepEqual(requests, ['5', '7', null]);
  assert.equal(errors.length, 2);
});
