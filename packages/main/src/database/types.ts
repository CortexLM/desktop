/**
 * Database types for Cortex IDE
 * All TypeScript interfaces for database entities
 */

/**
 * Toute valeur représentable en JSON.
 *
 * Les colonnes `settings` / `metadata` / `state` sont stockées en TEXT sérialisé,
 * donc leur contenu est exactement ce que `JSON.parse` peut rendre. Typer ces
 * champs ainsi (plutôt qu'`any`) force les appelants à narrower avant usage, tout
 * en autorisant les clés supplémentaires que ces objets acceptent.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Workspace {
  id: string;
  name: string;
  path: string;
  created_at: number;
  updated_at: number;
  settings?: WorkspaceSettings;
}

export interface WorkspaceSettings {
  theme?: 'light' | 'dark';
  editor?: {
    fontSize?: number;
    tabSize?: number;
    wordWrap?: boolean;
  };
  git?: {
    autoFetch?: boolean;
    defaultBranch?: string;
  };
  [key: string]: JsonValue | undefined;
}

export interface Session {
  id: string;
  workspace_id: string | null;
  title: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
  metadata?: SessionMetadata;
}

export interface SessionMetadata {
  provider?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  [key: string]: JsonValue | undefined;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: number;
  metadata?: MessageMetadata;
}

export interface ToolCallRecord {
  id?: string;
  name: string;
  arguments?: JsonValue;
  result?: JsonValue;
}

export interface MessageMetadata {
  toolCalls?: ToolCallRecord[];
  attachments?: string[];
  tokens?: {
    input?: number;
    output?: number;
  };
  [key: string]: JsonValue | ToolCallRecord[] | undefined;
}

export interface Mission {
  id: string;
  workspace_id: string | null;
  status: 'planning' | 'running' | 'paused' | 'completed' | 'failed';
  created_at: number;
  updated_at: number;
  state: MissionState;
}

export interface MissionState {
  name?: string;
  description?: string;
  steps?: MissionStep[];
  currentStep?: number;
  error?: string;
  result?: JsonValue;
  [key: string]: JsonValue | MissionStep[] | undefined;
}

export interface MissionStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  result?: JsonValue;
  error?: string;
}

export interface UsageLog {
  id: string;
  session_id: string | null;
  provider: string;
  model: string;
  tokens_input: number | null;
  tokens_output: number | null;
  cost: number | null;
  created_at: number;
}

export interface Automation {
  id: string;
  workspace_id: string | null;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  created_at: number;
  updated_at: number;
}

export interface AutomationTrigger {
  type: 'file_watch' | 'git_hook' | 'schedule' | 'manual';
  config: {
    pattern?: string;
    event?: string;
    cron?: string;
    [key: string]: JsonValue | undefined;
  };
}

export interface AutomationAction {
  type: 'run_script' | 'ai_task' | 'git_operation' | 'notification';
  config: {
    script?: string;
    command?: string;
    message?: string;
    [key: string]: JsonValue | undefined;
  };
}

export interface SchemaVersion {
  version: number;
  applied_at: number;
  description: string | null;
}

/**
 * Database row types (as returned from SQLite)
 * These use numeric booleans and JSON strings
 */
export interface WorkspaceRow {
  id: string;
  name: string;
  path: string;
  created_at: number;
  updated_at: number;
  settings: string | null;
}

export interface SessionRow {
  id: string;
  workspace_id: string | null;
  title: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
  metadata: string | null;
}

export interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: number;
  metadata: string | null;
}

export interface MissionRow {
  id: string;
  workspace_id: string | null;
  status: string;
  created_at: number;
  updated_at: number;
  state: string;
}

export interface UsageLogRow {
  id: string;
  session_id: string | null;
  provider: string;
  model: string;
  tokens_input: number | null;
  tokens_output: number | null;
  cost: number | null;
  created_at: number;
}

export interface AutomationRow {
  id: string;
  workspace_id: string | null;
  name: string;
  enabled: number;
  trigger: string;
  actions: string;
  created_at: number;
  updated_at: number;
}

export interface SchemaVersionRow {
  version: number;
  applied_at: number;
  description: string | null;
}
