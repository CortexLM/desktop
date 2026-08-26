import { toolsForPolicy } from './autonomy';
import type { AgentMode, AutonomyLevel, ToolDefinition } from './types';

export const CODING_TOOLS: ToolDefinition[] = [
  {
    name: 'Read',
    description: 'Read a text file. Prefer this over Execute. Path must be absolute.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        offset: { type: 'number', description: '1-based start line' },
        limit: { type: 'number', description: 'Max lines to return' },
      },
      required: ['path'],
    },
  },
  {
    name: 'Create',
    description: 'Create or overwrite a file. Do not use Execute to write files.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        contents: { type: 'string' },
      },
      required: ['path', 'contents'],
    },
  },
  {
    name: 'Edit',
    description: 'Replace exactly one occurrence of old_string with new_string.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'ApplyPatch',
    description: 'Apply a unified diff or *** Begin Patch *** document.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        patch: { type: 'string', description: 'Unified diff or Begin Patch document' },
      },
      required: ['patch'],
    },
  },
  {
    name: 'Grep',
    description: 'Search file contents with a regular expression.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string', description: 'Absolute directory or file' },
        glob: { type: 'string' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'Glob',
    description: 'Find files by glob pattern from the workspace root.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string', description: 'Optional absolute start directory' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'LS',
    description: 'List a directory. Path must be absolute.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute directory path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'Execute',
    description:
      'Run a program, build, test, or install. Not for writing files (no cat, heredoc, sed -i, tee).',
    risk: 'exec',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        cwd: { type: 'string', description: 'Absolute working directory' },
      },
      required: ['command'],
    },
  },
  {
    name: 'Git',
    description: 'Read-only git helper (status, diff, log, branch). Writes go through Execute after permission.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        subcommand: { type: 'string', description: 'status | diff | log | branch' },
        args: { type: 'string' },
      },
      required: ['subcommand'],
    },
  },
  {
    name: 'TodoWrite',
    description: 'Replace or merge the session todo list. Exactly one item in_progress.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        merge: { type: 'boolean', description: 'If true, merge by id instead of replacing' },
        todos: { type: 'string', description: 'JSON array of {id,content,status}' },
      },
      required: ['todos'],
    },
  },
  {
    name: 'AskUser',
    description: 'Ask a blocking question. Use this instead of a plain-text question.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        options: { type: 'string', description: 'Optional JSON string array of choices' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'WebSearch',
    description: 'Search the public web and return titles and URLs.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'FetchUrl',
    description: 'Fetch an http(s) URL and return text. Not for file:// or secrets.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
      required: ['url'],
    },
  },
  {
    name: 'Task',
    description: 'Delegate to explorer, worker, or a named custom droid. No nested Task.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        subagent: { type: 'string', description: 'explorer | worker' },
        droid: { type: 'string', description: 'Custom droid name from .cortex/droids' },
        prompt: { type: 'string' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'Skill',
    description: 'Load a skill body by name. Skills are not inlined in the default prompt.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'ExitSpecMode',
    description: 'Leave spec mode by presenting a complete plan. Forbidden while Option A/B is unresolved.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        rationale: { type: 'string' },
        steps: { type: 'string', description: 'JSON array of step titles' },
        unresolved_choices: { type: 'boolean' },
      },
      required: ['title', 'steps'],
    },
  },
];

/** @deprecated Use SPEC_SAFE_TOOLS via toolsForPolicy. Kept for older imports. */
export const PLAN_SAFE_TOOLS = new Set([
  'Read',
  'read',
  'LS',
  'ls',
  'Grep',
  'grep',
  'Glob',
  'glob',
  'Git',
  'git',
  'TodoWrite',
  'todowrite',
  'AskUser',
  'question',
  'WebSearch',
  'FetchUrl',
  'webfetch',
  'Skill',
  'ExitSpecMode',
]);

export function filterTools(names?: string[]): ToolDefinition[] {
  if (!names || names.length === 0) return CODING_TOOLS;
  const allow = new Set(names.map((name) => name.toLowerCase()));
  return CODING_TOOLS.filter(
    (tool) => allow.has(tool.name.toLowerCase()) || allow.has(tool.name)
  );
}

export function toolsForMode(
  mode: AgentMode | undefined,
  tools: ToolDefinition[] = CODING_TOOLS,
  autonomy?: AutonomyLevel
): ToolDefinition[] {
  return toolsForPolicy(tools, { mode, autonomy });
}
