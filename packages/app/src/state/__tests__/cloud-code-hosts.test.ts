import { describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { createCloudAutomationHost } from '../cloud-automation-host.ts';
import { createCloudSettingsHost } from '../cloud-settings-host.ts';
import {
  toRunSettings,
  toSessionDetail,
  toSessionEvent,
  toSessionRuntime,
  toSessionStatus,
  toSettingsPatch,
  toWireDecision,
} from '../cloud-code-map.ts';
import { DEFAULT_RUN_SETTINGS } from '../settings-host.ts';
import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';

const NOT_FOUND = {
  status: 404,
  body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' },
};

function api(responses: Parameters<typeof stubFetch>[0]) {
  const { fetch, calls } = stubFetch(responses);
  return { client: new CortexApiClient({ fetch }), calls };
}

describe('wire mapping', () => {
  it('narrows an unknown status rather than guessing optimistically', () => {
    expect(toSessionStatus('review')).toBe('review');
    // Not `merged`: nothing said the run finished.
    expect(toSessionStatus('something-new')).toBe('queued');
    expect(toSessionStatus(undefined)).toBe('queued');
  });

  it('defaults a runtime to cloud, the only answer that can be true', () => {
    expect(toSessionRuntime('ssh')).toBe('ssh');
    // A run learned about over HTTP is not running in this browser.
    expect(toSessionRuntime(undefined)).toBe('cloud');
  });

  it('maps timeline kinds and drops ones it does not model', () => {
    expect(toSessionEvent({ id: 'e', kind: 'prompt', text: 'go' })?.kind).toBe('prompt');
    expect(toSessionEvent({ id: 'e', role: 'assistant', text: 'ok' })?.kind).toBe('reply');
    expect(toSessionEvent({ id: 'e', kind: 'thinking', text: '…' })?.kind).toBe('thinking');
    expect(toSessionEvent({ id: 'e', kind: 'error', text: 'bad' })?.kind).toBe('error');

    const tool = toSessionEvent({ id: 'e', kind: 'tool', tool: 'Edit', status: 'ok' });
    expect(tool).toMatchObject({ kind: 'tool', name: 'Edit', ok: true });
    expect(toSessionEvent({ id: 'e', kind: 'tool', tool: 'Bash', status: 'error' })).toMatchObject({
      ok: false,
    });

    // Rendered as agent prose it would put words in the agent's mouth.
    expect(toSessionEvent({ id: 'e', kind: 'unheard-of' })).toBeUndefined();
  });

  it('surfaces a pending permission from the detail row', () => {
    const detail = toSessionDetail({
      id: 'ses_1',
      status: 'running',
      timeline: [{ id: 'e1', kind: 'prompt', text: 'go' }],
      permission_request: { id: 'req_1', command: 'rm -rf build' },
      created_at: '2026-08-01T00:00:00Z',
    });

    // A reloaded tab still shows the Allow / Always / Deny prompt.
    expect(detail.events.at(-1)).toMatchObject({ kind: 'permission', requestId: 'req_1' });
    expect(detail.createdAt).toBe(Date.parse('2026-08-01T00:00:00Z'));
  });

  it('falls back to now for an unparseable timestamp', () => {
    const detail = toSessionDetail({ id: 'ses_1', created_at: 'not-a-date' }, 1234);
    expect(detail.createdAt).toBe(1234);
  });

  it('names a permission request from whatever the row carries', () => {
    expect(
      toSessionDetail({ id: 's', permission_request: { id: 'r', tool: 'Bash' } }).events[0],
    ).toMatchObject({ summary: 'Bash is waiting for a decision' });
    expect(
      toSessionDetail({ id: 's', permission_request: { id: 'r' } }).events[0],
    ).toMatchObject({ summary: 'The agent is waiting for a decision' });
  });

  it('maps only the two decisions with distinct wire names', () => {
    expect(toWireDecision('deny')).toBe('deny');
    expect(toWireDecision('allow-always')).toBe('always');
    expect(toWireDecision('allow-once')).toBe('allow');
  });

  it('fills settings gaps from the shipped defaults', () => {
    const settings = toRunSettings({ defaults: { model: 'cortex-opus' } }, DEFAULT_RUN_SETTINGS);
    expect(settings.defaults.model).toBe('cortex-opus');
    expect(settings.defaults.branchPrefix).toBe(DEFAULT_RUN_SETTINGS.defaults.branchPrefix);
    // An unrecognised enum falls back rather than being carried through.
    expect(
      toRunSettings({ defaults: { create_pull_requests: 'nonsense' } }, DEFAULT_RUN_SETTINGS)
        .defaults.createPullRequests,
    ).toBe('draft');
    expect(
      toRunSettings({ permissions: { network_access: 'nonsense' } }, DEFAULT_RUN_SETTINGS)
        .permissions.networkAccess,
    ).toBe('allowlist');
  });

  it('sends only the fields that changed', () => {
    // Sending everything would let one tab overwrite what another just set.
    expect(toSettingsPatch({ defaults: { branchPrefix: 'x/' } })).toEqual({
      defaults: { branch_prefix: 'x/' },
    });
    expect(toSettingsPatch({ permissions: { runShellCommands: false } })).toEqual({
      permissions: { run_shell_commands: false },
    });
    expect(toSettingsPatch({})).toEqual({});
    expect(
      toSettingsPatch({
        defaults: { model: 'm', repository: 'o/r', baseBranch: 'main', createPullRequests: 'ready' },
        permissions: {
          applyDatabaseMigrations: true,
          slackNotifications: true,
          networkAccess: 'none',
        },
      }),
    ).toEqual({
      defaults: {
        model: 'm',
        repository: 'o/r',
        base_branch: 'main',
        create_pull_requests: 'ready',
      },
      permissions: {
        apply_database_migrations: true,
        slack_notifications: true,
        network_access: 'none',
      },
    });
  });
});

describe('cloud settings host', () => {
  it('reads providers and workspace settings from the account', async () => {
    const { client, calls } = api([
      { body: { items: [{ id: 'openai', configured: true, masked_key: 'sk-…4242', source: 'env' }] } },
      { body: { defaults: { branch_prefix: 'cortex/' } } },
    ]);
    const host = createCloudSettingsHost(client);

    const providers = await host.getProviders();
    const workspace = await host.getWorkspace();

    expect(providers.providers[0]).toMatchObject({
      id: 'openai',
      maskedApiKey: 'sk-…4242',
      credentialSource: 'env',
      active: true,
    });
    expect(workspace.defaults.branchPrefix).toBe('cortex/');
    expect(calls[0]!.url).toContain('/v1/code/providers');
  });

  it('re-reads after a save instead of echoing the request', async () => {
    const { client, calls } = api([
      { body: { id: 'openai', configured: true, masked_key: 'sk-…4242' } },
      { body: { items: [{ id: 'openai', configured: true, masked_key: 'sk-…4242' }] } },
    ]);
    const host = createCloudSettingsHost(client);

    const saved = await host.setProvider({ id: 'openai', enabled: true, apiKey: 'sk-live' });

    // Persisting without the service accepting it is the failure this shape catches.
    expect(calls[1]!.method).toBe('GET');
    expect(saved.activeProviders).toEqual(['openai']);
  });

  it('explains a missing settings route instead of showing defaults as the account', async () => {
    const { client } = api([NOT_FOUND, NOT_FOUND, NOT_FOUND, NOT_FOUND]);
    const host = createCloudSettingsHost(client);

    await expect(host.getWorkspace()).rejects.toThrow(/does not expose Code settings/i);
    await expect(host.getProviders()).rejects.toThrow(/does not expose Code settings/i);
    await expect(host.setWorkspace({ defaults: { model: 'm' } })).rejects.toThrow(/Code settings/i);
    await expect(host.setProvider({ id: 'openai', enabled: true })).rejects.toThrow(/Code settings/i);
  });

  it('rethrows a non-404 unchanged', async () => {
    const { client } = api([{ status: 500, body: { code: 'BOOM', message: 'server on fire' } }]);
    await expect(createCloudSettingsHost(client).getWorkspace()).rejects.toThrow(/server on fire/);
  });
});

describe('cloud automation host', () => {
  it('maps a row and round-trips an unfamiliar trigger untouched', async () => {
    const watch = { type: 'file_watch', patterns: ['**/*.ts'], events: ['change'], workspacePath: '/w' };
    const { client } = api([
      {
        body: {
          items: [
            { id: 'aut_1', name: 'Nightly', enabled: true, trigger: watch, created_at: '2026-08-01T00:00:00Z' },
            { id: 'aut_2' },
          ],
        },
      },
    ]);

    const rows = await createCloudAutomationHost(client).list();

    // The service decides which host a watch belongs to; rewriting it would be a guess.
    expect(rows[0]?.trigger).toEqual(watch);
    expect(rows[0]?.createdAt).toBe(Date.parse('2026-08-01T00:00:00Z'));
    // A row with no recognisable trigger is still listed and deletable.
    expect(rows[1]).toMatchObject({ name: 'Automation', enabled: false, trigger: { type: 'manual' } });
    // The workspace is the account's; the browser has no local id to claim.
    expect(rows[1]?.workspaceId).toBe('');
  });

  it('creates, toggles, runs, reads logs and deletes', async () => {
    const { client, calls } = api([
      { body: { id: 'aut_3', name: 'New', enabled: true } },
      { body: { id: 'aut_3', enabled: false } },
      { body: { id: 'log_1', automation_id: 'aut_3', status: 'success', message: 'done' } },
      { body: { items: [{ id: 'log_1', status: 'running' }] } },
      { status: 204 },
    ]);
    const host = createCloudAutomationHost(client);

    await host.create({ name: 'New', trigger: { type: 'manual' }, actions: [], enabled: true });
    await host.toggle('aut_3', false);
    const log = await host.run('aut_3');
    const logs = await host.logs('aut_3');
    await host.remove('aut_3');

    expect(log).toMatchObject({ status: 'success', output: 'done' });
    expect(logs[0]?.status).toBe('running');
    expect(calls[4]!.method).toBe('DELETE');
  });

  it('renders empty for a missing route but refuses to schedule anything', async () => {
    const { client } = api([NOT_FOUND, NOT_FOUND, NOT_FOUND, NOT_FOUND, NOT_FOUND, NOT_FOUND]);
    const host = createCloudAutomationHost(client);

    await expect(host.list()).resolves.toEqual([]);
    await expect(host.logs('aut_1')).resolves.toEqual([]);
    // Nobody creates a schedule that will never fire.
    await expect(host.create({ name: 'x', trigger: { type: 'manual' }, actions: [], enabled: true })).rejects.toThrow(
      /does not run account automations/i,
    );
    await expect(host.toggle('aut_1', true)).rejects.toThrow(/account automations/i);
    await expect(host.run('aut_1')).rejects.toThrow(/account automations/i);
    await expect(host.remove('aut_1')).rejects.toThrow(/account automations/i);
  });

  it('rethrows a non-404 from the list and the logs', async () => {
    const boom = { status: 500, body: { code: 'BOOM', message: 'nope' } };
    const { client } = api([boom, boom]);
    const host = createCloudAutomationHost(client);
    await expect(host.list()).rejects.toThrow(/nope/);
    await expect(host.logs('aut_1')).rejects.toThrow(/nope/);
  });
});
