export const SPEC_MODE_REMINDER = `Spec mode is active. Do NOT edit files, run mutating commands, or otherwise change the workspace until the user approves. MUTATE tools are stripped. Read-only tools remain available. Present the plan by calling ExitSpecMode with a mermaid fence (flowchart or sequenceDiagram). Use AskUser among viable approaches. Do NOT ExitSpecMode with unresolved Option A/B. Call ExitSpecMode before any write.`;

export function wrapSystemReminder(body: string): string {
  return `<system-reminder>\n${body.trim()}\n</system-reminder>`;
}

export function isSystemReminder(text: string): boolean {
  return /<system-reminder>[\s\S]*<\/system-reminder>/.test(text);
}
