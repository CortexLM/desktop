/**
 * Format Service - Main Process
 * Formatage de documents via Prettier, avec résolution de la config du projet
 * (.prettierrc, prettier.config.js, ...) et fallback sur les defaults Cortex.
 */

import * as path from 'path';

export interface FormatRequest {
  /** Chemin du fichier (utilisé pour résoudre la config et inférer le parser) */
  path: string;
  content: string;
  /** Langage fourni par l'éditeur (Monaco language id) */
  language: string;
}

export interface FormatChange {
  range: { start: number; end: number };
  text: string;
}

export interface FormatResult {
  formatted: string;
  changes: FormatChange[];
}

/**
 * Erreur de formatage : le contenu n'a pas pu être formaté (syntaxe invalide,
 * langage non supporté, ...). Le contenu original n'est jamais modifié.
 */
export class FormatError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'FormatError';
  }
}

/**
 * Mapping Monaco language id -> parser Prettier.
 * Les langages absents de cette table ne sont pas supportés par Prettier.
 */
const LANGUAGE_PARSERS: Record<string, string> = {
  javascript: 'babel',
  javascriptreact: 'babel',
  jsx: 'babel',
  babel: 'babel',
  flow: 'babel-flow',
  typescript: 'typescript',
  typescriptreact: 'typescript',
  tsx: 'typescript',
  json: 'json',
  jsonc: 'json',
  json5: 'json5',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  html: 'html',
  vue: 'vue',
  angular: 'angular',
  handlebars: 'glimmer',
  graphql: 'graphql',
  markdown: 'markdown',
  mdx: 'mdx',
  yaml: 'yaml',
};

/**
 * Mapping extension de fichier -> parser Prettier.
 * Sert de fallback quand `language` est absent/inconnu (ex: 'plaintext').
 */
const EXTENSION_PARSERS: Record<string, string> = {
  '.js': 'babel',
  '.cjs': 'babel',
  '.mjs': 'babel',
  '.jsx': 'babel',
  '.ts': 'typescript',
  '.cts': 'typescript',
  '.mts': 'typescript',
  '.tsx': 'typescript',
  '.json': 'json',
  '.jsonc': 'json',
  '.json5': 'json5',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.htm': 'html',
  '.vue': 'vue',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdx': 'mdx',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

/** Defaults Cortex IDE, utilisés si le projet n'a pas de config Prettier. */
const DEFAULT_OPTIONS = {
  singleQuote: true,
  trailingComma: 'es5' as const,
  tabWidth: 2,
  semi: true,
  printWidth: 100,
};

/**
 * Résout le parser Prettier pour un fichier donné.
 * @returns le nom du parser, ou `undefined` si le langage n'est pas supporté
 */
export function resolveParser(filePath: string, language?: string): string | undefined {
  if (language) {
    const fromLanguage = LANGUAGE_PARSERS[language.toLowerCase()];
    if (fromLanguage) return fromLanguage;
  }

  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_PARSERS[ext];
}

/**
 * Formate un document.
 *
 * Prettier est chargé dynamiquement (~2 Mo) afin de ne pas peser sur le
 * démarrage du process main : le coût n'est payé qu'au premier formatage.
 *
 * @throws {FormatError} si le langage n'est pas supporté ou le contenu invalide
 */
export async function formatDocument(request: FormatRequest): Promise<FormatResult> {
  const parser = resolveParser(request.path, request.language);

  if (!parser) {
    throw new FormatError(
      `No formatter available for language "${request.language}" (${path.basename(request.path)})`
    );
  }

  const prettier = await import('prettier');

  // Respecte la config du projet (.prettierrc, prettier.config.js, ...) si présente
  let projectOptions: Record<string, unknown> = {};
  try {
    const resolved = await prettier.resolveConfig(request.path);
    if (resolved) {
      projectOptions = resolved as Record<string, unknown>;
    }
  } catch (error) {
    // Config illisible/invalide : on continue avec les defaults plutôt que d'échouer
    console.warn(`[FormatService] Could not resolve prettier config for ${request.path}:`, error);
  }

  let formatted: string;
  try {
    formatted = await prettier.format(request.content, {
      ...DEFAULT_OPTIONS,
      ...projectOptions,
      parser,
      filepath: request.path,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new FormatError(`Failed to format ${path.basename(request.path)}: ${message}`, error);
  }

  // Pas de changement => pas d'edit à appliquer côté éditeur
  if (formatted === request.content) {
    return { formatted, changes: [] };
  }

  return {
    formatted,
    changes: [
      {
        range: { start: 0, end: request.content.length },
        text: formatted,
      },
    ],
  };
}
