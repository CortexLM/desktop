/**
 * Types IPC - Automations
 */

export type TriggerType = 'file_watch' | 'git_hook' | 'schedule' | 'manual';
export type ActionType = 'run_script' | 'ai_task' | 'git_operation' | 'notification';
export type AutomationStatus = 'idle' | 'running' | 'success' | 'error';

// ============================================================================
// Triggers
// ============================================================================

export interface FileTrigger {
  type: 'file_watch';
  patterns: string[];
  events: ('add' | 'change' | 'unlink')[];
  workspacePath: string;
}

export interface GitTrigger {
  type: 'git_hook';
  hook: 'pre-commit' | 'post-commit' | 'pre-push' | 'post-merge';
  repoPath: string;
}

export interface ScheduleTrigger {
  type: 'schedule';
  cron: string;
  timezone?: string;
}

export interface ManualTrigger {
  type: 'manual';
}

export type Trigger = FileTrigger | GitTrigger | ScheduleTrigger | ManualTrigger;

// ============================================================================
// Actions
// ============================================================================

export interface ScriptAction {
  type: 'run_script';
  script: string;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
}

export type AIProviderName = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'grok';

export interface AITaskAction {
  type: 'ai_task';
  prompt: string;
  /**
   * Le modèle, ou vide pour laisser le provider appliquer son défaut.
   *
   * Vide n'existe qu'en transit : `automation-handlers` le résout avant que le
   * service ne voie la requête, donc une automation stockée en a toujours un.
   */
  model: string;
  /**
   * Le provider, ou vide pour « celui qui est réellement enregistré ».
   *
   * Le renderer ne sait pas laquelle des clés stockées a construit un provider, et
   * deviner produirait une automation qui échoue à son premier déclenchement, des
   * heures plus tard, sans personne pour le voir. Comme `model`, vide n'existe
   * qu'en transit.
   */
  provider: AIProviderName | '';
  context?: {
    files?: string[];
    workspacePath?: string;
  };
}

export interface GitOperationAction {
  type: 'git_operation';
  operation: 'commit' | 'push' | 'pull' | 'branch';
  repoPath: string;
  params?: Record<string, unknown>;
}

export interface NotificationAction {
  type: 'notification';
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
}

export type Action = ScriptAction | AITaskAction | GitOperationAction | NotificationAction;

// ============================================================================
// Entités
// ============================================================================

export interface Automation {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  actions: Action[];
  createdAt: number;
  updatedAt: number;
}

export interface AutomationLog {
  id: string;
  automationId: string;
  status: AutomationStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
  output?: string;
  actionResults: Array<{
    action: Action;
    status: 'success' | 'error';
    output?: string;
    error?: string;
    duration: number;
  }>;
}

// ============================================================================
// Requêtes / réponses
// ============================================================================

export interface CreateAutomationRequest {
  workspaceId: string;
  name: string;
  enabled: boolean;
  trigger: Trigger;
  actions: Action[];
}

export interface CreateAutomationResponse {
  automation: Automation;
}

export interface UpdateAutomationRequest {
  id: string;
  name?: string;
  enabled?: boolean;
  trigger?: Trigger;
  actions?: Action[];
}

export interface UpdateAutomationResponse {
  automation: Automation;
}

export interface DeleteAutomationRequest {
  id: string;
}

export interface DeleteAutomationResponse {
  success: boolean;
}

export interface ListAutomationsRequest {
  workspaceId?: string;
}

export interface ListAutomationsResponse {
  automations: Automation[];
}

export interface GetAutomationRequest {
  id: string;
}

export interface GetAutomationResponse {
  automation: Automation;
}

export interface RunAutomationRequest {
  id: string;
  triggerData?: unknown;
}

export interface RunAutomationResponse {
  log: AutomationLog;
}

export interface GetAutomationLogsRequest {
  automationId: string;
  limit?: number;
}

export interface GetAutomationLogsResponse {
  logs: AutomationLog[];
}

export interface ToggleAutomationRequest {
  id: string;
  enabled: boolean;
}

export interface ToggleAutomationResponse {
  automation: Automation;
}

// ============================================================================
// Événements (main -> renderer)
//
// Payloads émis par `AutomationService`. Typés ici pour que le préload exposant
// `onStarted` / `onCompleted` / `onFailed` / `onNotification` n'ait pas à
// retomber sur `any`.
// ============================================================================

export interface AutomationStartedEvent {
  automation: Automation;
  log: AutomationLog;
}

export interface AutomationCompletedEvent {
  automation: Automation;
  log: AutomationLog;
}

export interface AutomationFailedEvent {
  automation: Automation;
  log: AutomationLog;
  /** Sérialisé à travers la frontière IPC : le message, pas l'instance Error. */
  error: string;
}

export type NotificationLevel = 'info' | 'warning' | 'error' | 'success';

export interface AutomationNotificationEvent {
  title: string;
  message: string;
  level: NotificationLevel;
}
