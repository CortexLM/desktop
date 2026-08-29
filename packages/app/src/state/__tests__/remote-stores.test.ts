import { afterEach, describe, expect, it } from 'vitest';

import { CortexApiClient } from '@cortex-ide/cortex-api';

import { setBotClientForTests } from '../bot-client.ts';
import { createRemoteCollection, honestStateFor } from '../remote-collection.ts';
import {
  addSshRuntime,
  clearPairingCode,
  codeHosts,
  codeHostsState,
  loadCodeHosts,
  loadSshRuntimes,
  pairingCode,
  pairingError,
  removeHost,
  removeSshRuntime,
  resetCodeHostsForTests,
  sshRuntimes,
  startPairing,
  toCodeHost,
  toSshRuntime,
} from '../code-hosts.ts';
import {
  addTicket,
  loadTicket,
  loadTickets,
  openTicket,
  removeTicket,
  resetTicketsForTests,
  saveTicket,
  setTicketStatus,
  ticketState,
  tickets,
  ticketsState,
  toCodeTicket,
} from '../tickets.ts';
import {
  libraryItems,
  libraryState,
  loadLibrary,
  removeLibraryItem,
  resetLibraryForTests,
  saveToLibrary,
  toLibraryItem,
} from '../library.ts';
import {
  loadResearch,
  researchRuns,
  researchState,
  resetResearchForTests,
  startResearch,
  toResearchRun,
} from '../research.ts';
import { accountUsage, loadAccountUsage, resetUsageForTests } from '../usage.ts';
import { resetHostPairing } from '../host-pairing.ts';
import { stubFetch } from '../../../../cortex-api/src/__tests__/fixtures.ts';

const NOT_FOUND = {
  status: 404,
  body: { code: 'not_found', title: 'Not found', detail: 'No such endpoint.' },
};

function connect(responses: Parameters<typeof stubFetch>[0]) {
  const { fetch, calls } = stubFetch(responses);
  setBotClientForTests(new CortexApiClient({ fetch }));
  return calls;
}

afterEach(() => {
  setBotClientForTests(undefined);
  resetCodeHostsForTests();
  resetTicketsForTests();
  resetLibraryForTests();
  resetResearchForTests();
  resetUsageForTests();
  resetHostPairing();
  globalThis.localStorage?.clear();
});

describe('remote collection lifecycle', () => {
  it('separates empty, unsupported, disconnected and error', async () => {
    const collection = createRemoteCollection<{ id: string }>({
      label: 'Widgets',
      load: async (client) => {
        const list = await client.request('/v1/widgets', (await import('zod')).z.any());
        return (list as { items: Array<{ id: string }> }).items;
      },
    });

    // No client at all: the browser on an origin that may not call the API.
    await collection.reload();
    expect(collection.state()).toBe('disconnected');
    await expect(collection.mutate(async () => {})).rejects.toThrow(/connection to Cortex/i);

    connect([{ body: { items: [] } }]);
    await collection.reload();
    // The service answered with nothing, which is genuinely empty.
    expect(collection.state()).toBe('empty');

    connect([{ body: { items: [{ id: 'w1' }] } }]);
    await collection.reload();
    expect(collection.state()).toBe('ready');
    expect(collection.items()).toEqual([{ id: 'w1' }]);

    connect([NOT_FOUND]);
    await collection.reload();
    // Not `empty`: that would claim the account has nothing.
    expect(collection.state()).toBe('unsupported');
    expect(collection.items()).toEqual([]);

    connect([{ status: 500, body: { code: 'BOOM', message: 'server on fire' } }]);
    await collection.reload();
    expect(collection.state()).toBe('error');
    expect(collection.error()).toMatch(/server on fire/);

    collection.reset();
    expect(collection.state()).toBe('idle');
  });

  it('re-reads after a write', async () => {
    const collection = createRemoteCollection<{ id: string }>({
      label: 'Widgets',
      load: async (client) => {
        const list = await client.request('/v1/widgets', (await import('zod')).z.any());
        return (list as { items: Array<{ id: string }> }).items;
      },
    });

    const calls = connect([{ body: {} }, { body: { items: [{ id: 'w1' }] } }]);
    await collection.mutate(async (client) => {
      await client.request('/v1/widgets', (await import('zod')).z.any(), { method: 'POST', body: {} });
    });

    expect(calls[0]!.method).toBe('POST');
    expect(calls[1]!.method).toBe('GET');
    expect(collection.items()).toEqual([{ id: 'w1' }]);
  });

  it('maps a lifecycle onto what HonestState renders', () => {
    expect(honestStateFor('idle')).toBe('loading');
    expect(honestStateFor('loading')).toBe('loading');
    expect(honestStateFor('empty')).toBe('empty');
    expect(honestStateFor('ready')).toBe('none');
    // Both must read as errors, never as "you have nothing".
    expect(honestStateFor('unsupported')).toBe('error');
    expect(honestStateFor('disconnected')).toBe('error');
    expect(honestStateFor('error')).toBe('error');
  });
});

describe('Code hosts and SSH runtimes', () => {
  it('narrows a host status without calling an unknown one offline', () => {
    expect(toCodeHost({ id: 'h1', status: 'online' }).status).toBe('online');
    expect(toCodeHost({ id: 'h1', status: 'connected' }).status).toBe('online');
    expect(toCodeHost({ id: 'h1', status: 'disconnected' }).status).toBe('offline');
    expect(toCodeHost({ id: 'h1', status: 'weird' }).status).toBe('unknown');
    expect(toCodeHost({ name: 'ana-mbp' }).id).toBe('ana-mbp');
    expect(toCodeHost({ id: 'h1', url: 'https://code.internal' }).url).toBe('https://code.internal');
  });

  it('labels an SSH runtime from user and host', () => {
    expect(toSshRuntime({ id: 's1', user: 'deploy', host: 'build-01' }).label).toBe(
      'deploy@build-01',
    );
    expect(toSshRuntime({ id: 's1', host: 'build-01' }).label).toBe('build-01');
    expect(toSshRuntime({ id: 's1' }).label).toBe('s1');
    expect(toSshRuntime({ id: 's1', fingerprint: 'SHA256:aa' }).fingerprint).toBe('SHA256:aa');
  });

  it('lists paired hosts and registered servers', async () => {
    connect([
      { body: { items: [{ id: 'h1', name: 'ana-mbp', status: 'online' }] } },
      { body: { items: [{ id: 's1', host: 'build-01', user: 'deploy' }] } },
    ]);

    await loadCodeHosts();
    await loadSshRuntimes();

    expect(codeHosts()[0]?.name).toBe('ana-mbp');
    expect(codeHostsState()).toBe('ready');
    expect(sshRuntimes()[0]?.label).toBe('deploy@build-01');
  });

  it('shows a pairing code once and never persists it', async () => {
    connect([{ body: { pairing_code: 'PAIR-1234' } }, { body: { items: [] } }]);

    await startPairing();

    expect(pairingCode()).toBe('PAIR-1234');
    // The service stores a hash; this client keeps the code in memory only.
    const stored = JSON.stringify({ ...globalThis.localStorage });
    expect(stored).not.toContain('PAIR-1234');

    clearPairingCode();
    expect(pairingCode()).toBe('');
  });

  it('says pairing is unsupported rather than silently failing', async () => {
    connect([NOT_FOUND]);
    await startPairing();
    expect(pairingCode()).toBe('');
    expect(pairingError()).toMatch(/cannot pair a Code host/i);
  });

  it('reports a real pairing failure with its own message', async () => {
    // Distinct from a missing route: "not available" would be neither true nor
    // actionable for a service that answered 500.
    connect([{ status: 500, body: { code: 'BOOM', message: 'pairing service down' } }]);
    await startPairing();
    expect(pairingError()).toMatch(/pairing service down/);
  });

  it('unpairs, registers and removes over the API', async () => {
    const calls = connect([
      { status: 204 },
      { body: { items: [] } },
      { body: { id: 's2' } },
      { body: { items: [] } },
      { status: 204 },
      { body: { items: [] } },
    ]);

    await removeHost('h1');
    await addSshRuntime({ host: 'build-02', user: 'deploy', port: 2222 });
    await removeSshRuntime('s2');

    expect(calls[0]!.method).toBe('DELETE');
    expect(calls[2]!.body).toEqual({ host: 'build-02', user: 'deploy', port: 2222 });
    expect(calls[4]!.method).toBe('DELETE');
  });

  it('refuses writes with no connection instead of pretending', async () => {
    await expect(removeHost('h1')).rejects.toThrow(/connection to Cortex/i);
    await expect(addSshRuntime({ host: 'h', user: 'u' })).rejects.toThrow(/connection to Cortex/i);
  });

  it('omits an absent port', async () => {
    const calls = connect([{ body: { id: 's3' } }, { body: { items: [] } }]);
    await addSshRuntime({ host: 'build-03', user: 'deploy' });
    expect(calls[0]!.body).toEqual({ host: 'build-03', user: 'deploy' });
  });
});

describe('Tickets', () => {
  it('maps a row and links a started ticket to its run', () => {
    expect(toCodeTicket({ id: 't1', title: 'Fix auth', status: 'in_progress' })).toMatchObject({
      title: 'Fix auth',
      status: 'in_progress',
    });
    // An unfamiliar status is still work someone queued.
    expect(toCodeTicket({ id: 't1', status: 'weird' }).status).toBe('open');
    expect(toCodeTicket({ id: 't1' }).title).toBe('Ticket');
    expect(toCodeTicket({ id: 't1', session_id: 'ses_9' }).sessionId).toBe('ses_9');
    expect(toCodeTicket({ id: 't1', repository: 'o/r' }).repository).toBe('o/r');
  });

  it('lists, adds, restatuses and deletes', async () => {
    const calls = connect([
      { body: { items: [{ id: 't1', title: 'Fix auth' }] } },
      { body: { id: 't2' } },
      { body: { items: [{ id: 't1' }, { id: 't2' }] } },
      { body: { id: 't2', status: 'done' } },
      { body: { items: [{ id: 't1' }] } },
      { status: 204 },
      { body: { items: [{ id: 't1' }] } },
    ]);

    await loadTickets();
    expect(tickets()[0]?.title).toBe('Fix auth');
    expect(ticketsState()).toBe('ready');

    await addTicket({ title: 'New', repository: 'o/r' });
    expect(calls[1]!.body).toEqual({ title: 'New', repository: 'o/r' });

    await setTicketStatus('t2', 'done');
    expect(calls[3]!.method).toBe('PATCH');

    await removeTicket('t2');
    expect(calls[5]!.method).toBe('DELETE');
  });

  it('opens one ticket and reports a stale link honestly', async () => {
    connect([{ body: { id: 't1', title: 'Fix auth', body: 'details' } }]);
    await loadTicket('t1');
    expect(openTicket()?.body).toBe('details');
    expect(ticketState()).toBe('ready');

    connect([NOT_FOUND]);
    await loadTicket('gone');
    expect(openTicket()).toBeUndefined();
    expect(ticketState()).toBe('error');
  });

  it('says it is disconnected rather than showing an empty queue', async () => {
    await loadTicket('t1');
    expect(ticketState()).toBe('disconnected');
    await expect(saveTicket('t1', { title: 'x' })).rejects.toThrow(/connection to Cortex/i);
  });

  it('saves an edit and re-reads it', async () => {
    const calls = connect([{ body: { id: 't1', title: 'Renamed' } }, { body: { id: 't1', title: 'Renamed' } }]);
    await saveTicket('t1', { title: 'Renamed' });
    expect(calls[0]!.method).toBe('PATCH');
    expect(openTicket()?.title).toBe('Renamed');
  });
});

describe('Library', () => {
  it('maps a saved answer', () => {
    expect(toLibraryItem({ id: 'l1', title: 'Tokyo', kind: 'upload' })).toMatchObject({
      title: 'Tokyo',
      kind: 'upload',
    });
    // Anything not an upload is an answer.
    expect(toLibraryItem({ id: 'l1' })).toMatchObject({ title: 'Saved item', kind: 'answer' });
    expect(toLibraryItem({ id: 'l1', created_at: 'nonsense' }).savedAt).toBe(0);
  });

  it('saves to the account and never to localStorage', async () => {
    const calls = connect([{ body: { id: 'l1' } }, { body: { items: [{ id: 'l1', title: 'Saved' }] } }]);

    await saveToLibrary({ title: 'Saved', excerpt: 'the answer', conversationId: 'cnv_1' });

    expect(calls[0]!.body).toEqual({
      title: 'Saved',
      kind: 'answer',
      excerpt: 'the answer',
      conversation_id: 'cnv_1',
    });
    expect(libraryItems()[0]?.title).toBe('Saved');
    expect(globalThis.localStorage?.getItem('cortex.library.v1')).toBeNull();
  });

  it('reports a missing library route as unsupported', async () => {
    connect([NOT_FOUND]);
    await loadLibrary();
    expect(libraryState()).toBe('unsupported');
  });

  it('removes an item', async () => {
    const calls = connect([{ status: 204 }, { body: { items: [] } }]);
    await removeLibraryItem('l1');
    expect(calls[0]!.method).toBe('DELETE');
  });
});

describe('Research', () => {
  it('maps a run and narrows its status', () => {
    expect(toResearchRun({ id: 'r1', question: 'Why?', status: 'done', source_count: 3 })).toEqual({
      id: 'r1',
      question: 'Why?',
      status: 'done',
      sourceCount: 3,
    });
    expect(toResearchRun({ id: 'r1', status: 'weird' }).status).toBe('queued');
    expect(toResearchRun({ id: 'r1' }).question).toBe('Research');
    expect(toResearchRun({ id: 'r1', conversation_id: 'cnv_2' }).conversationId).toBe('cnv_2');
  });

  it('queues a run and re-reads the list', async () => {
    const calls = connect([
      { body: { id: 'r2' } },
      { body: { items: [{ id: 'r2', question: 'Why?' }] } },
    ]);

    await startResearch('  Why?  ');

    expect(calls[0]!.body).toEqual({ question: 'Why?' });
    expect(researchRuns()[0]?.question).toBe('Why?');
  });

  it('ignores an empty question rather than queueing nothing', async () => {
    await startResearch('   ');
    expect(researchRuns()).toEqual([]);
  });

  it('reports a missing research route as unsupported', async () => {
    connect([NOT_FOUND]);
    await loadResearch();
    expect(researchState()).toBe('unsupported');
  });
});

describe('Account usage', () => {
  it('reads credits from the service', async () => {
    connect([{ body: { credits_used: 12, credits_included: 100, plan: 'pro' } }]);
    await loadAccountUsage();
    expect(accountUsage()?.credits_used).toBe(12);
  });

  it('leaves usage undefined rather than zeroed when the route is absent', async () => {
    connect([NOT_FOUND]);
    await loadAccountUsage();
    // A billing figure that reads as precise and is made up is worse than none.
    expect(accountUsage()).toBeUndefined();
  });

  it('stays undefined with no connection', async () => {
    await loadAccountUsage();
    expect(accountUsage()).toBeUndefined();
  });
});
