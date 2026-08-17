/**
 * Tool definitions and dispatcher.
 *
 * These are the schemas advertised to the model for function calling, and the
 * validated entry point that routes a model-produced call to the manager.
 *
 * Arguments arrive from a language model, so they are untrusted: every field is
 * validated before it reaches the manager, and malformed input returns a
 * corrective message the agent can act on rather than throwing.
 */

import type { CATContextManager } from './context-manager';
import type {
  ContextToolDefinition,
  ContextToolName,
  ContextToolResult,
  ForgetContextArgs,
  GetMoreContextArgs,
  SearchCodebaseArgs,
  SummarizeContextArgs,
} from './types';

/**
 * The four context tools.
 *
 * Descriptions carry the usage policy, not just the mechanics: models call these
 * at the right moment far more reliably when the description says when to use it.
 */
export const CONTEXT_TOOL_DEFINITIONS: readonly ContextToolDefinition[] = [
  {
    name: 'get_more_context',
    description:
      'Fetch additional context for specific files or symbols. Use when the current context is ' +
      'insufficient to act with confidence. Set `depth` above 0 to also pull direct dependencies. ' +
      'Check your remaining token budget first; free space with forget_context or summarize_context ' +
      'if the budget is tight.',
    parameters: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to load into context.',
        },
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Symbol names (functions, classes) to resolve and load.',
        },
        depth: {
          type: 'integer',
          minimum: 0,
          maximum: 3,
          description: 'Dependency expansion depth. 0 = only the requested items.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'forget_context',
    description:
      'Remove irrelevant context to free tokens. Use as soon as you know an item does not matter ' +
      'for the task; this both reclaims budget and teaches the system what was not useful. ' +
      'Accepts item ids or file paths. Task semantics are pinned and cannot be removed.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Item ids or file paths to drop from context.',
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
  {
    name: 'summarize_context',
    description:
      'Compress old context into a compact summary that keeps file paths and symbol names. ' +
      'Call this at stage boundaries, once a phase of work is done, rather than waiting for the ' +
      'budget to run out. Summarized files can still be re-fetched with get_more_context.',
    parameters: {
      type: 'object',
      properties: {
        range: {
          type: 'array',
          items: { type: 'integer' },
          minItems: 2,
          maxItems: 2,
          description: 'Inclusive turn range to fold, as [startTurn, endTurn].',
        },
      },
      required: ['range'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_codebase',
    description:
      'Semantic search across the codebase. Use when you do not yet know which files matter. ' +
      'Prefer a narrow `limit` to avoid flooding the context window with weak matches.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to look for, in natural language or code terms.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'Maximum number of results to load. Defaults to 5.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
] as const;

/** True when `name` is one of the context tools. */
export function isContextToolName(name: string): name is ContextToolName {
  return CONTEXT_TOOL_DEFINITIONS.some((definition) => definition.name === name);
}

/** Look up a single definition. */
export function getContextToolDefinition(
  name: ContextToolName,
): ContextToolDefinition | undefined {
  return CONTEXT_TOOL_DEFINITIONS.find((definition) => definition.name === name);
}

/**
 * Route a validated tool call to the manager.
 *
 * Unknown tools and malformed arguments come back as failed results rather than
 * exceptions: the agent should see a correction and retry, not crash the turn.
 */
export async function dispatchContextTool(
  manager: CATContextManager,
  name: string,
  rawArgs: unknown,
): Promise<ContextToolResult> {
  if (!isContextToolName(name)) {
    return {
      tool: 'get_more_context',
      ok: false,
      message: `Unknown context tool "${name}". Available: ${CONTEXT_TOOL_DEFINITIONS.map((d) => d.name).join(', ')}.`,
      tokenDelta: 0,
      budget: manager.getBudget(),
      error: `unknown tool: ${name}`,
    };
  }

  const args = coerceArgsObject(rawArgs);

  if (!args) {
    return {
      tool: name,
      ok: false,
      message: 'Arguments must be a JSON object.',
      tokenDelta: 0,
      budget: manager.getBudget(),
      error: 'invalid arguments',
    };
  }

  switch (name) {
    case 'get_more_context':
      return manager.getMoreContext(parseGetMoreContext(args));
    case 'forget_context':
      return manager.forgetContext(parseForgetContext(args));
    case 'summarize_context':
      return manager.summarizeContext(parseSummarizeContext(args));
    case 'search_codebase':
      return manager.searchCodebase(parseSearchCodebase(args));
  }
}

/** Accept both an object and a JSON string, since providers differ. */
function coerceArgsObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return isPlainObject(raw) ? raw : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseGetMoreContext(args: Record<string, unknown>): GetMoreContextArgs {
  return {
    files: toStringArray(args.files),
    symbols: toStringArray(args.symbols),
    depth: typeof args.depth === 'number' ? args.depth : undefined,
  };
}

function parseForgetContext(args: Record<string, unknown>): ForgetContextArgs {
  return { items: toStringArray(args.items) ?? [] };
}

function parseSummarizeContext(args: Record<string, unknown>): SummarizeContextArgs {
  const range = args.range;

  if (
    Array.isArray(range) &&
    range.length === 2 &&
    typeof range[0] === 'number' &&
    typeof range[1] === 'number'
  ) {
    return { range: [range[0], range[1]] };
  }

  // Invalid shape reaches the manager, which returns the corrective message.
  return { range: range as SummarizeContextArgs['range'] };
}

function parseSearchCodebase(args: Record<string, unknown>): SearchCodebaseArgs {
  return {
    query: typeof args.query === 'string' ? args.query : '',
    limit: typeof args.limit === 'number' ? args.limit : undefined,
  };
}

/** Keep only string entries; drops junk without failing the whole call. */
function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const strings = value.filter((entry): entry is string => typeof entry === 'string');
  return strings.length > 0 ? strings : undefined;
}
