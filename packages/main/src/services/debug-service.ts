/**
 * Debug Service - Logging and debugging utilities
 */

import { writeFile } from 'fs/promises';
import { logger } from '@cortex-ide/shared/logger';

/**
 * Options d'exécution du service de debug du main process.
 *
 * Ce type s'appelait `DebugSettings`, comme le `DebugSettings` de
 * `@cortex-ide/shared` — mais il ne décrit pas la même chose :
 *
 * - `DebugSettings` (partagé) est le contrat IPC du panneau debug :
 *   `{ enabled, logLevel, categories, maxLogSize, logRotation }`. C'est ce que
 *   `DebugContext` et `SettingsPanel` lisent.
 * - `DebugServiceOptions` (ici) est l'état interne des interrupteurs de
 *   monitoring : `{ logLevel, enableIpcMonitoring,
 *   enablePerformanceMonitoring, maxLogSize }`.
 *
 * Les deux rôles sont réels et distincts, donc aucun n'écrase l'autre : c'est
 * le NOM qui était le problème. Renommer rend la projection de
 * `ipc/handlers/debug-handlers.ts` lisible comme une traduction entre deux
 * contrats, au lieu d'une conversion inexplicable entre deux homonymes.
 *
 * Attention `maxLogSize` : ici c'est un nombre d'entrées (défaut 10 000), dans
 * la forme partagée c'est des Mo. Même nom, unités incompatibles — les
 * handlers ne transmettent volontairement pas ce champ.
 */
export interface DebugServiceOptions {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableIpcMonitoring: boolean;
  enablePerformanceMonitoring: boolean;
  maxLogSize: number;
}

class DebugService {
  private settings: DebugServiceOptions = {
    logLevel: 'info',
    enableIpcMonitoring: true,
    enablePerformanceMonitoring: true,
    maxLogSize: 10000
  };

  async initialize(): Promise<void> {
    logger.info('debug', 'Debug service initialized');
  }

  async cleanup(): Promise<void> {
    logger.info('debug', 'Debug service cleaned up');
  }

  getSettings(): DebugServiceOptions {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<DebugServiceOptions>): void {
    this.settings = { ...this.settings, ...newSettings };
    logger.info('debug', 'Debug settings updated', this.settings);
  }

  async exportLogs(filePath: string): Promise<void> {
    const logs = logger.getLogs();
    await writeFile(filePath, JSON.stringify(logs, null, 2));
    logger.info('debug', `Logs exported to ${filePath}`);
  }
}

export const debugService = new DebugService();
