/**
 * Façade terminal
 */

import type {
  CreateTerminalResponse,
  TerminalDataEvent,
  TerminalExitEvent,
} from '@cortex-ide/shared';

import { getAPI, unwrapResponse } from './client';

export const terminal = {
  /**
   * Crée un terminal (PTY)
   */
  async create(
    cwd?: string,
    env?: Record<string, string>,
    shell?: string
  ): Promise<CreateTerminalResponse> {
    return unwrapResponse(await getAPI().terminal.create({ cwd, env, shell }));
  },

  /**
   * Écrit dans l'entrée du terminal
   */
  async input(terminalId: string, data: string): Promise<void> {
    unwrapResponse(await getAPI().terminal.input({ terminalId, data }));
  },

  /**
   * Redimensionne le terminal
   */
  async resize(terminalId: string, cols: number, rows: number): Promise<void> {
    unwrapResponse(await getAPI().terminal.resize({ terminalId, cols, rows }));
  },

  /**
   * Termine le processus du terminal
   */
  async kill(terminalId: string): Promise<void> {
    unwrapResponse(await getAPI().terminal.kill(terminalId));
  },

  /**
   * S'abonne à la sortie du terminal
   *
   * @returns fonction de désabonnement
   */
  onData(callback: (event: TerminalDataEvent) => void): () => void {
    return getAPI().terminal.onData(callback);
  },

  /**
   * S'abonne à la fin du processus
   *
   * @returns fonction de désabonnement
   */
  onExit(callback: (event: TerminalExitEvent) => void): () => void {
    return getAPI().terminal.onExit(callback);
  },
};
