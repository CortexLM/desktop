/**
 * Fuzzy subsequence matching for the command palette.
 *
 * Matches the way people actually type into a palette: "gitcom" should find
 * "Git: Commit" and "epc" should find "EditorPanelContainer.tsx". A plain
 * substring test finds neither, so characters are matched in order but not
 * necessarily adjacently.
 *
 * Scoring rewards matches that look intentional rather than coincidental:
 * consecutive runs, matches at word boundaries, and matches near the start.
 * The returned indices let the UI highlight exactly which characters matched.
 */

export interface FuzzyMatch {
  score: number;
  /** Indices in the target that matched, ascending. */
  indices: number[];
}

const SCORE_CONSECUTIVE = 8;
const SCORE_WORD_BOUNDARY = 10;
const SCORE_CAMEL_BOUNDARY = 8;
const PENALTY_LEADING_CHAR = 2;
const PENALTY_MAX_LEADING = 12;
const PENALTY_UNMATCHED_CHAR = 1;

/**
 * Scores `query` against `target`. Returns null when the query isn't a
 * subsequence of the target, i.e. a non-match.
 *
 * An empty query matches everything with score 0, so the palette shows its
 * full list before any typing.
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  if (!query) return { score: 0, indices: [] };
  if (!target) return null;

  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  // Cheap rejection before the O(n) scan: most candidates fail here.
  if (lowerQuery.length > lowerTarget.length) return null;

  const indices: number[] = [];
  let score = 0;
  let targetIndex = 0;
  let previousMatchIndex = -1;

  for (let queryIndex = 0; queryIndex < lowerQuery.length; queryIndex++) {
    const queryChar = lowerQuery[queryIndex];

    // Skip whitespace in the query so "git commit" behaves like "gitcommit".
    if (queryChar === ' ') continue;

    let found = -1;
    while (targetIndex < lowerTarget.length) {
      if (lowerTarget[targetIndex] === queryChar) {
        found = targetIndex;
        targetIndex++;
        break;
      }
      targetIndex++;
    }

    if (found === -1) return null;

    indices.push(found);

    if (previousMatchIndex === found - 1) {
      score += SCORE_CONSECUTIVE;
    }

    const previousChar = found > 0 ? target[found - 1] : undefined;
    if (previousChar === undefined || isWordSeparator(previousChar)) {
      score += SCORE_WORD_BOUNDARY;
    } else if (isCamelBoundary(previousChar, target[found])) {
      score += SCORE_CAMEL_BOUNDARY;
    }

    if (previousMatchIndex === -1) {
      // Matches far into the string are weaker signals, but the penalty is
      // capped so a late match in a long path isn't ruled out entirely.
      score -= Math.min(found * PENALTY_LEADING_CHAR, PENALTY_MAX_LEADING);
    }

    previousMatchIndex = found;
  }

  // Prefer tighter matches: "index.ts" beats "some/long/index.tsx" for "index".
  score -= (target.length - indices.length) * PENALTY_UNMATCHED_CHAR * 0.1;

  return { score, indices };
}

function isWordSeparator(char: string): boolean {
  return char === ' ' || char === '-' || char === '_' || char === '/' || char === '\\' || char === '.' || char === ':';
}

function isCamelBoundary(previous: string, current: string): boolean {
  return previous === previous.toLowerCase() && current === current.toUpperCase() && current !== current.toLowerCase();
}

export interface ScoredItem<T> {
  item: T;
  score: number;
  indices: number[];
}

/**
 * Filters and ranks `items` by how well they match `query`.
 *
 * Each item can expose several searchable strings via `getFields` (a command's
 * label plus its keywords, a file's name plus its path). The best-scoring field
 * decides the item's rank, and the indices returned belong to `primaryField` so
 * highlighting lines up with the text actually on screen.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getFields: (item: T) => { primary: string; extra?: string[] },
  limit = 100
): ScoredItem<T>[] {
  const trimmed = query.trim();

  if (!trimmed) {
    return items.slice(0, limit).map((item) => ({ item, score: 0, indices: [] }));
  }

  const results: ScoredItem<T>[] = [];

  for (const item of items) {
    const { primary, extra } = getFields(item);

    const primaryMatch = fuzzyMatch(trimmed, primary);
    let best = primaryMatch;
    let indices = primaryMatch?.indices ?? [];

    if (extra) {
      for (const field of extra) {
        const match = fuzzyMatch(trimmed, field);
        if (match && (!best || match.score > best.score)) {
          best = match;
          // Highlighting only applies to the primary text, so a win on an
          // alias contributes its score but no indices.
          indices = primaryMatch?.indices ?? [];
        }
      }
    }

    if (best) {
      results.push({ item, score: best.score, indices });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/** Splits `text` into matched/unmatched runs for highlighted rendering. */
export function highlightSegments(
  text: string,
  indices: number[]
): Array<{ text: string; matched: boolean }> {
  if (indices.length === 0) return [{ text, matched: false }];

  const matched = new Set(indices);
  const segments: Array<{ text: string; matched: boolean }> = [];
  let current = '';
  let currentMatched = matched.has(0);

  for (let index = 0; index < text.length; index++) {
    const isMatched = matched.has(index);

    if (isMatched === currentMatched) {
      current += text[index];
    } else {
      if (current) segments.push({ text: current, matched: currentMatched });
      current = text[index];
      currentMatched = isMatched;
    }
  }

  if (current) segments.push({ text: current, matched: currentMatched });
  return segments;
}
