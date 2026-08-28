import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '../client.ts';
import { isCortexApiError } from '../errors.ts';
import {
  archiveCodeSession,
  createCodeAutomation,
  createCodeSecret,
  createCodeSession,
  createCodeSshRuntime,
  createCodeTicket,
  deleteCodeAutomation,
  deleteCodeSecret,
  deleteCodeSession,
  deleteCodeSshRuntime,
  deleteCodeTicket,
  followUpCodeSession,
  getCodeSession,
  getCodeSettings,
  getCodeTicket,
  getCodeUsage,
  listCodeAutomationLogs,
  listCodeAutomations,
  listCodeProviders,
  listCodeRepositories,
  listCodeSecrets,
  listCodeSshRuntimes,
  listCodeTickets,
  patchCodeAutomation,
  patchCodeTicket,
  putCodeProvider,
  putCodeSettings,
  resolveCodePermission,
  runCodeAutomation,
  stopCodeSession,
  unpairCodeHost,
} from '../code-control.ts';
import { stubFetch } from './fixtures.ts';

const SESSION = { id: 'ses_1', title: 'fix lint', status: 'running' };
const BASE = 'https://api.cortex.foundation';

function client(responses: Parameters<typeof stubFetch>[0]) {
  const { fetch, calls } = stubFetch(responses);
  return { client: new CortexApiClient({ fetch }), calls };
}

/** One queued response is enough for a call whose body is not read. */
function ok(body: unknown = {}) {
  return [{ body }];
}

describe('Code sessions', () => {
  it('reads a session detail with its timeline and diff', async () => {
    const { client: api, calls } = client(
      ok({
        ...SESSION,
        timeline: [{ id: 'e1', kind: 'reply', text: 'done' }],
        changes: [{ path: 'a.ts', additions: 1 }],
        pull_request: { url: 'https://github.com/o/r/pull/9', number: 9 },
      }),
    );

    const detail = await getCodeSession(api, 'ses_1');

    expect(calls[0]!.url).toBe(`${BASE}/v1/code/sessions/ses_1`);
    expect(detail.timeline?.[0]?.text).toBe('done');
    expect(detail.pull_request?.number).toBe(9);
  });

  it('encodes an identifier that needs it', async () => {
    const { client: api, calls } = client(ok(SESSION));
    await getCodeSession(api, 'ses/1');
    expect(calls[0]!.url).toBe(`${BASE}/v1/code/sessions/ses%2F1`);
  });

  it('starts, follows up, stops, archives and deletes a run', async () => {
    const { client: api, calls } = client([
      { body: SESSION },
      { body: SESSION },
      { body: SESSION },
      { body: SESSION },
      { status: 204 },
    ]);

    await createCodeSession(api, { prompt: 'fix lint', runtime: 'cloud', repository: 'o/r' });
    await followUpCodeSession(api, 'ses_1', { message: 'again' });
    await stopCodeSession(api, 'ses_1');
    await archiveCodeSession(api, 'ses_1', true);
    await deleteCodeSession(api, 'ses_1');

    expect(calls.map((call) => `${call.method} ${call.url.slice(BASE.length)}`)).toEqual([
      'POST /v1/code/sessions',
      'POST /v1/code/sessions/ses_1/turns',
      'POST /v1/code/sessions/ses_1/stop',
      'POST /v1/code/sessions/ses_1/archive',
      'DELETE /v1/code/sessions/ses_1',
    ]);
    expect(calls[0]!.body).toEqual({ prompt: 'fix lint', runtime: 'cloud', repository: 'o/r' });
    expect(calls[3]!.body).toEqual({ archived: true });
  });

  it('answers a permission over HTTP', async () => {
    const { client: api, calls } = client(ok());
    await resolveCodePermission(api, 'ses_1', {
      request_permission_id: 'req_1',
      decision: 'always',
    });
    expect(calls[0]!.url).toBe(`${BASE}/v1/code/sessions/ses_1/permissions`);
    expect(calls[0]!.body).toEqual({ request_permission_id: 'req_1', decision: 'always' });
  });

  it('lists repositories from the list envelope', async () => {
    const { client: api } = client(ok({ items: [{ full_name: 'o/r', default_branch: 'main' }] }));
    await expect(listCodeRepositories(api)).resolves.toEqual([
      { full_name: 'o/r', default_branch: 'main' },
    ]);
  });

  it('keeps a 404 as not_found rather than an empty result', async () => {
    const { client: api } = client([
      { status: 404, body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' } },
    ]);

    await expect(getCodeSession(api, 'ses_1')).rejects.toSatisfy(
      (error: unknown) => isCortexApiError(error) && error.code === 'not_found',
    );
  });
});

describe('Code settings and providers', () => {
  it('reads and writes workspace settings', async () => {
    const { client: api, calls } = client([
      { body: { defaults: { branch_prefix: 'cortex/' } } },
      { body: { defaults: { branch_prefix: 'x/' } } },
    ]);

    const read = await getCodeSettings(api);
    await putCodeSettings(api, { defaults: { branch_prefix: 'x/' } });

    expect(read.defaults?.branch_prefix).toBe('cortex/');
    expect(calls[1]!.method).toBe('PUT');
    expect(calls[1]!.body).toEqual({ defaults: { branch_prefix: 'x/' } });
  });

  it('saves a provider key and reads back only a mask', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'openai', configured: true, masked_key: 'sk-…4242' }] } },
      { body: { id: 'openai', configured: true, masked_key: 'sk-…4242' } },
    ]);

    const providers = await listCodeProviders(api);
    const saved = await putCodeProvider(api, 'openai', { api_key: 'sk-live' });

    expect(providers[0]?.masked_key).toBe('sk-…4242');
    expect(calls[1]!.method).toBe('PUT');
    expect(calls[1]!.body).toEqual({ api_key: 'sk-live' });
    // The response carries a mask, never the value that was sent.
    expect(saved).not.toHaveProperty('api_key');
  });
});

describe('Code secrets', () => {
  it('lists, creates and deletes', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'sec_1', name: 'TOKEN' }] } },
      { body: { id: 'sec_2', name: 'OTHER' } },
      { status: 204 },
    ]);

    const rows = await listCodeSecrets(api);
    await createCodeSecret(api, { name: 'OTHER', value: 'shh' });
    await deleteCodeSecret(api, 'sec_2');

    expect(rows[0]?.name).toBe('TOKEN');
    expect(calls[1]!.body).toEqual({ name: 'OTHER', value: 'shh' });
    expect(calls[2]!.method).toBe('DELETE');
    expect(calls[2]!.url).toBe(`${BASE}/v1/code/secrets/sec_2`);
  });
});

describe('Code automations', () => {
  it('covers the full lifecycle and its logs', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'aut_1', name: 'Nightly', enabled: true }] } },
      { body: { id: 'aut_2', name: 'New' } },
      { body: { id: 'aut_2', enabled: false } },
      { body: { id: 'log_1', status: 'success' } },
      { body: { items: [{ id: 'log_1', status: 'success' }] } },
      { status: 204 },
    ]);

    await listCodeAutomations(api);
    await createCodeAutomation(api, { name: 'New', trigger: { type: 'manual' } });
    await patchCodeAutomation(api, 'aut_2', { enabled: false });
    await runCodeAutomation(api, 'aut_2');
    await listCodeAutomationLogs(api, 'aut_2');
    await deleteCodeAutomation(api, 'aut_2');

    expect(calls.map((call) => `${call.method} ${call.url.slice(BASE.length)}`)).toEqual([
      'GET /v1/code/automations',
      'POST /v1/code/automations',
      'PATCH /v1/code/automations/aut_2',
      'POST /v1/code/automations/aut_2/run',
      'GET /v1/code/automations/aut_2/logs',
      'DELETE /v1/code/automations/aut_2',
    ]);
  });
});

describe('Code tickets', () => {
  it('covers the full lifecycle', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'tkt_1', title: 'Fix auth' }] } },
      { body: { id: 'tkt_1', title: 'Fix auth', session_id: 'ses_9' } },
      { body: { id: 'tkt_2', title: 'New' } },
      { body: { id: 'tkt_2', status: 'done' } },
      { status: 204 },
    ]);

    const rows = await listCodeTickets(api);
    const one = await getCodeTicket(api, 'tkt_1');
    await createCodeTicket(api, { title: 'New', repository: 'o/r' });
    await patchCodeTicket(api, 'tkt_2', { status: 'done' });
    await deleteCodeTicket(api, 'tkt_2');

    expect(rows[0]?.title).toBe('Fix auth');
    // A started ticket carries its run, so the UI links instead of duplicating it.
    expect(one.session_id).toBe('ses_9');
    expect(calls[2]!.body).toEqual({ title: 'New', repository: 'o/r' });
    expect(calls[3]!.method).toBe('PATCH');
    expect(calls[4]!.method).toBe('DELETE');
  });
});

describe('Usage, hosts and SSH runtimes', () => {
  it('reads account usage', async () => {
    const { client: api, calls } = client(ok({ credits_used: 12, credits_included: 100, plan: 'pro' }));
    const usage = await getCodeUsage(api);
    expect(calls[0]!.url).toBe(`${BASE}/v1/code/usage`);
    expect(usage.credits_used).toBe(12);
  });

  it('unpairs a host', async () => {
    const { client: api, calls } = client([{ status: 204 }]);
    await unpairCodeHost(api, 'host_1');
    expect(calls[0]!.method).toBe('DELETE');
    expect(calls[0]!.url).toBe(`${BASE}/v1/code/hosts/host_1`);
  });

  it('registers an SSH runtime without a key or password', async () => {
    const { client: api, calls } = client([
      { body: { items: [{ id: 'ssh_1', host: 'build-01', user: 'deploy' }] } },
      { body: { id: 'ssh_2', host: 'build-02', user: 'deploy', fingerprint: 'SHA256:aa' } },
      { status: 204 },
    ]);

    await listCodeSshRuntimes(api);
    const created = await createCodeSshRuntime(api, { host: 'build-02', user: 'deploy', port: 2222 });
    await deleteCodeSshRuntime(api, 'ssh_2');

    expect(calls[1]!.body).toEqual({ host: 'build-02', user: 'deploy', port: 2222 });
    // Nothing secret is sent: the service completes the handshake.
    expect(calls[1]!.body).not.toHaveProperty('private_key');
    expect(calls[1]!.body).not.toHaveProperty('password');
    expect(created.fingerprint).toBe('SHA256:aa');
    expect(calls[2]!.url).toBe(`${BASE}/v1/code/runtimes/ssh/ssh_2`);
  });

  it('omits an absent port rather than sending a default', async () => {
    const { client: api, calls } = client(ok({ id: 'ssh_3' }));
    await createCodeSshRuntime(api, { host: 'build-03', user: 'deploy' });
    expect(calls[0]!.body).toEqual({ host: 'build-03', user: 'deploy' });
  });
});
