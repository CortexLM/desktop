/**
 * AI Service - Main Process
 * Service backend pour gérer les sessions et communications avec les providers AI
 * Intégration MCP pour permettre aux agents d'utiliser des tools externes
 */

import { EventEmitter } from 'events';
import type { MCPToolInvocation, MCPToolResult } from './mcp-service';
import type { MCPServer, MCPTool } from '@cortex-ide/shared';
import { getSecretsService } from './secrets-service';
import { getDatabaseService } from './database-service';
import { getProviderSettingsService } from './provider-settings-service';

// Imported as a value, not `import type`: the no-registry constructor path
// instantiates it (see `AIProviderRegistry.fromEnv()` below).
import {
  AgentServer,
  AIProviderRegistry,
  CheckpointStore,
  CODING_TOOLS,
  InMemoryPermissionGate,
  loadDroidsFromWorkspace,
  loadSkillsFromWorkspace,
  readProjectConventions,
  WorkspaceToolExecutor,
  type AgentEvent,
  type AgentMode,
  type Message as ProviderChatMessage,
  type PermissionDecision,
  type RegistryConfig,
  type ToolCall as AgentToolCall,
  type ToolDefinition as AgentToolDefinition,
  type ToolResult,
} from '@cortex-ide/ai-engine';
import type { StreamChunk as IpcStreamChunk } from '@cortex-ide/shared';

// Local type definitions
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * A tool result fed back into the conversation.
 *
 * Kept separate from `Message` because providers only accept
 * user/assistant/system roles: tool output has to be flattened into an
 * assistant message before being sent (see `_processToolCalls`).
 */
export interface ToolResultMessage {
  role: 'tool';
  content: string;
  toolCalls: ToolCall[];
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  stream?: boolean;
}

interface ChatResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

interface StreamChunk {
  content: string;
  done: boolean;
}

// Types pour MCP tools
export interface ToolCall {
  id: string;
  type: 'mcp_tool';
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

interface ToolDefinition {
  type: 'mcp_tool';
  serverId: string;
  toolName: string;
  description: string;
  /** JSON Schema du tool, tel qu'annoncé par le serveur MCP. */
  inputSchema: MCPTool['inputSchema'];
}

/**
 * Vue structurelle du service MCP dont dépend ce service.
 *
 * Déclarée ici plutôt qu'importée depuis `mcp-service` : `MCPService` importe
 * déjà indirectement l'AIService via les handlers, et seuls ces trois membres
 * sont utilisés. Évite un `any` sans créer de cycle.
 */
export interface MCPServiceLike {
  getServer(serverId: string): MCPServer | undefined;
  getAllServers(): MCPServer[];
  invokeTool(invocation: MCPToolInvocation): Promise<MCPToolResult>;
}


export interface AISession {
  id: string;
  providerId: string;
  model?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  workspacePath?: string;
  mcpEnabled?: boolean;
  availableTools?: ToolDefinition[];
}

export interface StreamEventData {
  sessionId: string;
  chunk: StreamChunk;
}

export class AIService extends EventEmitter {
  private registry: AIProviderRegistry;
  private sessions = new Map<string, AISession>();
  private mcpService?: MCPServiceLike;
  private permissionGates = new Map<string, InMemoryPermissionGate>();
  private checkpoints = new CheckpointStore();
  readonly agentServer: AgentServer;

  constructor(registry?: AIProviderRegistry, mcpService?: MCPServiceLike) {
    super();
    // `fromEnv()` rather than `new AIProviderRegistry()`: the bare constructor
    // registers no provider, so every `getProvider()` would return undefined.
    // `validateRegistry()` below warns about the same env vars `fromEnv()` reads.
    this.registry = registry || AIProviderRegistry.fromEnv();
    this.mcpService = mcpService;
    this.agentServer = new AgentServer({
      persist: {
        save: (record) => {
          void this.persistSessionRow(
            {
              id: record.id,
              providerId: record.providerId,
              model: record.model,
              messages: [],
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
              workspacePath: record.workspacePath,
            },
            undefined
          );
        },
        saveMessage: (sessionId, role, content) => {
          if (role === 'tool') return;
          void this.persistMessage(sessionId, role, content);
        },
      },
    });
    this.validateRegistry();
  }

  /**
   * Définit le service MCP pour l'intégration des tools
   */
  setMCPService(mcpService: MCPServiceLike): void {
    this.mcpService = mcpService;
  }

  /**
   * Active MCP pour une session et charge les tools disponibles
   */
  async enableMCPForSession(sessionId: string, serverIds?: string[]): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    if (!this.mcpService) {
      return;
    }

    // Récupérer les tools disponibles depuis les serveurs MCP
    const availableTools: ToolDefinition[] = [];

    const mcpService = this.mcpService;

    // `filter(Boolean)` ne retire pas `undefined` du type : un id inconnu passait
    // donc pour un serveur et faisait planter la lecture de `.tools`.
    const servers: MCPServer[] = serverIds
      ? serverIds
          .map((id) => mcpService.getServer(id))
          .filter((server): server is MCPServer => server !== undefined)
      : mcpService.getAllServers().filter((s) => s.status === 'running');

    for (const server of servers) {
      if (server.tools) {
        for (const tool of server.tools) {
          availableTools.push({
            type: 'mcp_tool',
            serverId: server.id,
            toolName: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
        }
      }
    }

    session.mcpEnabled = true;
    session.availableTools = availableTools;
    session.updatedAt = Date.now();

    this.emit('session:mcp-enabled', { sessionId, toolCount: availableTools.length });
  }

  /**
   * Invoque un tool MCP depuis une session AI
   */
  async invokeMCPTool(sessionId: string, toolCall: ToolCall): Promise<MCPToolResult> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    if (!session.mcpEnabled) {
      throw new Error('MCP not enabled for this session');
    }

    if (!this.mcpService) {
      throw new Error('MCP service not configured');
    }

    // Vérifier que le tool est disponible pour cette session
    const toolDef = session.availableTools?.find(
      t => t.serverId === toolCall.serverId && t.toolName === toolCall.toolName
    );

    if (!toolDef) {
      throw new Error(`Tool ${toolCall.toolName} from server ${toolCall.serverId} not available in this session`);
    }

    // Invoquer le tool via MCP service
    const invocation: MCPToolInvocation = {
      serverId: toolCall.serverId,
      toolName: toolCall.toolName,
      arguments: toolCall.arguments,
    };

    const result = await this.mcpService.invokeTool(invocation);

    this.emit('tool:invoked', { sessionId, toolCall, result });

    return result;
  }

  /**
   * Exécute une série de tool calls et renvoie leurs résultats.
   *
   * Public, comme `invokeMCPTool`: rien ne l'appelle en interne parce que
   * `ChatResponse` ne transporte pas encore de tool calls, donc c'est
   * l'appelant qui pilote la boucle.
   */
  async processToolCalls(
    sessionId: string,
    toolCalls: ToolCall[]
  ): Promise<ToolResultMessage[]> {
    const toolMessages: ToolResultMessage[] = [];

    for (const toolCall of toolCalls) {
      try {
        const result = await this.invokeMCPTool(sessionId, toolCall);

        toolMessages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCalls: [toolCall],
        });
      } catch (error) {
        toolMessages.push({
          role: 'tool',
          content: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            isError: true,
          }),
          toolCalls: [toolCall],
        });
      }
    }

    return toolMessages;
  }

  /**
   * Reconstruit le registry à partir d'une configuration, à chaud.
   *
   * C'est la moitié « service » du pont des réglages : sans cet appel après un
   * enregistrement, le registry garde les providers construits au démarrage et
   * `createSession('anthropic')` continue de lever `Provider "anthropic" not
   * found` alors que la clé est bien stockée — le bug d'origine, exactement.
   *
   * Délègue à `registry.reconfigure()`, qui purge avant de réenregistrer :
   * `register()` étant additif, reconfigurer sans purge laisserait l'ancien
   * provider (et son ancienne clé) résolvable.
   *
   * Les sessions ouvertes ne sont pas détruites : elles portent un `providerId`,
   * qui est résolu à chaque envoi. Une session dont le provider vient d'être
   * retiré échouera à son prochain message avec « not found » plutôt que de
   * continuer à utiliser une clé révoquée.
   *
   * Renvoie les IDs que le registry résout après reconstruction : c'est une
   * mesure, pas une déduction des réglages.
   */
  applyRegistryConfig(config: RegistryConfig): string[] {
    this.registry.reconfigure(config);
    this.validateRegistry();
    return this.registry.getProviderIds();
  }

  /**
   * Le provider par défaut, pour le produit Chat.
   *
   * Les conversations parlent au provider directement — un échange linéaire n'a
   * pas besoin de la boucle d'agent, de ses outils ni de ses permissions.
   */
  chatProvider() {
    return this.registry.getDefault();
  }

  /** IDs actuellement résolus par le registry. */
  getRegisteredProviderIds(): string[] {
    return this.registry.getProviderIds();
  }

  /**
   * Valide que le registry a au moins un provider configuré
   */
  private validateRegistry(): void {
    if (this.registry.getProviderIds().length === 0) {
      console.warn('[AIService] No AI providers configured. Set environment variables:');
      console.warn('  - OPENAI_API_KEY for OpenAI');
      console.warn('  - ANTHROPIC_API_KEY for Anthropic');
      console.warn('  - OPENROUTER_API_KEY for OpenRouter');
      console.warn('  - OLLAMA_HOST or OLLAMA_ENABLED=true for Ollama');
    }
  }

  /**
   * Crée une nouvelle session
   */
  /**
   * `extras.id` lets a caller that already owns an identifier reuse it.
   *
   * `SessionService` needs this: it writes the run's row *before* resolving a
   * provider, so that a missing key becomes a recorded failure on an existing run
   * rather than a rejected call with nothing to show. That only works if the
   * session it later creates carries the same id as the row. `AgentServer` already
   * accepted an `id`; this was the one link that dropped it.
   */
  async createSession(
    providerId?: string,
    model?: string,
    extras?: { workspacePath?: string; workspaceId?: string; id?: string }
  ): Promise<AISession> {
    const provider = providerId
      ? this.registry.getProvider(providerId)
      : this.registry.getProviderIds().length > 0 
        ? this.registry.getProvider(this.registry.getProviderIds()[0])
        : undefined;

    if (!provider) {
      throw new Error(
        providerId
          ? `Provider "${providerId}" not found`
          : 'No default AI provider configured'
      );
    }

    // Vérifier la disponibilité du provider
    const available = await provider.isAvailable();
    if (!available) {
      throw new Error(`Provider "${provider.id}" is not available`);
    }

    const session: AISession = {
      id: extras?.id ?? this.generateSessionId(),
      providerId: provider.id,
      model,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workspacePath: extras?.workspacePath,
    };

    this.sessions.set(session.id, session);
    this.agentServer.createSession({
      id: session.id,
      providerId: session.providerId,
      model: session.model,
      workspacePath: session.workspacePath,
    });
    this.emit('session:created', session);
    void this.persistSessionRow(session, extras?.workspaceId);

    return session;
  }

  /**
   * Récupère une session existante
   */
  getSession(sessionId: string): AISession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Liste toutes les sessions
   */
  getAllSessions(): AISession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Supprime une session
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      this.emit('session:deleted', sessionId);
    }
    return deleted;
  }

  /**
   * Envoie un message et attend la réponse complète
   */
  async sendMessage(
    sessionId: string,
    content: string,
    options?: ChatOptions
  ): Promise<ChatResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const provider = this.registry.getProvider(session.providerId);
    if (!provider) {
      throw new Error(`Provider "${session.providerId}" not found`);
    }

    const chunks: string[] = [];
    for await (const chunk of this.streamMessage(sessionId, content, options, {
      workspacePath: session.workspacePath,
    })) {
      if (chunk.content) chunks.push(chunk.content);
    }

    return {
      content: chunks.join(''),
      model: session.model ?? provider.id,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  /**
   * Envoie un message en mode streaming
   */
  resolvePermission(sessionId: string, requestId: string, decision: PermissionDecision): void {
    this.permissionGates.get(sessionId)?.resolve(requestId, decision);
    this.agentServer.resolvePermission(sessionId, requestId, decision);
  }

  forkSession(sessionId: string) {
    return this.agentServer.forkSession(sessionId);
  }

  compactSession(sessionId: string) {
    return this.agentServer.compactSession(sessionId);
  }

  revertLastTurn(sessionId: string) {
    const record = this.agentServer.revertLastTurn(sessionId);
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages = record.messages
        .filter((message) => message.role !== 'tool')
        .map((message) => ({ role: message.role as Message['role'], content: message.content }));
    }
    return record;
  }

  switchSessionModel(sessionId: string, providerId: string, model?: string) {
    return this.agentServer.switchModel(sessionId, providerId, model);
  }

  listCheckpoints() {
    return this.checkpoints.list();
  }

  restoreCheckpoint(sessionId: string, checkpointId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session "${sessionId}" not found`);
    const messages = this.checkpoints.restore(checkpointId);
    session.messages = messages
      .filter((message) => message.role !== 'tool')
      .map((message) => ({
        role: message.role as Message['role'],
        content: message.content,
      }));
    session.updatedAt = Date.now();
  }

  async *streamMessage(
    sessionId: string,
    content: string,
    options?: ChatOptions,
    agent?: { workspacePath?: string; mode?: AgentMode }
  ): AsyncIterableIterator<StreamChunk> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const provider = this.registry.getProvider(session.providerId);
    if (!provider) {
      throw new Error(`Provider "${session.providerId}" not found`);
    }

    // Ajouter le message utilisateur
    const userMessage: Message = { role: 'user', content };
    session.messages.push(userMessage);
    session.updatedAt = Date.now();

    this.emit('message:sent', { sessionId, message: userMessage });
    void this.persistMessage(session.id, 'user', content);

    if (agent?.workspacePath && !session.workspacePath) {
      session.workspacePath = agent.workspacePath;
    }

    yield* this.streamAgentTurn(session, provider, content, options, {
      workspacePath: agent?.workspacePath ?? session.workspacePath ?? process.cwd(),
      mode: agent?.mode,
    });
  }

  /**
   * Ajoute un message système à la session
   */
  addSystemMessage(sessionId: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const systemMessage: Message = { role: 'system', content };
    session.messages.unshift(systemMessage); // Ajouter au début
    session.updatedAt = Date.now();

    this.emit('message:added', { sessionId, message: systemMessage });
    void this.persistMessage(sessionId, 'system', content);
  }

  /**
   * Récupère les providers disponibles
   */
  getAvailableProviders(): Array<{ id: string; name: string }> {
    return this.registry.getProviderIds().map((id: string) => {
      const provider = this.registry.getProvider(id);
      return {
        id,
        name: provider?.name || id,
      };
    });
  }

  /**
   * Vérifie quels providers sont actuellement disponibles
   */
  async checkAvailableProviders(): Promise<string[]> {
    const ids = this.registry.getProviderIds();
    const results = await Promise.all(
      ids.map(async (id: string) => {
        const provider = this.registry.getProvider(id);
        if (!provider) return null;
        const available = await provider.isAvailable();
        return available ? id : null;
      })
    );
    return results.filter((id): id is string => id !== null);
  }

  /**
   * Change le provider d'une session existante
   */
  async switchProvider(sessionId: string, providerId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const provider = this.registry.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" not found`);
    }

    const available = await provider.isAvailable();
    if (!available) {
      throw new Error(`Provider "${providerId}" is not available`);
    }

    session.providerId = providerId;
    session.updatedAt = Date.now();

    this.emit('session:updated', session);
  }

  /**
   * Efface l'historique des messages d'une session
   */
  clearSessionHistory(sessionId: string, keepSystemMessages = true): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    if (keepSystemMessages) {
      session.messages = session.messages.filter(m => m.role === 'system');
    } else {
      session.messages = [];
    }
    
    session.updatedAt = Date.now();
    this.emit('session:cleared', sessionId);
  }

  private async *streamAgentTurn(
    session: AISession,
    provider: NonNullable<ReturnType<AIProviderRegistry['getProvider']>>,
    _userText: string,
    options: ChatOptions | undefined,
    agent: { workspacePath: string; mode?: AgentMode }
  ): AsyncIterableIterator<StreamChunk> {
    const workspaceRoot = agent.workspacePath;
    const [conventions, droids, skills] = await Promise.all([
      readProjectConventions(workspaceRoot),
      loadDroidsFromWorkspace(workspaceRoot),
      loadSkillsFromWorkspace(workspaceRoot),
    ]);

    if (this.mcpService) {
      await this.enableMCPForSession(session.id);
    }

    const mcpTools = this.toAgentMcpTools(session);
    const tools: AgentToolDefinition[] = [...CODING_TOOLS, ...mcpTools];

    // The user's stored secrets, as environment variables for anything the agent
    // runs. Read per turn rather than cached: a secret added in Settings should
    // apply to the next run, not to the next launch. Best-effort — a run without a
    // secret is degraded, a run that refuses to start over one is broken.
    const secretEnv = await getSecretsService()
      .environment()
      .catch(() => ({}) as Record<string, string>);

    const workspaceExecutor = new WorkspaceToolExecutor({
      workspaceRoot,
      droids,
      skills,
      env: secretEnv,
      autonomy: this.agentServer.getSession(session.id)?.autonomy ?? 'medium',
      delegationDepth: this.agentServer.getSession(session.id)?.parentId ? 1 : 0,
      onTodos: (todos, merge) => this.agentServer.mergeTodos(session.id, todos, merge),
      runDroid: async (droid, prompt) => {
        const child = this.agentServer.createChildSession(session.id, droid.name);
        const result = await provider.chat(
          [
            { role: 'system', content: droid.systemPrompt },
            { role: 'user', content: prompt },
          ],
          { ...options, model: droid.model ?? session.model }
        );
        child.messages.push({ role: 'user', content: prompt }, { role: 'assistant', content: result.content });
        return result.content;
      },
    });
    const executor = {
      execute: async (call: AgentToolCall): Promise<ToolResult> => {
        if (call.name.startsWith('mcp__')) {
          const [, serverId, toolName] = call.name.split('__');
          const results = await this.processToolCalls(session.id, [
            {
              id: call.id,
              type: 'mcp_tool',
              serverId,
              toolName,
              arguments: call.arguments,
            },
          ]);
          const payload = results[0]?.content ?? '';
          return { ok: !payload.includes('"isError":true'), output: payload };
        }
        return workspaceExecutor.execute(call);
      },
    };

    if (!this.agentServer.getSession(session.id)) {
      this.agentServer.createSession({
        id: session.id,
        providerId: session.providerId,
        model: session.model,
        workspacePath: workspaceRoot,
        mode: agent.mode,
      });
    }
    const hosted = this.agentServer.getSession(session.id)!;
    hosted.messages = session.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    hosted.mode = agent.mode ?? hosted.mode;
    hosted.workspacePath = workspaceRoot;
    this.agentServer.setMode(session.id, hosted.mode);

    const visible: string[] = [];

    try {
      for await (const event of this.agentServer.runTurn(session.id, _userText, {
        extraTools: mcpTools,
        conventions,
        skills,
        executor,
        chat: async (messages) => {
          // Passed through natively, not flattened. The old mapping rewrote tool
          // results as user prose and dropped the assistant's `toolCalls`
          // entirely, so the model never saw itself call anything — and a model
          // with no memory of having created the file creates it again, every
          // iteration, until the cap. Providers already know how to replay
          // tool calls and pair results by `toolCallId`.
          const mapped: ProviderChatMessage[] = messages.map((message) => ({
            role: message.role,
            content: message.content,
            ...(message.toolCalls ? { toolCalls: message.toolCalls } : {}),
            ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
            ...(message.name ? { name: message.name } : {}),
          }));
          const response = await provider.chat(mapped, {
            ...options,
            model: session.model,
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters as unknown as Record<string, unknown>,
            })),
          });
          return { content: response.content, toolCalls: response.toolCalls };
        },
      })) {
        const ipc = agentEventToIpc(event);
        this.emit('stream:chunk', {
          sessionId: session.id,
          chunk: { content: ipc.content ?? '', done: ipc.type === 'done', ipc },
        });
        if (event.type === 'text') visible.push(event.text);
        // The full IPC payload rides along, not just the text. The consumer that
        // matters here is SessionService.recordChunk: with `{ content, done }`
        // alone, tool calls, permission requests and plans never reached the
        // timeline — and a permission request nobody can see is a run that waits
        // forever on a decision that cannot be given.
        yield { ...ipc, content: ipc.content ?? '', done: ipc.type === 'done' };
        if (event.type === 'error') {
          throw new Error(event.message);
        }
      }

      const assistantText = visible.join('\n') || '(agent turn)';
      session.messages.push({
        role: 'assistant',
        content: assistantText,
      });
      session.updatedAt = Date.now();
    } catch (error) {
      session.messages.pop();
      this.emit('error', {
        sessionId: session.id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Génère un ID unique pour les sessions
   */
  private toAgentMcpTools(session: AISession): AgentToolDefinition[] {
    return (session.availableTools ?? []).map((tool) => ({
      name: `mcp__${tool.serverId}__${tool.toolName}`,
      description: `${tool.description} (MCP ${tool.serverId})`,
      risk: 'write' as const,
      parameters: {
        type: 'object' as const,
        properties: (tool.inputSchema?.properties ?? {}) as AgentToolDefinition['parameters']['properties'],
        required: tool.inputSchema?.required,
      },
    }));
  }

  private async persistSessionRow(session: AISession, workspaceId?: string): Promise<void> {
    try {
      const manager = await getDatabaseService().getManager();
      if (manager.getSession(session.id)) return;
      manager.createSession({
        id: session.id,
        workspace_id: workspaceId ?? null,
        title: 'New session',
        model: session.model ?? null,
        metadata: {
          provider: session.providerId,
          workspacePath: session.workspacePath ?? null,
        },
      });
    } catch {
      // Tests and early boot may not have SQLite ready.
    }
  }

  private async persistMessage(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string
  ): Promise<void> {
    try {
      const manager = await getDatabaseService().getManager();
      if (!manager.getSession(sessionId)) return;
      manager.createMessage({
        session_id: sessionId,
        role,
        content,
      });
    } catch {
      // Same as persistSessionRow: persistence is best-effort.
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Nettoie toutes les sessions
   */
  cleanup(): void {
    this.sessions.clear();
    this.removeAllListeners();
  }
}

// Instance singleton
let aiServiceInstance: AIService | null = null;

/**
 * Applique les réglages providers PERSISTÉS au registry fraîchement construit.
 *
 * Sans cet appel, une clé enregistrée dans Settings ne survit pas au
 * redémarrage : le constructeur ne lit que l'environnement (`fromEnv()`), et
 * `settings:set-provider` — le seul autre endroit qui reconfigure le registry —
 * ne rejoue rien au boot. Symptôme observé en démo : Settings affiche la clé
 * masquée, mais tout run à froid échoue avec « No model is configured ».
 *
 * En try/catch : la lecture passe par `app.getPath('userData')`, absent dans
 * certains harnais de test. Un échec ici laisse simplement le registry
 * env-only, il ne doit pas empêcher le service d'exister.
 */
function applyStoredProviderSettings(service: AIService): void {
  try {
    const settings = getProviderSettingsService();
    service.applyRegistryConfig(settings.toRegistryConfig());
  } catch (error) {
    console.warn(
      '[AIService] Stored provider settings were not applied:',
      error instanceof Error ? error.message : typeof error
    );
  }
}

/**
 * Récupère ou crée l'instance du service AI
 */
export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
    applyStoredProviderSettings(aiServiceInstance);
  }
  return aiServiceInstance;
}

/**
 * Réinitialise l'instance du service AI
 */
function agentEventToIpc(event: AgentEvent): IpcStreamChunk {
  return mapTextEvent(event) ?? mapToolEvent(event) ?? mapInteractEvent(event) ?? { type: 'done' };
}

function mapTextEvent(event: AgentEvent): IpcStreamChunk | undefined {
  if (event.type === 'thinking') return { type: 'thinking', content: event.text };
  if (event.type === 'text') return { type: 'chunk', content: event.text };
  if (event.type === 'error') return { type: 'error', error: event.message };
  if (event.type === 'context_full') {
    return {
      type: 'context_full',
      usage: { promptTokens: event.tokens, completionTokens: 0, totalTokens: event.tokens },
    };
  }
  return undefined;
}

function mapToolEvent(event: AgentEvent): IpcStreamChunk | undefined {
  if (event.type === 'tool_start') {
    return {
      type: 'tool',
      tool: { id: event.id, name: event.name, title: event.title, status: 'running', detail: event.detail },
    };
  }
  if (event.type === 'tool_end') {
    return {
      type: 'tool',
      content: event.output,
      tool: {
        id: event.id,
        name: event.name,
        status: event.ok ? 'done' : 'error',
        additions: event.additions,
        deletions: event.deletions,
        durationMs: event.durationMs,
      },
    };
  }
  return undefined;
}

function mapInteractEvent(event: AgentEvent): IpcStreamChunk | undefined {
  if (event.type === 'permission') return { type: 'permission', permission: event.request };
  if (event.type === 'question') {
    return { type: 'question', question: { id: event.id, prompt: event.prompt, options: event.options } };
  }
  if (event.type === 'plan') return { type: 'plan', plan: event.plan };
  if (event.type.startsWith('task_')) {
    return taskEventToIpc(event as Extract<AgentEvent, { type: `task_${string}` }>);
  }
  return undefined;
}

function taskEventToIpc(
  event: Extract<AgentEvent, { type: `task_${string}` }>,
): IpcStreamChunk {
  const phase = event.type.replace('task_', '') as 'started' | 'progress' | 'completed' | 'failed';
  return {
    type: 'task',
    task: {
      id: event.id,
      phase,
      summary: event.summary,
      artifact_id: event.type === 'task_completed' ? event.artifact_id : undefined,
    },
  };
}

export function resetAIService(): void {
  if (aiServiceInstance) {
    aiServiceInstance.cleanup();
    aiServiceInstance = null;
  }
}
