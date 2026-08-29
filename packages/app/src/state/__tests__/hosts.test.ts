/**
 * The renderer's hosts, and the invariants that make them safe.
 *
 * Every one of them wraps an IPC bridge, and every one shares two properties worth
 * asserting: a failed envelope throws rather than resolving to `undefined`, and the
 * detached variant answers honestly instead of pretending the desktop is there.
 *
 * The first matters most. `undefined` from a failed call reads as "no data", and "no
 * runs" is a state the app supports — so a swallowed failure is indistinguishable
 * from an empty account.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detachedSessionHost,
  resolveSessionHost,
} from '../session-host.ts';
import { detachedSettingsHost, resolveSettingsHost } from '../settings-host.ts';
import { detachedAutomationHost, resolveAutomationHost } from '../automation-host.ts';
import { resolveTerminalHost } from '../terminal-host.ts';

const failure = { success: false as const, error: { code: 'X', message: 'main said no' } };

function install(namespace: string, bridge: Record<string, unknown>): void {
  (globalThis as { cortex?: Record<string, unknown> }).cortex = { [namespace]: bridge };
}

afterEach(() => {
  delete (globalThis as { cortex?: unknown }).cortex;
});

describe('failed envelopes throw', () => {
  it('session reads', async () => {
    install('session', { list: vi.fn(async () => failure) });
    await expect(resolveSessionHost().list()).rejects.toThrow('main said no');
  });

  it('settings writes', async () => {
    install('settings', { setWorkspace: vi.fn(async () => failure) });
    await expect(resolveSettingsHost().setWorkspace({})).rejects.toThrow('main said no');
  });

  it('automation creation', async () => {
    install('automation', { create: vi.fn(async () => failure) });
    await expect(
      resolveAutomationHost().create({
        name: 'n',
        trigger: { type: 'manual' },
        actions: [],
        enabled: true,
      }),
    ).rejects.toThrow('main said no');
  });
});

describe('successful envelopes are unwrapped', () => {
  it('session list', async () => {
    install('session', {
      list: vi.fn(async () => ({ success: true, data: { sessions: [{ id: 'a' }] } })),
    });
    await expect(resolveSessionHost().list()).resolves.toEqual([{ id: 'a' }]);
  });

  it('a workspace read', async () => {
    install('settings', {
      getWorkspace: vi.fn(async () => ({
        success: true,
        data: { defaults: { branchPrefix: 'from-main/' } },
      })),
    });
    await expect(resolveSettingsHost().getWorkspace()).resolves.toEqual({
      defaults: { branchPrefix: 'from-main/' },
    });
  });
});

describe('the session host', () => {
  it('reduces a cancelled folder pick to a flag, not an error', () => {
    // Closing the dialog is a normal gesture. Reporting it as a failure would show
    // an error for choosing not to choose.
    expect(detachedSessionHost().openWorkspace()).resolves.toEqual({
      cancelled: true,
      repositories: [],
    });
  });

  it('answers empty for reads and rejects writes when detached', async () => {
    const host = detachedSessionHost();

    await expect(host.list()).resolves.toEqual([]);
    await expect(host.get('anything')).resolves.toBeNull();
    await expect(host.start({ prompt: 'p', runtime: 'local' })).rejects.toThrow(/desktop app/i);
  });
});

describe('the settings host', () => {
  it('answers with main’s own defaults so the screen renders its real layout', async () => {
    const settings = await detachedSettingsHost().getWorkspace();

    expect(settings.defaults.branchPrefix).toBe('cortex/');
    // True for the same reason main defaults it true: an agent that cannot run a
    // command cannot check its own work.
    expect(settings.permissions.runShellCommands).toBe(true);
  });

  it('rejects a write rather than showing a saved state nothing stored', async () => {
    await expect(
      detachedSettingsHost().setProvider({ id: 'openai', enabled: true }),
    ).rejects.toThrow(/desktop app/i);
  });
});

describe('the automation host', () => {
  it('answers empty for a list and rejects the rest', async () => {
    const host = detachedAutomationHost();

    await expect(host.list()).resolves.toEqual([]);
    await expect(host.toggle('a', true)).rejects.toThrow(/desktop app/i);
    await expect(host.run('a')).rejects.toThrow(/desktop app/i);
  });
});

describe('the terminal host', () => {
  it('reports itself unavailable rather than failing on use', () => {
    // The Shell tab checks this and says why there is no terminal, instead of
    // rendering an empty rectangle that looks like a hung shell.
    expect(resolveTerminalHost().available).toBe(false);
  });

  it('is available once the bridge exists', () => {
    install('terminal', { create: vi.fn(), onData: vi.fn(), onExit: vi.fn() });
    expect(resolveTerminalHost().available).toBe(true);
  });

  it('returns the id main assigned, not the one it was asked for', async () => {
    // `terminal:create` ignores a caller-supplied id and answers with its own.
    // Filtering output on a locally-invented one matches nothing, which renders as a
    // terminal that mounts and stays blank forever.
    install('terminal', {
      create: vi.fn(async () => ({ success: true, data: { terminalId: 'assigned-by-main' } })),
      onData: vi.fn(),
      onExit: vi.fn(),
    });

    await expect(resolveTerminalHost().create({ cols: 80, rows: 24 })).resolves.toBe(
      'assigned-by-main',
    );
  });
});
