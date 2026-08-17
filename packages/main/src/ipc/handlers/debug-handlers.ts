/**
 * Debug Panel IPC Handlers
 *
 * Sert les canaux `debug:*` consommés par `DebugPanel` et ses sous-panneaux via
 * `window.electron.invoke`.
 *
 * ---------------------------------------------------------------------------
 * Enveloppe : ces handlers renvoient la valeur BRUTE, pas `{ success, data }`.
 * ---------------------------------------------------------------------------
 * C'est le seul domaine dans ce cas, et c'est délibéré : le renderer consomme
 * directement le résultat (`setSettings(result)`, `setMessages(result)`,
 * `result.map(...)`). Renvoyer l'enveloppe standard donnerait `result.map is not
 * a function` et un panneau vide. La forme est donc dictée par les consommateurs
 * existants, pas par la convention des autres domaines.
 *
 * Les erreurs sont propagées telles quelles : `ipcRenderer.invoke` rejette et
 * chaque panneau a déjà son `try/catch`. Les lectures sont construites pour ne
 * pas lever (état en mémoire), afin qu'un panneau ne reste pas bloqué sur son
 * état de chargement.
 *
 * ---------------------------------------------------------------------------
 * Deux contrats, deux noms
 * ---------------------------------------------------------------------------
 * - `DebugSettings` (`@cortex-ide/shared`, `src/types/debug.ts`) : `{ enabled,
 *   logLevel, categories, maxLogSize, logRotation }` — le contrat IPC du
 *   panneau, importé par `DebugContext` et `SettingsPanel`.
 * - `DebugServiceOptions` (`services/debug-service.ts`) : `{ logLevel,
 *   enableIpcMonitoring, enablePerformanceMonitoring, maxLogSize }` — les
 *   interrupteurs internes du service.
 *
 * Les deux s'appelaient `DebugSettings`. Le nom partagé laissait croire à un
 * doublon à dédupliquer, alors que les deux rôles sont réels : d'où le renommage
 * du second plutôt que la fusion des deux.
 *
 * Renvoyer les options du service à la place du contrat ferait lire
 * `settings.enabled` → `undefined` (mode debug bloqué à « off ») et
 * `Object.entries(settings.categories)` → TypeError, qui casse le rendu de
 * `SettingsPanel`. Ce module conserve donc l'état sous la forme attendue par le
 * renderer et projette vers le service les champs que celui-ci possède
 * réellement.
 */

import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import { join } from 'node:path';

import { logger, OptionalLimitSchema, DebugUpdateSettingsRequestSchema } from '@cortex-ide/shared';

import type {
  DebugSettings,
  LogEntry,
  IPCMessage,
  PerformanceMetric,
  MemorySnapshot,
} from '@cortex-ide/shared';

import { debugService } from '../../services/debug-service';
import { ipcMonitor } from '../../services/ipc-monitor';
import { performanceMonitor } from '../../services/performance-monitor';
import { profiler } from '../../performance/profiler';

export const DEBUG_CHANNELS = [
  'debug:get-settings',
  'debug:update-settings',
  'debug:get-logs',
  'debug:clear-logs',
  'debug:get-metrics',
  'debug:clear-metrics',
  'debug:get-memory',
  'debug:get-ipc-messages',
  'debug:get-ipc-stats',
  'debug:clear-ipc',
  'debug:export-logs',
  'debug:get-system-info',
] as const;

// ============================================================================
// Réglages
// ============================================================================

/**
 * Réglages sous la forme attendue par le renderer.
 *
 * `enabled`, `categories` et `logRotation` n'existent pas dans le service : les
 * conserver ici est ce qui permet à un cycle
 * get → update → get de restituer ce que l'utilisateur a enregistré, au lieu de
 * perdre silencieusement ces trois champs.
 */
const DEFAULT_SETTINGS: DebugSettings = {
  enabled: false,
  logLevel: 'info',
  categories: {
    ipc: true,
    performance: true,
    network: true,
    database: true,
    ai: true,
    git: true,
  },
  maxLogSize: 10,
  logRotation: true,
};

let settings: DebugSettings = structuredClone(DEFAULT_SETTINGS);

/** Réinitialise l'état local. Utilisé par les tests. */
export function resetDebugSettings(): void {
  settings = structuredClone(DEFAULT_SETTINGS);
}

export function handleGetSettings(): DebugSettings {
  // `logLevel` est projeté depuis le service : c'est lui qui en est la source de
  // vérité une fois qu'un autre appelant l'a modifié.
  return { ...settings, logLevel: debugService.getSettings().logLevel };
}

export function handleUpdateSettings(request: unknown): DebugSettings {
  const update = DebugUpdateSettingsRequestSchema.parse(request);

  settings = {
    ...settings,
    ...update,
    // `categories` est fusionné champ par champ : `DebugContext` n'envoie que
    // `{ enabled }`, un remplacement d'objet effacerait les catégories.
    categories: { ...settings.categories, ...(update.categories ?? {}) },
  };

  // Projection vers le service, limitée à ce qu'il comprend.
  //
  // `maxLogSize` n'est PAS transmis : le service le compte en nombre d'entrées
  // (défaut 10 000), la forme partagée le documente en Mo. Même nom, unités
  // incompatibles — transmettre la valeur ramènerait le buffer à ~10 entrées.
  // `enableIpcMonitoring` suit la catégorie `ipc` SEULE, pas `enabled &&
  // categories.ipc`.
  //
  // Le panneau debug est atteignable sans activer le mode debug (`DebugPanel` ne
  // teste pas `settings.enabled`). Or `enabled` vaut false par défaut : avec la
  // conjonction, il suffisait d'ouvrir SettingsPanel et de cliquer sur Save —
  // qui renvoie les réglages inchangés — pour couper l'enregistrement IPC et
  // retrouver un IPC Inspector vide, c'est-à-dire exactement le symptôme que ce
  // module sert à corriger. Mesuré : 1 message enregistré avant le Save, 0
  // après.
  //
  // La case « ipc » des catégories est l'interrupteur visible et intentionnel ;
  // c'est donc elle qui décide. `enablePerformanceMonitoring` garde la
  // conjonction : il n'alimente pas de panneau de la même façon (le profiler,
  // lui, tourne indépendamment).
  debugService.updateSettings({
    logLevel: settings.logLevel,
    enableIpcMonitoring: settings.categories.ipc,
    enablePerformanceMonitoring: settings.enabled && settings.categories.performance,
  });

  return handleGetSettings();
}

// ============================================================================
// Logs
// ============================================================================

export function handleGetLogs(limit: unknown): LogEntry[] {
  return logger.getLogs(OptionalLimitSchema.parse(limit));
}

export function handleClearLogs(): { success: true } {
  logger.clear();
  return { success: true };
}

/**
 * Exporte les logs dans un fichier.
 *
 * `DebugPanel` appelle sans argument et lit `result.success` / `result.path` :
 * la destination est donc choisie ici. Une boîte de dialogue est proposée quand
 * une fenêtre est disponible, sinon on retombe sur `userData`.
 */
export async function handleExportLogs(
  event?: Electron.IpcMainInvokeEvent
): Promise<{ success: boolean; path?: string; error?: string }> {
  const defaultName = `cortex-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

  try {
    const parent = event ? BrowserWindow.fromWebContents(event.sender) : null;

    let target: string | undefined;

    if (parent) {
      const result = await dialog.showSaveDialog(parent, {
        title: 'Export Debug Logs',
        defaultPath: join(app.getPath('downloads'), defaultName),
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      // Annulation utilisateur : ce n'est pas une erreur, mais ce n'est pas un
      // succès non plus — `DebugPanel` ne logguera pas de chemin.
      if (result.canceled || !result.filePath) {
        return { success: false };
      }

      target = result.filePath;
    } else {
      target = join(app.getPath('userData'), defaultName);
    }

    await debugService.exportLogs(target);
    return { success: true, path: target };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export logs',
    };
  }
}

// ============================================================================
// Métriques de performance
// ============================================================================

/**
 * Convertit une métrique du profiler vers la forme partagée.
 *
 * Le profiler mesure des durées (`duration`), la forme partagée attend une
 * valeur numérique générique (`value`) + une unité. Les métriques encore en
 * cours (pas de `duration`) sont écartées : elles n'ont rien à tracer.
 */
function fromProfiler(): PerformanceMetric[] {
  return profiler
    .getReport()
    .metrics.filter((metric): metric is typeof metric & { duration: number } =>
      typeof metric.duration === 'number'
    )
    .map((metric) => ({
      id: `${metric.category}-${metric.name}-${metric.startTime}`,
      timestamp: Math.round(metric.startTime),
      category: metric.category,
      name: metric.name,
      value: metric.duration,
      unit: 'ms',
    }));
}

/**
 * `PerformancePanel` appelle `('debug:get-metrics', undefined, 500)` : la
 * catégorie est le premier argument, la limite le second.
 *
 * Deux sources sont fusionnées. `performanceMonitor` est la source désignée du
 * panneau debug mais rien ne l'alimente aujourd'hui (aucun appel à
 * `recordMetric()` dans le main process) ; `profiler` est réellement alimenté et
 * fournit les mesures IPC/DB/startup. Sans cette fusion, le panneau afficherait
 * un graphique vide alors que des mesures existent.
 */
export function handleGetMetrics(category: unknown, limit: unknown): PerformanceMetric[] {
  const resolvedCategory = typeof category === 'string' && category ? category : undefined;
  const resolvedLimit = OptionalLimitSchema.parse(limit);

  const recorded: PerformanceMetric[] = performanceMonitor
    .getMetrics(resolvedCategory)
    .map((metric, index) => ({
      id: `pm-${metric.category}-${metric.name}-${metric.timestamp}-${index}`,
      timestamp: metric.timestamp,
      category: metric.category,
      name: metric.name,
      value: metric.value,
      unit: metric.unit ?? 'ms',
    }));

  const profiled = resolvedCategory
    ? fromProfiler().filter((metric) => metric.category === resolvedCategory)
    : fromProfiler();

  const all = [...recorded, ...profiled].sort((a, b) => a.timestamp - b.timestamp);

  // La limite garde les entrées les plus récentes, comme les services.
  return resolvedLimit ? all.slice(-resolvedLimit) : all;
}

export function handleClearMetrics(): { success: true } {
  performanceMonitor.clear();
  profiler.clear();
  return { success: true };
}

/**
 * Snapshots mémoire.
 *
 * Même raison que pour les métriques : `performanceMonitor` n'est pas alimenté,
 * le profiler l'est (échantillonnage périodique), donc on retombe sur lui quand
 * le premier est vide.
 */
export function handleGetMemory(limit: unknown): MemorySnapshot[] {
  const resolvedLimit = OptionalLimitSchema.parse(limit);

  const recorded = performanceMonitor.getMemorySnapshots(resolvedLimit);
  if (recorded.length > 0) {
    return recorded;
  }

  const profiled = profiler.getReport().memorySnapshots;
  return resolvedLimit ? profiled.slice(-resolvedLimit) : profiled;
}

// ============================================================================
// Messages IPC
// ============================================================================

/**
 * Convertit un message du moniteur vers la forme partagée.
 *
 * Deux écarts à combler :
 * - `direction` : le moniteur enregistre `'send' | 'receive'`, la forme partagée
 *   (et le filtre du panneau, et sa colorisation) attend
 *   `'renderer->main' | 'main->renderer'`.
 * - `id` : absent du moniteur, requis comme clé React et pour le dépliage. Il
 *   est dérivé du canal, du timestamp et de l'index pour rester stable entre
 *   deux polls (le panneau recharge toutes les secondes) tout en étant unique.
 */
function toSharedIPCMessage(
  message: ReturnType<typeof ipcMonitor.getMessages>[number],
  index: number
): IPCMessage {
  return {
    id: `${message.channel}-${message.timestamp}-${index}`,
    timestamp: message.timestamp,
    channel: message.channel,
    direction: message.direction === 'send' ? 'renderer->main' : 'main->renderer',
    // Le moniteur n'enregistre pas les payloads (ils peuvent contenir des
    // secrets et du contenu de fichiers). Le panneau affiche donc « pas de
    // payload » plutôt qu'une valeur inventée.
    data: undefined,
    duration: message.duration,
  };
}

export function handleGetIPCMessages(limit: unknown): IPCMessage[] {
  const resolvedLimit = OptionalLimitSchema.parse(limit);
  return ipcMonitor.getMessages(resolvedLimit).map(toSharedIPCMessage);
}

export function handleGetIPCStats(): Record<string, { count: number; avgDuration: number }> {
  const stats = ipcMonitor.getChannelStats();

  // `avgDuration` vaut NaN quand aucun message du canal ne porte de durée
  // (`totalDuration / count` avec totalDuration=0 donne 0, mais count=0 donnerait
  // NaN) ; `toFixed()` afficherait alors "NaN". Normalisé à 0.
  return Object.fromEntries(
    Object.entries(stats).map(([channel, data]) => [
      channel,
      {
        count: data.count,
        avgDuration: Number.isFinite(data.avgDuration) ? data.avgDuration : 0,
      },
    ])
  );
}

export function handleClearIPC(): { success: true } {
  ipcMonitor.clear();
  return { success: true };
}

// ============================================================================
// Informations système
// ============================================================================

export interface DebugSystemInfo {
  version: string;
  platform: string;
  arch: string;
  electron: string;
  chrome: string;
  node: string;
  v8: string;
  appPath: string;
  userData: string;
  /**
   * `SettingsPanel` affiche `systemInfo.logs` (« Logs Directory ») alors que son
   * interface `SystemInfo` locale ne déclare pas le champ. Il est fourni ici
   * pour que la ligne ne soit pas vide à l'écran.
   */
  logs: string;
}

/**
 * Lit une valeur d'`app` sans jamais lever.
 *
 * `app.getPath('logs')` peut échouer selon la plateforme et le moment de
 * l'appel. Comme `SettingsPanel` reste bloqué sur son spinner tant que
 * `debug:get-settings` / `debug:get-system-info` n'ont pas répondu, une lecture
 * d'information secondaire ne doit pas faire échouer l'ensemble : le champ est
 * simplement marqué indisponible.
 */
function safely(read: () => string): string {
  try {
    return read() ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function handleGetSystemInfo(): DebugSystemInfo {
  return {
    version: safely(() => app.getVersion()),
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron ?? 'unknown',
    chrome: process.versions.chrome ?? 'unknown',
    node: process.versions.node,
    v8: process.versions.v8,
    appPath: safely(() => app.getAppPath()),
    userData: safely(() => app.getPath('userData')),
    logs: safely(() => app.getPath('logs')),
  };
}

// ============================================================================
// Enregistrement
// ============================================================================

/**
 * Enregistre les handlers debug.
 *
 * Les signatures sont alignées sur les appels réels du renderer, y compris
 * `debug:get-metrics` qui reçoit `(category, limit)`.
 */
export function registerDebugHandlers(): void {
  ipcMain.handle('debug:get-settings', () => handleGetSettings());
  ipcMain.handle('debug:update-settings', (_event, request) => handleUpdateSettings(request));

  ipcMain.handle('debug:get-logs', (_event, limit) => handleGetLogs(limit));
  ipcMain.handle('debug:clear-logs', () => handleClearLogs());
  ipcMain.handle('debug:export-logs', (event) => handleExportLogs(event));

  ipcMain.handle('debug:get-metrics', (_event, category, limit) =>
    handleGetMetrics(category, limit)
  );
  ipcMain.handle('debug:clear-metrics', () => handleClearMetrics());
  ipcMain.handle('debug:get-memory', (_event, limit) => handleGetMemory(limit));

  ipcMain.handle('debug:get-ipc-messages', (_event, limit) => handleGetIPCMessages(limit));
  ipcMain.handle('debug:get-ipc-stats', () => handleGetIPCStats());
  ipcMain.handle('debug:clear-ipc', () => handleClearIPC());

  ipcMain.handle('debug:get-system-info', () => handleGetSystemInfo());
}

/**
 * Désenregistre les handlers debug
 */
export function unregisterDebugHandlers(): void {
  DEBUG_CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
}
