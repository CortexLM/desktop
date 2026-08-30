import { describe, expect, it, vi } from 'vitest';

import type { RuntimeKind } from '@cortex-ide/cortex-api';

import { composerDraft, resetComposerDraft, setComposerDraft } from '../../state/composer-draft.ts';
import { cycleRuntime, pickRepo, THIS_PC_NEEDS_FOLDER } from '../start-run.ts';

describe('cycleRuntime', () => {
  it('does nothing when only This PC is available', () => {
    resetComposerDraft('local');
    cycleRuntime(['local']);
    expect(composerDraft().runtime).toBe('local');
  });

  it('advances through Cloud and SSH when they are allowed', () => {
    resetComposerDraft('local');
    const allowed: RuntimeKind[] = ['local', 'cloud', 'ssh'];
    cycleRuntime(allowed);
    expect(composerDraft().runtime).toBe('cloud');
    cycleRuntime(allowed);
    expect(composerDraft().runtime).toBe('ssh');
  });
});

describe('pickRepo', () => {
  it('opens the folder picker when there is nothing to cycle', () => {
    const openFolder = vi.fn();
    pickRepo([], openFolder);
    expect(openFolder).toHaveBeenCalledOnce();
  });

  it('cycles repository ids when a folder is already open', () => {
    setComposerDraft({ prompt: '', runtime: 'local', repo: 'app' });
    pickRepo(['app', 'api'], vi.fn());
    expect(composerDraft().repo).toBe('api');
  });
});

describe('This PC copy', () => {
  it('names the folder requirement rather than a cloud fallback', () => {
    expect(THIS_PC_NEEDS_FOLDER).toMatch(/this computer/i);
    expect(THIS_PC_NEEDS_FOLDER).toMatch(/not a cloud workspace/);
  });
});
