/**
 * Shared test fixtures: an in-memory codebase provider.
 *
 * Deterministic on purpose. The CAT claims under test are about context
 * *management* policy, so retrieval must be a fixed variable, not a source of
 * noise that could explain a win.
 */

import type { CodebaseProvider, CodebaseSearchHit } from '../types';

export interface FakeFile {
  path: string;
  content: string;
  symbols?: string[];
  dependencies?: string[];
  /** Terms that make this file a search match. */
  keywords?: string[];
}

export class FakeCodebase implements CodebaseProvider {
  private readonly files = new Map<string, FakeFile>();

  /** Call counters, used to assert on retrieval effort. */
  readCount = 0;
  searchCount = 0;

  constructor(files: FakeFile[]) {
    for (const file of files) this.files.set(file.path, file);
  }

  async search(query: string, limit: number): Promise<CodebaseSearchHit[]> {
    this.searchCount += 1;

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits: CodebaseSearchHit[] = [];

    for (const file of this.files.values()) {
      const haystack = [
        file.path,
        ...(file.keywords ?? []),
        ...(file.symbols ?? []),
      ]
        .join(' ')
        .toLowerCase();

      const matches = terms.filter((term) => haystack.includes(term)).length;
      if (matches === 0) continue;

      hits.push({
        filePath: file.path,
        content: file.content,
        score: matches / terms.length,
        symbols: file.symbols,
      });
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async readFile(filePath: string): Promise<string | null> {
    this.readCount += 1;
    return this.files.get(filePath)?.content ?? null;
  }

  async findSymbol(symbol: string): Promise<CodebaseSearchHit | null> {
    for (const file of this.files.values()) {
      if (file.symbols?.includes(symbol)) {
        return {
          filePath: file.path,
          content: file.content,
          score: 1,
          symbols: [symbol],
        };
      }
    }
    return null;
  }

  async getDependencies(filePath: string, depth: number): Promise<string[]> {
    const collected = new Set<string>();
    let frontier = [filePath];

    for (let level = 0; level < depth; level += 1) {
      const next: string[] = [];

      for (const path of frontier) {
        for (const dep of this.files.get(path)?.dependencies ?? []) {
          if (collected.has(dep)) continue;
          collected.add(dep);
          next.push(dep);
        }
      }

      if (next.length === 0) break;
      frontier = next;
    }

    return [...collected];
  }

  resetCounters(): void {
    this.readCount = 0;
    this.searchCount = 0;
  }
}

/** Body text of a given token size, using the ~4 chars/token heuristic. */
export function bodyOfTokens(label: string, tokens: number): string {
  const target = tokens * 4;
  const header = `// ${label}\n`;
  const filler = 'const x = compute(value); '.repeat(Math.ceil(target / 26));
  return (header + filler).slice(0, Math.max(target, header.length));
}

/**
 * A small repository where only a few files are relevant to the seeded task.
 * The distractors are what a naive top-k stuffing strategy loads by mistake.
 */
export function buildTestRepo(): FakeCodebase {
  return new FakeCodebase([
    {
      path: 'src/auth/session.ts',
      content: bodyOfTokens('session', 400) + '\nexport function createSession() {}\n',
      symbols: ['createSession', 'destroySession'],
      dependencies: ['src/auth/token.ts'],
      keywords: ['session', 'auth', 'login', 'expiry'],
    },
    {
      path: 'src/auth/token.ts',
      content: bodyOfTokens('token', 300) + '\nexport function signToken() {}\n',
      symbols: ['signToken', 'verifyToken'],
      keywords: ['token', 'auth', 'jwt', 'expiry'],
    },
    {
      path: 'src/auth/middleware.ts',
      content: bodyOfTokens('middleware', 250),
      symbols: ['requireAuth'],
      dependencies: ['src/auth/session.ts'],
      keywords: ['auth', 'middleware', 'guard'],
    },
    {
      path: 'src/ui/button.tsx',
      content: bodyOfTokens('button', 500),
      symbols: ['Button'],
      keywords: ['button', 'ui', 'component'],
    },
    {
      path: 'src/ui/modal.tsx',
      content: bodyOfTokens('modal', 600),
      symbols: ['Modal'],
      keywords: ['modal', 'ui', 'component'],
    },
    {
      path: 'src/utils/format.ts',
      content: bodyOfTokens('format', 350),
      symbols: ['formatDate'],
      keywords: ['format', 'date', 'util'],
    },
    {
      path: 'src/db/migrations.ts',
      content: bodyOfTokens('migrations', 700),
      symbols: ['runMigrations'],
      keywords: ['db', 'migration', 'schema'],
    },
    {
      path: 'docs/changelog.md',
      content: bodyOfTokens('changelog', 450),
      keywords: ['changelog', 'release', 'notes'],
    },
  ]);
}
