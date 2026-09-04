/**
 * The composer draft survives a route change.
 *
 * This is a regression lock for a bug with no error message: `HomeRoute` held the draft in a
 * signal it owned, Solid disposed that scope on navigation, and coming back to Home showed an
 * empty composer. Nothing failed — the text was just gone, at exactly the moment someone
 * leaves to check a repository name or an earlier run before sending.
 *
 * Module scope is the fix, so these tests assert the property that makes it work (state
 * outliving its reader) rather than re-testing `createSignal`.
 */

import { createRoot } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';

import {
  composerDraft,
  resetComposerDraft,
  setComposerDraft,
} from '../composer-draft.ts';

afterEach(() => {
  resetComposerDraft('local');
});

describe('the composer draft', () => {
  it('starts empty on the local runtime', () => {
    // Local, not cloud: signed out, a draft pointing at a runtime the user cannot reach would
    // only fail on send.
    expect(composerDraft()).toEqual({ prompt: '', runtime: 'local' });
  });

  it('survives the disposal of the scope that wrote it', () => {
    // Stands in for a route being unmounted. A signal created inside this root would be gone
    // by the time the assertion runs; the module-scope one is not.
    createRoot((dispose) => {
      setComposerDraft((current) => ({ ...current, prompt: 'Fix the flaky auth test' }));
      dispose();
    });

    expect(composerDraft().prompt).toBe('Fix the flaky auth test');
  });

  it('survives repeated mounts and unmounts', () => {
    setComposerDraft((current) => ({ ...current, prompt: 'Investigate the timeout' }));

    for (let visit = 0; visit < 3; visit += 1) {
      createRoot((dispose) => {
        // A reader that only reads must not perturb what it read.
        expect(composerDraft().prompt).toBe('Investigate the timeout');
        dispose();
      });
    }

    expect(composerDraft().prompt).toBe('Investigate the timeout');
  });

  it('keeps the rest of the draft when one field changes', () => {
    setComposerDraft({
      prompt: 'Ship the release',
      runtime: 'local',
      repo: 'cortex/desktop',
      branch: 'main',
    });

    setComposerDraft((current) => ({ ...current, prompt: 'Ship the release now' }));

    // The composer edits fields independently, so a partial update must not drop the pickers'
    // selections.
    expect(composerDraft()).toEqual({
      prompt: 'Ship the release now',
      runtime: 'local',
      repo: 'cortex/desktop',
      branch: 'main',
    });
  });
});

describe('resetting after a session starts', () => {
  it('clears the prompt and the pickers', () => {
    setComposerDraft({
      prompt: 'Fix the flaky auth test',
      runtime: 'local',
      repo: 'cortex/desktop',
      model: 'cortex-codex',
    });

    resetComposerDraft('local');

    expect(composerDraft()).toEqual({ prompt: '', runtime: 'local' });
  });

  it('keeps the runtime the user chose', () => {
    setComposerDraft({ prompt: 'Deploy', runtime: 'cloud' });

    resetComposerDraft('cloud');

    // Resetting to `local` unconditionally would silently undo the choice between one session
    // and the next.
    expect(composerDraft().runtime).toBe('cloud');
  });
});
