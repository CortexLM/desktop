/**
 * MCP Service - Main Process
 * Service backend pour gérer les serveurs MCP (Model Context Protocol)
 * Découverte, installation, configuration et invocation de tools MCP
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

import type { MCPServer, MCPServerStatus, MCPTool } from '@cortex-ide/shared';

// ============================================================================
// Types
// ============================================================================

// `MCPServer` / `MCPTool` / `MCPServerStatus` sont le contrat partagé avec le
// renderer : définis dans `@cortex-ide/shared`, ré-exportés ici pour les
// consommateurs du service.
export type { MCPServerStatus, MCPServer, MCPTool } from '@cortex-ide/shared';

export interface MCPToolInvocation {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface MCPPermission {
  serverId: string;
  toolName: string;
  granted: boolean;
  grantedAt?: number;
  grantedBy?: string;
}

/**
 * Charge utile JSON-RPC : ce que `JSON.parse` peut produire.
 *
 * Le contenu dépend du serveur MCP et de la méthode, donc il n'est pas typable
 * plus précisément ici ; les appelants narrowent au point d'usage.
 */
export type JsonRpcValue =
  | string
  | number
  | boolean
  | null
  | JsonRpcValue[]
  | { [key: string]: JsonRpcValue };

/** Réponse ou notification reçue d'un serveur MCP. */
interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: JsonRpcValue;
  result?: JsonRpcValue;
  error?: { code?: number; message?: string; data?: JsonRpcValue };
}

interface MCPProcess {
  serverId: string;
  process: ChildProcess;
  messageId: number;
  pendingRequests: Map<number, {
    resolve: (value: JsonRpcValue) => void;
    reject: (error: Error) => void;
    timeout?: ReturnType<typeof setTimeout>;
  }>;
}

/**
 * Extrait la liste de tools d'une réponse `tools/list`.
 *
 * La réponse vient d'un process externe : rien ne garantit sa forme, donc elle
 * est validée ici plutôt que castée. Une réponse inattendue donne une liste
 * vide, ce qui laisse le serveur utilisable sans tool.
 */
function extractTools(response: JsonRpcValue): MCPTool[] | undefined {
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return undefined;
  }

  const tools = (response as { tools?: JsonRpcValue }).tools;
  if (!Array.isArray(tools)) {
    return undefined;
  }

  return tools.filter(
    (tool): tool is JsonRpcValue & MCPTool =>
      !!tool && typeof tool === 'object' && !Array.isArray(tool) && typeof tool.name === 'string'
  ) as unknown as MCPTool[];
}

/**
 * Valide une réponse `tools/call`.
 *
 * Le protocole impose `{ content: [...] }` ; une réponse hors contrat est
 * signalée comme erreur de tool plutôt que propagée telle quelle.
 */
function toToolResult(response: JsonRpcValue): MCPToolResult {
  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    Array.isArray((response as { content?: JsonRpcValue }).content)
  ) {
    return response as unknown as MCPToolResult;
  }

  return {
    content: [{ type: 'text', text: 'Malformed tool result: missing "content" array' }],
    isError: true,
  };
}

// ============================================================================
// MCP Registry
// ============================================================================

/**
 * Registry des serveurs MCP installés et disponibles
 */
class MCPRegistry {
  private servers = new Map<string, MCPServer>();
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.cortex-ide', 'mcp-servers.json');
  }

  /**
   * Charge la configuration des serveurs MCP
   */
  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const config = JSON.parse(data);
      
      for (const server of config.servers || []) {
        this.servers.set(server.id, server);
      }
      
      console.log(`[MCPRegistry] Loaded ${this.servers.size} servers from config`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('[MCPRegistry] No config file found, starting fresh');
        await this.save();
      } else {
        console.error('[MCPRegistry] Failed to load config:', error);
      }
    }
  }

  /**
   * Sauvegarde la configuration des serveurs MCP
   */
  async save(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      await fs.mkdir(configDir, { recursive: true });
      
      const config = {
        version: '1.0.0',
        servers: Array.from(this.servers.values()),
      };
      
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log('[MCPRegistry] Config saved');
    } catch (error) {
      console.error('[MCPRegistry] Failed to save config:', error);
      throw error;
    }
  }

  /**
   * Enregistre un nouveau serveur MCP
   */
  register(server: MCPServer): void {
    this.servers.set(server.id, server);
  }

  /**
   * Récupère un serveur par ID
   */
  getServer(id: string): MCPServer | undefined {
    return this.servers.get(id);
  }

  /**
   * Liste tous les serveurs
   */
  getAllServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Liste les serveurs par statut
   */
  getServersByStatus(status: MCPServerStatus): MCPServer[] {
    return this.getAllServers().filter(s => s.status === status);
  }

  /**
   * Met à jour un serveur
   */
  updateServer(id: string, updates: Partial<MCPServer>): void {
    const server = this.servers.get(id);
    if (server) {
      this.servers.set(id, { ...server, ...updates });
    }
  }

  /**
   * Supprime un serveur
   */
  deleteServer(id: string): boolean {
    return this.servers.delete(id);
  }
}

// ============================================================================
// MCP Service
// ============================================================================

export class MCPService extends EventEmitter {
  private registry: MCPRegistry;
  private processes = new Map<string, MCPProcess>();
  private permissions = new Map<string, MCPPermission>();
  private permissionsPath: string;

  constructor(configPath?: string) {
    super();
    this.registry = new MCPRegistry(configPath);
    this.permissionsPath = path.join(os.homedir(), '.cortex-ide', 'mcp-permissions.json');
  }

  /**
   * Initialise le service MCP
   */
  async initialize(): Promise<void> {
    await this.registry.load();
    await this.loadPermissions();
    console.log('[MCPService] Initialized');
  }

  /**
   * Charge les permissions des tools MCP
   */
  private async loadPermissions(): Promise<void> {
    try {
      const data = await fs.readFile(this.permissionsPath, 'utf-8');
      const perms = JSON.parse(data);
      
      for (const perm of perms.permissions || []) {
        const key = `${perm.serverId}:${perm.toolName}`;
        this.permissions.set(key, perm);
      }
      
      console.log(`[MCPService] Loaded ${this.permissions.size} permissions`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[MCPService] Failed to load permissions:', error);
      }
    }
  }

  /**
   * Sauvegarde les permissions
   */
  private async savePermissions(): Promise<void> {
    try {
      const configDir = path.dirname(this.permissionsPath);
      await fs.mkdir(configDir, { recursive: true });
      
      const config = {
        version: '1.0.0',
        permissions: Array.from(this.permissions.values()),
      };
      
      await fs.writeFile(this.permissionsPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      console.error('[MCPService] Failed to save permissions:', error);
    }
  }

  /**
   * Installe un nouveau serveur MCP
   */
  async installServer(server: Omit<MCPServer, 'status' | 'installedAt'>): Promise<MCPServer> {
    const fullServer: MCPServer = {
      ...server,
      status: 'installed',
      installedAt: Date.now(),
    };
    
    this.registry.register(fullServer);
    await this.registry.save();
    
    this.emit('server:installed', fullServer);
    return fullServer;
  }

  /**
   * Démarre un serveur MCP
   */
  async startServer(serverId: string): Promise<void> {
    const server = this.registry.getServer(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    if (this.processes.has(serverId)) {
      console.log(`[MCPService] Server ${serverId} already running`);
      return;
    }

    if (!server.command) {
      throw new Error(`Server ${serverId} has no command configured`);
    }

    try {
      const childProcess = spawn(server.command, server.args || [], {
        env: { ...process.env, ...server.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const mcpProcess: MCPProcess = {
        serverId,
        process: childProcess,
        messageId: 0,
        pendingRequests: new Map(),
      };

      this.processes.set(serverId, mcpProcess);

      // Setup JSON-RPC communication
      let buffer = '';
      childProcess.stdout?.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              this.handleServerMessage(serverId, message, mcpProcess);
            } catch (error) {
              console.error(`[MCPService] Failed to parse message from ${serverId}:`, error);
            }
          }
        }
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`[MCPService] ${serverId} stderr:`, data.toString());
      });

      childProcess.on('error', (error: Error) => {
        console.error(`[MCPService] ${serverId} process error:`, error);
        this.registry.updateServer(serverId, { status: 'error', lastError: error.message });
        this.processes.delete(serverId);
        this.rejectPendingRequests(mcpProcess, `Server ${serverId} errored: ${error.message}`);
        this.emit('server:error', { serverId, error });
      });

      childProcess.on('exit', (code: number | null) => {
        console.log(`[MCPService] ${serverId} exited with code ${code}`);
        this.processes.delete(serverId);
        // Sans ça, les requêtes en vol restaient dans la Map et leurs promesses
        // ne se résolvaient jamais (timers + closures retenus 30s, appelants bloqués).
        this.rejectPendingRequests(mcpProcess, `Server ${serverId} exited with code ${code}`);
        this.registry.updateServer(serverId, { status: 'stopped' });
        this.emit('server:stopped', serverId);
      });

      // Initialize the server
      await this.sendServerRequest(mcpProcess, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'Cortex IDE',
          version: '1.0.0',
        },
      });

      // Discover tools
      const toolsResponse = await this.sendServerRequest(mcpProcess, 'tools/list', {});
      const discovered = extractTools(toolsResponse);
      if (discovered) {
        this.registry.updateServer(serverId, {
          status: 'running',
          tools: discovered,
        });
      }

      this.emit('server:started', serverId);
      console.log(`[MCPService] Server ${serverId} started successfully`);
    } catch (error) {
      this.registry.updateServer(serverId, { 
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Arrête un serveur MCP
   */
  async stopServer(serverId: string): Promise<void> {
    const mcpProcess = this.processes.get(serverId);
    if (!mcpProcess) {
      console.log(`[MCPService] Server ${serverId} not running`);
      return;
    }

    try {
      // Send shutdown request
      await this.sendServerRequest(mcpProcess, 'shutdown', {});
      mcpProcess.process.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          mcpProcess.process.kill('SIGKILL');
          resolve();
        }, 5000);
        
        mcpProcess.process.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      this.processes.delete(serverId);
      this.registry.updateServer(serverId, { status: 'stopped' });
      this.emit('server:stopped', serverId);
    } catch (error) {
      console.error(`[MCPService] Failed to stop server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Envoie une requête JSON-RPC au serveur
   */
  private async sendServerRequest(
    mcpProcess: MCPProcess,
    method: string,
    params: JsonRpcValue
  ): Promise<JsonRpcValue> {
    return new Promise<JsonRpcValue>((resolve, reject) => {
      const id = ++mcpProcess.messageId;
      
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      // Timeout after 30 seconds. Le timer est conservé dans l'entrée pending
      // pour être annulé dès la réponse : sinon chaque requête laissait un
      // timer actif 30s (avec ses closures) => fuite mémoire sous charge.
      const timeout = setTimeout(() => {
        if (mcpProcess.pendingRequests.delete(id)) {
          reject(new Error(`Request ${method} timed out`));
        }
      }, 30000);

      mcpProcess.pendingRequests.set(id, { resolve, reject, timeout });

      const message = JSON.stringify(request) + '\n';
      mcpProcess.process.stdin?.write(message);
    });
  }

  /**
   * Rejette toutes les requêtes en attente d'un process et annule leurs timers.
   * Appelé quand le process meurt : évite les promesses jamais résolues et les
   * timers de 30s qui retiennent leurs closures en mémoire.
   */
  private rejectPendingRequests(mcpProcess: MCPProcess, reason: string): void {
    const pending = Array.from(mcpProcess.pendingRequests.values());
    mcpProcess.pendingRequests.clear();

    for (const { reject, timeout } of pending) {
      if (timeout) clearTimeout(timeout);
      reject(new Error(reason));
    }
  }

  /**
   * Gère les messages reçus du serveur
   */
  private handleServerMessage(
    serverId: string,
    message: JsonRpcMessage,
    mcpProcess: MCPProcess
  ): void {
    if (message.id !== undefined && mcpProcess.pendingRequests.has(message.id)) {
      const { resolve, reject, timeout } = mcpProcess.pendingRequests.get(message.id)!;
      mcpProcess.pendingRequests.delete(message.id);
      if (timeout) clearTimeout(timeout);

      if (message.error) {
        reject(new Error(message.error.message || 'Unknown error'));
      } else {
        resolve(message.result ?? null);
      }
    } else if (message.method) {
      // Handle notifications from server
      this.emit('server:notification', { serverId, method: message.method, params: message.params });
    }
  }

  /**
   * Invoque un tool MCP
   */
  async invokeTool(invocation: MCPToolInvocation): Promise<MCPToolResult> {
    const { serverId, toolName, arguments: args } = invocation;

    // Vérifier les permissions
    const permKey = `${serverId}:${toolName}`;
    const permission = this.permissions.get(permKey);
    
    if (!permission || !permission.granted) {
      throw new Error(`Permission denied for tool ${toolName} on server ${serverId}`);
    }

    // Vérifier que le serveur est en cours d'exécution
    let mcpProcess = this.processes.get(serverId);
    if (!mcpProcess) {
      // Démarrer le serveur si nécessaire
      await this.startServer(serverId);
      mcpProcess = this.processes.get(serverId);
      
      if (!mcpProcess) {
        throw new Error(`Failed to start server ${serverId}`);
      }
    }

    try {
      const result = await this.sendServerRequest(mcpProcess, 'tools/call', {
        name: toolName,
        arguments: args,
      });

      const toolResult = toToolResult(result);
      this.emit('tool:invoked', { serverId, toolName, result: toolResult });
      return toolResult;
    } catch (error) {
      console.error(`[MCPService] Tool invocation failed:`, error);
      throw error;
    }
  }

  /**
   * Découvre les tools disponibles sur un serveur
   */
  async discoverTools(serverId: string): Promise<MCPTool[]> {
    const mcpProcess = this.processes.get(serverId);
    if (!mcpProcess) {
      throw new Error(`Server ${serverId} not running`);
    }

    const response = await this.sendServerRequest(mcpProcess, 'tools/list', {});
    const tools = extractTools(response) ?? [];
    
    this.registry.updateServer(serverId, { tools });
    await this.registry.save();
    
    return tools;
  }

  /**
   * Accorde une permission pour un tool
   */
  async grantPermission(serverId: string, toolName: string, grantedBy?: string): Promise<void> {
    const key = `${serverId}:${toolName}`;
    
    const permission: MCPPermission = {
      serverId,
      toolName,
      granted: true,
      grantedAt: Date.now(),
      grantedBy,
    };
    
    this.permissions.set(key, permission);
    await this.savePermissions();
    
    this.emit('permission:granted', permission);
  }

  /**
   * Révoque une permission pour un tool
   */
  async revokePermission(serverId: string, toolName: string): Promise<void> {
    const key = `${serverId}:${toolName}`;
    this.permissions.delete(key);
    await this.savePermissions();
    
    this.emit('permission:revoked', { serverId, toolName });
  }

  /**
   * Liste toutes les permissions
   */
  getAllPermissions(): MCPPermission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Vérifie si un tool a la permission
   */
  hasPermission(serverId: string, toolName: string): boolean {
    const key = `${serverId}:${toolName}`;
    const permission = this.permissions.get(key);
    return permission?.granted === true;
  }

  /**
   * Liste tous les serveurs
   */
  getAllServers(): MCPServer[] {
    return this.registry.getAllServers();
  }

  /**
   * Récupère un serveur par ID
   */
  getServer(serverId: string): MCPServer | undefined {
    return this.registry.getServer(serverId);
  }

  /**
   * Désinstalle un serveur
   */
  async uninstallServer(serverId: string): Promise<void> {
    // Arrêter le serveur s'il tourne
    if (this.processes.has(serverId)) {
      await this.stopServer(serverId);
    }

    // Supprimer toutes les permissions associées
    const permsToDelete = Array.from(this.permissions.keys())
      .filter(key => key.startsWith(`${serverId}:`));
    
    for (const key of permsToDelete) {
      this.permissions.delete(key);
    }
    await this.savePermissions();

    // Supprimer le serveur du registry
    this.registry.deleteServer(serverId);
    await this.registry.save();

    this.emit('server:uninstalled', serverId);
  }

  /**
   * Nettoie tous les processus
   */
  async cleanup(): Promise<void> {
    const serverIds = Array.from(this.processes.keys());
    
    for (const serverId of serverIds) {
      try {
        await this.stopServer(serverId);
      } catch (error) {
        console.error(`[MCPService] Failed to stop server ${serverId}:`, error);
      }
    }

    this.removeAllListeners();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let mcpServiceInstance: MCPService | null = null;

/**
 * Récupère ou crée l'instance du service MCP
 */
export function getMCPService(): MCPService {
  if (!mcpServiceInstance) {
    mcpServiceInstance = new MCPService();
  }
  return mcpServiceInstance;
}

/**
 * Réinitialise l'instance du service MCP
 */
export async function resetMCPService(): Promise<void> {
  if (mcpServiceInstance) {
    await mcpServiceInstance.cleanup();
    mcpServiceInstance = null;
  }
}
