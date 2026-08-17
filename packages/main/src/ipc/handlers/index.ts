/**
 * IPC Handlers Registry - Main Process
 *
 * Point d'entrée unique pour l'enregistrement des handlers IPC.
 * Chaque domaine expose son propre couple `register` / `unregister`, ce module
 * ne fait que les composer.
 */

import { registerFilesystemHandlers, unregisterFilesystemHandlers } from './filesystem-handlers';
import { registerEditorHandlers, unregisterEditorHandlers } from './editor-handlers';
import { registerGitHandlers, unregisterGitHandlers } from './git-handlers';
import { registerAIHandlers, unregisterAIHandlers } from './ai-handlers';
import { registerTerminalHandlers, unregisterTerminalHandlers } from './terminal-handlers';
import { registerDatabaseHandlers, unregisterDatabaseHandlers } from './database-handlers';
import { registerAutomationHandlers, unregisterAutomationHandlers } from './automation-handlers';
import { registerMCPHandlers, unregisterMCPHandlers } from './mcp-handlers';
import { registerUpdateHandlers, unregisterUpdateHandlers } from './update-handlers';
import { registerGitStashHandlers, unregisterGitStashHandlers } from './git-stash-handlers';
import { registerSearchHandlers, unregisterSearchHandlers } from './search-handlers';
import { registerWorkspaceHandlers, unregisterWorkspaceHandlers } from './workspace-handlers';
import { registerChatHandlers, unregisterChatHandlers } from './chat-handlers';
import { registerDebugHandlers, unregisterDebugHandlers } from './debug-handlers';
import { registerSettingsHandlers, unregisterSettingsHandlers } from './settings-handlers';
import { registerMissionHandlers, unregisterMissionHandlers } from './mission-handlers';
import { withIpcInstrumentation } from './shared/ipc-instrumentation';

/**
 * Un domaine de handlers IPC autonome
 */
export interface HandlerDomain {
  readonly name: string;
  readonly register: () => void;
  readonly unregister: () => void;
}

/**
 * Registre de tous les domaines de handlers.
 *
 * Ajouter un domaine se fait uniquement ici : aucun autre fichier n'a besoin
 * de changer.
 */
export const HANDLER_DOMAINS: readonly HandlerDomain[] = [
  {
    name: 'filesystem',
    register: registerFilesystemHandlers,
    unregister: unregisterFilesystemHandlers,
  },
  { name: 'editor', register: registerEditorHandlers, unregister: unregisterEditorHandlers },
  { name: 'git', register: registerGitHandlers, unregister: unregisterGitHandlers },
  { name: 'ai', register: registerAIHandlers, unregister: unregisterAIHandlers },
  { name: 'terminal', register: registerTerminalHandlers, unregister: unregisterTerminalHandlers },
  { name: 'database', register: registerDatabaseHandlers, unregister: unregisterDatabaseHandlers },
  {
    name: 'automation',
    register: registerAutomationHandlers,
    unregister: unregisterAutomationHandlers,
  },
  { name: 'mcp', register: registerMCPHandlers, unregister: unregisterMCPHandlers },
  { name: 'update', register: registerUpdateHandlers, unregister: unregisterUpdateHandlers },
  // Domaines servant les canaux de `window.ipc` / `window.electron` (git stash,
  // recherche avancée, workspaces, export de chat, panneau debug).
  {
    name: 'git-stash',
    register: registerGitStashHandlers,
    unregister: unregisterGitStashHandlers,
  },
  { name: 'search', register: registerSearchHandlers, unregister: unregisterSearchHandlers },
  {
    name: 'workspace',
    register: registerWorkspaceHandlers,
    unregister: unregisterWorkspaceHandlers,
  },
  { name: 'chat', register: registerChatHandlers, unregister: unregisterChatHandlers },
  { name: 'debug', register: registerDebugHandlers, unregister: unregisterDebugHandlers },
  // Réglages des providers AI. Domaine à part entière plutôt qu'un ajout dans
  // `ai-handlers` : c'est lui qui détient la clé d'API et la reconstruction du
  // registry, deux responsabilités qu'on veut pouvoir lire (et tester) seules.
  {
    name: 'settings',
    register: registerSettingsHandlers,
    unregister: unregisterSettingsHandlers,
  },
  {
    name: 'mission',
    register: registerMissionHandlers,
    unregister: unregisterMissionHandlers,
  },
];

/**
 * Enregistre tous les handlers IPC.
 *
 * L'enregistrement passe par `withIpcInstrumentation` : chaque handler est
 * enveloppé pour alimenter `ipcMonitor` et `performanceMonitor` (canal,
 * direction, durée, succès/échec — jamais les payloads). C'est le seul point
 * d'instrumentation, ce qui couvre tous les domaines y compris ceux qui
 * n'utilisent pas `createHandler`.
 */
export function registerIPCHandlers(): void {
  withIpcInstrumentation(() => {
    for (const domain of HANDLER_DOMAINS) {
      domain.register();
    }
  });

  console.log(`[IPC] All handlers registered (${HANDLER_DOMAINS.length} domains)`);
}

/**
 * Nettoie tous les handlers IPC.
 *
 * Chaque domaine est nettoyé indépendamment : l'échec de l'un n'empêche pas
 * les autres de se nettoyer.
 */
export function unregisterIPCHandlers(): void {
  for (const domain of HANDLER_DOMAINS) {
    try {
      domain.unregister();
    } catch (error) {
      console.error(`[IPC] Failed to unregister ${domain.name} handlers:`, error);
    }
  }

  console.log('[IPC] All handlers unregistered');
}

// ============================================================================
// Ré-exports publics
// ============================================================================

export { ErrorCode, getErrorCode } from './shared/error-codes';
export { createHandler, toErrorResponse } from './shared/handler-factory';
export { detectLanguage } from './shared/language';

export * from './filesystem-handlers';
export * from './editor-handlers';
export * from './git-handlers';
export * from './ai-handlers';
export * from './database-handlers';
export * from './automation-handlers';
export * from './mcp-handlers';
export * from './update-handlers';
export * from './git-stash-handlers';
export * from './search-handlers';
export * from './workspace-handlers';
export * from './chat-handlers';
export * from './debug-handlers';
export * from './settings-handlers';
export { registerTerminalHandlers, unregisterTerminalHandlers } from './terminal-handlers';
export { registerAIStreamHandler, cleanupAIStreamHandler, abortStream } from './ai-stream-handler';
