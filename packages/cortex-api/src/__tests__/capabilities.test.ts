import { describe, expect, it } from 'vitest';

import {
  annotateCatalogue,
  ANONYMOUS_CAPABILITIES,
  AUTHENTICATED_CAPABILITIES,
  canUseRuntime,
  capabilitiesFor,
  capabilitiesOn,
  runtimesOn,
  modelAvailability,
  modelLabel,
} from '../capabilities.ts';
import type { CortexModel } from '../schemas.ts';
import { MODELS_RESPONSE } from './fixtures.ts';

const catalogue = MODELS_RESPONSE.data as unknown as CortexModel[];
const codex = catalogue.find((model) => model.id === 'cortex-codex')!;
const opus = catalogue.find((model) => model.id === 'cortex-opus')!;

describe('anonymous capabilities', () => {
  it('keeps the app usable without an account', () => {
    // The product requirement: everything works signed out except what is Cortex's to give.
    expect(ANONYMOUS_CAPABILITIES.runtimes).toEqual(['local']);
    expect(ANONYMOUS_CAPABILITIES.authenticated).toBe(false);
  });

  it('withholds every account-backed feature', () => {
    expect(ANONYMOUS_CAPABILITIES).toMatchObject({
      cortexModels: false,
      usageReporting: false,
      review: false,
      automations: false,
      billing: false,
    });
  });

  it('offers all three runtimes once signed in', () => {
    expect(AUTHENTICATED_CAPABILITIES.runtimes).toEqual(['local', 'cloud', 'ssh']);
  });

  it('derives the set from the auth flag', () => {
    expect(capabilitiesFor(false)).toBe(ANONYMOUS_CAPABILITIES);
    expect(capabilitiesFor(true)).toBe(AUTHENTICATED_CAPABILITIES);
  });

  it('gates the runtime picker', () => {
    expect(canUseRuntime('local', ANONYMOUS_CAPABILITIES)).toBe(true);
    expect(canUseRuntime('cloud', ANONYMOUS_CAPABILITIES)).toBe(false);
    expect(canUseRuntime('ssh', ANONYMOUS_CAPABILITIES)).toBe(false);
    expect(canUseRuntime('cloud', AUTHENTICATED_CAPABILITIES)).toBe(true);
  });
});

describe('surface runtimes', () => {
  it('never offers local in the browser', () => {
    expect(runtimesOn('browser', false)).toEqual([]);
    expect(runtimesOn('browser', true)).toEqual(['cloud', 'ssh']);
  });

  it('keeps local on desktop signed out', () => {
    expect(runtimesOn('electron', false)).toEqual(['local']);
    expect(capabilitiesOn('electron', false).runtimes).toEqual(['local']);
  });
});

describe('model gating', () => {
  it('locks the whole catalogue behind an account when signed out', () => {
    // The catalogue itself is public, which is deliberate: a signed-out picker shows the
    // real Cortex models as locked rather than being empty.
    for (const entry of annotateCatalogue(catalogue, ANONYMOUS_CAPABILITIES)) {
      expect(entry.selectable, entry.model.id).toBe(false);
      expect(entry.lockReason, entry.model.id).toBe('requires-account');
    }
  });

  it('unlocks the free model once signed in', () => {
    const entry = modelAvailability(codex, AUTHENTICATED_CAPABILITIES);
    expect(entry.selectable).toBe(true);
    expect(entry.lockReason).toBeNull();
  });

  it('keeps a premium model locked even when signed in', () => {
    // cortex-opus comes back with locked: true, which is the server's verdict on the plan.
    const entry = modelAvailability(opus, AUTHENTICATED_CAPABILITIES);
    expect(entry.selectable).toBe(false);
    expect(entry.lockReason).toBe('requires-upgrade');
  });

  it("prefers the server's lock verdict over is_premium", () => {
    // A premium model the plan does include must be selectable, so the client cannot infer
    // the lock from the price tier.
    const premiumButAllowed: CortexModel = { ...opus, locked: false };
    expect(modelAvailability(premiumButAllowed, AUTHENTICATED_CAPABILITIES).selectable).toBe(true);
  });

  it('distinguishes the three lock reasons, because the design responds to each differently', () => {
    // Signing out prompts for an account, premium opens the upgrade modal, and stale is
    // simply not offered.
    expect(modelAvailability(codex, ANONYMOUS_CAPABILITIES).lockReason).toBe('requires-account');
    expect(modelAvailability(opus, AUTHENTICATED_CAPABILITIES).lockReason).toBe('requires-upgrade');
    expect(
      modelAvailability({ ...codex, stale: true }, AUTHENTICATED_CAPABILITIES).lockReason,
    ).toBe('unavailable');
  });

  it('treats a stale model as unavailable before any other check', () => {
    // Otherwise a signed-out user would be told to make an account for a model that is
    // gone regardless.
    expect(modelAvailability({ ...codex, stale: true }, ANONYMOUS_CAPABILITIES).lockReason).toBe(
      'unavailable',
    );
  });

  it('leaves a model selectable when the server sends no lock field at all', () => {
    const { locked: _locked, is_premium: _premium, stale: _stale, ...bare } = codex;
    expect(modelAvailability(bare as CortexModel, AUTHENTICATED_CAPABILITIES).selectable).toBe(true);
  });
});

describe('model labels', () => {
  it('uses the display name the server sends', () => {
    expect(modelLabel(codex)).toBe('Cortex Codex');
  });

  it('falls back to the id when there is no display name', () => {
    const { display_name: _displayName, ...bare } = codex;
    expect(modelLabel(bare as CortexModel)).toBe('cortex-codex');
  });

  it('falls back to the id when the display name is blank', () => {
    expect(modelLabel({ ...codex, display_name: '   ' })).toBe('cortex-codex');
  });
});
