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
  /**
   * Vide = « tous les événements ». Le renderer n'a pas de raison de choisir entre
   * add / change / unlink : « quand les fichiers changent » veut dire les trois, et
   * le handler complète.
   */
  events: z.array(z.enum(['add', 'change', 'unlink'])),
  /**
   * Vide = « l'espace de travail actif ».
   *
   * Un chemin disque n'est pas au renderer de le fournir : main ne le lui envoie
   * délibérément pas, et exiger ici une valeur qu'il ne peut pas connaître rendait
   * la création d'automation impossible depuis l'UI. Le handler le résout.
   */
  workspacePath: z.string(),
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
  /** Vide = le défaut du provider. Quelqu'un qui n'a pas choisi de modèle en veut un. */
  model: z.string(),
  /**
   * Vide = le provider effectivement enregistré.
   *
   * Le renderer ne sait pas laquelle des clés stockées a réellement construit un
   * provider ; deviner ici produirait une automation qui échoue à son premier
   * déclenchement, des heures plus tard, sans personne pour le voir.
   */
  provider: z.union([
    z.enum(['openai', 'anthropic', 'openrouter', 'ollama', 'grok']),
    z.literal(''),
  ]),
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
  /** Vide = l'espace de travail actif, résolu par le handler. */
  workspaceId: z.string(),
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
