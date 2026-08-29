/** Canonical Factory-shaped tool names and lowercase aliases. */

export const TOOL_ALIASES: Record<string, string> = {
  read: 'Read',
  create: 'Create',
  write: 'Create',
  edit: 'Edit',
  applypatch: 'ApplyPatch',
  apply_patch: 'ApplyPatch',
  grep: 'Grep',
  glob: 'Glob',
  ls: 'LS',
  execute: 'Execute',
  bash: 'Execute',
  todowrite: 'TodoWrite',
  askuser: 'AskUser',
  question: 'AskUser',
  websearch: 'WebSearch',
  fetchurl: 'FetchUrl',
  webfetch: 'FetchUrl',
  task: 'Task',
  skill: 'Skill',
  exitspecmode: 'ExitSpecMode',
  git: 'Git',
};

export function canonicalToolName(name: string): string {
  if (TOOL_ALIASES[name]) return TOOL_ALIASES[name];
  const folded = name.toLowerCase().replace(/[\s-]/g, '');
  return TOOL_ALIASES[folded] ?? name;
}

export const MUTATE_TOOLS = new Set([
  'Create',
  'Edit',
  'ApplyPatch',
  'Execute',
]);

export const SPEC_SAFE_TOOLS = new Set([
  'Read',
  'LS',
  'Grep',
  'Glob',
  'Git',
  'TodoWrite',
  'AskUser',
  'WebSearch',
  'FetchUrl',
  'Skill',
  'ExitSpecMode',
]);

export const EXPLORER_TOOLS = new Set(['Read', 'LS', 'Grep', 'Glob']);

/** Plan-mode children: read tools plus the spec exit. */
export const PLAN_CHILD_TOOLS = new Set([...EXPLORER_TOOLS, 'AskUser', 'ExitSpecMode', 'TodoWrite']);
