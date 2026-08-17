/**
 * Advanced Search IPC Handlers
 *
 * Sert les canaux `search:*` consommés par `AdvancedSearchPanel` via
 * `window.ipc`. Toute la logique (glob, regex, filtrage binaire, preview de
 * remplacement) reste dans `AdvancedSearchService`.
 */

import { ipcMain } from 'electron';

import {
  SearchFindRequestSchema,
  SearchReplaceRequestSchema,
  NoPayloadSchema,
} from '@cortex-ide/shared';

import type { SearchFindRequest, SearchReplaceRequest, NoPayload } from '@cortex-ide/shared';

import {
  getAdvancedSearchService,
  type SearchResult,
  type ReplaceResult,
} from '../../services/advanced-search-service';
import { createHandler } from './shared/handler-factory';

export const SEARCH_CHANNELS = ['search:find', 'search:replace', 'search:get-history'] as const;

/**
 * Formes de réponse.
 *
 * `AdvancedSearchPanel` lit `response.data.results` et `response.data.history` :
 * les tableaux du service sont encapsulés sous une clé nommée, jamais renvoyés
 * nus.
 */
export interface SearchFindResponse {
  results: SearchResult[];
}

export interface SearchReplaceResponse {
  results: ReplaceResult[];
}

export interface SearchHistoryResponse {
  history: string[];
}

export const handleSearchFind = createHandler<SearchFindRequest, SearchFindResponse>(
  SearchFindRequestSchema,
  async ({ rootPath, ...options }) => ({
    // `rootPath` est un paramètre positionnel du service, pas une option.
    results: await getAdvancedSearchService().search(rootPath, options),
  })
);

export const handleSearchReplace = createHandler<SearchReplaceRequest, SearchReplaceResponse>(
  SearchReplaceRequestSchema,
  async ({ rootPath, ...options }) => ({
    results: await getAdvancedSearchService().replace(rootPath, options),
  })
);

export const handleSearchGetHistory = createHandler<NoPayload, SearchHistoryResponse>(
  NoPayloadSchema,
  async () => ({ history: getAdvancedSearchService().getSearchHistory() })
);

/**
 * Enregistre les handlers de recherche
 */
export function registerSearchHandlers(): void {
  ipcMain.handle('search:find', handleSearchFind);
  ipcMain.handle('search:replace', handleSearchReplace);
  ipcMain.handle('search:get-history', handleSearchGetHistory);
}

/**
 * Désenregistre les handlers de recherche
 */
export function unregisterSearchHandlers(): void {
  SEARCH_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
