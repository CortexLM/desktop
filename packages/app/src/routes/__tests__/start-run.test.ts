import { describe, expect, it, vi } from 'vitest';

import type { RuntimeKind } from '@cortex-ide/cortex-api';

import { composerDraft, resetComposerDraft, setComposerDraft } from '../../state/composer-draft.ts';
import {
  cycleRuntime,
  pickRepo,
  THIS_PC_NEEDS_FOLDER,
  userFacingStartError,
} from '../start-run.ts';

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

describe('userFacingStartError', () => {
  it('keeps a product message intact', () => {
    expect(userFacingStartError(new Error('No model is configured'))).toBe(
      'No model is configured',
    );
  });

  it('does not put a native-module path on the screen', () => {
    const leaked = new Error(
      "Database initialization failed: Module did not self-register: '/workspace/node_modules/.bun/better-sqlite3@11.5.0/node_modules/better-sqlite3/build/Release/better_sqlite3.node'.",
    );
    const message = userFacingStartError(leaked);
    expect(message).toBe('This workspace could not be opened. Try restarting Cortex.');
    expect(message.toLowerCase()).not.toContain('sqlite');
    expect(message).not.toContain('node_modules');
  });
});
