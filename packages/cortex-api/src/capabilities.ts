/**
 * What the app is allowed to do, given who is signed in.
 *
 * Chat is usable without an account (local or BYO providers). Code is shown to
 * guests and locked: starting a session raises the sign-in modal. Cloud
 * runtimes, usage, review and automations stay shown and locked until there is
 * an account.
 */

import type { CortexModel } from './schemas.ts';

export type RuntimeKind = 'local' | 'cloud' | 'ssh';

export interface Capabilities {
  /** Signed in to a Cortex account. */
  authenticated: boolean;
  /** May run inference through Cortex's own models. */
  cortexModels: boolean;
  /** Runtimes the runtime picker should offer as selectable. */
  runtimes: readonly RuntimeKind[];
  /** Usage and Limits screens have data to show. */
  usageReporting: boolean;
  /** Review screen is reachable. */
  review: boolean;
  /** Automations can be created and scheduled. */
  automations: boolean;
  /** Billing portal and upgrade flow are reachable. */
  billing: boolean;
}

/**
 * Anonymous mode. Chat plus the labelled This PC runtime. Starting a Code
 * session is gated in the UI; the runtime list still includes `local` so the
 * chips stay shown and locked rather than hidden.
 */
export const ANONYMOUS_CAPABILITIES: Capabilities = {
  authenticated: false,
  cortexModels: false,
  runtimes: ['local'],
  usageReporting: false,
  review: false,
  automations: false,
  billing: false,
};

export const AUTHENTICATED_CAPABILITIES: Capabilities = {
  authenticated: true,
  cortexModels: true,
  runtimes: ['local', 'cloud', 'ssh'],
  usageReporting: true,
  review: true,
  automations: true,
  billing: true,
};

export function capabilitiesFor(authenticated: boolean): Capabilities {
  return authenticated ? AUTHENTICATED_CAPABILITIES : ANONYMOUS_CAPABILITIES;
}

/**
 * Where the UI is running. The browser never offers `local`: the Code harness
 * cannot execute in a tab. Desktop may.
 */
export type AppSurface = 'electron' | 'browser';

export function runtimesOn(surface: AppSurface, authenticated: boolean): readonly RuntimeKind[] {
  if (surface === 'browser') return authenticated ? ['cloud', 'ssh'] : [];
  return authenticated ? AUTHENTICATED_CAPABILITIES.runtimes : ANONYMOUS_CAPABILITIES.runtimes;
}

/** Capabilities with the runtime list corrected for web vs desktop. */
export function capabilitiesOn(surface: AppSurface, authenticated: boolean): Capabilities {
  const base = capabilitiesFor(authenticated);
  return { ...base, runtimes: runtimesOn(surface, authenticated) };
}

/** Why a model cannot be selected, or `null` when it can. */
export type ModelLockReason = 'requires-account' | 'requires-upgrade' | 'unavailable';

export interface ModelAvailability {
  model: CortexModel;
  selectable: boolean;
  lockReason: ModelLockReason | null;
}

/**
 * Decides whether a catalogue entry can be selected.
 *
 * The three reasons are distinct on purpose, because the design responds to each
 * differently: signing out shows an account prompt, a premium model shows the upgrade
 * modal, and a stale entry is simply not offered.
 */
export function modelAvailability(
  model: CortexModel,
  capabilities: Capabilities,
): ModelAvailability {
  if (model.stale === true) {
    return { model, selectable: false, lockReason: 'unavailable' };
  }

  if (!capabilities.cortexModels) {
    return { model, selectable: false, lockReason: 'requires-account' };
  }

  // `locked` is the server's own verdict on the caller's plan, so it wins over any
  // client-side inference from `is_premium`.
  if (model.locked === true) {
    return { model, selectable: false, lockReason: 'requires-upgrade' };
  }

  return { model, selectable: true, lockReason: null };
}

export function annotateCatalogue(
  models: readonly CortexModel[],
  capabilities: Capabilities,
): ModelAvailability[] {
  return models.map((model) => modelAvailability(model, capabilities));
}

/** Human label for a model, falling back to its id when the server sends no display name. */
export function modelLabel(model: CortexModel): string {
  return model.display_name?.trim() || model.id;
}

/** Whether a runtime can be selected under the current capabilities. */
export function canUseRuntime(runtime: RuntimeKind, capabilities: Capabilities): boolean {
  return capabilities.runtimes.includes(runtime);
}
