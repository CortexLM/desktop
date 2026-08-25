/**
 * IPC handler domain tests — AI, MCP, automation and update channels.
 *
 * `electron` comes from the global preload (test/electron-mock.ts). Each
 * handler is invoked directly with its service layer mocked, so schema
 * validation and error mapping run for real.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { registeredHandlers, resetElectronMock } from '../../../../../../test/electron-mock';

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

const aiServiceMock = {
  createSession: vi.fn(async () => ({
    id: 'session-1',
    providerId: 'openai',
    model: 'gpt-4',
    createdAt: 1_700_000_000,
  })),
  addSystemMessage: vi.fn(() => {}),
  sendMessage: vi.fn(async () => ({
    content: 'hello there',
    model: 'gpt-4',
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    finishReason: 'stop',
  })),
};

const registerAIStreamHandler = vi.fn(() => {});
const cleanupAIStreamHandler = vi.fn(() => {});

const SERVERS = [
  { id: 'a', name: 'A', description: '', status: 'running', transport: 'stdio' },
  { id: 'b', name: 'B', description: '', status: 'stopped', transport: 'stdio' },
];

const mcpServiceMock = {
  getAllServers: vi.fn(() => SERVERS),
  getServer: vi.fn((id: string) => SERVERS.find((s) => s.id === id)),
  installServer: vi.fn(async (server: Record<string, unknown>) => ({
    ...server,
    status: 'installed',
    installedAt: 1,
  })),
  uninstallServer: vi.fn(async () => undefined),
  startServer: vi.fn(async () => undefined),
  stopServer: vi.fn(async () => undefined),
  discoverTools: vi.fn(async () => [
    { name: 'read', description: 'r', inputSchema: { type: 'object', properties: {} } },
  ]),
  invokeTool: vi.fn(async () => ({ content: [{ type: 'text', text: 'tool result' }] })),
  getAllPermissions: vi.fn(() => [
    { serverId: 'a', toolName: 'read', granted: true },
    { serverId: 'b', toolName: 'write', granted: true },
  ]),
  grantPermission: vi.fn(async () => undefined),
  revokePermission: vi.fn(async () => undefined),
  hasPermission: vi.fn(() => true),
};

const AUTOMATION = {
  id: 'auto-1',
  workspaceId: 'ws-1',
  name: 'Lint',
  enabled: true,
  trigger: { type: 'manual' as const },
  actions: [{ type: 'notification' as const, title: 't', message: 'm', level: 'info' as const }],
  createdAt: 1,
  updatedAt: 1,
};

const automationServiceMock = {
  createAutomation: vi.fn(async (req: Record<string, unknown>) => ({ ...AUTOMATION, ...req })),
  updateAutomation: vi.fn(async (id: string, updates: Record<string, unknown>) => ({
    ...AUTOMATION,
    id,
    ...updates,
  })),
  deleteAutomation: vi.fn(async () => undefined),
  listAutomations: vi.fn(() => [AUTOMATION]),
  getAutomation: vi.fn((id: string) => (id === 'auto-1' ? AUTOMATION : undefined)),
  runAutomation: vi.fn(async () => ({
    id: 'log-1',
    automationId: 'auto-1',
    status: 'success' as const,
    startedAt: 1,
    completedAt: 2,
    actionResults: [],
  })),
  toggleAutomation: vi.fn(async (id: string, enabled: boolean) => ({
    ...AUTOMATION,
    id,
    enabled,
  })),
  getAutomationLogs: vi.fn(() => []),
};

const updateManagerMock = {
  checkForUpdates: vi.fn(async () => undefined),
  downloadUpdate: vi.fn(async () => undefined),
  quitAndInstall: vi.fn(() => undefined),
};

// Spreading `importOriginal()` keeps every export the tests do not override; a
// factory returning only the overrides would drop the rest (e.g. service
// classes) and break this file's own imports at link time.
//
// Each factory forwards through an arrow rather than capturing the mock object
// directly: `vi.mock` is hoisted above these declarations, so an eager read
// would hit the temporal dead zone.
vi.mock('../../../services/ai-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/ai-service')>()),
  getAIService: () => aiServiceMock,
}));
vi.mock('../ai-stream-handler', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../ai-stream-handler')>()),
  registerAIStreamHandler: (...args: Parameters<typeof registerAIStreamHandler>) =>
    registerAIStreamHandler(...args),
  cleanupAIStreamHandler: (...args: Parameters<typeof cleanupAIStreamHandler>) =>
    cleanupAIStreamHandler(...args),
}));
vi.mock('../../../services/mcp-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/mcp-service')>()),
  getMCPService: () => mcpServiceMock,
}));
vi.mock('../../../services/automation-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/automation-service')>()),
  get automationService() {
    return automationServiceMock;
  },
}));
// `updater` is the one exception to the partial-mock pattern: the module does
// `export const updateManager = new UpdateManager()` at import time, which
// reaches into `electron-updater` and needs a real Electron app
// ("Cannot read properties of undefined (reading 'getVersion')"). Calling
// `importOriginal()` here would therefore throw, so the factory replaces the
// module outright. `update-handlers` only consumes `updateManager`, so the stub
// covers its full usage.
vi.mock('../../../updater', () => ({
  get updateManager() {
    return updateManagerMock;
  },
  UpdateManager: class UpdateManagerStub {},
}));

const {
  AI_CHANNELS,
  handleCreateSession,
  handleSendMessage,
  registerAIHandlers,
  unregisterAIHandlers,
} = await import('../ai-handlers');
const {
  MCP_CHANNELS,
  handleCheckMCPPermission,
  handleDiscoverMCPTools,
  handleGetMCPServer,
  handleGrantMCPPermission,
  handleInstallMCPServer,
  handleInvokeMCPTool,
  handleListMCPPermissions,
  handleListMCPServers,
  handleRevokeMCPPermission,
  handleStartMCPServer,
  handleStopMCPServer,
  handleUninstallMCPServer,
  registerMCPHandlers,
  unregisterMCPHandlers,
} = await import('../mcp-handlers');
const {
  AUTOMATION_CHANNELS,
  handleCreateAutomation,
  handleDeleteAutomation,
  handleGetAutomation,
  handleGetAutomationLogs,
  handleListAutomations,
  handleRunAutomation,
  handleToggleAutomation,
  handleUpdateAutomation,
  registerAutomationHandlers,
  unregisterAutomationHandlers,
} = await import('../automation-handlers');
const {
  UPDATE_CHANNELS,
  registerUpdateHandlers,
  unregisterUpdateHandlers,
} = await import('../update-handlers');
const { ErrorCode } = await import('../shared/error-codes');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Handler = (event: unknown, request: unknown) => Promise<{
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: unknown };
}>;

const event = { sender: { send: vi.fn() } };

async function ok<T>(handler: Handler, request: unknown): Promise<T> {
  const response = await handler(event, request);
  if (!response.success) {
    throw new Error(`Expected success, got ${JSON.stringify(response.error)}`);
  }
  return response.data as T;
}

async function fail(handler: Handler, request: unknown) {
  const response = await handler(event, request);
  if (response.success) {
    throw new Error(`Expected failure, got ${JSON.stringify(response.data)}`);
  }
  return response.error!;
}

beforeEach(() => {
  resetElectronMock();
});

// ===========================================================================
// AI
// ===========================================================================

describe('ai handlers', () => {
  beforeEach(() => {
    aiServiceMock.createSession.mockClear();
    aiServiceMock.addSystemMessage.mockClear();
    aiServiceMock.sendMessage.mockClear();
    registerAIStreamHandler.mockClear();
    cleanupAIStreamHandler.mockClear();
  });

  describe('handleCreateSession', () => {
    it('creates a session and returns its descriptor', async () => {
      const data = await ok<{
        sessionId: string;
        providerId: string;
        model: string;
        createdAt: number;
      }>(handleCreateSession as Handler, { provider: 'openai', model: 'gpt-4' });

      expect(aiServiceMock.createSession).toHaveBeenCalledWith('openai', 'gpt-4', {
        workspacePath: undefined,
        workspaceId: undefined,
      });
      expect(data.sessionId).toBe('session-1');
      expect(data.providerId).toBe('openai');
      expect(data.createdAt).toBe(1_700_000_000);
    });

    it('adds a system prompt when supplied', async () => {
      await ok(handleCreateSession as Handler, {
        provider: 'anthropic',
        model: 'claude-3',
        systemPrompt: 'Be terse.',
      });

      expect(aiServiceMock.addSystemMessage).toHaveBeenCalledWith('session-1', 'Be terse.');
    });

    it('attaches a coding-agent system prompt when none is supplied', async () => {
      await ok(handleCreateSession as Handler, { provider: 'openai', model: 'gpt-4' });

      expect(aiServiceMock.addSystemMessage).toHaveBeenCalled();
      const prompt = String(
        (aiServiceMock.addSystemMessage.mock.calls[0] as unknown as [string, string])[1]
      );
      expect(prompt).toContain('You are Cortex, an AI software engineering agent.');
    });

    it('accepts an optional workspaceId', async () => {
      await ok(handleCreateSession as Handler, {
        provider: 'ollama',
        model: 'llama3',
        workspaceId: 'ws-1',
      });

      expect(aiServiceMock.createSession).toHaveBeenCalledWith('ollama', 'llama3', {
        workspacePath: undefined,
        workspaceId: 'ws-1',
      });
    });

    it.each(['openai', 'anthropic', 'openrouter', 'ollama'])('accepts the %s provider', async (provider) => {
      const response = await (handleCreateSession as Handler)(event, { provider, model: 'm' });

      expect(response.success).toBe(true);
    });

    it('rejects an unknown provider', async () => {
      const error = await fail(handleCreateSession as Handler, { provider: 'my-llm', model: 'm' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('requires a model', async () => {
      const error = await fail(handleCreateSession as Handler, { provider: 'openai' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects an empty model', async () => {
      const error = await fail(handleCreateSession as Handler, { provider: 'openai', model: '' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('surfaces a provider failure', async () => {
      aiServiceMock.createSession.mockImplementationOnce(async () => {
        throw new Error('invalid api key');
      });

      const error = await fail(handleCreateSession as Handler, {
        provider: 'openai',
        model: 'gpt-4',
      });

      expect(error.message).toBe('invalid api key');
    });
  });

  describe('handleSendMessage', () => {
    it('returns content, model and usage', async () => {
      const data = await ok<{
        content: string;
        model: string;
        usage: { totalTokens: number };
        finishReason: string;
      }>(handleSendMessage as Handler, { sessionId: 'session-1', message: 'Hi' });

      expect(aiServiceMock.sendMessage).toHaveBeenCalledWith('session-1', 'Hi');
      expect(data.content).toBe('hello there');
      expect(data.usage.totalTokens).toBe(30);
      expect(data.finishReason).toBe('stop');
    });

    it('accepts an optional context block', async () => {
      const response = await (handleSendMessage as Handler)(event, {
        sessionId: 's',
        message: 'm',
        context: {
          files: ['a.ts'],
          selection: { path: 'a.ts', start: 0, end: 10 },
        },
      });

      expect(response.success).toBe(true);
    });

    it('rejects an empty message', async () => {
      const error = await fail(handleSendMessage as Handler, { sessionId: 's', message: '' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a missing sessionId', async () => {
      const error = await fail(handleSendMessage as Handler, { message: 'hi' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a malformed selection', async () => {
      const error = await fail(handleSendMessage as Handler, {
        sessionId: 's',
        message: 'm',
        context: { selection: { path: 'a.ts', start: 'zero', end: 10 } },
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('surfaces an upstream failure', async () => {
      aiServiceMock.sendMessage.mockImplementationOnce(async () => {
        throw new Error('upstream 503');
      });

      const error = await fail(handleSendMessage as Handler, { sessionId: 's', message: 'm' });

      expect(error.message).toBe('upstream 503');
    });
  });

  describe('registration', () => {
    it('registers both channels and the stream handler', () => {
      registerAIHandlers();

      expect(AI_CHANNELS.every((c) => registeredHandlers.has(c))).toBe(true);
      expect(registerAIStreamHandler).toHaveBeenCalled();
    });

    it('unregisters the channels and cleans up streams', () => {
      registerAIHandlers();

      unregisterAIHandlers();

      expect(AI_CHANNELS.some((c) => registeredHandlers.has(c))).toBe(false);
      expect(cleanupAIStreamHandler).toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// MCP
// ===========================================================================

describe('mcp handlers', () => {
  beforeEach(() => {
    Object.values(mcpServiceMock).forEach((m) => m.mockClear());
  });

  describe('handleListMCPServers', () => {
    it('returns every server when unfiltered', async () => {
      const data = await ok<{ servers: unknown[] }>(handleListMCPServers as Handler, {});

      expect(data.servers).toHaveLength(2);
    });

    it('filters by status', async () => {
      const data = await ok<{ servers: Array<{ status: string }> }>(
        handleListMCPServers as Handler,
        { status: 'running' }
      );

      expect(data.servers).toHaveLength(1);
      expect(data.servers[0].status).toBe('running');
    });

    it('returns an empty list when no server matches', async () => {
      const data = await ok<{ servers: unknown[] }>(handleListMCPServers as Handler, {
        status: 'error',
      });

      expect(data.servers).toEqual([]);
    });

    it('rejects an invalid status', async () => {
      const error = await fail(handleListMCPServers as Handler, { status: 'exploded' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleGetMCPServer', () => {
    it('returns the server', async () => {
      const data = await ok<{ server: { id: string } }>(handleGetMCPServer as Handler, {
        serverId: 'a',
      });

      expect(data.server.id).toBe('a');
    });

    it('fails for an unknown id', async () => {
      const error = await fail(handleGetMCPServer as Handler, { serverId: 'zzz' });

      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.message).toContain('not found');
    });

    it('requires a serverId', async () => {
      const error = await fail(handleGetMCPServer as Handler, {});

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleInstallMCPServer', () => {
    it('defaults the transport to stdio', async () => {
      const data = await ok<{ server: { transport: string } }>(handleInstallMCPServer as Handler, {
        id: 'x',
        name: 'X',
        description: 'd',
        command: 'node',
      });

      expect(data.server.transport).toBe('stdio');
    });

    it('passes through args and env', async () => {
      await ok(handleInstallMCPServer as Handler, {
        id: 'x',
        name: 'X',
        description: 'd',
        command: 'node',
        args: ['server.js'],
        env: { TOKEN: 'abc' },
      });

      const passed = mcpServiceMock.installServer.mock.calls[0][0] as Record<string, unknown>;
      expect(passed.args).toEqual(['server.js']);
      expect(passed.env).toEqual({ TOKEN: 'abc' });
    });

    it('accepts the http transport', async () => {
      const data = await ok<{ server: { transport: string } }>(handleInstallMCPServer as Handler, {
        id: 'x',
        name: 'X',
        description: 'd',
        command: 'node',
        transport: 'http',
      });

      expect(data.server.transport).toBe('http');
    });

    it('requires a command', async () => {
      const error = await fail(handleInstallMCPServer as Handler, {
        id: 'x',
        name: 'X',
        description: 'd',
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects an unknown transport', async () => {
      const error = await fail(handleInstallMCPServer as Handler, {
        id: 'x',
        name: 'X',
        description: 'd',
        command: 'node',
        transport: 'grpc',
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('lifecycle handlers', () => {
    it('uninstall delegates and reports success', async () => {
      const data = await ok<{ success: boolean }>(handleUninstallMCPServer as Handler, {
        serverId: 'a',
      });

      expect(mcpServiceMock.uninstallServer).toHaveBeenCalledWith('a');
      expect(data.success).toBe(true);
    });

    it('start delegates', async () => {
      await ok(handleStartMCPServer as Handler, { serverId: 'a' });

      expect(mcpServiceMock.startServer).toHaveBeenCalledWith('a');
    });

    it('start surfaces a spawn failure', async () => {
      mcpServiceMock.startServer.mockImplementationOnce(async () => {
        throw new Error('has no command configured');
      });

      const error = await fail(handleStartMCPServer as Handler, { serverId: 'a' });

      expect(error.message).toContain('no command configured');
    });

    it('stop delegates', async () => {
      await ok(handleStopMCPServer as Handler, { serverId: 'a' });

      expect(mcpServiceMock.stopServer).toHaveBeenCalledWith('a');
    });
  });

  describe('handleDiscoverMCPTools', () => {
    it('returns the tool list', async () => {
      const data = await ok<{ tools: Array<{ name: string }> }>(
        handleDiscoverMCPTools as Handler,
        { serverId: 'a' }
      );

      expect(data.tools[0].name).toBe('read');
    });

    it('fails when the server is not running', async () => {
      mcpServiceMock.discoverTools.mockImplementationOnce(async () => {
        throw new Error('Server a not running');
      });

      const error = await fail(handleDiscoverMCPTools as Handler, { serverId: 'a' });

      expect(error.message).toBe('Server a not running');
    });
  });

  describe('handleInvokeMCPTool', () => {
    it('forwards the tool name and arguments', async () => {
      const data = await ok<{ content: Array<{ text: string }> }>(
        handleInvokeMCPTool as Handler,
        { serverId: 'a', toolName: 'read', arguments: { path: '/x' } }
      );

      expect(mcpServiceMock.invokeTool).toHaveBeenCalledWith({
        serverId: 'a',
        toolName: 'read',
        arguments: { path: '/x' },
      });
      expect(data.content[0].text).toBe('tool result');
    });

    it('accepts an empty arguments object', async () => {
      const response = await (handleInvokeMCPTool as Handler)(event, {
        serverId: 'a',
        toolName: 'read',
        arguments: {},
      });

      expect(response.success).toBe(true);
    });

    it('requires the arguments field', async () => {
      const error = await fail(handleInvokeMCPTool as Handler, {
        serverId: 'a',
        toolName: 'read',
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('maps a permission denial to PERMISSION_DENIED', async () => {
      mcpServiceMock.invokeTool.mockImplementationOnce(async () => {
        throw new Error('Permission denied for tool read on server a');
      });

      const error = await fail(handleInvokeMCPTool as Handler, {
        serverId: 'a',
        toolName: 'read',
        arguments: {},
      });

      expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
    });
  });

  describe('permission handlers', () => {
    it('lists every permission', async () => {
      const data = await ok<{ permissions: unknown[] }>(handleListMCPPermissions as Handler, {});

      expect(data.permissions).toHaveLength(2);
    });

    it('filters permissions by server', async () => {
      const data = await ok<{ permissions: Array<{ serverId: string }> }>(
        handleListMCPPermissions as Handler,
        { serverId: 'b' }
      );

      expect(data.permissions).toHaveLength(1);
      expect(data.permissions[0].serverId).toBe('b');
    });

    it('grants with an optional grantedBy', async () => {
      await ok(handleGrantMCPPermission as Handler, {
        serverId: 'a',
        toolName: 'read',
        grantedBy: 'alice',
      });

      expect(mcpServiceMock.grantPermission).toHaveBeenCalledWith('a', 'read', 'alice');
    });

    it('grants without a grantedBy', async () => {
      await ok(handleGrantMCPPermission as Handler, { serverId: 'a', toolName: 'read' });

      expect(mcpServiceMock.grantPermission).toHaveBeenCalledWith('a', 'read', undefined);
    });

    it('revokes a permission', async () => {
      await ok(handleRevokeMCPPermission as Handler, { serverId: 'a', toolName: 'read' });

      expect(mcpServiceMock.revokePermission).toHaveBeenCalledWith('a', 'read');
    });

    it('checks a permission', async () => {
      const data = await ok<{ granted: boolean }>(handleCheckMCPPermission as Handler, {
        serverId: 'a',
        toolName: 'read',
      });

      expect(data.granted).toBe(true);
    });

    it('reports a denied permission', async () => {
      mcpServiceMock.hasPermission.mockImplementationOnce(() => false);

      const data = await ok<{ granted: boolean }>(handleCheckMCPPermission as Handler, {
        serverId: 'a',
        toolName: 'write',
      });

      expect(data.granted).toBe(false);
    });

    it('requires a toolName when checking', async () => {
      const error = await fail(handleCheckMCPPermission as Handler, { serverId: 'a' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('registration', () => {
    it('registers and unregisters all twelve MCP channels', () => {
      registerMCPHandlers();
      expect(MCP_CHANNELS.every((c) => registeredHandlers.has(c))).toBe(true);
      expect(MCP_CHANNELS).toHaveLength(12);

      unregisterMCPHandlers();
      expect(MCP_CHANNELS.some((c) => registeredHandlers.has(c))).toBe(false);
    });
  });
});

// ===========================================================================
// Automations
// ===========================================================================

describe('automation handlers', () => {
  const validCreate = {
    workspaceId: 'ws-1',
    name: 'Lint',
    enabled: true,
    trigger: { type: 'manual' as const },
    actions: [{ type: 'notification' as const, title: 't', message: 'm', level: 'info' as const }],
  };

  beforeEach(() => {
    Object.values(automationServiceMock).forEach((m) => m.mockClear());
  });

  describe('handleCreateAutomation', () => {
    it('returns the created automation', async () => {
      const data = await ok<{ automation: { id: string } }>(handleCreateAutomation as Handler, validCreate);

      expect(automationServiceMock.createAutomation).toHaveBeenCalled();
      expect(data.automation.id).toBe('auto-1');
    });

    it('accepts a file_watch trigger', async () => {
      const response = await (handleCreateAutomation as Handler)(event, {
        ...validCreate,
        trigger: {
          type: 'file_watch',
          patterns: ['**/*.ts'],
          events: ['change', 'add'],
          workspacePath: '/repo',
        },
      });

      expect(response.success).toBe(true);
    });

    it('accepts a schedule trigger with a timezone', async () => {
      const response = await (handleCreateAutomation as Handler)(event, {
        ...validCreate,
        trigger: { type: 'schedule', cron: '0 9 * * 1', timezone: 'Europe/Paris' },
      });

      expect(response.success).toBe(true);
    });

    it('accepts a git_hook trigger', async () => {
      const response = await (handleCreateAutomation as Handler)(event, {
        ...validCreate,
        trigger: { type: 'git_hook', hook: 'pre-commit', repoPath: '/repo' },
      });

      expect(response.success).toBe(true);
    });

    it('rejects an unknown trigger type', async () => {
      const error = await fail(handleCreateAutomation as Handler, {
        ...validCreate,
        trigger: { type: 'moon_phase' },
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a file_watch trigger with no patterns', async () => {
      const error = await fail(handleCreateAutomation as Handler, {
        ...validCreate,
        trigger: { type: 'file_watch', patterns: [], events: ['change'], workspacePath: '/r' },
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('fills in the events a file_watch trigger was sent without', async () => {
      // The renderer has no reason to choose between add / change / unlink — "when
      // files change" means all three — and it is not sent the workspace path at
      // all. Rejecting the narrow form made creating an automation from the UI
      // impossible, so the handler completes it instead.
      const response = await ok(handleCreateAutomation as Handler, {
        ...validCreate,
        trigger: { type: 'file_watch', patterns: ['*'], events: [], workspacePath: '' },
      });

      const trigger = (response as { automation: { trigger: Record<string, unknown> } })
        .automation.trigger;
      expect(trigger.events).toEqual(['add', 'change', 'unlink']);
    });

    it('rejects an unknown git hook', async () => {
      const error = await fail(handleCreateAutomation as Handler, {
        ...validCreate,
        trigger: { type: 'git_hook', hook: 'post-rebase', repoPath: '/r' },
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects an empty action list', async () => {
      const error = await fail(handleCreateAutomation as Handler, { ...validCreate, actions: [] });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects an unknown action type', async () => {
      const error = await fail(handleCreateAutomation as Handler, {
        ...validCreate,
        actions: [{ type: 'launch_rocket' }],
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it.each([
      { type: 'run_script', script: 'bun test' },
      { type: 'ai_task', prompt: 'p', model: 'gpt-4', provider: 'openai' },
      { type: 'git_operation', operation: 'commit', repoPath: '/repo' },
      { type: 'notification', title: 't', message: 'm', level: 'error' },
    ])('accepts a %o action', async (action) => {
      const response = await (handleCreateAutomation as Handler)(event, {
        ...validCreate,
        actions: [action],
      });

      expect(response.success).toBe(true);
    });

    it('rejects a run_script action with no script', async () => {
      const error = await fail(handleCreateAutomation as Handler, {
        ...validCreate,
        actions: [{ type: 'run_script', script: '' }],
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects an ai_task action with an unknown provider', async () => {
      const error = await fail(handleCreateAutomation as Handler, {
        ...validCreate,
        actions: [{ type: 'ai_task', prompt: 'p', model: 'm', provider: 'my-llm' }],
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('accepts an empty workspaceId and resolves it', async () => {
      // Same reason: a disk path is not the renderer's to supply. Requiring one it
      // cannot know is what blocked automation creation from the UI entirely.
      await expect(
        ok(handleCreateAutomation as Handler, { ...validCreate, workspaceId: '' }),
      ).resolves.toBeDefined();
    });

    it('requires the enabled flag', async () => {
      const { enabled, ...withoutEnabled } = validCreate;
      const error = await fail(handleCreateAutomation as Handler, withoutEnabled);

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(enabled).toBe(true);
    });
  });

  describe('handleUpdateAutomation', () => {
    it('strips the id from the update payload', async () => {
      await ok(handleUpdateAutomation as Handler, { id: 'auto-1', name: 'Renamed' });

      expect(automationServiceMock.updateAutomation).toHaveBeenCalledWith('auto-1', {
        name: 'Renamed',
      });
    });

    it('supports toggling enabled through update', async () => {
      await ok(handleUpdateAutomation as Handler, { id: 'auto-1', enabled: false });

      expect(automationServiceMock.updateAutomation).toHaveBeenCalledWith('auto-1', {
        enabled: false,
      });
    });

    it('requires an id', async () => {
      const error = await fail(handleUpdateAutomation as Handler, { name: 'x' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects an empty name', async () => {
      const error = await fail(handleUpdateAutomation as Handler, { id: 'auto-1', name: '' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('maps a missing automation to AUTOMATION_ERROR', async () => {
      automationServiceMock.updateAutomation.mockImplementationOnce(async () => {
        throw new Error('Automation ghost is unavailable');
      });

      const error = await fail(handleUpdateAutomation as Handler, { id: 'ghost', name: 'x' });

      expect(error.code).toBe(ErrorCode.AUTOMATION_ERROR);
    });
  });

  describe('handleDeleteAutomation', () => {
    it('reports success', async () => {
      const data = await ok<{ success: boolean }>(handleDeleteAutomation as Handler, {
        id: 'auto-1',
      });

      expect(automationServiceMock.deleteAutomation).toHaveBeenCalledWith('auto-1');
      expect(data.success).toBe(true);
    });

    it('requires an id', async () => {
      const error = await fail(handleDeleteAutomation as Handler, {});

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleListAutomations', () => {
    it('passes the workspace filter through', async () => {
      await ok(handleListAutomations as Handler, { workspaceId: 'ws-9' });

      expect(automationServiceMock.listAutomations).toHaveBeenCalledWith('ws-9');
    });

    it('works with no filter', async () => {
      const data = await ok<{ automations: unknown[] }>(handleListAutomations as Handler, {});

      expect(data.automations).toHaveLength(1);
      expect(automationServiceMock.listAutomations).toHaveBeenCalledWith(undefined);
    });
  });

  describe('handleGetAutomation', () => {
    it('returns the automation', async () => {
      const data = await ok<{ automation: { id: string } }>(handleGetAutomation as Handler, {
        id: 'auto-1',
      });

      expect(data.automation.id).toBe('auto-1');
    });

    it('fails for an unknown id', async () => {
      const error = await fail(handleGetAutomation as Handler, { id: 'ghost' });

      // "Automation ... not found" hits the FILE_NOT_FOUND branch first.
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    });
  });

  describe('handleRunAutomation', () => {
    it('returns the execution log', async () => {
      const data = await ok<{ log: { status: string } }>(handleRunAutomation as Handler, {
        id: 'auto-1',
      });

      expect(data.log.status).toBe('success');
    });

    it('forwards trigger data', async () => {
      await ok(handleRunAutomation as Handler, {
        id: 'auto-1',
        triggerData: { event: 'change', path: 'a.ts' },
      });

      expect(automationServiceMock.runAutomation).toHaveBeenCalledWith('auto-1', {
        event: 'change',
        path: 'a.ts',
      });
    });

    it('maps a concurrent-run rejection to AUTOMATION_ERROR', async () => {
      automationServiceMock.runAutomation.mockImplementationOnce(async () => {
        throw new Error('Automation auto-1 is already running');
      });

      const error = await fail(handleRunAutomation as Handler, { id: 'auto-1' });

      expect(error.code).toBe(ErrorCode.AUTOMATION_ERROR);
    });
  });

  describe('handleToggleAutomation', () => {
    it('flips the enabled flag', async () => {
      const data = await ok<{ automation: { enabled: boolean } }>(
        handleToggleAutomation as Handler,
        { id: 'auto-1', enabled: false }
      );

      expect(automationServiceMock.toggleAutomation).toHaveBeenCalledWith('auto-1', false);
      expect(data.automation.enabled).toBe(false);
    });

    it('requires the enabled flag', async () => {
      const error = await fail(handleToggleAutomation as Handler, { id: 'auto-1' });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a non-boolean enabled flag', async () => {
      const error = await fail(handleToggleAutomation as Handler, {
        id: 'auto-1',
        enabled: 'yes',
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('handleGetAutomationLogs', () => {
    it('forwards the limit', async () => {
      await ok(handleGetAutomationLogs as Handler, { automationId: 'auto-1', limit: 10 });

      expect(automationServiceMock.getAutomationLogs).toHaveBeenCalledWith('auto-1', 10);
    });

    it('works without a limit', async () => {
      await ok(handleGetAutomationLogs as Handler, { automationId: 'auto-1' });

      expect(automationServiceMock.getAutomationLogs).toHaveBeenCalledWith('auto-1', undefined);
    });

    it('rejects a zero limit', async () => {
      const error = await fail(handleGetAutomationLogs as Handler, {
        automationId: 'auto-1',
        limit: 0,
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a negative limit', async () => {
      const error = await fail(handleGetAutomationLogs as Handler, {
        automationId: 'auto-1',
        limit: -5,
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it('rejects a fractional limit', async () => {
      const error = await fail(handleGetAutomationLogs as Handler, {
        automationId: 'auto-1',
        limit: 2.5,
      });

      expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe('registration', () => {
    it('registers and unregisters all eight automation channels', () => {
      registerAutomationHandlers();
      expect(AUTOMATION_CHANNELS.every((c) => registeredHandlers.has(c))).toBe(true);
      expect(AUTOMATION_CHANNELS).toHaveLength(8);

      unregisterAutomationHandlers();
      expect(AUTOMATION_CHANNELS.some((c) => registeredHandlers.has(c))).toBe(false);
    });
  });
});

// ===========================================================================
// Update
// ===========================================================================

describe('update handlers', () => {
  beforeEach(() => {
    updateManagerMock.checkForUpdates.mockClear();
    updateManagerMock.downloadUpdate.mockClear();
    updateManagerMock.quitAndInstall.mockClear();
    registerUpdateHandlers();
  });

  async function callUpdate(channel: string) {
    const handler = registeredHandlers.get(channel)!;
    return (await handler(event, undefined)) as { success: boolean; error?: string };
  }

  it('update:check reports success', async () => {
    const result = await callUpdate(UPDATE_CHANNELS.CHECK);

    expect(result.success).toBe(true);
    expect(updateManagerMock.checkForUpdates).toHaveBeenCalled();
  });

  it('update:check returns the failure message', async () => {
    updateManagerMock.checkForUpdates.mockImplementationOnce(async () => {
      throw new Error('offline');
    });

    const result = await callUpdate(UPDATE_CHANNELS.CHECK);

    expect(result.success).toBe(false);
    expect(result.error).toBe('offline');
  });

  it('update:check handles a non-Error throwable', async () => {
    updateManagerMock.checkForUpdates.mockImplementationOnce(async () => {
      throw 'nope';
    });

    const result = await callUpdate(UPDATE_CHANNELS.CHECK);

    expect(result.error).toBe('Unknown error');
  });

  it('update:download reports success', async () => {
    const result = await callUpdate(UPDATE_CHANNELS.DOWNLOAD);

    expect(result.success).toBe(true);
    expect(updateManagerMock.downloadUpdate).toHaveBeenCalled();
  });

  it('update:download returns the failure message', async () => {
    updateManagerMock.downloadUpdate.mockImplementationOnce(async () => {
      throw new Error('disk full');
    });

    const result = await callUpdate(UPDATE_CHANNELS.DOWNLOAD);

    expect(result.error).toBe('disk full');
  });

  it('update:install triggers quitAndInstall', async () => {
    const result = await callUpdate(UPDATE_CHANNELS.INSTALL);

    expect(result.success).toBe(true);
    expect(updateManagerMock.quitAndInstall).toHaveBeenCalled();
  });

  it('update:install reports a failure', async () => {
    updateManagerMock.quitAndInstall.mockImplementationOnce(() => {
      throw new Error('installer missing');
    });

    const result = await callUpdate(UPDATE_CHANNELS.INSTALL);

    expect(result.success).toBe(false);
    expect(result.error).toBe('installer missing');
  });

  it('unregisters all three update channels', () => {
    unregisterUpdateHandlers();

    expect(Object.values(UPDATE_CHANNELS).some((c) => registeredHandlers.has(c))).toBe(false);
  });
});
