/**
 * AI Service - Main Process
 * Service backend pour gérer les sessions et communications avec les providers AI
 * Intégration MCP pour permettre aux agents d'utiliser des tools externes
 */

import { EventEmitter } from 'events';
import type { MCPToolInvocation, MCPToolResult } from './mcp-service';
import type { MCPServer, MCPTool } from '@cortex-ide/shared';

// Imported as a value, not `import type`: the no-registry constructor path
// instantiates it (see `AIProviderRegistry.fromEnv()` below).
import { AIProviderRegistry, type RegistryConfig } from '@cortex-ide/ai-engine';

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

class AIProviderError extends Error {}

export interface AISession {
  id: string;
  providerId: string;
  model?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
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

  constructor(registry?: AIProviderRegistry, mcpService?: MCPServiceLike) {
    super();
    // `fromEnv()` rather than `new AIProviderRegistry()`: the bare constructor
    // registers no provider, so every `getProvider()` would return undefined.
    // `validateRegistry()` below warns about the same env vars `fromEnv()` reads.
    this.registry = registry || AIProviderRegistry.fromEnv();
    this.mcpService = mcpService;
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
      throw new Error('MCP service not configured');
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
  async createSession(providerId?: string, model?: string): Promise<AISession> {
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
      id: this.generateSessionId(),
      providerId: provider.id,
      model,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.sessions.set(session.id, session);
    this.emit('session:created', session);

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

    // Ajouter le message utilisateur
    const userMessage: Message = { role: 'user', content };
    session.messages.push(userMessage);
    session.updatedAt = Date.now();

    try {
      // Envoyer au provider avec les options
      const response = await provider.chat(session.messages, options);

      // Ajouter la réponse de l'assistant
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
      };
      session.messages.push(assistantMessage);
      session.updatedAt = Date.now();

      this.emit('message:sent', { sessionId, message: userMessage });
      this.emit('message:received', { sessionId, message: assistantMessage, response });

      return response;
    } catch (error) {
      // Retirer le message utilisateur en cas d'erreur
      session.messages.pop();
      
      if (error instanceof AIProviderError) {
        this.emit('error', { sessionId, error });
        throw error;
      }
      
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Envoie un message en mode streaming
   */
  async *streamMessage(
    sessionId: string,
    content: string,
    options?: ChatOptions
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

    // Accumulation dans un tableau puis join() : la concaténation de string
    // dans la boucle était en O(n²) sur les réponses longues.
    const chunks: string[] = [];

    try {
      // Stream depuis le provider avec le modèle de la session si défini

      for await (const chunk of provider.stream(session.messages, options)) {
        chunks.push(chunk.content);
        
        // Émettre l'événement pour l'IPC
        this.emit('stream:chunk', { sessionId, chunk });
        
        yield chunk;
      }

      // Ajouter la réponse complète de l'assistant
      const assistantMessage: Message = {
        role: 'assistant',
        content: chunks.join(''),
      };
      session.messages.push(assistantMessage);
      session.updatedAt = Date.now();

      this.emit('message:received', { sessionId, message: assistantMessage });
    } catch (error) {
      // Retirer le message utilisateur en cas d'erreur
      session.messages.pop();
      
      if (error instanceof AIProviderError) {
        this.emit('error', { sessionId, error });
        throw error;
      }
      
      throw new Error(`Failed to stream message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

  /**
   * Génère un ID unique pour les sessions
   */
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
 * Récupère ou crée l'instance du service AI
 */
export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}

/**
 * Réinitialise l'instance du service AI
 */
export function resetAIService(): void {
  if (aiServiceInstance) {
    aiServiceInstance.cleanup();
    aiServiceInstance = null;
  }
}
