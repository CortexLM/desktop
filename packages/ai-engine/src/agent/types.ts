/** Shared types for the Cortex coding-agent loop. */

export type AgentMode = 'agent' | 'plan' | 'mission' | 'ask';

export type AutonomyLevel = 'off' | 'low' | 'medium' | 'high';

export type AgentRuntime = 'interactive' | 'headless';

export type ToolRisk = 'safe' | 'write' | 'exec';

export type PermissionDecision = 'allow-once' | 'allow-always' | 'deny';

export type PermissionAction = 'allow' | 'ask' | 'deny';

export interface PermissionRule {
  action: PermissionAction;
  /** Tool name or `*`. */
  tool: string;
  /** Glob matched against path or command. */
  pattern?: string;
  /** Optional agent / droid name this rule applies to. */
  agent?: string;
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  /**
   * On an assistant message: the tool calls it made. Kept on the transcript so
   * the next completion request can replay them natively. Without them the model
   * sees an empty assistant message followed by a result it never asked for — and
   * a model with no memory of having called the tool calls it again, forever.
   */
  toolCalls?: ToolCall[];
  /** On a tool message: the call this result answers. Pairs result to request. */
  toolCallId?: string;
}

export interface AgentToolParameterSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  risk: ToolRisk;
  parameters: AgentToolParameterSchema;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  output: string;
  additions?: number;
  deletions?: number;
}

export interface PermissionRequest {
  id: string;
  tool: string;
  risk: ToolRisk;
  summary: string;
  detail?: string;
  path?: string;
  agent?: string;
}

export interface PlanStep {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'done' | 'skipped';
}

export interface AgentPlan {
  title: string;
  rationale: string;
  steps: PlanStep[];
  approved: boolean;
  /** Required in plan mode: a mermaid flowchart or sequenceDiagram fence. */
  mermaid?: string;
}

export type TaskKind = 'explore' | 'plan' | 'worker';

export interface TaskPayload {
  id: string;
  summary: string;
  artifact_id?: string;
}

export type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool_start'; id: string; name: string; title: string; detail?: string }
  | {
      type: 'tool_end';
      id: string;
      name: string;
      ok: boolean;
      output: string;
      additions?: number;
      deletions?: number;
      durationMs: number;
    }
  | { type: 'permission'; request: PermissionRequest }
  | { type: 'question'; id: string; prompt: string; options?: string[] }
  | { type: 'plan'; plan: AgentPlan }
  | { type: 'task_started'; id: string; summary: string }
  | { type: 'task_progress'; id: string; summary: string }
  | { type: 'task_completed'; id: string; summary: string; artifact_id?: string }
  | { type: 'task_failed'; id: string; summary: string }
  | { type: 'context_full'; tokens: number; limit: number }
  | { type: 'done'; finishReason?: string }
  | { type: 'error'; message: string };

export interface PermissionGate {
  decide(request: PermissionRequest): Promise<PermissionDecision>;
}

export interface QuestionGate {
  ask(id: string, prompt: string, options?: string[]): Promise<string>;
}

export interface ToolExecutor {
  execute(call: ToolCall): Promise<ToolResult>;
}

export interface ChatCompletion {
  content: string;
  toolCalls?: ToolCall[];
}

export type ChatFn = (messages: AgentMessage[]) => Promise<ChatCompletion>;

export interface RunAgentTurnOptions {
  messages: AgentMessage[];
  chat: ChatFn;
  tools: ToolDefinition[];
  executor: ToolExecutor;
  permissions: PermissionGate;
  systemPrompt: string;
  mode?: AgentMode;
  autonomy?: AutonomyLevel;
  runtime?: AgentRuntime;
  agentName?: string;
  delegationDepth?: number;
  questions?: QuestionGate;
  abortSignal?: AbortSignal;
  maxIterations?: number;
  contextTokens?: number;
  contextLimit?: number;
  onMessages?: (messages: AgentMessage[]) => void;
  /** Oversized tool output is offloaded here; Read/Grep page by artifact_id. */
  artifacts?: ArtifactHost;
  /** Parent-owned background Task children. Absent: Task cannot spawn. */
  tasks?: TaskHost;
  taskTimeoutMs?: number;
}

export interface ArtifactStub {
  output: string;
  artifact_id?: string;
}

export interface ArtifactHost {
  offload(tool: string, output: string): ArtifactStub;
  readPage(id: string, offset?: number, limit?: number): string | undefined;
  grep(id: string, pattern: string): string | undefined;
  ids(): string[];
}

export interface TaskSpawnRequest {
  kind: TaskKind;
  prompt: string;
  callId: string;
}

export interface TaskHost {
  spawn(request: TaskSpawnRequest): TaskPayload;
  cancel(id: string): void;
  cancelAll(): void;
  drain(): AgentEvent[];
  openIds(): string[];
  waitOpen(): Promise<void>;
}

export interface DroidDefinition {
  name: string;
  description: string;
  model?: string;
  tools?: string[];
  systemPrompt: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  body: string;
}

export interface FileSnapshot {
  path: string;
  content: string;
}

export interface Checkpoint {
  id: string;
  createdAt: number;
  label: string;
  messages: AgentMessage[];
  files?: FileSnapshot[];
}

export interface AgentSessionRecord {
  id: string;
  parentId?: string;
  title: string;
  providerId: string;
  model?: string;
  workspacePath?: string;
  mode: AgentMode;
  autonomy?: AutonomyLevel;
  runtime?: AgentRuntime;
  agentName?: string;
  messages: AgentMessage[];
  todos: TodoItem[];
  openArtifactIds?: string[];
  openTaskIds?: string[];
  activePlan?: AgentPlan;
  createdAt: number;
  updatedAt: number;
}
