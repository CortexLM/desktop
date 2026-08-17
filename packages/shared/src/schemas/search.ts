/**
 * Zod Schemas - Advanced Search (canaux `search:*`)
 *
 * Le renderer envoie `rootPath` au même niveau que les options de recherche ;
 * `AdvancedSearchService.search()` attend `(rootPath, options)`. Le handler
 * sépare les deux.
 */

import { z } from 'zod';

/**
 * Options communes à `search:find` et `search:replace`.
 *
 * `includePatterns` / `excludePatterns` restent optionnels : le service applique
 * ses propres valeurs par défaut (dont l'exclusion de `node_modules`), qu'il ne
 * faut pas dupliquer ici au risque de les voir diverger.
 */
const SearchOptionsShape = {
  query: z.string().min(1, 'query is required'),
  useRegex: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  wholeWord: z.boolean().optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
};

export const SearchFindRequestSchema = z.object({
  rootPath: z.string().min(1, 'rootPath is required'),
  ...SearchOptionsShape,
  maxResults: z.number().int().positive().max(100_000).optional(),
  contextLines: z.number().int().min(0).max(50).optional(),
});

export const SearchReplaceRequestSchema = z.object({
  rootPath: z.string().min(1, 'rootPath is required'),
  ...SearchOptionsShape,
  replacement: z.string(),
  /**
   * Par défaut `true` : un remplacement global écrit sur le disque et n'est pas
   * annulable, il ne doit pas se produire parce que le champ a été oublié.
   */
  dryRun: z.boolean().optional().default(true),
});

export type SearchFindRequest = z.infer<typeof SearchFindRequestSchema>;
export type SearchReplaceRequest = z.infer<typeof SearchReplaceRequestSchema>;
