import type { ToolDefinition } from './types';

export const CODING_TOOLS: ToolDefinition[] = [
  {
    name: 'read',
    description: 'Read a text file from the workspace. Use offset/limit for large files.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the workspace root' },
        offset: { type: 'number', description: '1-based start line' },
        limit: { type: 'number', description: 'Max lines to return' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write',
    description: 'Create or overwrite a file with the given contents.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        contents: { type: 'string' },
      },
      required: ['path', 'contents'],
    },
  },
  {
    name: 'edit',
    description: 'Replace one exact occurrence of old_string with new_string in a file.',
    risk: 'write',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'grep',
    description: 'Search file contents with a regular expression.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        path: { type: 'string', description: 'Directory or file to search' },
        glob: { type: 'string' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'glob',
    description: 'Find files by glob pattern from the workspace root.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'bash',
    description: 'Run a shell command in the workspace. Prefer non-interactive commands.',
    risk: 'exec',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        cwd: { type: 'string' },
      },
      required: ['command'],
    },
  },
  {
    name: 'git',
    description: 'Run a read-oriented git command (status, diff, log, branch). Writes go through bash after permission.',
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
    name: 'task',
    description: 'Delegate a focused subtask to a named droid with a fresh context.',
    risk: 'safe',
    parameters: {
      type: 'object',
      properties: {
        droid: { type: 'string', description: 'Droid name from .cortex/droids or .factory/droids' },
        prompt: { type: 'string' },
      },
      required: ['droid', 'prompt'],
    },
  },
];

export function filterTools(names?: string[]): ToolDefinition[] {
  if (!names || names.length === 0) return CODING_TOOLS;
  const allow = new Set(names);
  return CODING_TOOLS.filter((tool) => allow.has(tool.name));
}
