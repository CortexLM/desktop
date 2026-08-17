/**
 * Structured workspace: the store the CAT tools operate on.
 *
 * Three tiers per the paper: task semantics, long-term memory, short-term
 * working memory. The tier determines eviction eligibility, so classification
 * at insert time is what makes later compression safe rather than lossy.
 */

import type { ContextItem, ContextSource, ContextTier } from './types';

export interface AddItemInput {
  content: string;
  tokens: number;
  tier: ContextTier;
  source: ContextSource;
  filePath?: string;
  symbols?: string[];
  pinned?: boolean;
  id?: string;
  foldedFrom?: string[];
}

/** Result of folding a turn range into a single summary item. */
export interface FoldResult {
  summary: ContextItem | null;
  removedIds: string[];
  tokensBefore: number;
  tokensAfter: number;
  /** Tokens freed. Negative would mean the fold made things worse. */
  tokensSaved: number;
}

/**
 * Produces an actionable summary from folded items.
 *
 * The paper stresses *high-fidelity actionable* summaries: a summary that loses
 * the file paths and symbol names is useless because the agent can no longer
 * re-fetch what it dropped.
 */
export type Summarizer = (items: readonly ContextItem[]) => string;

export interface WorkspaceConfig {
  /** Counts tokens for summary text. */
  countTokens: (text: string) => number;
  /** Overrides the built-in structural summarizer. */
  summarizer?: Summarizer;
}

export class ContextWorkspace {
  private readonly items = new Map<string, ContextItem>();
  private readonly countTokens: (text: string) => number;
  private readonly summarize: Summarizer;
  private currentTurn = 0;
  private idCounter = 0;

  constructor(config: WorkspaceConfig) {
    this.countTokens = config.countTokens;
    this.summarize = config.summarizer ?? defaultStructuralSummarizer;
  }

  get turn(): number {
    return this.currentTurn;
  }

  /** Advance the turn clock. Recency scoring and folding ranges depend on it. */
  advanceTurn(): number {
    this.currentTurn += 1;
    return this.currentTurn;
  }

  /** All items, insertion-ordered. */
  all(): ContextItem[] {
    return [...this.items.values()];
  }

  get size(): number {
    return this.items.size;
  }

  get(id: string): ContextItem | undefined {
    return this.items.get(id);
  }

  byTier(tier: ContextTier): ContextItem[] {
    return this.all().filter((item) => item.tier === tier);
  }

  totalTokens(): number {
    let total = 0;
    for (const item of this.items.values()) total += item.tokens;
    return total;
  }

  /** True when a live item already covers this file path. */
  hasFile(filePath: string): boolean {
    for (const item of this.items.values()) {
      if (item.filePath === filePath) return true;
    }
    return false;
  }

  /**
   * Insert an item. `task` tier is pinned implicitly: the goal must survive
   * every compression cycle or the agent loses track of what it is solving.
   */
  add(input: AddItemInput): ContextItem {
    const id = input.id ?? this.nextId(input);

    const item: ContextItem = {
      id,
      content: input.content,
      tokens: input.tokens,
      tier: input.tier,
      source: input.source,
      filePath: input.filePath,
      symbols: input.symbols,
      addedAtTurn: this.currentTurn,
      useCount: 0,
      pinned: input.pinned ?? input.tier === 'task',
      foldedFrom: input.foldedFrom,
    };

    this.items.set(id, item);
    return item;
  }

  /** Remove by id. Pinned items are protected unless `force` is set. */
  remove(id: string, force = false): boolean {
    const item = this.items.get(id);
    if (!item) return false;
    if (item.pinned && !force) return false;
    return this.items.delete(id);
  }

  /**
   * Resolve a caller-supplied identifier to item ids, accepting either an item
   * id or a file path. The agent reasons in file paths far more naturally than
   * in synthetic ids, so both must work.
   */
  resolve(identifier: string): string[] {
    if (this.items.has(identifier)) return [identifier];

    const matches: string[] = [];
    for (const item of this.items.values()) {
      if (item.filePath === identifier) matches.push(item.id);
    }
    return matches;
  }

  /** Record that an item contributed to progress. Feeds retention scoring. */
  markUsed(id: string): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    item.useCount += 1;
    item.lastUsedAtTurn = this.currentTurn;
    return true;
  }

  setPinned(id: string, pinned: boolean): boolean {
    const item = this.items.get(id);
    if (!item) return false;
    // Task semantics stay pinned: unpinning them is never a valid optimization.
    if (item.tier === 'task' && !pinned) return false;

    item.pinned = pinned;
    return true;
  }

  /**
   * Fold every eligible short-term item added in `[startTurn, endTurn]` into a
   * single long-term summary.
   *
   * Only short-term items fold: task semantics must stay verbatim, and
   * re-folding long-term summaries compounds information loss.
   */
  fold(startTurn: number, endTurn: number): FoldResult {
    const candidates = this.all().filter(
      (item) =>
        item.tier === 'short-term' &&
        !item.pinned &&
        item.addedAtTurn >= startTurn &&
        item.addedAtTurn <= endTurn,
    );

    const tokensBefore = candidates.reduce((sum, item) => sum + item.tokens, 0);

    // A single item cannot be compressed into a summary that references it
    // without roughly reproducing it; folding one item is not worth the loss.
    if (candidates.length < 2) {
      return {
        summary: null,
        removedIds: [],
        tokensBefore,
        tokensAfter: tokensBefore,
        tokensSaved: 0,
      };
    }

    const summaryText = this.summarize(candidates);
    const summaryTokens = this.countTokens(summaryText);

    // Refuse folds that do not pay for themselves.
    if (summaryTokens >= tokensBefore) {
      return {
        summary: null,
        removedIds: [],
        tokensBefore,
        tokensAfter: tokensBefore,
        tokensSaved: 0,
      };
    }

    const removedIds = candidates.map((item) => item.id);

    // The summary inherits the usage history of what it replaces. Without this,
    // folding used context would make it look like dead weight, and any
    // precision metric would penalise exactly the behaviour we want.
    const inheritedUseCount = candidates.reduce((sum, item) => sum + item.useCount, 0);
    const inheritedLastUsed = candidates.reduce<number | undefined>((latest, item) => {
      if (item.lastUsedAtTurn === undefined) return latest;
      return latest === undefined ? item.lastUsedAtTurn : Math.max(latest, item.lastUsedAtTurn);
    }, undefined);

    for (const id of removedIds) this.items.delete(id);

    const summary = this.add({
      content: summaryText,
      tokens: summaryTokens,
      tier: 'long-term',
      source: 'summary',
      foldedFrom: removedIds,
      symbols: dedupe(candidates.flatMap((item) => item.symbols ?? [])),
    });

    summary.useCount = inheritedUseCount;
    summary.lastUsedAtTurn = inheritedLastUsed;

    return {
      summary,
      removedIds,
      tokensBefore,
      tokensAfter: summaryTokens,
      tokensSaved: tokensBefore - summaryTokens,
    };
  }

  /** Drop all items. Used between benchmark runs. */
  clear(): void {
    this.items.clear();
    this.currentTurn = 0;
    this.idCounter = 0;
  }

  private nextId(input: AddItemInput): string {
    this.idCounter += 1;
    const label = input.filePath ?? input.source;
    return `${label}#${this.idCounter}`;
  }
}

/**
 * Default summarizer: keeps the structural skeleton (paths, symbols, imports,
 * exports, signatures) and drops function bodies.
 *
 * This preserves the agent's ability to act — it still knows what exists and
 * where — while discarding the bulk of the tokens. Bodies are the part it can
 * re-fetch on demand via `get_more_context`.
 */
export function defaultStructuralSummarizer(items: readonly ContextItem[]): string {
  const lines: string[] = ['[folded context summary]'];

  for (const item of items) {
    const label = item.filePath ?? item.source;
    const signatures = extractSignatures(item.content);
    const symbols = dedupe([...(item.symbols ?? []), ...signatures]);

    const parts = [`- ${label}`];
    if (symbols.length > 0) {
      parts.push(`symbols: ${symbols.slice(0, 8).join(', ')}`);
    }
    parts.push(`(${item.tokens} tokens folded, turn ${item.addedAtTurn})`);

    lines.push(parts.join(' | '));
  }

  lines.push('Re-fetch any folded file with get_more_context if details are needed.');

  return lines.join('\n');
}

/** Pull declaration names out of source text with light heuristics. */
function extractSignatures(content: string): string[] {
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
    /(?:export\s+)?class\s+(\w+)/g,
    /(?:export\s+)?interface\s+(\w+)/g,
    /(?:export\s+)?type\s+(\w+)/g,
    /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/g,
  ];

  const found: string[] = [];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) found.push(match[1]);
    }
  }

  return dedupe(found);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
