/**
 * Automation Service - Main Process
 * Gestion complète du système d'automations avec triggers et actions
 */

import { watch, FSWatcher } from 'chokidar';
import { schedule, ScheduledTask } from 'node-cron';
import { EventEmitter } from 'events';
import { gitService } from './git-service';
import { getAIService } from './ai-service';

import type {
  Action,
  AITaskAction,
  Automation,
  AutomationLog,
  FileTrigger,
  GitOperationAction,
  NotificationAction,
  ScheduleTrigger,
  ScriptAction,
} from '@cortex-ide/shared';

// ============================================================================
// Types
// ============================================================================

// Les types d'automation sont définis une seule fois dans `@cortex-ide/shared`
// (contrat partagé avec le renderer via IPC). Ré-exportés ici pour que les
// consommateurs du service n'aient pas à changer d'import.
export type {
  TriggerType,
  ActionType,
  AutomationStatus,
  FileTrigger,
  GitTrigger,
  ScheduleTrigger,
  ManualTrigger,
  Trigger,
  ScriptAction,
  AITaskAction,
  GitOperationAction,
  NotificationAction,
  Action,
  Automation,
  AutomationLog,
} from '@cortex-ide/shared';

// ============================================================================
// Automation Service
// ============================================================================

/**
 * Nombre maximum de logs conservés en mémoire par automation.
 * Au-delà, les plus anciens sont évincés (ring buffer) pour éviter une
 * croissance illimitée de `logs` sur les automations à haute fréquence.
 */
export const MAX_LOGS_PER_AUTOMATION = 100;

export class AutomationService extends EventEmitter {
  private automations: Map<string, Automation> = new Map();
  private watchers: Map<string, FSWatcher> = new Map();
  private schedulers: Map<string, ScheduledTask> = new Map();
  private logs: Map<string, AutomationLog[]> = new Map();
  private runningAutomations: Set<string> = new Set();
  /**
   * Sessions AI temporaires créées par les actions `ai_task`, encore actives.
   * Sert de filet de sécurité : `cleanup()` supprime toute session dont le
   * `finally` n'aurait pas pu s'exécuter (crash, arrêt de l'app en plein run).
   */
  private activeAISessions: Set<string> = new Set();
  private disposed = false;

  constructor() {
    super();
  }

  /**
   * Nombre de sessions AI temporaires actuellement suivies.
   * Exposé pour le monitoring et les tests de fuite mémoire.
   */
  getActiveAISessionCount(): number {
    return this.activeAISessions.size;
  }

  /**
   * Crée une nouvelle automation
   */
  async createAutomation(automation: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Automation> {
    const id = `automation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const now = Date.now();

    const newAutomation: Automation = {
      id,
      ...automation,
      createdAt: now,
      updatedAt: now,
    };

    this.automations.set(id, newAutomation);

    // Active l'automation si enabled
    if (newAutomation.enabled) {
      await this.activateAutomation(id);
    }

    this.emit('automation:created', newAutomation);

    return newAutomation;
  }

  /**
   * Met à jour une automation
   */
  async updateAutomation(id: string, updates: Partial<Omit<Automation, 'id' | 'createdAt'>>): Promise<Automation> {
    const automation = this.automations.get(id);
    if (!automation) {
      throw new Error(`Automation ${id} not found`);
    }

    // Désactive l'ancienne automation
    await this.deactivateAutomation(id);

    // Applique les mises à jour
    const updated: Automation = {
      ...automation,
      ...updates,
      updatedAt: Date.now(),
    };

    this.automations.set(id, updated);

    // Réactive si enabled
    if (updated.enabled) {
      await this.activateAutomation(id);
    }

    this.emit('automation:updated', updated);

    return updated;
  }

  /**
   * Supprime une automation
   */
  async deleteAutomation(id: string): Promise<void> {
    const automation = this.automations.get(id);
    if (!automation) {
      throw new Error(`Automation ${id} not found`);
    }

    await this.deactivateAutomation(id);
    this.automations.delete(id);
    this.logs.delete(id);

    this.emit('automation:deleted', id);
  }

  /**
   * Liste toutes les automations
   */
  listAutomations(workspaceId?: string): Automation[] {
    const automations = Array.from(this.automations.values());
    
    if (workspaceId) {
      return automations.filter(a => a.workspaceId === workspaceId);
    }
    
    return automations;
  }

  /**
   * Récupère une automation par ID
   */
  getAutomation(id: string): Automation | undefined {
    return this.automations.get(id);
  }

  /**
   * Active/désactive une automation
   */
  async toggleAutomation(id: string, enabled: boolean): Promise<Automation> {
    return await this.updateAutomation(id, { enabled });
  }

  /**
   * Exécute manuellement une automation
   */
  async runAutomation(id: string, triggerData?: unknown): Promise<AutomationLog> {
    const automation = this.automations.get(id);
    if (!automation) {
      throw new Error(`Automation ${id} not found`);
    }

    return await this.executeAutomation(automation, triggerData);
  }

  /**
   * Récupère les logs d'une automation
   */
  getAutomationLogs(automationId: string, limit: number = 50): AutomationLog[] {
    const logs = this.logs.get(automationId) || [];
    return logs.slice(-limit);
  }

  /**
   * Active une automation (setup triggers)
   */
  private async activateAutomation(id: string): Promise<void> {
    const automation = this.automations.get(id);
    if (!automation) return;

    const { trigger } = automation;

    switch (trigger.type) {
      case 'file_watch':
        this.setupFileWatcher(automation);
        break;

      case 'schedule':
        this.setupScheduler(automation);
        break;

      case 'git_hook':
        // Git hooks sont gérés différemment (fichiers .git/hooks)
        // Pour l'instant, on log juste
        console.log(`[Automation] Git hook trigger for ${id} (not yet implemented)`);
        break;

      case 'manual':
        // Manual triggers n'ont pas besoin d'activation
        break;
    }
  }

  /**
   * Désactive une automation (cleanup triggers)
   */
  private async deactivateAutomation(id: string): Promise<void> {
    // Stop file watcher
    const watcher = this.watchers.get(id);
    if (watcher) {
      this.watchers.delete(id);
      // Retire les listeners avant close() : ils capturent l'objet automation
      // (closure), donc les laisser en place retient la référence en mémoire.
      watcher.removeAllListeners();
      await watcher.close();
    }

    // Stop scheduler
    const scheduler = this.schedulers.get(id);
    if (scheduler) {
      this.schedulers.delete(id);
      scheduler.stop();
    }
  }

  /**
   * Setup file watcher trigger
   */
  private setupFileWatcher(automation: Automation): void {
    const trigger = automation.trigger as FileTrigger;

    const watcher = watch(trigger.patterns, {
      cwd: trigger.workspacePath,
      persistent: true,
      ignoreInitial: true,
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
    });

    // Register events
    trigger.events.forEach(event => {
      watcher.on(event, async (path: string) => {
        console.log(`[Automation] File ${event}: ${path}`);
        
        // Execute automation
        try {
          await this.executeAutomation(automation, { event, path });
        } catch (error) {
          console.error(`[Automation] Error executing automation ${automation.id}:`, error);
        }
      });
    });

    this.watchers.set(automation.id, watcher);
  }

  /**
   * Setup schedule trigger
   */
  private setupScheduler(automation: Automation): void {
    const trigger = automation.trigger as ScheduleTrigger;

    const task = schedule(
      trigger.cron,
      async () => {
        console.log(`[Automation] Schedule triggered: ${automation.name}`);
        
        try {
          await this.executeAutomation(automation);
        } catch (error) {
          console.error(`[Automation] Error executing automation ${automation.id}:`, error);
        }
      },
      {
        timezone: trigger.timezone,
      }
    );

    this.schedulers.set(automation.id, task);
  }

  /**
   * Exécute une automation
   */
  private async executeAutomation(automation: Automation, triggerData?: unknown): Promise<AutomationLog> {
    // Empêche les exécutions concurrentes
    if (this.runningAutomations.has(automation.id)) {
      throw new Error(`Automation ${automation.id} is already running`);
    }

    this.runningAutomations.add(automation.id);

    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const startedAt = Date.now();

    const log: AutomationLog = {
      id: logId,
      automationId: automation.id,
      status: 'running',
      startedAt,
      actionResults: [],
    };

    // Ajoute le log (ring buffer borné pour éviter une croissance illimitée)
    let automationLogs = this.logs.get(automation.id);
    if (!automationLogs) {
      automationLogs = [];
      this.logs.set(automation.id, automationLogs);
    }
    automationLogs.push(log);
    if (automationLogs.length > MAX_LOGS_PER_AUTOMATION) {
      automationLogs.splice(0, automationLogs.length - MAX_LOGS_PER_AUTOMATION);
    }

    this.emit('automation:started', { automation, log });

    try {
      // Exécute chaque action
      for (const action of automation.actions) {
        const actionStart = Date.now();
        
        try {
          const output = await this.executeAction(action, triggerData);
          
          log.actionResults.push({
            action,
            status: 'success',
            output,
            duration: Date.now() - actionStart,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          log.actionResults.push({
            action,
            status: 'error',
            error: errorMessage,
            duration: Date.now() - actionStart,
          });

          // Stop sur erreur
          throw error;
        }
      }

      // Succès
      log.status = 'success';
      log.completedAt = Date.now();

      this.emit('automation:completed', { automation, log });

      return log;

    } catch (error) {
      // Erreur
      log.status = 'error';
      log.error = error instanceof Error ? error.message : String(error);
      log.completedAt = Date.now();

      this.emit('automation:failed', { automation, log, error });

      return log;

    } finally {
      this.runningAutomations.delete(automation.id);
    }
  }

  /**
   * Exécute une action
   */
  private async executeAction(action: Action, triggerData?: unknown): Promise<string> {
    switch (action.type) {
      case 'run_script':
        return await this.executeScriptAction(action);

      case 'ai_task':
        return await this.executeAITaskAction(action, triggerData);

      case 'git_operation':
        return await this.executeGitOperationAction(action);

      case 'notification':
        return await this.executeNotificationAction(action);

      default:
        throw new Error(`Unknown action type: ${(action as Action).type}`);
    }
  }

  /**
   * Exécute une action script
   */
  private async executeScriptAction(action: ScriptAction): Promise<string> {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const shell = action.shell || (process.platform === 'win32' ? 'cmd.exe' : '/bin/bash');
      const child = spawn(shell, ['-c', action.script], {
        cwd: action.cwd || process.cwd(),
        env: { ...process.env, ...action.env },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Script exited with code ${code}\n${stderr}`));
        }
      });

      child.on('error', reject);
    });
  }

  /**
   * Exécute une action AI
   */
  private async executeAITaskAction(action: AITaskAction, triggerData?: unknown): Promise<string> {
    const aiService = getAIService();

    // Crée une session temporaire
    const session = await aiService.createSession(action.provider, action.model);
    this.activeAISessions.add(session.id);

    try {
      // Prépare le prompt avec contexte
      let fullPrompt = action.prompt;
      
      if (triggerData) {
        fullPrompt += `\n\nTrigger data: ${JSON.stringify(triggerData, null, 2)}`;
      }

      // Envoie le message
      const response = await aiService.sendMessage(session.id, fullPrompt);
      
      return response.content;
    } finally {
      // Nettoie la session temporaire : sans ça, chaque exécution d'automation
      // laissait une session (+ tout son historique de messages) dans la Map
      // du AIService => fuite mémoire non bornée.
      this.releaseAISession(session.id);
    }
  }

  /**
   * Supprime une session AI temporaire et arrête de la suivre.
   * Tolérant aux erreurs : le nettoyage ne doit jamais masquer le résultat
   * (ou l'erreur) de l'action elle-même.
   */
  private releaseAISession(sessionId: string): void {
    this.activeAISessions.delete(sessionId);

    try {
      getAIService().deleteSession(sessionId);
    } catch (error) {
      console.error(`[Automation] Failed to delete AI session ${sessionId}:`, error);
    }
  }

  /**
   * Exécute une opération Git
   */
  private async executeGitOperationAction(action: GitOperationAction): Promise<string> {
    const { operation, repoPath, params = {} } = action;

    switch (operation) {
      case 'commit': {
        const message = params.message as string || 'Automated commit';
        const files = params.files as string[] | undefined;
        const result = await gitService.commit(repoPath, message, files);
        return `Committed: ${result.hash.slice(0, 7)} - ${result.message}`;
      }

      case 'push': {
        const remote = params.remote as string | undefined;
        const branch = params.branch as string | undefined;
        const result = await gitService.push(repoPath, remote, branch);
        return `Pushed ${result.pushed} commit(s)`;
      }

      case 'pull': {
        const remote = params.remote as string | undefined;
        const branch = params.branch as string | undefined;
        await gitService.pull(repoPath, remote, branch);
        return 'Pull completed';
      }

      case 'branch': {
        const branchName = params.branchName as string;
        const checkout = params.checkout as boolean | undefined;
        await gitService.createBranch(repoPath, branchName, checkout);
        return `Branch ${branchName} created`;
      }

      default:
        throw new Error(`Unknown git operation: ${operation}`);
    }
  }

  /**
   * Exécute une action notification
   */
  private async executeNotificationAction(action: NotificationAction): Promise<string> {
    // Émet un événement pour que le renderer affiche la notification
    this.emit('notification', {
      title: action.title,
      message: action.message,
      level: action.level,
    });

    return `Notification sent: ${action.title}`;
  }

  /**
   * Nettoie toutes les ressources (watchers, schedulers, sessions AI, listeners).
   * Idempotent : peut être appelé plusieurs fois sans effet de bord.
   */
  async cleanup(): Promise<void> {
    // Stop all watchers
    const watchers = Array.from(this.watchers.values());
    this.watchers.clear();
    await Promise.all(
      watchers.map(async (watcher) => {
        try {
          watcher.removeAllListeners();
          await watcher.close();
        } catch (error) {
          console.error('[Automation] Failed to close file watcher:', error);
        }
      })
    );

    // Stop all schedulers
    for (const scheduler of this.schedulers.values()) {
      try {
        scheduler.stop();
      } catch (error) {
        console.error('[Automation] Failed to stop scheduler:', error);
      }
    }
    this.schedulers.clear();

    // Supprime les sessions AI temporaires restées ouvertes (run interrompu)
    for (const sessionId of Array.from(this.activeAISessions)) {
      this.releaseAISession(sessionId);
    }
    this.activeAISessions.clear();

    this.automations.clear();
    this.logs.clear();
    this.runningAutomations.clear();
  }

  /**
   * Libère définitivement le service : cleanup complet + retrait des listeners.
   * À appeler au shutdown de l'application. Après `dispose()`, le service ne
   * doit plus être utilisé.
   */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    await this.cleanup();
    this.removeAllListeners();
  }
}

// Instance singleton
export const automationService = new AutomationService();
