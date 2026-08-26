import { canonicalToolName, MUTATE_TOOLS, SPEC_SAFE_TOOLS } from './tool-names';
import type { AgentMode, AgentRuntime, AutonomyLevel, ToolDefinition } from './types';

export type { AgentRuntime, AutonomyLevel };

export const DEFAULT_AUTONOMY: Record<AgentRuntime, AutonomyLevel> = {
  interactive: 'medium',
  headless: 'off',
};

const BLOCKLIST = [
  /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f\s+(\/|\~|\$HOME)\b/,
  /\bgit\s+push\b[^\n]*--force/,
  /\bgit\s+push\b[^\n]*-f\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bdrop\s+(table|database)\b/i,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bchmod\s+-R\s+777\b/,
  /\b(curl|wget)\b[^\n]*\|\s*(ba)?sh\b/,
  /\bshutdown\b/,
  /\bmkfs\./,
];

/** File-content writes via the shell — dedicated Create/Edit/ApplyPatch must be used. */
const SHELL_FILE_WRITE = [
  /\bsed\s+[^\n]*-i\b/,
  /\bperl\s+[^\n]*-i\b/,
  /\btee\b/,
  /<<\s*['"]?\w+/,
  /\bcat\b[\s\S]*[>|]/,
  /(?:echo|printf)\b[\s\S]*>/,
  /\bawk\b[^\n]*inplace/,
];

const OFF_EXECUTE = /^(git\s+(status|diff|log|branch|show)\b|ls\b|pwd\b|true\b|false\b)/;

const LOW_EXECUTE =
  /\b(test|lint|typecheck|tsc|vitest|eslint|prettier --check|bun run (test|typecheck|lint))\b/;

const MEDIUM_EXECUTE =
  /\b(install|ci|build|compile|commit|mv\b|cp\b|mkdir\b|bun add|npm i|pnpm (i|add)|yarn add)\b/;

export function isBlockedCommand(command: string): boolean {
  return BLOCKLIST.some((pattern) => pattern.test(command));
}

export function isForbiddenShellWrite(command: string): boolean {
  return SHELL_FILE_WRITE.some((pattern) => pattern.test(command));
}

export function executeBand(command: string): 'blocked' | 'off' | 'low' | 'medium' | 'high' {
  if (isBlockedCommand(command) || isForbiddenShellWrite(command)) return 'blocked';
  const trimmed = command.trim();
  if (OFF_EXECUTE.test(trimmed)) return 'off';
  if (LOW_EXECUTE.test(trimmed)) return 'low';
  if (MEDIUM_EXECUTE.test(trimmed)) return 'medium';
  return 'high';
}

export function autonomyAllowsExecute(level: AutonomyLevel, command: string): boolean {
  const band = executeBand(command);
  if (band === 'blocked') return false;
  if (level === 'off') return band === 'off';
  if (level === 'low') return band === 'off' || band === 'low';
  if (level === 'medium') return band !== 'high';
  return true;
}

export function toolsForPolicy(
  tools: ToolDefinition[],
  options: { mode?: AgentMode; autonomy?: AutonomyLevel }
): ToolDefinition[] {
  const autonomy = options.autonomy ?? 'medium';
  const spec = options.mode === 'plan' || options.mode === 'ask';

  return tools.filter((tool) => {
    const name = canonicalToolName(tool.name);
    if (spec && !SPEC_SAFE_TOOLS.has(name) && MUTATE_TOOLS.has(name)) {
      return false;
    }
    if (autonomy === 'off' && MUTATE_TOOLS.has(name) && name !== 'Execute') {
      return false;
    }
    return true;
  });
}

export function resolveAutonomy(
  runtime: AgentRuntime | undefined,
  autonomy?: AutonomyLevel
): AutonomyLevel {
  if (autonomy) return autonomy;
  return DEFAULT_AUTONOMY[runtime ?? 'interactive'];
}
