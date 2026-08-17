/**
 * Task classification: map a task onto a complexity bucket, and from there onto
 * a price lane.
 *
 * Two signal families are combined:
 *  1. Lexical - what the prompt asks for ("format this file" vs "redesign the
 *     auth architecture").
 *  2. Structural - how big the job is (file count, token estimate, explicit
 *     reasoning flag). Structural signals can only push complexity *up*, never
 *     down, so a large job is never silently downgraded to the cheap lane.
 */

import type { ModelTier, Task, TaskComplexity, TaskKind } from './types';

/** Which lane each complexity bucket maps to by default. */
export const COMPLEXITY_TIER: Record<TaskComplexity, ModelTier> = {
  simple: 'cheap',
  medium: 'mid',
  complex: 'expensive',
};

/** Difficulty of each known task kind. */
export const KIND_COMPLEXITY: Record<TaskKind, TaskComplexity> = {
  'file-read': 'simple',
  'syntax-check': 'simple',
  formatting: 'simple',
  'lint-fix': 'simple',
  'doc-lookup': 'simple',
  'symbol-rename': 'simple',
  'commit-message': 'simple',
  'bug-fix': 'medium',
  'small-feature': 'medium',
  'test-write': 'medium',
  'code-review': 'medium',
  'doc-write': 'medium',
  architecture: 'complex',
  refactor: 'complex',
  'debug-complex': 'complex',
  migration: 'complex',
  reasoning: 'complex',
  'security-audit': 'complex',
};

interface KindPattern {
  kind: TaskKind;
  /**
   * Specificity weight. Domain-specific nouns ("prettier", "race condition")
   * score higher than generic verbs ("fix", "add"), which appear in prompts of
   * every difficulty. Defaults to 1.
   */
  weight?: number;
  patterns: RegExp[];
}

/**
 * Lexical signals per kind, scored by total matched weight. Order breaks exact
 * ties, and is arranged complex -> simple so an ambiguous prompt resolves to the
 * safer (more capable) lane.
 */
const KIND_PATTERNS: KindPattern[] = [
  // --- complex ---
  {
    kind: 'architecture',
    patterns: [
      /\barchitect(?:ure|ural)?\b/i,
      /\bsystem design\b/i,
      /\bdesign (?:the |a |an )?(?:system|schema|api|module boundar)/i,
      /\btrade-?offs?\b/i,
      /\bevaluate (?:approaches|options|alternatives)\b/i,
    ],
  },
  {
    kind: 'migration',
    patterns: [/\bmigrat(?:e|ion)\b/i, /\bport (?:it |this )?(?:to|from)\b/i, /\bupgrade .* (?:major|v\d)\b/i],
  },
  {
    kind: 'refactor',
    patterns: [
      /\brefactor(?:ing)?\b/i,
      /\brestructur(?:e|ing)\b/i,
      /\bextract (?:a )?(?:module|package|service|abstraction)\b/i,
      /\bdecoupl(?:e|ing)\b/i,
      /\brewrite\b/i,
    ],
  },
  {
    kind: 'debug-complex',
    patterns: [
      /\brace condition\b/i,
      /\bdeadlock\b/i,
      /\bmemory leak\b/i,
      /\bintermittent\b/i,
      /\bflaky\b/i,
      /\bheisenbug\b/i,
      /\broot cause\b/i,
      /\bwhy (?:does|is|are|do)\b.*\b(?:fail|break|hang|crash)/i,
    ],
  },
  {
    kind: 'security-audit',
    patterns: [/\bsecurity (?:audit|review)\b/i, /\bvulnerabilit(?:y|ies)\b/i, /\bthreat model\b/i, /\bexploit\b/i],
  },
  {
    kind: 'reasoning',
    patterns: [/\bexplain why\b/i, /\breason (?:about|through)\b/i, /\bstep by step\b/i, /\bprove\b/i, /\bderive\b/i],
  },
  // --- medium ---
  {
    kind: 'bug-fix',
    // "fix" and "error" alone are weak: they also appear in "fix the formatting"
    // and "lint error". Specific bug vocabulary carries full weight.
    weight: 0.5,
    patterns: [/\bfix\b/i, /\berror\b/i, /\bbug\b/i, /\bbroken\b/i, /\bnot working\b/i, /\bthrows?\b/i],
  },
  {
    kind: 'small-feature',
    patterns: [
      /\badd (?:a |an )?(?:new )?(?:feature|option|flag|field|endpoint|button|method)\b/i,
      /\bimplement\b/i,
      /\bsupport for\b/i,
    ],
  },
  { kind: 'test-write', patterns: [/\bwrite (?:unit |integration )?tests?\b/i, /\btest coverage\b/i, /\badd tests?\b/i] },
  { kind: 'code-review', patterns: [/\breview (?:this |the |my )?(?:code|diff|pr|change)/i, /\bcritique\b/i] },
  { kind: 'doc-write', patterns: [/\bwrite (?:the )?docs?\b/i, /\bdocument (?:this|the)\b/i, /\bchangelog\b/i, /\breadme\b/i] },
  // --- simple ---
  {
    kind: 'formatting',
    patterns: [/\bformat(?:ting)?\b/i, /\bprettier\b/i, /\bindent(?:ation)?\b/i, /\bwhitespace\b/i, /\bstyle fix\b/i],
  },
  { kind: 'lint-fix', patterns: [/\blint(?:er|ing)?\b/i, /\beslint\b/i, /\bunused (?:import|variable)s?\b/i] },
  {
    kind: 'syntax-check',
    patterns: [/\bsyntax (?:check|error)\b/i, /\bdoes (?:this|it) (?:compile|parse)\b/i, /\btypecheck\b/i],
  },
  {
    kind: 'file-read',
    patterns: [
      /\bread (?:the |this )?file\b/i,
      /\bshow me\b/i,
      /\bwhat(?:'s| is) in\b/i,
      /\bsummari[sz]e (?:this |the )?file\b/i,
      /\blist (?:the )?(?:files|exports|functions)\b/i,
      /\bwhere is\b/i,
      /\bfind (?:the )?(?:definition|usage|reference)/i,
    ],
  },
  { kind: 'symbol-rename', patterns: [/\brename\b/i, /\bfind and replace\b/i] },
  { kind: 'doc-lookup', patterns: [/\bwhat does .* do\b/i, /\bapi (?:docs|reference)\b/i, /\blook up\b/i] },
  { kind: 'commit-message', patterns: [/\bcommit message\b/i, /\bpr (?:title|description)\b/i] },
];

/** Thresholds at which sheer size forces a higher lane. */
export const STRUCTURAL_THRESHOLDS = {
  /** At or above this file count, a task is at least `medium`. */
  mediumFileCount: 5,
  /** At or above this file count, a task is `complex` (cross-cutting change). */
  complexFileCount: 12,
  /** At or above this token estimate, a task is at least `medium`. */
  mediumTokens: 40_000,
  /** At or above this token estimate, a task is `complex`. */
  complexTokens: 150_000,
} as const;

const COMPLEXITY_RANK: Record<TaskComplexity, number> = { simple: 0, medium: 1, complex: 2 };
const RANK_COMPLEXITY: TaskComplexity[] = ['simple', 'medium', 'complex'];

function maxComplexity(a: TaskComplexity, b: TaskComplexity): TaskComplexity {
  // Non-null: rank is always a valid index into RANK_COMPLEXITY.
  return RANK_COMPLEXITY[Math.max(COMPLEXITY_RANK[a], COMPLEXITY_RANK[b])]!;
}

/** Outcome of classifying a task. */
export interface Classification {
  complexity: TaskComplexity;
  /** Inferred kind, when a lexical signal matched. */
  kind?: TaskKind;
  /** 0-1. Low confidence makes the router prefer a safer lane. */
  confidence: number;
  /** Ordered list of the signals that drove the decision. */
  signals: string[];
}

interface LexicalMatch {
  kind: TaskKind;
  hits: number;
  score: number;
}

function matchKind(prompt: string): LexicalMatch | undefined {
  let best: LexicalMatch | undefined;

  for (const { kind, patterns, weight = 1 } of KIND_PATTERNS) {
    const hits = patterns.reduce((count, pattern) => count + (pattern.test(prompt) ? 1 : 0), 0);
    if (hits === 0) continue;

    const score = hits * weight;
    // Strict `>` means earlier entries win exact ties. KIND_PATTERNS runs
    // complex -> simple, so "refactor and format" takes the complex reading.
    if (!best || score > best.score) {
      best = { kind, hits, score };
    }
  }

  return best;
}

/**
 * Classify a task into a complexity bucket.
 *
 * An explicit `task.kind` short-circuits lexical analysis; structural signals
 * still apply, because a "bug-fix" spanning 20 files is not a mid-tier job.
 */
export function classifyTask(task: Task): Classification {
  const signals: string[] = [];
  let complexity: TaskComplexity;
  let kind: TaskKind | undefined;
  let confidence: number;

  if (task.kind) {
    kind = task.kind;
    complexity = KIND_COMPLEXITY[task.kind];
    confidence = 0.95;
    signals.push(`explicit kind: ${task.kind}`);
  } else {
    const match = matchKind(task.prompt ?? '');
    if (match) {
      kind = match.kind;
      complexity = KIND_COMPLEXITY[match.kind];
      // More corroborating patterns -> more confidence, capped at 0.9.
      confidence = Math.min(0.9, 0.55 + match.hits * 0.15);
      signals.push(`lexical match: ${match.kind} (${match.hits} pattern${match.hits > 1 ? 's' : ''})`);
    } else {
      // No signal at all. Default to `medium`: cheap enough to matter, capable
      // enough that an unknown task is unlikely to fail outright.
      complexity = 'medium';
      confidence = 0.3;
      signals.push('no lexical signal, defaulting to medium');
    }
  }

  // --- structural bumps (upward only) ---
  if (task.requiresReasoning) {
    const bumped = maxComplexity(complexity, 'complex');
    if (bumped !== complexity) signals.push('requiresReasoning flag -> complex');
    complexity = bumped;
    confidence = Math.max(confidence, 0.9);
  }

  const fileCount = task.fileCount ?? 0;
  if (fileCount >= STRUCTURAL_THRESHOLDS.complexFileCount) {
    const bumped = maxComplexity(complexity, 'complex');
    if (bumped !== complexity) signals.push(`${fileCount} files -> complex`);
    complexity = bumped;
  } else if (fileCount >= STRUCTURAL_THRESHOLDS.mediumFileCount) {
    const bumped = maxComplexity(complexity, 'medium');
    if (bumped !== complexity) signals.push(`${fileCount} files -> medium`);
    complexity = bumped;
  }

  const tokens = task.estimatedTokens ?? 0;
  if (tokens >= STRUCTURAL_THRESHOLDS.complexTokens) {
    const bumped = maxComplexity(complexity, 'complex');
    if (bumped !== complexity) signals.push(`~${tokens} tokens -> complex`);
    complexity = bumped;
  } else if (tokens >= STRUCTURAL_THRESHOLDS.mediumTokens) {
    const bumped = maxComplexity(complexity, 'medium');
    if (bumped !== complexity) signals.push(`~${tokens} tokens -> medium`);
    complexity = bumped;
  }

  return { complexity, kind, confidence, signals };
}

/** Default lane for a complexity bucket. */
export function tierForComplexity(complexity: TaskComplexity): ModelTier {
  return COMPLEXITY_TIER[complexity];
}
