/**
 * CATContextManager: the four callable context operations plus the automatic
 * optimization policy that sits behind them.
 *
 * Every operation returns a fresh `BudgetSnapshot`, so the agent's next decision
 * is made against real numbers rather than a stale estimate. Operations are
 * budget-aware: a fetch that would overflow triggers relief (evict, then fold)
 * before it is refused, which is the behaviour that separates CAT from static
 * truncation.
 */

import { ContextBudgetManager, type BudgetManagerConfig } from './budget-manager';
import { ContextUsageLearner } from './usage-learner';
import { ContextWorkspace, type Summarizer } from './workspace';
import type {
  BudgetSnapshot,
  CodebaseProvider,
  CodebaseSearchHit,
  ContextItem,
  ContextMetrics,
  ContextPrediction,
  ContextToolName,
  ContextToolResult,
  ForgetContextArgs,
  GetMoreContextArgs,
  SearchCodebaseArgs,
  SummarizeContextArgs,
} from './types';

export interface CATContextManagerConfig extends BudgetManagerConfig {
  provider: CodebaseProvider;
  /** Token counter. Defaults to a ~4 chars/token heuristic. */
  countTokens?: (text: string) => number;
  /** Custom fold summarizer. */
  summarizer?: Summarizer;
  /** Reuse a learner across sessions to carry over learned patterns. */
  learner?: ContextUsageLearner;
  /**
   * Free space automatically when an operation would overflow, instead of
   * failing the call. On by default: an agent that cannot self-relieve stalls.
   */
  autoOptimize?: boolean;
  /** Max dependency expansion depth accepted from `get_more_context`. */
  maxDepth?: number;
}

/** Default heuristic, matching the package's existing ~4 chars/token estimate. */
function defaultCountTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class CATContextManager {
  private readonly budget: ContextBudgetManager;
  private readonly workspace: ContextWorkspace;
  private readonly learner: ContextUsageLearner;
  private readonly provider: CodebaseProvider;
  private readonly countTokens: (text: string) => number;
  private readonly autoOptimize: boolean;
  private readonly maxDepth: number;

  private readonly toolCalls: Record<ContextToolName, number> = {
    get_more_context: 0,
    forget_context: 0,
    summarize_context: 0,
    search_codebase: 0,
  };

  private tokensReclaimed = 0;

  constructor(config: CATContextManagerConfig) {
    this.budget = new ContextBudgetManager(config);
    this.countTokens = config.countTokens ?? defaultCountTokens;
    this.workspace = new ContextWorkspace({
      countTokens: this.countTokens,
      summarizer: config.summarizer,
    });
    this.learner = config.learner ?? new ContextUsageLearner();
    this.provider = config.provider;
    this.autoOptimize = config.autoOptimize ?? true;
    this.maxDepth = config.maxDepth ?? 3;
  }

  // ---------------------------------------------------------------------------
  // Session setup and introspection
  // ---------------------------------------------------------------------------

  /**
   * Seed the task tier. Task semantics are pinned, so they survive every
   * compression cycle.
   */
  setTask(description: string, options: { constraints?: string[] } = {}): ContextItem {
    const parts = [`Task: ${description}`];
    if (options.constraints?.length) {
      parts.push('Constraints:', ...options.constraints.map((c) => `- ${c}`));
    }

    const content = parts.join('\n');
    this.learner.setTaskContext(description);

    return this.workspace.add({
      content,
      tokens: this.countTokens(content),
      tier: 'task',
      source: 'task-spec',
      pinned: true,
    });
  }

  /** Current budget state, for prompt rendering or assertions. */
  getBudget(): BudgetSnapshot {
    return this.budget.snapshot(this.workspace.all());
  }

  /** Budget rendered as prompt text for the agent. */
  describeBudget(): string {
    return ContextBudgetManager.describe(this.getBudget());
  }

  getWorkspace(): ContextWorkspace {
    return this.workspace;
  }

  getLearner(): ContextUsageLearner {
    return this.learner;
  }

  advanceTurn(): number {
    return this.workspace.advanceTurn();
  }

  /** File paths currently held. */
  loadedFiles(): string[] {
    return [
      ...new Set(
        this.workspace
          .all()
          .map((item) => item.filePath)
          .filter((path): path is string => Boolean(path)),
      ),
    ];
  }

  /**
   * Signal that context contributed to progress. This is the learning signal:
   * without it the learner has no ground truth and scoring degrades to recency.
   */
  recordUsefulContext(identifiers: readonly string[]): void {
    const usefulFiles: string[] = [];

    for (const identifier of identifiers) {
      for (const id of this.workspace.resolve(identifier)) {
        const item = this.workspace.get(id);
        if (!item) continue;

        this.workspace.markUsed(id);
        this.learner.observe({
          itemId: id,
          filePath: item.filePath,
          source: item.source,
          turn: this.workspace.turn,
          useful: true,
        });

        if (item.filePath) usefulFiles.push(item.filePath);
      }
    }

    if (usefulFiles.length > 1) {
      this.learner.observeCooccurrence(usefulFiles);
    }
  }

  /** Predicted-useful files given what is already loaded. */
  predictNeededContext(limit = 5): ContextPrediction[] {
    return this.learner.predict({ alreadyLoaded: this.loadedFiles(), limit });
  }

  // ---------------------------------------------------------------------------
  // Tool: get_more_context
  // ---------------------------------------------------------------------------

  /**
   * Fetch files and/or symbols, optionally expanding through dependencies.
   *
   * Items are added only if they fit; when they do not and `autoOptimize` is on,
   * space is reclaimed first. Partial success is reported honestly so the agent
   * knows what it actually has.
   */
  async getMoreContext(args: GetMoreContextArgs): Promise<ContextToolResult> {
    this.toolCalls.get_more_context += 1;

    const files = args.files ?? [];
    const symbols = args.symbols ?? [];

    if (files.length === 0 && symbols.length === 0) {
      return this.failure('get_more_context', 'Provide at least one of `files` or `symbols`.');
    }

    const depth = clampDepth(args.depth ?? 0, this.maxDepth);
    const targets = await this.expandTargets(files, depth);

    const addedIds: string[] = [];
    const skipped: string[] = [];
    const notFound: string[] = [];
    let tokensAdded = 0;

    for (const filePath of targets) {
      if (this.workspace.hasFile(filePath)) {
        skipped.push(`${filePath} (already loaded)`);
        continue;
      }

      const content = await this.provider.readFile(filePath);
      if (content === null) {
        notFound.push(filePath);
        continue;
      }

      const tokens = this.countTokens(content);
      if (!(await this.ensureRoom(tokens))) {
        skipped.push(`${filePath} (no budget: needs ${tokens} tokens)`);
        continue;
      }

      const item = this.workspace.add({
        content,
        tokens,
        tier: 'short-term',
        source: files.includes(filePath) ? 'explicit-fetch' : 'dependency-expansion',
        filePath,
      });

      addedIds.push(item.id);
      tokensAdded += tokens;
    }

    for (const symbol of symbols) {
      const hit = await this.provider.findSymbol?.(symbol);
      if (!hit) {
        notFound.push(symbol);
        continue;
      }

      const tokens = this.countTokens(hit.content);
      if (!(await this.ensureRoom(tokens))) {
        skipped.push(`${symbol} (no budget: needs ${tokens} tokens)`);
        continue;
      }

      const item = this.workspace.add({
        content: hit.content,
        tokens,
        tier: 'short-term',
        source: 'explicit-fetch',
        filePath: hit.filePath,
        symbols: [symbol],
      });

      addedIds.push(item.id);
      tokensAdded += tokens;
    }

    const messageParts = [`Added ${addedIds.length} item(s), ${tokensAdded} tokens.`];
    if (skipped.length) messageParts.push(`Skipped: ${skipped.join('; ')}.`);
    if (notFound.length) messageParts.push(`Not found: ${notFound.join(', ')}.`);

    return {
      tool: 'get_more_context',
      ok: addedIds.length > 0 || notFound.length === 0,
      message: messageParts.join(' '),
      tokenDelta: tokensAdded,
      budget: this.getBudget(),
      addedItemIds: addedIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool: forget_context
  // ---------------------------------------------------------------------------

  /**
   * Drop context by id or file path.
   *
   * Removal is recorded as a not-useful observation: the agent explicitly
   * judging context irrelevant is exactly the signal the learner needs.
   */
  forgetContext(args: ForgetContextArgs): ContextToolResult {
    this.toolCalls.forget_context += 1;

    if (!Array.isArray(args.items) || args.items.length === 0) {
      return this.failure('forget_context', '`items` must be a non-empty array.');
    }

    const removedIds: string[] = [];
    const protectedIds: string[] = [];
    const unknown: string[] = [];
    let tokensFreed = 0;

    for (const identifier of args.items) {
      const ids = this.workspace.resolve(identifier);

      if (ids.length === 0) {
        unknown.push(identifier);
        continue;
      }

      for (const id of ids) {
        const item = this.workspace.get(id);
        if (!item) continue;

        if (item.pinned) {
          protectedIds.push(id);
          continue;
        }

        this.learner.observe({
          itemId: id,
          filePath: item.filePath,
          source: item.source,
          turn: this.workspace.turn,
          useful: false,
        });

        if (this.workspace.remove(id)) {
          removedIds.push(id);
          tokensFreed += item.tokens;
        }
      }
    }

    this.tokensReclaimed += tokensFreed;

    const messageParts = [`Removed ${removedIds.length} item(s), freed ${tokensFreed} tokens.`];
    if (protectedIds.length) {
      messageParts.push(`Kept ${protectedIds.length} pinned item(s) (task semantics cannot be dropped).`);
    }
    if (unknown.length) messageParts.push(`Unknown: ${unknown.join(', ')}.`);

    return {
      tool: 'forget_context',
      ok: removedIds.length > 0,
      message: messageParts.join(' '),
      tokenDelta: -tokensFreed,
      budget: this.getBudget(),
      removedItemIds: removedIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool: summarize_context
  // ---------------------------------------------------------------------------

  /**
   * Fold a turn range of short-term memory into one long-term summary.
   *
   * This is the paper's proactive folding at stage boundaries: called when a
   * phase completes, it converts bulky working memory into a compact, still
   * actionable record.
   */
  summarizeContext(args: SummarizeContextArgs): ContextToolResult {
    this.toolCalls.summarize_context += 1;

    const range = args.range;
    if (!Array.isArray(range) || range.length !== 2) {
      return this.failure('summarize_context', '`range` must be a [startTurn, endTurn] tuple.');
    }

    const [start, end] = range;
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return this.failure('summarize_context', '`range` bounds must be finite numbers.');
    }
    if (start > end) {
      return this.failure('summarize_context', '`range` start must not exceed end.');
    }

    const result = this.workspace.fold(start, end);

    if (!result.summary) {
      return {
        tool: 'summarize_context',
        ok: false,
        message:
          `Nothing folded for turns ${start}-${end}. ` +
          'Folding needs at least two unpinned short-term items and must save tokens.',
        tokenDelta: 0,
        budget: this.getBudget(),
      };
    }

    this.tokensReclaimed += result.tokensSaved;

    const ratio = result.tokensBefore / Math.max(1, result.tokensAfter);

    return {
      tool: 'summarize_context',
      ok: true,
      message:
        `Folded ${result.removedIds.length} item(s) from turns ${start}-${end}: ` +
        `${result.tokensBefore} -> ${result.tokensAfter} tokens (${ratio.toFixed(1)}x), ` +
        `saved ${result.tokensSaved}.`,
      tokenDelta: -result.tokensSaved,
      budget: this.getBudget(),
      addedItemIds: [result.summary.id],
      removedItemIds: result.removedIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool: search_codebase
  // ---------------------------------------------------------------------------

  /**
   * Semantic search. Hits are added as short-term context, highest score first,
   * stopping when the budget is exhausted rather than overflowing it.
   */
  async searchCodebase(args: SearchCodebaseArgs): Promise<ContextToolResult> {
    this.toolCalls.search_codebase += 1;

    if (typeof args.query !== 'string' || args.query.trim().length === 0) {
      return this.failure('search_codebase', '`query` must be a non-empty string.');
    }

    const limit = clampLimit(args.limit ?? 5);
    const hits = await this.provider.search(args.query, limit);

    if (hits.length === 0) {
      return {
        tool: 'search_codebase',
        ok: true,
        message: `No matches for "${args.query}".`,
        tokenDelta: 0,
        budget: this.getBudget(),
        addedItemIds: [],
      };
    }

    const ranked = [...hits].sort((a, b) => b.score - a.score);
    const addedIds: string[] = [];
    const skipped: string[] = [];
    let tokensAdded = 0;

    for (const hit of ranked) {
      if (this.workspace.hasFile(hit.filePath)) {
        skipped.push(`${hit.filePath} (already loaded)`);
        continue;
      }

      const tokens = this.countTokens(hit.content);
      if (!(await this.ensureRoom(tokens))) {
        skipped.push(`${hit.filePath} (no budget)`);
        continue;
      }

      const item = this.workspace.add({
        content: hit.content,
        tokens,
        tier: 'short-term',
        source: 'search-result',
        filePath: hit.filePath,
        symbols: hit.symbols,
      });

      addedIds.push(item.id);
      tokensAdded += tokens;
    }

    const messageParts = [
      `Found ${hits.length} match(es) for "${args.query}", added ${addedIds.length} (${tokensAdded} tokens).`,
    ];
    if (skipped.length) messageParts.push(`Skipped: ${skipped.join('; ')}.`);

    return {
      tool: 'search_codebase',
      ok: true,
      message: messageParts.join(' '),
      tokenDelta: tokensAdded,
      budget: this.getBudget(),
      addedItemIds: addedIds,
    };
  }

  // ---------------------------------------------------------------------------
  // Automatic optimization
  // ---------------------------------------------------------------------------

  /**
   * Reclaim at least `needed` tokens using learned utility.
   *
   * Order matters: evict the lowest-utility items first (cheap, precise), then
   * fold older turns (lossy but bulk). Folding first would compress content the
   * agent was about to discard anyway.
   */
  optimize(needed: number): { freed: number; evictedIds: string[]; folded: boolean } {
    const evictedIds: string[] = [];
    let freed = 0;

    if (needed <= 0) return { freed: 0, evictedIds, folded: false };

    const candidates = this.learner.rankForEviction(this.workspace.all(), this.workspace.turn);

    for (const item of candidates) {
      if (freed >= needed) break;
      // Keep context the agent has actually used; prefer folding it later.
      if (item.useCount > 0) continue;

      if (this.workspace.remove(item.id)) {
        evictedIds.push(item.id);
        freed += item.tokens;
      }
    }

    let folded = false;

    if (freed < needed) {
      const currentTurn = this.workspace.turn;
      // Fold everything up to the previous turn; the current turn is live.
      const foldResult = this.workspace.fold(0, Math.max(0, currentTurn - 1));

      if (foldResult.summary) {
        folded = true;
        freed += foldResult.tokensSaved;
      }
    }

    this.tokensReclaimed += freed;
    return { freed, evictedIds, folded };
  }

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  /** Session metrics, including the precision number used in A/B comparisons. */
  getMetrics(): ContextMetrics {
    const items = this.workspace.all();
    let totalTokens = 0;
    let usefulTokens = 0;
    let deadItems = 0;

    for (const item of items) {
      totalTokens += item.tokens;

      if (item.useCount > 0 || item.tier === 'task') {
        usefulTokens += item.tokens;
      } else if (!item.pinned) {
        deadItems += 1;
      }
    }

    return {
      totalTokens,
      usefulTokens,
      precision: totalTokens === 0 ? 0 : usefulTokens / totalTokens,
      deadItems,
      toolCalls: { ...this.toolCalls },
      tokensReclaimed: this.tokensReclaimed,
      overflowEvents: this.budget.overflowCount,
    };
  }

  /** Assemble the prompt-ready context string, task tier first. */
  render(): string {
    const order: Array<ContextItem['tier']> = ['task', 'long-term', 'short-term'];
    const sections: string[] = [];

    for (const tier of order) {
      const items = this.workspace.byTier(tier);
      if (items.length === 0) continue;

      sections.push(`## ${tier}`);
      for (const item of items) {
        const label = item.filePath ? `### ${item.filePath}` : `### ${item.source}`;
        sections.push(label, item.content);
      }
    }

    return sections.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /** Ensure `tokens` fit, optimizing first when allowed. */
  private async ensureRoom(tokens: number): Promise<boolean> {
    const items = this.workspace.all();
    if (this.budget.canFit(items, tokens)) return true;
    if (!this.autoOptimize) return false;

    const deficit = this.budget.deficitFor(items, tokens);
    this.optimize(deficit);

    return this.budget.canFit(this.workspace.all(), tokens);
  }

  /** Resolve requested files plus their dependencies up to `depth`. */
  private async expandTargets(files: readonly string[], depth: number): Promise<string[]> {
    const targets = [...files];

    if (depth > 0 && this.provider.getDependencies) {
      for (const file of files) {
        const deps = await this.provider.getDependencies(file, depth);
        targets.push(...deps);
      }
    }

    return [...new Set(targets)];
  }

  private failure(tool: ContextToolName, error: string): ContextToolResult {
    return {
      tool,
      ok: false,
      message: error,
      tokenDelta: 0,
      budget: this.getBudget(),
      error,
    };
  }
}

function clampDepth(depth: number, max: number): number {
  if (!Number.isFinite(depth) || depth < 0) return 0;
  return Math.min(Math.floor(depth), max);
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return 5;
  return Math.min(Math.floor(limit), 50);
}

export type { CodebaseSearchHit };
