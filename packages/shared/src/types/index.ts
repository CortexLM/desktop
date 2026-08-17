// Types de base pour l'application

export interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  updatedAt: number;
  settings?: Record<string, any>;
}

export interface Session {
  id: string;
  workspaceId: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

export interface Mission {
  id: string;
  workspaceId: string;
  status: 'planning' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
  state: Record<string, any>;
}

export interface UsageLog {
  id: string;
  sessionId: string;
  provider: string;
  model: string;
  tokensInput: number;
  tokensOutput: number;
  cost: number;
  createdAt: number;
}

// `Automation`, `AutomationTrigger` et `AutomationAction` ne sont PAS définis ici.
//
// Ils l'étaient, sous une forme `{ type: 'file-watch', config: Record<string, any> }`
// qu'aucun consommateur n'utilisait : `automation-service`, `automation-repository`,
// les handlers IPC et les vues du renderer travaillent tous avec les unions
// discriminées de `./ipc/automation` (`'file_watch'` + champs typés), que
// `schemas/automation.ts` valide déjà à l'exécution.
//
// La forme `config: Record<string, any>` ne pouvait pas être validée sans perdre
// le typage, et faire coexister deux `Automation` homonymes obligeait
// `src/index.ts` à en masquer une. Source unique : `./ipc/automation`.

// Re-export debug types
export * from './debug';
