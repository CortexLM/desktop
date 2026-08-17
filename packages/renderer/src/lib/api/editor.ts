/**
 * Façade editor
 */

import type {
  OpenFileResponse,
  SaveFileResponse,
  FormatDocumentResponse,
} from '@cortex-ide/shared';

import { getAPI, unwrapResponse } from './client';

export const editor = {
  /**
   * Ouvre un fichier dans l'éditeur
   */
  async openFile(path: string, workspaceId?: string): Promise<OpenFileResponse> {
    return unwrapResponse(await getAPI().editor.openFile({ path, workspaceId }));
  },

  /**
   * Enregistre un fichier depuis l'éditeur
   */
  async saveFile(path: string, content: string): Promise<SaveFileResponse> {
    return unwrapResponse(await getAPI().editor.saveFile({ path, content }));
  },

  /**
   * Formate un document
   */
  async format(path: string, content: string, language: string): Promise<FormatDocumentResponse> {
    return unwrapResponse(await getAPI().editor.format({ path, content, language }));
  },
};
