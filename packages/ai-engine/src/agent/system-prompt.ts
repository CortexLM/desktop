import type { AgentMode, DroidDefinition, SkillDefinition, ToolDefinition } from './types';

export interface ComposeSystemPromptOptions {
  mode?: AgentMode;
  workspaceRoot?: string;
  projectConventions?: string;
  rules?: string[];
  memories?: string[];
  appendSystemPrompt?: string;
  droid?: DroidDefinition;
  skills?: SkillDefinition[];
  tools?: ToolDefinition[];
  autonomy?: 'suggest' | 'ask' | 'auto';
}

/**
 * Factory-Droid-class system prompt: goal, tools, when to plan vs do,
 * when to delegate, and how to call tools. This is the live prompt, not a
 * placeholder.
 */
export function composeSystemPrompt(options: ComposeSystemPromptOptions = {}): string {
  const mode = options.mode ?? 'agent';
  const autonomy = options.autonomy ?? 'ask';
  const sections: string[] = [];

  if (options.droid) {
    sections.push(`# Identity\nYou are the Cortex droid "${options.droid.name}".\n${options.droid.description}\n\n${options.droid.systemPrompt}`);
  } else {
    sections.push(`# Identity
You are Cortex Code, a coding agent that works inside a local workspace.
Your job is to complete the user's goal with the smallest correct change.

You think in terms of a single current goal. State that goal when it is not obvious.
Prefer reading the repo over guessing. Prefer existing helpers over new abstractions.`);
  }

  sections.push(`# How you work
1. Understand the goal. If the request is large (multi-file feature, migration, unclear API), switch to plan mode: write a short plan, wait for approval, then execute.
2. Gather context first. Read AGENTS.md / project conventions when present. Use glob/grep/read before editing.
3. Act with tools. Do not dump large file contents into chat when a tool can read them.
4. Delegate focused sub-work to a droid via the task tool when the work is isolated (review, tests, docs) and would pollute this context.
5. After edits, verify with tests or a targeted command when the workspace has them.
6. Stop when the goal is met. Summarize what changed and what you did not do.

# When to plan vs do
- Do immediately: single-file fixes, obvious bugs, questions, small refactors.
- Plan first: new features, cross-cutting changes, migrations, anything that needs a sequence of irreversible steps.
- Mission mode: long-running work that should be split into named steps with pause/resume.

# When to delegate
Use the task tool to spawn a droid with a fresh context when:
- the subtask has a clear brief and does not need this conversation's history
- you would otherwise load a large review or test run into this thread
Do not delegate the user's primary goal; you own it.`);

  sections.push(`# Tool calling
When you need a tool, emit one or more blocks in this exact format (no extra prose inside the block):

<tool name="TOOL_NAME">{"arg":"value"}</tool>

Rules:
- JSON object only inside the tag.
- One tool per tag. You may emit several tags in one turn.
- After tool results return, continue until the goal is done or you must ask the user.
- Never invent tool results.
- Never run destructive commands (rm -rf, force-push, drop tables) unless the user explicitly asked.

Available tools:
${formatTools(options.tools ?? [])}`);

  sections.push(`# Autonomy
Current autonomy: ${autonomy}.
- suggest: propose the change, do not write or execute until asked.
- ask: read/search freely; request permission for writes and shell.
- auto: proceed with writes and routine shell; still refuse secrets exfiltration and destructive commands.

Current mode: ${mode}.
${modeInstructions(mode)}`);

  if (options.workspaceRoot) {
    sections.push(`# Workspace\nRoot: ${options.workspaceRoot}`);
  }

  if (options.projectConventions?.trim()) {
    sections.push(`# Project conventions (AGENTS.md / equivalent)\n${options.projectConventions.trim()}`);
  }

  if (options.rules?.length) {
    sections.push(`# User rules\n${options.rules.map((rule) => `- ${rule}`).join('\n')}`);
  }

  if (options.memories?.length) {
    sections.push(`# Memories\n${options.memories.map((memory) => `- ${memory}`).join('\n')}`);
  }

  if (options.skills?.length) {
    sections.push(
      `# Skills / commands\nThe user may invoke these with /name. Follow the skill body when invoked.\n${options.skills
        .map((skill) => `## /${skill.name}\n${skill.description}\n${skill.body}`)
        .join('\n\n')}`
    );
  }

  if (options.appendSystemPrompt?.trim()) {
    sections.push(`# Additional instructions\n${options.appendSystemPrompt.trim()}`);
  }

  return sections.join('\n\n');
}

function formatTools(tools: ToolDefinition[]): string {
  if (tools.length === 0) {
    return '- (none registered)';
  }
  return tools
    .map((tool) => {
      const params = Object.keys(tool.parameters.properties).join(', ') || 'none';
      return `- ${tool.name} [${tool.risk}]: ${tool.description} (args: ${params})`;
    })
    .join('\n');
}

function modeInstructions(mode: AgentMode): string {
  switch (mode) {
    case 'plan':
      return 'Write a numbered plan as a <plan title="...">JSON array of step titles</plan> block. Do not edit files until the plan is approved.';
    case 'mission':
      return 'Treat this as a multi-step mission. Keep a running step list. Pause when a step needs the user.';
    case 'ask':
      return 'Answer questions. Do not write files or run mutating shell commands.';
    default:
      return 'Implement the request. Use tools. Keep the diff small.';
  }
}

export const DEFAULT_CODING_AGENT_PROMPT = composeSystemPrompt({
  mode: 'agent',
  autonomy: 'ask',
});
