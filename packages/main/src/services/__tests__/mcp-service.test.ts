/**
 * MCPService unit tests
 *
 * `child_process.spawn` is replaced by a scriptable fake JSON-RPC server so the
 * full start/discover/invoke/stop lifecycle runs against the real service code.
 * Config and permission files are written to a temp dir per test.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { EventEmitter } from 'events';
import * as fsSync from 'fs';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// ---------------------------------------------------------------------------
// ESM namespace overrides
// ---------------------------------------------------------------------------
//
// Bun patches an ESM namespace object in place, so the original suite could call
// `spyOn(os, 'homedir')` / `spyOn(fs, 'writeFile')` directly. Vitest cannot:
// a namespace's properties are non-configurable, and `vi.spyOn` throws
// "Cannot redefine property" (verified, not assumed).
//
// Instead the two modules are mocked once, keeping every real export, with the
// two functions under test routed through a mutable holder. A `null` holder
// means "use the real implementation", so behaviour is per-test exactly as
// before: set the holder for the duration of a test, clear it afterwards.
const { homedirOverride, writeFileOverride } = vi.hoisted(() => ({
  homedirOverride: { value: null as string | null },
  writeFileOverride: { value: null as (() => Promise<void>) | null },
}));

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    default: actual,
    homedir: () => homedirOverride.value ?? actual.homedir(),
  };
});

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    default: actual,
    writeFile: (...args: Parameters<typeof actual.writeFile>) =>
      writeFileOverride.value ? writeFileOverride.value() : actual.writeFile(...args),
  };
});

// ---------------------------------------------------------------------------
// Fake MCP child process
// ---------------------------------------------------------------------------

type RpcHandler = (
  method: string,
  params: unknown,
  id: number
) => Record<string, unknown> | { __error: { message: string } } | undefined;

class FakeMCPProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = { write: vi.fn((_chunk: string) => true) };
  killed: string[] = [];
  kill = vi.fn((signal: string) => {
    this.killed.push(signal);
    if (this.autoExitOnKill) {
      queueMicrotask(() => this.emit('exit', 0));
    }
    return true;
  });

  autoExitOnKill = true;

  constructor(private readonly handler: RpcHandler) {
    super();
    // Reply to whatever the service writes on stdin.
    this.stdin.write.mockImplementation((chunk: string) => {
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue;
        const request = JSON.parse(line) as { id: number; method: string; params: unknown };
        const result = this.handler(request.method, request.params, request.id);
        if (result === undefined) continue; // simulate no answer (timeout)
        queueMicrotask(() => {
          const payload =
            '__error' in result
              ? { jsonrpc: '2.0', id: request.id, error: result.__error }
              : { jsonrpc: '2.0', id: request.id, result };
          this.stdout.emit('data', Buffer.from(`${JSON.stringify(payload)}\n`));
        });
      }
      return true;
    });
  }

  /** Push a raw string as if the server wrote it to stdout. */
  pushRaw(raw: string): void {
    this.stdout.emit('data', Buffer.from(raw));
  }
}

const DEFAULT_TOOLS = [
  {
    name: 'read_file',
    description: 'Read a file',
    inputSchema: { type: 'object' as const, properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'write_file',
    description: 'Write a file',
    inputSchema: { type: 'object' as const, properties: { path: { type: 'string' } } },
  },
];

const defaultHandler: RpcHandler = (method) => {
  switch (method) {
    case 'initialize':
      return { protocolVersion: '2024-11-05', capabilities: { tools: {} } };
    case 'tools/list':
      return { tools: DEFAULT_TOOLS };
    case 'tools/call':
      return { content: [{ type: 'text', text: 'tool output' }] };
    case 'shutdown':
      return {};
    default:
      return {};
  }
};

let rpcHandler: RpcHandler = defaultHandler;
let spawnedProcesses: FakeMCPProcess[] = [];
let spawnCalls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];
let spawnImpl: (() => FakeMCPProcess) | null = null;

const spawnMock = vi.fn((command: string, args: string[], options: Record<string, unknown>) => {
  spawnCalls.push({ command, args, options });
  if (spawnImpl) return spawnImpl();
  const proc = new FakeMCPProcess((m, p, id) => rpcHandler(m, p, id));
  spawnedProcesses.push(proc);
  return proc;
});

// The factory is hoisted above `spawnMock`'s declaration, so it must not read it
// eagerly. Forwarding through an arrow defers the lookup to call time, when the
// binding is initialised. Real exports are kept so `ChildProcess` still links.
vi.mock('child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('child_process')>()),
  spawn: (...args: Parameters<typeof spawnMock>) => spawnMock(...args),
}));

// Imported after the mock above is registered so it links against it.
const {
  MCPService,
  getMCPService,
  resetMCPService,
} = await import('../mcp-service');

type MCPServer = import('../mcp-service').MCPServer;

/**
 * Resolves after `ms` real milliseconds — portable replacement for `Bun.sleep`.
 * No test in this suite installs fake timers, so real-time waits keep the
 * original semantics.
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;
let configPath: string;
let consoleLogSpy: MockInstance<typeof console.log>;
let consoleErrorSpy: MockInstance<typeof console.error>;

function serverFixture(overrides: Partial<MCPServer> = {}): Omit<MCPServer, 'status' | 'installedAt'> {
  return {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Local filesystem access',
    transport: 'stdio',
    command: 'node',
    args: ['server.js'],
    ...overrides,
  } as Omit<MCPServer, 'status' | 'installedAt'>;
}

async function installedService(): Promise<{ service: MCPService; server: MCPServer }> {
  const service = new MCPService(configPath);
  const server = await service.installServer(serverFixture());
  return { service, server };
}

describe('MCPService', () => {
  beforeEach(async () => {
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'cortex-mcp-'));
    configPath = path.join(tmpDir, 'mcp-servers.json');
    // Permissions always land in `~/.cortex-ide`, so redirect HOME to the temp dir.
    homedirOverride.value = tmpDir;
    // `console` is a plain object, not an ESM namespace, so it spies normally.
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    rpcHandler = defaultHandler;
    spawnedProcesses = [];
    spawnCalls = [];
    spawnImpl = null;
    spawnMock.mockClear();
  });

  afterEach(async () => {
    await resetMCPService();
    homedirOverride.value = null;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Registry persistence
  // -------------------------------------------------------------------------

  describe('initialize', () => {
    it('creates a fresh config file when none exists', async () => {
      const service = new MCPService(configPath);

      await service.initialize();

      const written = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      expect(written.version).toBe('1.0.0');
      expect(written.servers).toEqual([]);
    });

    it('loads servers from an existing config', async () => {
      await fs.writeFile(
        configPath,
        JSON.stringify({
          version: '1.0.0',
          servers: [
            { id: 'a', name: 'A', description: '', status: 'installed', transport: 'stdio' },
            { id: 'b', name: 'B', description: '', status: 'stopped', transport: 'stdio' },
          ],
        })
      );
      const service = new MCPService(configPath);

      await service.initialize();

      expect(service.getAllServers()).toHaveLength(2);
      expect(service.getServer('a')?.name).toBe('A');
    });

    it('tolerates a config with no servers key', async () => {
      await fs.writeFile(configPath, JSON.stringify({ version: '1.0.0' }));
      const service = new MCPService(configPath);

      await service.initialize();

      expect(service.getAllServers()).toEqual([]);
    });

    it('logs and continues when the config is malformed', async () => {
      await fs.writeFile(configPath, '{ not json');
      const service = new MCPService(configPath);

      await service.initialize();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(service.getAllServers()).toEqual([]);
    });

    it('loads previously granted permissions', async () => {
      const permsPath = path.join(tmpDir, '.cortex-ide', 'mcp-permissions.json');
      await fs.mkdir(path.dirname(permsPath), { recursive: true });
      await fs.writeFile(
        permsPath,
        JSON.stringify({
          version: '1.0.0',
          permissions: [{ serverId: 'filesystem', toolName: 'read_file', granted: true }],
        })
      );
      const service = new MCPService(configPath);

      await service.initialize();

      expect(service.hasPermission('filesystem', 'read_file')).toBe(true);
    });

    it('logs when the permissions file is malformed', async () => {
      const permsPath = path.join(tmpDir, '.cortex-ide', 'mcp-permissions.json');
      await fs.mkdir(path.dirname(permsPath), { recursive: true });
      await fs.writeFile(permsPath, 'not-json');
      const service = new MCPService(configPath);

      await service.initialize();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(service.getAllPermissions()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Install / uninstall
  // -------------------------------------------------------------------------

  describe('installServer', () => {
    it('marks the server installed and stamps installedAt', async () => {
      const service = new MCPService(configPath);
      const before = Date.now();

      const server = await service.installServer(serverFixture());

      expect(server.status).toBe('installed');
      expect(server.installedAt).toBeGreaterThanOrEqual(before);
    });

    it('persists the server to disk', async () => {
      const service = new MCPService(configPath);

      await service.installServer(serverFixture());

      const written = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      expect(written.servers).toHaveLength(1);
      expect(written.servers[0].id).toBe('filesystem');
    });

    it('emits server:installed', async () => {
      const service = new MCPService(configPath);
      const listener = vi.fn();
      service.on('server:installed', listener);

      const server = await service.installServer(serverFixture());

      expect(listener).toHaveBeenCalledWith(server);
    });

    it('overwrites a server installed under the same id', async () => {
      const service = new MCPService(configPath);

      await service.installServer(serverFixture({ name: 'First' }));
      await service.installServer(serverFixture({ name: 'Second' }));

      expect(service.getAllServers()).toHaveLength(1);
      expect(service.getServer('filesystem')?.name).toBe('Second');
    });
  });

  describe('uninstallServer', () => {
    it('removes the server from the registry and from disk', async () => {
      const { service } = await installedService();

      await service.uninstallServer('filesystem');

      expect(service.getServer('filesystem')).toBeUndefined();
      const written = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      expect(written.servers).toEqual([]);
    });

    it('drops every permission belonging to that server', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');
      await service.grantPermission('filesystem', 'write_file');
      await service.grantPermission('other', 'ping');

      await service.uninstallServer('filesystem');

      expect(service.getAllPermissions()).toHaveLength(1);
      expect(service.getAllPermissions()[0].serverId).toBe('other');
    });

    it('stops a running server first', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');

      await service.uninstallServer('filesystem');

      expect(spawnedProcesses[0].kill).toHaveBeenCalled();
    });

    it('emits server:uninstalled', async () => {
      const { service } = await installedService();
      const listener = vi.fn();
      service.on('server:uninstalled', listener);

      await service.uninstallServer('filesystem');

      expect(listener).toHaveBeenCalledWith('filesystem');
    });

    it('is a no-op for an unknown server', async () => {
      const service = new MCPService(configPath);

      await service.uninstallServer('ghost');

      expect(service.getAllServers()).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Server lifecycle
  // -------------------------------------------------------------------------

  describe('startServer', () => {
    it('spawns the configured command with args and env', async () => {
      const { service } = await installedService();

      await service.startServer('filesystem');

      expect(spawnCalls[0].command).toBe('node');
      expect(spawnCalls[0].args).toEqual(['server.js']);
      expect(spawnCalls[0].options.stdio).toEqual(['pipe', 'pipe', 'pipe']);
    });

    it('merges server env over process env', async () => {
      const service = new MCPService(configPath);
      await service.installServer(serverFixture({ env: { MCP_TOKEN: 'secret' } }));

      await service.startServer('filesystem');

      const env = spawnCalls[0].options.env as Record<string, string>;
      expect(env.MCP_TOKEN).toBe('secret');
      expect(env.PATH).toBe(process.env.PATH);
    });

    it('performs the JSON-RPC initialize handshake', async () => {
      const { service } = await installedService();
      const seen: string[] = [];
      rpcHandler = (method, params, id) => {
        seen.push(method);
        return defaultHandler(method, params, id);
      };

      await service.startServer('filesystem');

      expect(seen[0]).toBe('initialize');
      expect(seen).toContain('tools/list');
    });

    it('records discovered tools and marks the server running', async () => {
      const { service } = await installedService();

      await service.startServer('filesystem');

      const server = service.getServer('filesystem');
      expect(server?.status).toBe('running');
      expect(server?.tools).toHaveLength(2);
      expect(server?.tools?.[0].name).toBe('read_file');
    });

    it('emits server:started', async () => {
      const { service } = await installedService();
      const listener = vi.fn();
      service.on('server:started', listener);

      await service.startServer('filesystem');

      expect(listener).toHaveBeenCalledWith('filesystem');
    });

    it('throws for an unknown server', async () => {
      const service = new MCPService(configPath);

      await expect(service.startServer('ghost')).rejects.toThrow('Server ghost not found');
    });

    it('throws when the server has no command', async () => {
      const service = new MCPService(configPath);
      await service.installServer(serverFixture({ command: undefined }));

      await expect(service.startServer('filesystem')).rejects.toThrow(
        'has no command configured'
      );
    });

    it('is idempotent while already running', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');

      await service.startServer('filesystem');

      expect(spawnMock).toHaveBeenCalledTimes(1);
    });

    it('marks the server errored when the handshake fails', async () => {
      const { service } = await installedService();
      rpcHandler = (method) =>
        method === 'initialize'
          ? { __error: { message: 'unsupported protocol' } }
          : { tools: [] };

      await expect(service.startServer('filesystem')).rejects.toThrow('unsupported protocol');

      const server = service.getServer('filesystem');
      expect(server?.status).toBe('error');
      expect(server?.lastError).toBe('unsupported protocol');
    });

    it('records a process spawn error and clears the process', async () => {
      const { service } = await installedService();
      const listener = vi.fn();
      service.on('server:error', listener);
      await service.startServer('filesystem');

      spawnedProcesses[0].emit('error', new Error('EPIPE'));

      expect(listener).toHaveBeenCalled();
      expect(service.getServer('filesystem')?.status).toBe('error');
      expect(service.getServer('filesystem')?.lastError).toBe('EPIPE');
    });

    it('marks the server stopped when the process exits on its own', async () => {
      const { service } = await installedService();
      const listener = vi.fn();
      service.on('server:stopped', listener);
      await service.startServer('filesystem');

      spawnedProcesses[0].emit('exit', 1);

      expect(listener).toHaveBeenCalledWith('filesystem');
      expect(service.getServer('filesystem')?.status).toBe('stopped');
    });

    it('leaves the server running when tools/list returns no tools key', async () => {
      const { service } = await installedService();
      rpcHandler = (method) => (method === 'tools/list' ? {} : {});

      await service.startServer('filesystem');

      expect(service.getServer('filesystem')?.status).toBe('installed');
    });
  });

  describe('stdout framing', () => {
    it('handles a response split across two chunks', async () => {
      const { service } = await installedService();
      let capturedId = 0;
      rpcHandler = (method, _params, id) => {
        if (method === 'initialize') {
          capturedId = id;
          return undefined; // answer manually below
        }
        return defaultHandler(method, _params, id);
      };

      const starting = service.startServer('filesystem');
      await sleep(5);
      const proc = spawnedProcesses[0];
      const payload = JSON.stringify({ jsonrpc: '2.0', id: capturedId, result: { ok: true } });
      proc.pushRaw(payload.slice(0, 10));
      proc.pushRaw(`${payload.slice(10)}\n`);

      await starting;
      expect(service.getServer('filesystem')?.status).toBe('running');
    });

    it('ignores malformed JSON lines', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');

      spawnedProcesses[0].pushRaw('this is not json\n');

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(service.getServer('filesystem')?.status).toBe('running');
    });

    it('forwards server notifications as events', async () => {
      const { service } = await installedService();
      const listener = vi.fn();
      service.on('server:notification', listener);
      await service.startServer('filesystem');

      spawnedProcesses[0].pushRaw(
        `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress', params: { pct: 50 } })}\n`
      );

      expect(listener).toHaveBeenCalledWith({
        serverId: 'filesystem',
        method: 'notifications/progress',
        params: { pct: 50 },
      });
    });

    it('logs stderr output', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');

      spawnedProcesses[0].stderr.emit('data', Buffer.from('warning: deprecated'));

      const logged = consoleErrorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logged).toContain('warning: deprecated');
    });

    it('ignores responses with an unknown id', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');

      spawnedProcesses[0].pushRaw(
        `${JSON.stringify({ jsonrpc: '2.0', id: 9999, result: {} })}\n`
      );

      expect(service.getServer('filesystem')?.status).toBe('running');
    });
  });

  describe('stopServer', () => {
    it('sends shutdown then SIGTERM', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');
      const methods: string[] = [];
      rpcHandler = (method, params, id) => {
        methods.push(method);
        return defaultHandler(method, params, id);
      };

      await service.stopServer('filesystem');

      expect(methods).toContain('shutdown');
      expect(spawnedProcesses[0].killed).toContain('SIGTERM');
    });

    it('marks the server stopped and emits the event', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');
      const listener = vi.fn();
      service.on('server:stopped', listener);

      await service.stopServer('filesystem');

      expect(service.getServer('filesystem')?.status).toBe('stopped');
      expect(listener).toHaveBeenCalledWith('filesystem');
    });

    it('is a no-op when the server is not running', async () => {
      const { service } = await installedService();

      await service.stopServer('filesystem');

      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('propagates a shutdown failure', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');
      rpcHandler = (method) =>
        method === 'shutdown' ? { __error: { message: 'refused' } } : {};

      await expect(service.stopServer('filesystem')).rejects.toThrow('refused');
    });

    it('allows restarting after a stop', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');
      await service.stopServer('filesystem');

      await service.startServer('filesystem');

      expect(spawnMock).toHaveBeenCalledTimes(2);
      expect(service.getServer('filesystem')?.status).toBe('running');
    });
  });

  // -------------------------------------------------------------------------
  // Tool discovery
  // -------------------------------------------------------------------------

  describe('discoverTools', () => {
    it('returns the tools advertised by the server', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');

      const tools = await service.discoverTools('filesystem');

      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual(['read_file', 'write_file']);
    });

    it('persists the discovered tools', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');

      await service.discoverTools('filesystem');

      const written = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      expect(written.servers[0].tools).toHaveLength(2);
    });

    it('throws when the server is not running', async () => {
      const { service } = await installedService();

      await expect(service.discoverTools('filesystem')).rejects.toThrow(
        'Server filesystem not running'
      );
    });

    it('returns an empty list when the server advertises none', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');
      rpcHandler = () => ({});

      const tools = await service.discoverTools('filesystem');

      expect(tools).toEqual([]);
    });

    it('propagates a discovery error', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');
      rpcHandler = () => ({ __error: { message: 'tools unavailable' } });

      await expect(service.discoverTools('filesystem')).rejects.toThrow('tools unavailable');
    });
  });

  // -------------------------------------------------------------------------
  // Permissions
  // -------------------------------------------------------------------------

  describe('permissions', () => {
    it('grants a permission and persists it', async () => {
      const { service } = await installedService();

      await service.grantPermission('filesystem', 'read_file', 'alice');

      expect(service.hasPermission('filesystem', 'read_file')).toBe(true);
      const permsPath = path.join(tmpDir, '.cortex-ide', 'mcp-permissions.json');
      const written = JSON.parse(await fs.readFile(permsPath, 'utf-8'));
      expect(written.permissions[0]).toMatchObject({
        serverId: 'filesystem',
        toolName: 'read_file',
        granted: true,
        grantedBy: 'alice',
      });
    });

    it('emits permission:granted', async () => {
      const { service } = await installedService();
      const listener = vi.fn();
      service.on('permission:granted', listener);

      await service.grantPermission('filesystem', 'read_file');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toMatchObject({ granted: true });
    });

    it('revokes a permission', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');

      await service.revokePermission('filesystem', 'read_file');

      expect(service.hasPermission('filesystem', 'read_file')).toBe(false);
    });

    it('emits permission:revoked', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');
      const listener = vi.fn();
      service.on('permission:revoked', listener);

      await service.revokePermission('filesystem', 'read_file');

      expect(listener).toHaveBeenCalledWith({
        serverId: 'filesystem',
        toolName: 'read_file',
      });
    });

    it('treats revoking an unknown permission as a no-op', async () => {
      const { service } = await installedService();

      await service.revokePermission('filesystem', 'never_granted');

      expect(service.getAllPermissions()).toEqual([]);
    });

    it('scopes permissions per server and tool', async () => {
      const { service } = await installedService();

      await service.grantPermission('filesystem', 'read_file');

      expect(service.hasPermission('filesystem', 'read_file')).toBe(true);
      expect(service.hasPermission('filesystem', 'write_file')).toBe(false);
      expect(service.hasPermission('other', 'read_file')).toBe(false);
    });

    it('lists all permissions', async () => {
      const { service } = await installedService();

      await service.grantPermission('a', 'one');
      await service.grantPermission('b', 'two');

      expect(service.getAllPermissions()).toHaveLength(2);
    });

    it('re-granting updates the existing entry rather than duplicating', async () => {
      const { service } = await installedService();

      await service.grantPermission('filesystem', 'read_file', 'alice');
      await service.grantPermission('filesystem', 'read_file', 'bob');

      const perms = service.getAllPermissions();
      expect(perms).toHaveLength(1);
      expect(perms[0].grantedBy).toBe('bob');
    });
  });

  // -------------------------------------------------------------------------
  // Tool invocation
  // -------------------------------------------------------------------------

  describe('invokeTool', () => {
    it('rejects when no permission was granted', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');

      await expect(
        service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: {} })
      ).rejects.toThrow('Permission denied for tool read_file');
    });

    it('rejects when the permission was revoked', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');
      await service.revokePermission('filesystem', 'read_file');

      await expect(
        service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: {} })
      ).rejects.toThrow('Permission denied');
    });

    it('forwards the tool name and arguments', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');
      await service.startServer('filesystem');
      let callParams: unknown;
      rpcHandler = (method, params, id) => {
        if (method === 'tools/call') callParams = params;
        return defaultHandler(method, params, id);
      };

      const result = await service.invokeTool({
        serverId: 'filesystem',
        toolName: 'read_file',
        arguments: { path: '/tmp/a.txt' },
      });

      expect(callParams).toEqual({ name: 'read_file', arguments: { path: '/tmp/a.txt' } });
      expect(result.content[0].text).toBe('tool output');
    });

    it('emits tool:invoked', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');
      await service.startServer('filesystem');
      const listener = vi.fn();
      service.on('tool:invoked', listener);

      await service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: {} });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toMatchObject({
        serverId: 'filesystem',
        toolName: 'read_file',
      });
    });

    it('auto-starts a stopped server', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');

      await service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: {} });

      expect(spawnMock).toHaveBeenCalledTimes(1);
      expect(service.getServer('filesystem')?.status).toBe('running');
    });

    it('surfaces a tool execution error', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');
      await service.startServer('filesystem');
      rpcHandler = (method, params, id) =>
        method === 'tools/call'
          ? { __error: { message: 'ENOENT: no such file' } }
          : defaultHandler(method, params, id);

      await expect(
        service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: {} })
      ).rejects.toThrow('ENOENT: no such file');
    });

    it('fails when the server cannot be started', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');
      rpcHandler = () => ({ __error: { message: 'startup failed' } });

      await expect(
        service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: {} })
      ).rejects.toThrow('startup failed');
    });

    it('handles concurrent invocations with distinct request ids', async () => {
      const { service } = await installedService();
      await service.grantPermission('filesystem', 'read_file');
      await service.startServer('filesystem');
      const ids: number[] = [];
      rpcHandler = (method, params, id) => {
        if (method === 'tools/call') ids.push(id);
        return { content: [{ type: 'text', text: `result-${id}` }] };
      };

      const results = await Promise.all([
        service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: { n: 1 } }),
        service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: { n: 2 } }),
        service.invokeTool({ serverId: 'filesystem', toolName: 'read_file', arguments: { n: 3 } }),
      ]);

      expect(new Set(ids).size).toBe(3);
      expect(new Set(results.map((r) => r.content[0].text)).size).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  describe('queries', () => {
    it('lists all servers', async () => {
      const service = new MCPService(configPath);
      await service.installServer(serverFixture({ id: 'a' }));
      await service.installServer(serverFixture({ id: 'b' }));

      expect(service.getAllServers()).toHaveLength(2);
    });

    it('returns undefined for an unknown server', () => {
      const service = new MCPService(configPath);

      expect(service.getServer('ghost')).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup and singleton
  // -------------------------------------------------------------------------

  describe('cleanup', () => {
    it('stops every running server', async () => {
      const service = new MCPService(configPath);
      await service.installServer(serverFixture({ id: 'a' }));
      await service.installServer(serverFixture({ id: 'b' }));
      await service.startServer('a');
      await service.startServer('b');

      await service.cleanup();

      expect(spawnedProcesses[0].kill).toHaveBeenCalled();
      expect(spawnedProcesses[1].kill).toHaveBeenCalled();
    });

    it('removes all listeners', async () => {
      const { service } = await installedService();
      service.on('server:started', () => {});

      await service.cleanup();

      expect(service.listenerCount('server:started')).toBe(0);
    });

    it('logs but does not throw when a stop fails', async () => {
      const { service } = await installedService();
      await service.startServer('filesystem');
      rpcHandler = () => ({ __error: { message: 'stuck' } });

      await service.cleanup();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('is a no-op with no running servers', async () => {
      const service = new MCPService(configPath);

      await service.cleanup();

      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  describe('getMCPService / resetMCPService', () => {
    it('returns the same instance on repeat calls', () => {
      expect(getMCPService()).toBe(getMCPService());
    });

    it('creates a new instance after a reset', async () => {
      const first = getMCPService();

      await resetMCPService();

      expect(getMCPService()).not.toBe(first);
    });

    it('reset is safe when no instance exists', async () => {
      await resetMCPService();
      await expect(resetMCPService()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Error handling on save
  // -------------------------------------------------------------------------

  describe('persistence failures', () => {
    it('propagates a registry save failure', async () => {
      // Point the config at a path whose parent cannot be created.
      const service = new MCPService(path.join(tmpDir, 'blocked'));
      await fs.writeFile(path.join(tmpDir, 'blocked'), 'file-not-dir');
      const blocked = new MCPService(path.join(tmpDir, 'blocked', 'nested', 'cfg.json'));

      await expect(blocked.installServer(serverFixture())).rejects.toThrow();
      expect(service).toBeInstanceOf(MCPService);
    });

    it('logs a permissions save failure without throwing', async () => {
      const service = new MCPService(configPath);
      // Cleared before `afterEach`, which needs a working writeFile for the
      // temp-dir teardown.
      writeFileOverride.value = async () => {
        throw new Error('EACCES');
      };

      try {
        await service.grantPermission('filesystem', 'read_file');

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(service.hasPermission('filesystem', 'read_file')).toBe(true);
      } finally {
        writeFileOverride.value = null;
      }
    });
  });
});
