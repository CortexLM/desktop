/**
 * Context-as-a-Tool (CAT) core types.
 *
 * Based on "Context as a Tool: Context Management for Long-Horizon SWE-Agents"
 * (arXiv:2512.22087). The central idea: context maintenance is not passive
 * preprocessing, it is a set of callable tools the agent invokes deliberately,
 * plus a learnable policy over when to invoke them.
 *
 * The workspace is structured into three tiers (paper section: structured workspace):
 *  - `task`       : task semantics. Goal, constraints, acceptance criteria.
 *                   Never evicted automatically; this is what the agent is doing.
 *  - `long-term`  : durable knowledge. Folded summaries, architectural facts.
 *                   Survives compression cycles.
 *  - `short-term` : working memory. Raw file bodies, tool output, search hits.
 *                   The primary eviction and folding target.
 */

/** Workspace tier an item belongs to. */
export type ContextTier = 'task' | 'long-term' | 'short-term';

/** Provenance of a context item, used by the learner to score sources. */
export type ContextSource =
  | 'task-spec'
  | 'explicit-fetch'
  | 'search-result'
  | 'dependency-expansion'
  | 'summary'
  | 'tool-output';

/**
 * A single addressable unit of context.
 *
 * `tokens` is stored rather than recomputed so budget math stays O(1) and
 * remains stable even if the counter implementation changes mid-session.
 */
export interface ContextItem {
  id: string;
  content: string;
  tokens: number;
  tier: ContextTier;
  source: ContextSource;
  /** File this item came from, when applicable. Drives per-file learning. */
  filePath?: string;
  /** Symbols (functions, classes) contained in or requested for this item. */
  symbols?: string[];
  /** Turn index at which the item entered the workspace. */
  addedAtTurn: number;
  /** Turn index of the most recent recorded use. Undefined if never used. */
  lastUsedAtTurn?: number;
  /** Number of times the agent signalled this item as useful. */
  useCount: number;
  /**
   * Pinned items are exempt from automatic eviction and folding. The agent can
   * pin, but `task` tier is pinned implicitly: losing the goal is unrecoverable.
   */
  pinned: boolean;
  /** Ids of items folded into this one, when `source === 'summary'`. */
  foldedFrom?: string[];
}

/**
 * Budget snapshot exposed to the agent so it can reason about its own limits.
 *
 * `usable` excludes the output reservation: an agent that fills the window to
 * `max` has no room left to answer, which is a silent failure mode.
 */
export interface BudgetSnapshot {
  max: number;
  reservedForOutput: number;
  usable: number;
  used: number;
  remaining: number;
  /** Fraction of `usable` consumed, 0..1+. */
  utilization: number;
  pressure: BudgetPressure;
  byTier: Record<ContextTier, number>;
  /** True when a fetch of typical size would not fit. */
  needsRelief: boolean;
}

/**
 * Coarse pressure signal. Thresholds are on utilization of `usable`.
 * Agents respond better to a named state than to a raw float.
 */
export type BudgetPressure = 'low' | 'moderate' | 'high' | 'critical';

/** The four callable context tools. */
export type ContextToolName =
  | 'get_more_context'
  | 'forget_context'
  | 'summarize_context'
  | 'search_codebase';

/** JSON-Schema-ish parameter descriptor for provider tool advertisement. */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

/** A tool definition in the shape providers expect for function calling. */
export interface ContextToolDefinition {
  name: ContextToolName;
  description: string;
  parameters: ToolParameterSchema;
}

/** Arguments for `get_more_context`. */
export interface GetMoreContextArgs {
  files?: string[];
  symbols?: string[];
  /** Dependency expansion depth. 0 = requested items only. */
  depth?: number;
}

/** Arguments for `forget_context`. */
export interface ForgetContextArgs {
  /** Item ids or file paths to drop. */
  items: string[];
}

/** Arguments for `summarize_context`. */
export interface SummarizeContextArgs {
  /** Inclusive turn range `[startTurn, endTurn]` to fold. */
  range: [number, number];
}

/** Arguments for `search_codebase`. */
export interface SearchCodebaseArgs {
  query: string;
  limit?: number;
}

/** Result of a single context tool invocation. */
export interface ContextToolResult {
  tool: ContextToolName;
  ok: boolean;
  /** Human-readable summary the agent reads back as tool output. */
  message: string;
  /** Net token change to the workspace. Negative means tokens were freed. */
  tokenDelta: number;
  /** Budget state after the operation, so the agent always sees fresh limits. */
  budget: BudgetSnapshot;
  /** Ids added by this call, if any. */
  addedItemIds?: string[];
  /** Ids removed by this call, if any. */
  removedItemIds?: string[];
  /** Populated when `ok` is false. */
  error?: string;
}

/** A retrieval hit from the codebase provider. */
export interface CodebaseSearchHit {
  filePath: string;
  content: string;
  /** Relevance in 0..1. Used for ranking and for learner feedback. */
  score: number;
  symbols?: string[];
  startLine?: number;
  endLine?: number;
}

/**
 * Pluggable codebase access. Kept minimal and injectable so the CAT layer is
 * testable without a real index, and so it can sit on top of any retriever
 * (embedding search, dependency graph walk, ripgrep).
 */
export interface CodebaseProvider {
  /** Semantic or lexical search over the repository. */
  search(query: string, limit: number): Promise<CodebaseSearchHit[]>;
  /** Read a file body. Returns null when the path is unknown. */
  readFile(filePath: string): Promise<string | null>;
  /** Resolve a symbol to its definition site. */
  findSymbol?(symbol: string): Promise<CodebaseSearchHit | null>;
  /** Direct dependencies of a file, used for depth expansion. */
  getDependencies?(filePath: string, depth: number): Promise<string[]>;
}

/** Records whether a piece of context contributed to progress. */
export interface UsageObservation {
  itemId: string;
  filePath?: string;
  source: ContextSource;
  turn: number;
  /** True when the agent referenced this item while making progress. */
  useful: boolean;
}

/**
 * What the learner believes about a file, accumulated across observations.
 * `hitRate` is the smoothed useful-fraction; raw fractions overreact to a
 * single observation.
 */
export interface FileUsageStats {
  filePath: string;
  fetches: number;
  usefulHits: number;
  hitRate: number;
  lastSeenTurn: number;
}

/** A predicted-useful context target with the reason for the prediction. */
export interface ContextPrediction {
  filePath: string;
  confidence: number;
  reason: string;
}

/** Metrics used to evaluate context quality, including in A/B tests. */
export interface ContextMetrics {
  /** Tokens currently held. */
  totalTokens: number;
  /** Tokens held by items with at least one recorded use. */
  usefulTokens: number;
  /**
   * `usefulTokens / totalTokens`, 0..1. The headline quality number: how much
   * of the window is earning its keep.
   */
  precision: number;
  /** Count of items never used and not pinned. */
  deadItems: number;
  /** Tool invocations by name. */
  toolCalls: Record<ContextToolName, number>;
  /** Tokens reclaimed by forget + summarize over the session. */
  tokensReclaimed: number;
  /** Times the workspace exceeded its usable budget. */
  overflowEvents: number;
}
