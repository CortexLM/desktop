// Découpage sémantique : coupe aux frontières de déclarations (fonctions,
// classes, structs...) plutôt qu'à un nombre de lignes arbitraire.

import type { ChunkMetadata, ContextChunk, SemanticChunkingConfig } from '../types';

const DEFAULT_CONFIG: SemanticChunkingConfig = {
  maxChunkSize: 500,
  minChunkSize: 50,
  preserveBoundaries: true,
  includeDependencies: true,
  maxDependencyDepth: 2,
};

/** ~4 caractères par token (approximation usuelle pour du code). */
const CHARS_PER_TOKEN = 4;

const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'cpp',
  h: 'cpp',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
};

/** Langages découpés par équilibrage d'accolades. */
const BRACE_LANGUAGES = new Set(['typescript', 'javascript', 'rust', 'go', 'java', 'cpp']);

/** Une déclaration détectée, avec son préambule (commentaires/imports). */
interface Segment {
  startLine: number;
  endLine: number;
  functionName?: string;
  className?: string;
}

interface DeclarationMatch {
  functionName?: string;
  className?: string;
}

export class SemanticChunker {
  private readonly config: SemanticChunkingConfig;

  constructor(config: Partial<SemanticChunkingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Découpe un contenu en chunks alignés sur les frontières sémantiques.
   * `language` est déduit de l'extension si absent.
   */
  async chunk(content: string, filePath: string, language?: string): Promise<ContextChunk[]> {
    const resolvedLanguage = language ?? detectLanguage(filePath);
    const lines = content.split('\n');

    const segments =
      this.config.preserveBoundaries && resolvedLanguage
        ? this.findSegments(lines, resolvedLanguage)
        : [];

    const effectiveSegments = segments.length > 0 ? segments : [wholeFile(lines)];

    return this.buildChunks(effectiveSegments, lines, filePath, resolvedLanguage);
  }

  /**
   * Construit le graphe de dépendances directes entre chunks : un chunk dépend
   * d'un autre s'il référence le nom exporté (fonction/classe) de celui-ci.
   */
  buildDependencyGraph(chunks: ContextChunk[]): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    for (const chunk of chunks) {
      graph.set(chunk.id, new Set<string>());
    }

    for (const source of chunks) {
      const dependencies = graph.get(source.id)!;

      for (const target of chunks) {
        if (target.id === source.id) continue;

        const symbol = target.metadata.functionName ?? target.metadata.className;
        if (!symbol) continue;

        // Ne compte pas une déclaration comme dépendance d'elle-même
        // (même symbole réparti sur plusieurs chunks).
        const ownSymbol = source.metadata.functionName ?? source.metadata.className;
        if (ownSymbol === symbol) continue;

        if (referencesSymbol(source.content, symbol)) {
          dependencies.add(target.id);
        }
      }
    }

    return graph;
  }

  /**
   * Étend un ensemble de chunks avec leurs dépendances transitives, jusqu'à
   * `maxDependencyDepth` niveaux. Sans effet si `includeDependencies` est faux.
   */
  expandWithDependencies(chunkIds: string[], graph: Map<string, Set<string>>): Set<string> {
    const result = new Set(chunkIds);
    if (!this.config.includeDependencies) return result;

    let frontier = [...chunkIds];
    for (let depth = 0; depth < this.config.maxDependencyDepth; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const dependency of graph.get(id) ?? []) {
          if (!result.has(dependency)) {
            result.add(dependency);
            next.push(dependency);
          }
        }
      }
      if (next.length === 0) break;
      frontier = next;
    }

    return result;
  }

  /** Repère les déclarations de haut niveau et leur rattache leur préambule. */
  private findSegments(lines: string[], language: string): Segment[] {
    if (BRACE_LANGUAGES.has(language)) {
      return findBraceSegments(lines, language);
    }
    if (language === 'python') {
      return findIndentSegments(lines);
    }
    return [];
  }

  /** Transforme les segments en chunks, en respectant le budget de tokens. */
  private buildChunks(
    segments: Segment[],
    lines: string[],
    filePath: string,
    language: string | undefined
  ): ContextChunk[] {
    const chunks: ContextChunk[] = [];
    const lastModified = new Date();
    let index = 0;

    for (const segment of segments) {
      const segmentLines = lines.slice(segment.startLine, segment.endLine + 1);
      // Un segment peut dépasser le budget : on le redécoupe en conservant
      // ses métadonnées (le nom de la déclaration reste porté par chaque part).
      const parts = splitByTokenBudget(segmentLines, this.config.maxChunkSize);

      for (const part of parts) {
        const content = part.lines.join('\n');
        const metadata: ChunkMetadata = {
          filePath,
          startLine: segment.startLine + part.offset + 1,
          endLine: segment.startLine + part.offset + part.lines.length,
          lastModified,
        };
        if (language) metadata.language = language;
        if (segment.functionName) metadata.functionName = segment.functionName;
        if (segment.className) metadata.className = segment.className;

        chunks.push({
          id: `${filePath}:${index++}`,
          content,
          tokens: estimateTokens(content),
          type: 'code',
          metadata,
        });
      }
    }

    return chunks;
  }
}

/** Estime le nombre de tokens (~4 chars/token). */
export function estimateTokens(content: string): number {
  return Math.ceil(content.length / CHARS_PER_TOKEN);
}

/** Déduit le langage depuis l'extension du fichier. */
export function detectLanguage(filePath: string): string | undefined {
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (!extension) return undefined;
  return EXTENSION_LANGUAGES[extension];
}

function wholeFile(lines: string[]): Segment {
  return { startLine: 0, endLine: Math.max(0, lines.length - 1) };
}

/** Vrai si `content` référence `symbol` comme identifiant entier. */
function referencesSymbol(content: string, symbol: string): boolean {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(content);
}

/**
 * Découpe une liste de lignes en parts dont chacune respecte le budget de
 * tokens. Une ligne seule trop longue devient sa propre part.
 */
function splitByTokenBudget(
  lines: string[],
  maxChunkSize: number
): Array<{ lines: string[]; offset: number }> {
  if (estimateTokens(lines.join('\n')) <= maxChunkSize) {
    return [{ lines, offset: 0 }];
  }

  const parts: Array<{ lines: string[]; offset: number }> = [];
  let current: string[] = [];
  let offset = 0;

  for (const line of lines) {
    const candidate = current.length === 0 ? line : `${current.join('\n')}\n${line}`;
    if (current.length > 0 && estimateTokens(candidate) > maxChunkSize) {
      parts.push({ lines: current, offset });
      offset += current.length;
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    parts.push({ lines: current, offset });
  }

  return parts;
}

/** Le contenu significatif d'un segment (hors blancs). */
function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Compte les accolades d'une ligne en ignorant chaînes et commentaires.
 * `delta` = solde net, `opens` = nombre d'accolades ouvrantes. Les deux sont
 * nécessaires : une déclaration tenant sur une seule ligne (`function a(){}`)
 * a un delta nul mais ouvre bien un bloc.
 */
function scanBraces(line: string): { delta: number; opens: number } {
  let delta = 0;
  let opens = 0;
  let i = 0;

  while (i < line.length) {
    const char = line[i];

    if (char === '/' && line[i + 1] === '/') break; // commentaire ligne
    if (char === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end === -1) break;
      i = end + 2;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      i = skipString(line, i);
      continue;
    }
    if (char === '{') {
      delta++;
      opens++;
    }
    if (char === '}') delta--;
    i++;
  }

  return { delta, opens };
}

function braceDelta(line: string): number {
  return scanBraces(line).delta;
}

/** Avance après la chaîne ouverte à l'index `start`. */
function skipString(line: string, start: number): number {
  const quote = line[start];
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === '\\') {
      i += 2;
      continue;
    }
    if (line[i] === quote) return i + 1;
    i++;
  }
  return line.length;
}

const FUNCTION_PATTERNS: RegExp[] = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function|\()/,
  /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:unsafe\s+)?(?:extern\s+"[^"]*"\s+)?fn\s+([A-Za-z_][\w]*)/,
  /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)/,
];

const TYPE_PATTERNS: RegExp[] = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/,
  /^\s*(?:pub(?:\([^)]*\))?\s+)?struct\s+([A-Za-z_][\w]*)/,
  /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:trait|impl)\s+(?:<[^>]*>\s*)?([A-Za-z_][\w]*)/,
  /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:enum|mod)\s+([A-Za-z_][\w]*)/,
  /^\s*(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+|static\s+)*(?:class|interface|enum|record)\s+([A-Za-z_][\w]*)/,
];

/** Détecte une déclaration au début d'une ligne. */
function matchDeclaration(line: string): DeclarationMatch | undefined {
  for (const pattern of FUNCTION_PATTERNS) {
    const match = pattern.exec(line);
    if (match) return { functionName: match[1] };
  }
  for (const pattern of TYPE_PATTERNS) {
    const match = pattern.exec(line);
    if (match) return { className: match[1] };
  }
  return undefined;
}

/**
 * Segmente les langages à accolades : ne considère que les déclarations de
 * profondeur 0, pour garder une classe entière (avec ses méthodes) groupée.
 */
function findBraceSegments(lines: string[], language: string): Segment[] {
  const segments: Segment[] = [];
  let depth = 0;
  // Début du préambule courant (commentaires, imports, lignes blanches).
  let pendingStart = 0;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (depth === 0) {
      const declaration = matchDeclaration(line);
      if (declaration) {
        const endLine = findBraceDeclarationEnd(lines, index);
        segments.push({
          startLine: pendingStart,
          endLine,
          ...declaration,
        });
        index = endLine + 1;
        pendingStart = index;
        depth = 0;
        continue;
      }
    }

    depth += braceDelta(line);
    if (depth < 0) depth = 0;
    index++;
  }

  // Reste de fichier non déclaratif : rattaché au segment précédent s'il est
  // trop petit pour vivre seul, sinon segment à part.
  if (pendingStart < lines.length) {
    const rest = lines.slice(pendingStart);
    if (rest.some(l => !isBlank(l))) {
      segments.push({ startLine: pendingStart, endLine: lines.length - 1 });
    } else if (segments.length > 0) {
      segments[segments.length - 1].endLine = lines.length - 1;
    }
  }

  void language;
  return segments;
}

/** Trouve la dernière ligne d'une déclaration à accolades. */
function findBraceDeclarationEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let opened = false;

  for (let i = startLine; i < lines.length; i++) {
    const { delta, opens } = scanBraces(lines[i]);
    depth += delta;

    // `opens` et non `delta` : `function a() { return 1; }` a un delta nul
    // mais constitue bien une déclaration complète sur cette ligne.
    if (opens > 0) opened = true;
    if (opened && depth <= 0) return i;

    // Déclaration sur une seule ligne (type alias, struct unitaire, ...).
    if (!opened && lines[i].trimEnd().endsWith(';')) return i;
  }

  return lines.length - 1;
}

/**
 * Segmente Python : une déclaration de haut niveau (indentation 0) court
 * jusqu'à la prochaine ligne non blanche d'indentation 0.
 */
function findIndentSegments(lines: string[]): Segment[] {
  const segments: Segment[] = [];
  let pendingStart = 0;
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const declaration = matchPythonDeclaration(line);

    if (declaration) {
      let end = index;
      for (let i = index + 1; i < lines.length; i++) {
        if (isBlank(lines[i])) continue;
        if (!/^\s/.test(lines[i])) break; // retour à l'indentation 0
        end = i;
      }
      segments.push({ startLine: pendingStart, endLine: end, ...declaration });
      index = end + 1;
      pendingStart = index;
      continue;
    }

    index++;
  }

  if (pendingStart < lines.length) {
    const rest = lines.slice(pendingStart);
    if (rest.some(l => !isBlank(l))) {
      segments.push({ startLine: pendingStart, endLine: lines.length - 1 });
    } else if (segments.length > 0) {
      segments[segments.length - 1].endLine = lines.length - 1;
    }
  }

  return segments;
}

/** Détecte `def`/`class` à l'indentation 0. */
function matchPythonDeclaration(line: string): DeclarationMatch | undefined {
  const functionMatch = /^(?:async\s+)?def\s+([A-Za-z_][\w]*)/.exec(line);
  if (functionMatch) return { functionName: functionMatch[1] };

  const classMatch = /^class\s+([A-Za-z_][\w]*)/.exec(line);
  if (classMatch) return { className: classMatch[1] };

  return undefined;
}
