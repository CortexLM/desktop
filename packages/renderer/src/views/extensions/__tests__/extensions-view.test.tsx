/**
 * Extensions view: the crash that took the whole view down, plus the envelope
 * and empty/error states its panels depend on.
 *
 * Baseline: `packages/renderer/src/views/extensions/` was at 0% line coverage
 * (0/211, read from lcov.info — the text reporter omitted the directory
 * entirely, which is not the same thing as reporting zero).
 *
 * The regressions each test would catch are named on the test itself. The
 * headline one:
 *
 *   `MCPMarketplace` built its catalogue at MODULE SCOPE and called
 *   `process.cwd()` while doing it. `process` does not exist in the renderer, so
 *   the reference threw a ReferenceError at import time. Because
 *   `MCPExtensions` imports the marketplace eagerly, the failure was not
 *   contained to the marketplace tab: the entire Extensions view went down,
 *   including the "Installed" list a user lands on first.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { MCPServer } from '@cortex-ide/shared';

import { MCPExtensions } from '../MCPExtensions';
import { MCPMarketplace } from '../MCPMarketplace';
import { MCPExtensionList } from '../MCPExtensionList';
import { MCPToolsView } from '../MCPToolsView';
import { MCPConfig } from '../MCPConfig';

// ---------------------------------------------------------------------------
// window.cortex.mcp stub
//
// Handlers answer with the `IPCResponse` envelope: `{ success: true, data }`.
// The panels run the response through `unwrapResponse`, so the envelope is part
// of the contract under test — a bare payload must not be silently tolerated.
// ---------------------------------------------------------------------------

const ok = <T,>(data: T) => ({ success: true as const, data });
const fail = (code: string, message: string) => ({
  success: false as const,
  error: { code, message },
});

interface McpStub {
  listServers: ReturnType<typeof vi.fn>;
  getServer: ReturnType<typeof vi.fn>;
  installServer: ReturnType<typeof vi.fn>;
  uninstallServer: ReturnType<typeof vi.fn>;
  startServer: ReturnType<typeof vi.fn>;
  stopServer: ReturnType<typeof vi.fn>;
  discoverTools: ReturnType<typeof vi.fn>;
  invokeTool: ReturnType<typeof vi.fn>;
  checkPermission: ReturnType<typeof vi.fn>;
  grantPermission: ReturnType<typeof vi.fn>;
  onServerStarted: ReturnType<typeof vi.fn>;
  onServerStopped: ReturnType<typeof vi.fn>;
  onServerError: ReturnType<typeof vi.fn>;
}

let mcp: McpStub;
let alertSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

/** Subscriptions handed back to the component, so tests can fire events. */
let listeners: {
  started: Array<() => void>;
  stopped: Array<() => void>;
  errored: Array<() => void>;
};

const server = (overrides: Partial<MCPServer> = {}): MCPServer =>
  ({
    id: 'srv-1',
    name: 'Filesystem',
    description: 'Local file access',
    status: 'stopped',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
    version: '1.0.0',
    author: 'ModelContext Protocol',
    ...overrides,
  }) as MCPServer;

beforeEach(() => {
  listeners = { started: [], stopped: [], errored: [] };

  mcp = {
    listServers: vi.fn(async () => ok({ servers: [] })),
    getServer: vi.fn(async () => ok({ server: server() })),
    installServer: vi.fn(async () => ok({ server: server() })),
    uninstallServer: vi.fn(async () => ok({ success: true })),
    startServer: vi.fn(async () => ok({ server: server({ status: 'running' }) })),
    stopServer: vi.fn(async () => ok({ server: server({ status: 'stopped' }) })),
    discoverTools: vi.fn(async () => ok({ tools: [] })),
    invokeTool: vi.fn(async () => ok({ result: {} })),
    checkPermission: vi.fn(async () => ok({ granted: true })),
    grantPermission: vi.fn(async () => ok({ granted: true })),
    onServerStarted: vi.fn((cb: () => void) => {
      listeners.started.push(cb);
      return () => undefined;
    }),
    onServerStopped: vi.fn((cb: () => void) => {
      listeners.stopped.push(cb);
      return () => undefined;
    }),
    onServerError: vi.fn((cb: () => void) => {
      listeners.errored.push(cb);
      return () => undefined;
    }),
  };

  Object.defineProperty(window, 'cortex', {
    configurable: true,
    writable: true,
    value: { mcp },
  });

  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
  consoleErrorSpy.mockRestore();
  vi.restoreAllMocks();
});

// ===========================================================================
// The crash: module scope must stay renderer-safe
// ===========================================================================

describe('the Extensions view survives being imported', () => {
  /**
   * Regression: `process.cwd()` in the module-scope catalogue.
   *
   * This is a source-level assertion rather than a render, deliberately. The
   * failure was a ReferenceError raised while the module was being *evaluated*,
   * so by the time any test could render a component the damage is already done
   * — and under vitest `process` happens to exist, which would hide the bug
   * entirely. What must hold is a property of the file: nothing at module scope
   * may touch a Node global.
   */
  it('never references a Node-only global at module scope', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../MCPMarketplace.tsx'),
      'utf8'
    );

    // Everything before the component declaration is module-scope code, which
    // runs on import.
    const componentStart = source.indexOf('export const MCPMarketplace');
    expect(componentStart).toBeGreaterThan(0);

    // Comments are stripped first: the fix is *documented* in a comment naming
    // `process.cwd()`, and matching that text would make this test fail on the
    // very explanation of the thing it guards. Only executable code counts.
    const moduleScope = source
      .slice(0, componentStart)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    for (const nodeOnly of ['process.cwd', 'process.env', '__dirname', 'require(']) {
      expect(moduleScope).not.toContain(nodeOnly);
    }
  });

  /**
   * Regression: the crash was not contained to the marketplace tab.
   * `MCPExtensions` imports `MCPMarketplace` eagerly, so a throw at its module
   * scope took down the "Installed" tab a user sees first. Rendering the
   * container proves the whole view still mounts.
   */
  it('mounts the container and lands on the Installed tab', async () => {
    render(<MCPExtensions />);

    expect(screen.getByTestId('extensions-installed-tab')).toBeTruthy();
    expect(screen.getByTestId('extensions-marketplace-tab')).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText('No MCP extensions installed')).toBeTruthy()
    );
  });

  it('reaches the marketplace tab and renders the catalogue', async () => {
    render(<MCPExtensions />);

    // A plain <button>, not a Radix TabsTrigger, so `click` is the right event.
    await userEvent.click(screen.getByTestId('extensions-marketplace-tab'));

    expect(screen.getByTestId('mcp-marketplace')).toBeTruthy();
    expect(screen.getAllByTestId('extension-card').length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// The catalogue payload crossing into the main process
// ===========================================================================

describe('the marketplace install payload', () => {
  /**
   * Regression: the filesystem entry shipping the renderer's working directory.
   *
   * The path argument must stay the literal `'.'` — the main process resolves it
   * against its own cwd. `process.cwd()` in the renderer is both unavailable and
   * the wrong answer, so this asserts the value that crosses the boundary, not
   * just that the click worked.
   */
  it('sends a relative path for the filesystem server, never an absolute one', async () => {
    render(<MCPMarketplace />);

    const card = screen
      .getAllByTestId('extension-card')
      .find((node) => node.getAttribute('data-name') === 'Filesystem');
    expect(card).toBeTruthy();

    await userEvent.click(within(card as HTMLElement).getByTestId('install-extension'));

    await waitFor(() => expect(mcp.installServer).toHaveBeenCalledTimes(1));

    const payload = mcp.installServer.mock.calls[0][0] as { args: string[] };
    expect(payload.args).toEqual(['-y', '@modelcontextprotocol/server-filesystem', '.']);
    for (const arg of payload.args) {
      expect(arg.startsWith('/')).toBe(false);
    }
  });

  it('reports a failed install instead of claiming success', async () => {
    mcp.installServer.mockRejectedValueOnce(new Error('npm registry unreachable'));

    render(<MCPMarketplace />);
    const card = screen
      .getAllByTestId('extension-card')
      .find((node) => node.getAttribute('data-name') === 'Filesystem');
    await userEvent.click(within(card as HTMLElement).getByTestId('install-extension'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(String(alertSpy.mock.calls[0][0])).toContain('npm registry unreachable');
  });

  it('re-enables the Install button after a failure, so a retry is possible', async () => {
    mcp.installServer.mockRejectedValueOnce(new Error('transient'));

    render(<MCPMarketplace />);
    const card = screen
      .getAllByTestId('extension-card')
      .find((node) => node.getAttribute('data-name') === 'Filesystem') as HTMLElement;
    const button = within(card).getByTestId('install-extension');

    await userEvent.click(button);
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    // `finally { setInstalling(null) }` — without it the row stays "Installing..."
    // for the rest of the session and the user cannot retry.
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(within(card).getByText('Install')).toBeTruthy();
  });

  it('filters the catalogue by search text and says so when nothing matches', async () => {
    render(<MCPMarketplace />);

    await userEvent.type(screen.getByTestId('search-extensions'), 'postgres');
    expect(screen.getAllByTestId('extension-card')).toHaveLength(1);

    await userEvent.clear(screen.getByTestId('search-extensions'));
    await userEvent.type(screen.getByTestId('search-extensions'), 'zzz-nonexistent');

    // An empty result must explain itself rather than render a blank grid.
    expect(screen.queryAllByTestId('extension-card')).toHaveLength(0);
    expect(screen.getByText('No extensions found')).toBeTruthy();
  });

  it('filters by category', async () => {
    render(<MCPMarketplace />);

    await userEvent.selectOptions(screen.getByTestId('filter-category'), 'Database');

    const cards = screen.getAllByTestId('extension-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].getAttribute('data-name')).toBe('PostgreSQL');
  });
});

// ===========================================================================
// The installed list: envelope, and empty vs. error
// ===========================================================================

describe('the installed list distinguishes empty from broken', () => {
  /**
   * Regression: reading `.servers` straight off the IPC response.
   *
   * The payload lives under `.data`. Without `unwrapResponse` the destructuring
   * yields `undefined`, and `servers.map` throws — or, worse, an empty list
   * renders and looks like "nothing installed".
   */
  it('reads servers from under the response envelope', async () => {
    mcp.listServers.mockResolvedValueOnce(
      ok({ servers: [server({ name: 'GitHub', status: 'running' })] })
    );

    render(<MCPExtensionList />);

    await waitFor(() => expect(screen.getByText('GitHub')).toBeTruthy());
    expect(screen.queryByText('No MCP extensions installed')).toBeNull();
  });

  /**
   * Regression: a failed load rendering as an empty list.
   *
   * This is the exact shape of the bug that hid the IPC Inspector for so long —
   * "empty because it broke" is indistinguishable from "empty because there is
   * nothing". The error text must be on screen, and the "nothing installed"
   * message must not.
   */
  it('shows the failure instead of an innocent-looking empty list', async () => {
    mcp.listServers.mockRejectedValueOnce(new Error('mcp service is down'));

    render(<MCPExtensionList />);

    await waitFor(() => expect(screen.getByText('mcp service is down')).toBeTruthy());
    expect(screen.queryByText('No MCP extensions installed')).toBeNull();
  });

  it('surfaces a failure envelope as an error, not as emptiness', async () => {
    mcp.listServers.mockResolvedValueOnce(fail('MCP_ERROR', 'server registry corrupt'));

    render(<MCPExtensionList />);

    await waitFor(() => expect(screen.getByText('server registry corrupt')).toBeTruthy());
    expect(screen.queryByText('No MCP extensions installed')).toBeNull();
  });

  it('offers the marketplace when genuinely empty', async () => {
    render(<MCPExtensionList />);

    await waitFor(() =>
      expect(screen.getByText('No MCP extensions installed')).toBeTruthy()
    );
    // An empty state that leads somewhere, distinct from the error branch.
    expect(screen.getByText('Browse Marketplace')).toBeTruthy();
  });

  it('recovers on the next load after a failure', async () => {
    mcp.listServers
      .mockResolvedValueOnce(fail('MCP_ERROR', 'transient'))
      .mockResolvedValueOnce(ok({ servers: [server({ name: 'Slack' })] }));

    render(<MCPExtensionList />);
    await waitFor(() => expect(screen.getByText('transient')).toBeTruthy());

    // A server-started event triggers a reload; `setError(null)` must clear the
    // stale message or the view stays red forever.
    listeners.started.forEach((cb) => cb());

    await waitFor(() => expect(screen.getByText('Slack')).toBeTruthy());
    expect(screen.queryByText('transient')).toBeNull();
  });

  it('shows a running server with a stop control, a stopped one with start', async () => {
    mcp.listServers.mockResolvedValueOnce(
      ok({
        servers: [
          server({ id: 'a', name: 'Running One', status: 'running' }),
          server({ id: 'b', name: 'Stopped One', status: 'stopped' }),
        ],
      })
    );

    render(<MCPExtensionList />);

    await waitFor(() => expect(screen.getByText('Running One')).toBeTruthy());
    expect(screen.getByTitle('Stop server')).toBeTruthy();
    expect(screen.getByTitle('Start server')).toBeTruthy();
  });

  it('renders a server error message on the row that carries it', async () => {
    mcp.listServers.mockResolvedValueOnce(
      ok({ servers: [server({ status: 'error', lastError: 'spawn ENOENT' })] })
    );

    render(<MCPExtensionList />);

    await waitFor(() => expect(screen.getByText(/spawn ENOENT/)).toBeTruthy());
  });

  it('asks before uninstalling and does nothing when refused', async () => {
    mcp.listServers.mockResolvedValue(ok({ servers: [server({ name: 'GitHub' })] }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<MCPExtensionList />);
    await waitFor(() => expect(screen.getByText('GitHub')).toBeTruthy());

    await userEvent.click(screen.getByTitle('Uninstall'));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mcp.uninstallServer).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('uninstalls when confirmed', async () => {
    mcp.listServers.mockResolvedValue(ok({ servers: [server({ name: 'GitHub' })] }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MCPExtensionList />);
    await waitFor(() => expect(screen.getByText('GitHub')).toBeTruthy());

    await userEvent.click(screen.getByTitle('Uninstall'));

    await waitFor(() => expect(mcp.uninstallServer).toHaveBeenCalledWith({ serverId: 'srv-1' }));
    confirmSpy.mockRestore();
  });
});

// ===========================================================================
// Tools view
// ===========================================================================

describe('the tools view', () => {
  /**
   * Regression: reading `.server` off the response instead of `.data.server`,
   * which left `server` undefined and rendered "Server not found" for a server
   * that exists.
   */
  it('reads the server from under the envelope rather than reporting it missing', async () => {
    mcp.getServer.mockResolvedValueOnce(
      ok({ server: server({ name: 'GitHub', status: 'running' }) })
    );
    mcp.discoverTools.mockResolvedValueOnce(
      ok({
        tools: [
          {
            name: 'search_repos',
            description: 'Search repositories',
            inputSchema: { type: 'object' as const, properties: { q: { type: 'string' } } },
          },
        ],
      })
    );

    render(<MCPToolsView serverId="srv-1" />);

    await waitFor(() => expect(screen.getByText('GitHub Tools')).toBeTruthy());
    expect(screen.queryByText('Server not found')).toBeNull();
    expect(screen.getByText('search_repos')).toBeTruthy();
  });

  it('says the server must be running instead of showing an empty tool list', async () => {
    mcp.getServer.mockResolvedValueOnce(ok({ server: server({ status: 'stopped' }) }));

    render(<MCPToolsView serverId="srv-1" />);

    // Distinguishing "not running" from "no tools" is the whole point.
    await waitFor(() =>
      expect(
        screen.getByText('Server must be running to view and invoke tools')
      ).toBeTruthy()
    );
    expect(screen.queryByText('No tools available')).toBeNull();
    expect(mcp.discoverTools).not.toHaveBeenCalled();
  });

  it('says "no tools" only when a running server really exposes none', async () => {
    mcp.getServer.mockResolvedValueOnce(ok({ server: server({ status: 'running' }) }));
    mcp.discoverTools.mockResolvedValueOnce(ok({ tools: [] }));

    render(<MCPToolsView serverId="srv-1" />);

    await waitFor(() => expect(screen.getByText('No tools available')).toBeTruthy());
  });

  it('blocks invocation when a required argument is empty', async () => {
    mcp.getServer.mockResolvedValueOnce(ok({ server: server({ status: 'running' }) }));
    mcp.discoverTools.mockResolvedValueOnce(
      ok({
        tools: [
          {
            name: 'read_file',
            description: 'Read a file',
            inputSchema: {
              type: 'object' as const,
              properties: { path: { type: 'string' } },
              required: ['path'],
            },
          },
        ],
      })
    );

    render(<MCPToolsView serverId="srv-1" />);
    await waitFor(() => expect(screen.getByText('read_file')).toBeTruthy());

    await userEvent.click(screen.getByText('Run'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(String(alertSpy.mock.calls[0][0])).toContain('path');
    expect(mcp.invokeTool).not.toHaveBeenCalled();
  });

  it('does not invoke a tool when permission is refused', async () => {
    mcp.getServer.mockResolvedValueOnce(ok({ server: server({ status: 'running' }) }));
    mcp.discoverTools.mockResolvedValueOnce(
      ok({
        tools: [
          {
            name: 'delete_file',
            description: 'Delete a file',
            inputSchema: { type: 'object' as const, properties: {} },
          },
        ],
      })
    );
    mcp.checkPermission.mockResolvedValueOnce(ok({ granted: false }));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<MCPToolsView serverId="srv-1" />);
    await waitFor(() => expect(screen.getByText('delete_file')).toBeTruthy());

    await userEvent.click(screen.getByText('Run'));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(mcp.invokeTool).not.toHaveBeenCalled();
    expect(mcp.grantPermission).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

// ===========================================================================
// Config panel
// ===========================================================================

describe('the config panel', () => {
  it('reads env vars from under the envelope', async () => {
    mcp.getServer.mockResolvedValueOnce(
      ok({ server: server({ env: { GITHUB_TOKEN: 'ghp_secret' } }) })
    );

    render(<MCPConfig serverId="srv-1" />);

    await waitFor(() => expect(screen.getByDisplayValue('GITHUB_TOKEN')).toBeTruthy());
    expect(screen.queryByText('No environment variables configured')).toBeNull();
  });

  /**
   * Regression: a secret rendered in cleartext. The value input must default to
   * `type="password"`; the debug/config surfaces are shown during screen shares.
   */
  it('masks env var values until they are explicitly revealed', async () => {
    mcp.getServer.mockResolvedValueOnce(
      ok({ server: server({ env: { GITHUB_TOKEN: 'ghp_secret' } }) })
    );

    const { container } = render(<MCPConfig serverId="srv-1" />);
    await waitFor(() => expect(screen.getByDisplayValue('GITHUB_TOKEN')).toBeTruthy());

    const valueInput = screen.getByDisplayValue('ghp_secret') as HTMLInputElement;
    expect(valueInput.type).toBe('password');

    // The eye toggle is the only button inside the value cell.
    const toggle = valueInput.parentElement?.querySelector('button');
    expect(toggle).toBeTruthy();
    await userEvent.click(toggle as HTMLElement);

    expect((screen.getByDisplayValue('ghp_secret') as HTMLInputElement).type).toBe('text');
    expect(container).toBeTruthy();
  });

  it('says "no variables" rather than rendering an empty block', async () => {
    mcp.getServer.mockResolvedValueOnce(ok({ server: server({ env: {} }) }));

    render(<MCPConfig serverId="srv-1" />);

    await waitFor(() =>
      expect(screen.getByText('No environment variables configured')).toBeTruthy()
    );
  });

  it('reports a load failure as "Server not found" rather than a blank form', async () => {
    mcp.getServer.mockRejectedValueOnce(new Error('ipc timeout'));

    render(<MCPConfig serverId="srv-1" />);

    await waitFor(() => expect(screen.getByText('Server not found')).toBeTruthy());
  });

  it('carries the edited env vars into the reinstall payload', async () => {
    mcp.getServer.mockResolvedValueOnce(
      ok({ server: server({ env: { GITHUB_TOKEN: 'old' } }) })
    );

    render(<MCPConfig serverId="srv-1" />);
    await waitFor(() => expect(screen.getByDisplayValue('GITHUB_TOKEN')).toBeTruthy());

    const valueInput = screen.getByDisplayValue('old');
    await userEvent.clear(valueInput);
    await userEvent.type(valueInput, 'new-token');

    await userEvent.click(screen.getByText('Save Configuration'));

    await waitFor(() => expect(mcp.installServer).toHaveBeenCalledTimes(1));
    const payload = mcp.installServer.mock.calls[0][0] as { env: Record<string, string> };
    expect(payload.env).toEqual({ GITHUB_TOKEN: 'new-token' });

    // Uninstall must precede install, or the reinstall collides with the old
    // registration.
    expect(mcp.uninstallServer).toHaveBeenCalled();
  });
});
