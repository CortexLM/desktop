/** Shared types for the Cortex coding-agent loop. */

export type AgentMode = 'agent' | 'plan' | 'mission' | 'ask';

export type ToolRisk = 'safe' | 'write' | 'exec';

export type PermissionDecision = 'allow-once' | 'allow-always' | 'deny';

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
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
  | { type: 'plan'; plan: AgentPlan }
  | { type: 'context_full'; tokens: number; limit: number }
  | { type: 'done'; finishReason?: string }
  | { type: 'error'; message: string };

export interface PermissionGate {
  decide(request: PermissionRequest): Promise<PermissionDecision>;
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
  abortSignal?: AbortSignal;
  maxIterations?: number;
  contextTokens?: number;
  contextLimit?: number;
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

export interface Checkpoint {
  id: string;
  createdAt: number;
  label: string;
  messages: AgentMessage[];
}
