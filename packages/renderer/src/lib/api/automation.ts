/**
 * Façade automation
 */

import type {
  Automation,
  AutomationLog,
  Trigger,
  Action,
  CreateAutomationResponse,
  UpdateAutomationRequest,
} from '@cortex-ide/shared';

import { getAPI, unwrapResponse } from './client';

/**
 * Événement émis au démarrage / à la fin d'une automation.
 *
 * Correspond au payload de `automation:started|completed|failed` côté main.
 */
export interface AutomationEvent {
  automation: Automation;
  log: AutomationLog;
}

/**
 * Événement d'échec : ajoute la cause au payload standard
 */
export interface AutomationFailedEvent extends AutomationEvent {
  error?: string;
}

/**
 * Notification remontée par une action `notification`
 */
export interface AutomationNotification {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
}

export const automation = {
  /**
   * Crée une automation
   */
  async create(
    workspaceId: string,
    name: string,
    enabled: boolean,
    trigger: Trigger,
    actions: Action[]
  ): Promise<CreateAutomationResponse> {
    return unwrapResponse(
      await getAPI().automation.create({ workspaceId, name, enabled, trigger, actions })
    );
  },

  /**
   * Met à jour une automation
   */
  async update(
    id: string,
    updates: Omit<UpdateAutomationRequest, 'id'>
  ): Promise<CreateAutomationResponse> {
    return unwrapResponse(await getAPI().automation.update({ id, ...updates }));
  },

  /**
   * Supprime une automation
   */
  async delete(id: string): Promise<void> {
    unwrapResponse(await getAPI().automation.delete({ id }));
  },

  /**
   * Liste les automations, éventuellement filtrées par workspace
   */
  async list(workspaceId?: string): Promise<Automation[]> {
    return unwrapResponse(await getAPI().automation.list({ workspaceId })).automations;
  },

  /**
   * Récupère une automation par son id
   */
  async get(id: string): Promise<Automation> {
    return unwrapResponse(await getAPI().automation.get({ id })).automation;
  },

  /**
   * Déclenche manuellement une automation
   *
   * @returns le log d'exécution
   */
  async run(id: string, triggerData?: unknown): Promise<AutomationLog> {
    return unwrapResponse(await getAPI().automation.run({ id, triggerData })).log;
  },

  /**
   * Active/désactive une automation
   */
  async toggle(id: string, enabled: boolean): Promise<Automation> {
    return unwrapResponse(await getAPI().automation.toggle({ id, enabled })).automation;
  },

  /**
   * Historique d'exécution d'une automation
   */
  async getLogs(automationId: string, limit?: number): Promise<AutomationLog[]> {
    return unwrapResponse(await getAPI().automation.getLogs({ automationId, limit })).logs;
  },

  /**
   * S'abonne au démarrage d'une automation
   *
   * @returns fonction de désabonnement
   */
  onStarted(callback: (event: AutomationEvent) => void): () => void {
    return getAPI().automation.onStarted(callback);
  },

  /**
   * S'abonne à la réussite d'une automation
   *
   * @returns fonction de désabonnement
   */
  onCompleted(callback: (event: AutomationEvent) => void): () => void {
    return getAPI().automation.onCompleted(callback);
  },

  /**
   * S'abonne à l'échec d'une automation
   *
   * @returns fonction de désabonnement
   */
  onFailed(callback: (event: AutomationFailedEvent) => void): () => void {
    return getAPI().automation.onFailed(callback);
  },

  /**
   * S'abonne aux notifications émises par les automations
   *
   * @returns fonction de désabonnement
   */
  onNotification(callback: (event: AutomationNotification) => void): () => void {
    return getAPI().automation.onNotification(callback);
  },
};
