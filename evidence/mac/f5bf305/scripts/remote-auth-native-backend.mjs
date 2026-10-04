// Controlled loopback auth fixture. Importing this standalone file has no side effects.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

async function serve() {
  const [directory, receiptArg] = process.argv.slice(2);
  assert.equal(process.platform, 'darwin', 'Start the fixture on the coordinator-leased Mac');
  assert(directory && receiptArg, 'Usage: node remote-auth-native-backend.mjs <isolated-mac-run-directory> <fresh-mac-receipt.json>');
  const root = fs.realpathSync(directory);
  assert(/^\/(?:private\/)?tmp\/opencode\/desktop-remote-auth-[a-zA-Z0-9._-]+$/.test(root), 'Use a fresh isolated auth run directory');
  assert(fs.statSync(root).isDirectory());
  assert.equal(fs.realpathSync(path.dirname(receiptArg)), root, 'Receipt belongs in the isolated run directory');
  const receipt = path.join(root, path.basename(receiptArg));
  fs.closeSync(fs.openSync(receipt, 'wx', 0o600));
  const runID = randomUUID();
  const privateValues = ['access', 'refresh', 'pending', 'challenge', 'factor', 'qr', 'totp', 'error'].map(suffix => `test-only-native-${randomUUID()}-${suffix}`);
  const health = {
    protocol: 'cortex-remote-auth-native-v1', runID, root, platform: process.platform, port: 9457,
    startedAt: new Date().toISOString(), scriptSHA256: createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  };
  const counts = { email: 0, code: 0, finishedCode: 0, wrongCode: 0, session: 0, enrollment: 0, logout: 0, abortedReply: 0, discovery: 0, inspections: 0, inspectionsPassed: 0, errors: 0 };
  const pending = new Set();
  let holdCode = false, freshRequestsCredentialFree = true;
  const snapshot = () => ({ ...health, counts: { ...counts }, holdCode, held: pending.size, freshRequestsCredentialFree });
  const save = () => fs.writeFileSync(receipt, `${JSON.stringify(snapshot(), null, 2)}\n`, { mode: 0o600 });
  const json = (res, body, status = 200) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body));
  };
  const empty = res => { res.writeHead(204, { 'cache-control': 'no-store' }); res.end(); };
  const problem = (res, status, code) => {
    res.writeHead(status, { 'content-type': 'application/problem+json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ type: 'about:blank', title: 'Authentication refused', status, code, request_id: 'req_test_native_auth', detail: privateValues[7] }));
  };
  const release = () => { holdCode = false; for (const resume of pending) resume(); pending.clear(); };
  const bodyOf = async (req, limit) => {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length; assert(bytes <= limit, 'Fixture request exceeds its bound'); chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    assert(body && typeof body === 'object' && !Array.isArray(body), 'Fixture requires an object');
    return body;
  };
  const server = http.createServer((req, res) => { void (async () => {
    assert.equal(req.headers.host, '127.0.0.1:9457', 'Fixture host mismatch');
    assert.equal(req.headers.origin, undefined, 'Renderer requests cannot control this fixture');
    const route = new URL(req.url, 'http://127.0.0.1:9457').pathname;
    if (req.method === 'GET' && route === '/health') return json(res, health);
    if (req.method === 'GET' && route === '/receipt') return json(res, snapshot());
    if (req.method === 'GET' && route === '/catalog') return json(res, {});
    if (req.method === 'GET' && ['/readyz', '/v1/instance', '/v1/registry/models'].includes(route)) {
      counts.discovery++; save();
      if (route === '/readyz') return json(res, { ready: true });
      if (route === '/v1/registry/models') return json(res, { items: [], has_more: false, source: 'cache' });
      return json(res, { mode: 'self_host', version: 'test', auth: { mode: 'cortex', required: true, providers: ['cortex'] }, registry: { enabled: true } });
    }
    if (req.method === 'POST' && (route === '/__control' || route === '/__inspect')) {
      assert.equal(req.headers['content-type'], 'application/json', 'Fixture control requires JSON');
      const body = await bodyOf(req, 4 * 1024 * 1024);
      assert.equal(body.runID, runID, 'Fixture run mismatch');
      if (route === '/__inspect') {
        assert.equal(typeof body.snapshot, 'string', 'A serialized renderer snapshot is required');
        assert(body.snapshot.length > 0);
        const privateMaterialAbsent = privateValues.every(value => !body.snapshot.includes(value));
        counts.inspections++; if (privateMaterialAbsent) counts.inspectionsPassed++;
        save(); return json(res, { privateMaterialAbsent });
      }
      assert(['hold', 'release'].includes(body.action), 'Unknown fixture control');
      if (body.action === 'hold') { assert(!holdCode && pending.size === 0); holdCode = true; }
      else release();
      save(); return json(res, snapshot());
    }
    if (req.method === 'POST' && ['/v1/auth/magic-auth', '/v1/auth/magic-auth/verify'].includes(route)) {
      const body = await bodyOf(req, 16384);
      assert(['person@example.test', 'mfa@example.test'].includes(body.email), 'Unknown fixture account');
      freshRequestsCredentialFree &&= !req.headers.cookie && !req.headers.authorization;
      if (route === '/v1/auth/magic-auth') {
        assert.deepEqual(Object.keys(body).sort(), ['email']);
        counts.email++; save(); return empty(res);
      }
      assert.deepEqual(Object.keys(body).sort(), ['code', 'email']);
      assert(typeof body.code === 'string' && /^\d{6}$/.test(body.code), 'Invalid fixture code');
      counts.code++;
      if (holdCode) await new Promise(resolve => { pending.add(resolve); save(); });
      counts.finishedCode++;
      if (res.destroyed) { counts.abortedReply++; save(); return; }
      if (body.code !== '123456') { counts.wrongCode++; save(); return problem(res, 401, 'invalid_credential'); }
      if (body.email === 'mfa@example.test') {
        counts.enrollment++; save();
        return json(res, { status: 'mfa_enrollment', pending_authentication_token: privateValues[2], authentication_challenge_id: privateValues[3], authentication_factor_id: privateValues[4], qr_code: privateValues[5], totp_secret: privateValues[6] });
      }
      counts.session++; save();
      res.setHeader('set-cookie', `cortex_rt=${privateValues[1]}; HttpOnly; SameSite=Lax; Path=/v1/auth; Max-Age=3600`);
      return json(res, { status: 'session', access_token: privateValues[0] });
    }
    if (req.method === 'POST' && route === '/v1/auth/logout') { counts.logout++; save(); return empty(res); }
    counts.errors++; save(); problem(res, 404, 'not_found');
  })().catch(() => {
    counts.errors++; save();
    if (!res.destroyed && !res.headersSent) problem(res, 500, 'internal');
    else if (!res.destroyed) res.end();
  }); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(9457, '127.0.0.1', resolve); });
  save();
  console.log('Remote authentication fixture listening on 127.0.0.1:9457');
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { release(); server.closeAllConnections(); server.close(() => { save(); process.exit(0); }); });
}

// macOS resolves /tmp as /private/tmp; compare real paths on both sides.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  await serve().catch(() => { console.error('Remote authentication fixture failed to start'); process.exitCode = 1; });
}
