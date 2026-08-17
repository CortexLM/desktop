/**
 * Zod Schemas - Automation
 */

import { z } from 'zod';

// ============================================================================
// Trigger Schemas
// ============================================================================

const FileTriggerSchema = z.object({
  type: z.literal('file_watch'),
  patterns: z.array(z.string()).min(1, 'At least one pattern is required'),
  events: z.array(z.enum(['add', 'change', 'unlink'])).min(1, 'At least one event is required'),
  workspacePath: z.string().min(1, 'Workspace path is required'),
});

const GitTriggerSchema = z.object({
  type: z.literal('git_hook'),
  hook: z.enum(['pre-commit', 'post-commit', 'pre-push', 'post-merge']),
  repoPath: z.string().min(1, 'Repository path is required'),
});

const ScheduleTriggerSchema = z.object({
  type: z.literal('schedule'),
  cron: z.string().min(1, 'Cron expression is required'),
  timezone: z.string().optional(),
});

const ManualTriggerSchema = z.object({
  type: z.literal('manual'),
});

export const TriggerSchema = z.discriminatedUnion('type', [
  FileTriggerSchema,
  GitTriggerSchema,
  ScheduleTriggerSchema,
  ManualTriggerSchema,
]);

// ============================================================================
// Action Schemas
// ============================================================================

const ScriptActionSchema = z.object({
  type: z.literal('run_script'),
  script: z.string().min(1, 'Script is required'),
  shell: z.string().optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

const AITaskActionSchema = z.object({
  type: z.literal('ai_task'),
  prompt: z.string().min(1, 'Prompt is required'),
  model: z.string().min(1, 'Model is required'),
  provider: z.enum(['openai', 'anthropic', 'openrouter', 'ollama', 'grok']),
  context: z.object({
    files: z.array(z.string()).optional(),
    workspacePath: z.string().optional(),
  }).optional(),
});

const GitOperationActionSchema = z.object({
  type: z.literal('git_operation'),
  operation: z.enum(['commit', 'push', 'pull', 'branch']),
  repoPath: z.string().min(1, 'Repository path is required'),
  params: z.record(z.unknown()).optional(),
});

const NotificationActionSchema = z.object({
  type: z.literal('notification'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  level: z.enum(['info', 'warning', 'error', 'success']),
});

export const ActionSchema = z.discriminatedUnion('type', [
  ScriptActionSchema,
  AITaskActionSchema,
  GitOperationActionSchema,
  NotificationActionSchema,
]);

// ============================================================================
// Automation Schemas
// ============================================================================

export const CreateAutomationRequestSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean(),
  trigger: TriggerSchema,
  actions: z.array(ActionSchema).min(1, 'At least one action is required'),
});

export const UpdateAutomationRequestSchema = z.object({
  id: z.string().min(1, 'Automation ID is required'),
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  trigger: TriggerSchema.optional(),
  actions: z.array(ActionSchema).min(1).optional(),
});

export const DeleteAutomationRequestSchema = z.object({
  id: z.string().min(1, 'Automation ID is required'),
});

export const ListAutomationsRequestSchema = z.object({
  workspaceId: z.string().optional(),
});

export const GetAutomationRequestSchema = z.object({
  id: z.string().min(1, 'Automation ID is required'),
});

export const RunAutomationRequestSchema = z.object({
  id: z.string().min(1, 'Automation ID is required'),
  triggerData: z.unknown().optional(),
});

export const GetAutomationLogsRequestSchema = z.object({
  automationId: z.string().min(1, 'Automation ID is required'),
  limit: z.number().int().positive().optional(),
});

export const ToggleAutomationRequestSchema = z.object({
  id: z.string().min(1, 'Automation ID is required'),
  enabled: z.boolean(),
});
