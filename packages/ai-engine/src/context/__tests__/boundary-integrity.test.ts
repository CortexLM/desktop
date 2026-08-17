import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SemanticChunker, estimateTokens } from '../chunking/semantic-chunker';

/**
 * Mesure A/B honnête : semantic chunking vs split naïf par budget de lignes.
 *
 * IMPORTANT sur ce qui est mesuré ici :
 * la métrique est l'INTÉGRITÉ DES FRONTIÈRES (un chunk contient-il des
 * déclarations complètes, accolades équilibrées), sur un corpus de vrais
 * fichiers du package. Ce n'est PAS une mesure de qualité de réponse LLM :
 * aucun juge LLM n'est exécuté ici. Ne pas convertir ces chiffres en
 * « +X% de qualité » sans une évaluation end-to-end séparée.
 */

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

function isBraceBalanced(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  return depth === 0;
}

function topLevelDeclarations(content: string): string[] {
  const names: string[] = [];
  for (const line of content.split('\n')) {
    const match =
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(line) ??
      /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (match) names.push(match[1]);
  }
  return names;
}

/** Baseline : accumule des lignes jusqu'au budget, sans regarder la syntaxe. */
function naiveSplit(content: string, maxTokens: number): string[] {
  const lines = content.split('\n');
  const chunks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const candidate = current.length === 0 ? line : `${current.join('\n')}\n${line}`;
    if (current.length > 0 && estimateTokens(candidate) > maxTokens) {
      chunks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks;
}

interface Measurement {
  semanticBalancedRate: number;
  naiveBalancedRate: number;
  semanticDeclRate: number;
  naiveDeclRate: number;
  files: number;
  declarations: number;
}

async function measure(maxChunkSize: number): Promise<Measurement> {
  const chunker = new SemanticChunker({ maxChunkSize });
  const files = collectSourceFiles(join(__dirname, '..', '..'));

  let semBalanced = 0;
  let semTotal = 0;
  let naiveBalanced = 0;
  let naiveTotal = 0;
  let semDecl = 0;
  let naiveDecl = 0;
  let declTotal = 0;
  let fileCount = 0;

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    if (content.trim().length === 0) continue;
    fileCount++;

    const semanticChunks = (await chunker.chunk(content, file, 'typescript')).map(c => c.content);
    const naiveChunks = naiveSplit(content, maxChunkSize);

    semBalanced += semanticChunks.filter(isBraceBalanced).length;
    semTotal += semanticChunks.length;
    naiveBalanced += naiveChunks.filter(isBraceBalanced).length;
    naiveTotal += naiveChunks.length;

    const declarations = topLevelDeclarations(content);
    declTotal += declarations.length;

    for (const name of declarations) {
      const semOwner = semanticChunks.find(c => c.includes(name));
      if (semOwner && isBraceBalanced(semOwner)) semDecl++;
      const naiveOwner = naiveChunks.find(c => c.includes(name));
      if (naiveOwner && isBraceBalanced(naiveOwner)) naiveDecl++;
    }
  }

  return {
    semanticBalancedRate: semBalanced / semTotal,
    naiveBalancedRate: naiveBalanced / naiveTotal,
    semanticDeclRate: declTotal ? semDecl / declTotal : 0,
    naiveDeclRate: declTotal ? naiveDecl / declTotal : 0,
    files: fileCount,
    declarations: declTotal,
  };
}

describe('Boundary integrity: semantic chunking vs naive split (measured)', () => {
  it('has a non-trivial corpus to measure against', async () => {
    const result = await measure(500);
    expect(result.files).toBeGreaterThan(20);
    expect(result.declarations).toBeGreaterThan(50);
  });

  it('produces more brace-balanced chunks than naive splitting at every budget', async () => {
    for (const budget of [200, 500, 1000, 2000]) {
      const result = await measure(budget);
      expect(
        result.semanticBalancedRate,
        `budget ${budget}: semantic ${result.semanticBalancedRate} vs naive ${result.naiveBalancedRate}`
      ).toBeGreaterThan(result.naiveBalancedRate);
    }
  });

  it('keeps more top-level declarations intact than naive splitting', async () => {
    for (const budget of [200, 500, 1000, 2000]) {
      const result = await measure(budget);
      expect(
        result.semanticDeclRate,
        `budget ${budget}: semantic ${result.semanticDeclRate} vs naive ${result.naiveDeclRate}`
      ).toBeGreaterThan(result.naiveDeclRate);
    }
  });

  /**
   * Seuil conservateur : le gain mesuré au 16/08/2026 sur ce corpus est de
   * +39% (budget 200) à +212% (budget 1000) en relatif. On verrouille à +30%
   * pour détecter une régression sans rendre le test fragile.
   */
  it('gain is at least +30% relative on declaration integrity', async () => {
    const result = await measure(500);
    const relativeGain =
      (result.semanticDeclRate - result.naiveDeclRate) / result.naiveDeclRate;
    expect(relativeGain).toBeGreaterThan(0.3);
  });
});
