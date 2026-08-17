/**
 * Façade filesystem
 */

import type {
  ReadFileResponse,
  WriteFileResponse,
  ReadDirResponse,
  FileChangeEvent,
} from '@cortex-ide/shared';

import { getAPI, unwrapResponse } from './client';

export const filesystem = {
  /**
   * Lit le contenu d'un fichier
   */
  async readFile(path: string, encoding?: BufferEncoding): Promise<ReadFileResponse> {
    return unwrapResponse(await getAPI().fs.readFile({ path, encoding }));
  },

  /**
   * Écrit le contenu d'un fichier
   */
  async writeFile(
    path: string,
    content: string,
    encoding?: BufferEncoding
  ): Promise<WriteFileResponse> {
    return unwrapResponse(await getAPI().fs.writeFile({ path, content, encoding }));
  },

  /**
   * Liste le contenu d'un répertoire
   */
  async readDir(path: string, recursive?: boolean): Promise<ReadDirResponse> {
    return unwrapResponse(await getAPI().fs.readDir({ path, recursive }));
  },

  /**
   * Surveille un fichier/répertoire
   */
  async watch(path: string, watchId: string): Promise<void> {
    await getAPI().fs.watch(path, watchId);
  },

  /**
   * Arrête la surveillance
   */
  async unwatch(watchId: string): Promise<void> {
    await getAPI().fs.unwatch(watchId);
  },

  /**
   * S'abonne aux changements de fichiers
   *
   * @returns fonction de désabonnement
   */
  onFileChange(callback: (event: FileChangeEvent) => void): () => void {
    return getAPI().fs.onFileChange(callback);
  },
};
