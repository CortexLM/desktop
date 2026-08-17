export const SESSION_SURFACES = [
  'git',
  'prs',
  'explorer',
  'terminal',
  'notes',
  'plans',
  'preview',
  'ai-chat',
  'browser',
] as const;

export type SessionSurface = (typeof SESSION_SURFACES)[number];

export const SESSION_SURFACE_LABEL: Record<SessionSurface, string> = {
  git: 'Changes',
  prs: 'PRs',
  explorer: 'Files',
  terminal: 'Terminal',
  notes: 'Notes',
  plans: 'Plans',
  preview: 'Preview',
  'ai-chat': 'Side chat',
  browser: 'Browser',
};
