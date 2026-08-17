/**
 * Close confirmation — the decision, and the wording that carries it.
 *
 * WHAT THESE TESTS ARE FOR
 * ------------------------
 * The feature has exactly two ways to be worthless while still looking present:
 *
 *   1. it stops asking (on one path, or all of them);
 *   2. it asks, but the button the user reaches for destroys their work.
 *
 * Neither is visible in a screenshot, and neither is caught by "does the dialog
 * render". So the assertions here are about the *pairing* of label and casualty,
 * and about which sets of tabs do and do not produce a prompt at all. The wording
 * is asserted literally, for the reason `RESOLUTION_LABELS` is: a label that stops
 * naming what it destroys is a regression in the only thing this feature does.
 *
 * The mirror-image property is asserted just as hard: a clean tab must close with
 * no prompt. Friction there is not extra safety, it is the mechanism by which a
 * user learns to click "yes" without reading — which disarms the prompt on the one
 * close in fifty where it mattered.
 */

import { describe, it, expect } from 'vitest';

import {
  DOOMED_REASON_TEXT,
  buildClosePrompt,
  classifyTab,
  planClose,
  prunePendingClose,
  tabsClosedBy,
  worstCasualty,
  type ClosableTab,
  type CloseScope,
} from '../close-confirmation';

/** A tab, clean unless said otherwise. */
function tab(overrides: Partial<ClosableTab> & { id: string }): ClosableTab {
  return {
    path: `/w/${overrides.id}.ts`,
    isDirty: false,
    ...overrides,
  };
}

const dirty = (id: string, extra: Partial<ClosableTab> = {}): ClosableTab =>
  tab({ id, isDirty: true, ...extra });

describe('classifyTab', () => {
  it('finds nothing to lose in a clean tab', () => {
    expect(classifyTab(tab({ id: 'a' }))).toBeNull();
  });

  it('finds nothing to lose in a clean tab that agrees with disk', () => {
    expect(classifyTab(tab({ id: 'a', diskState: 'clean' }))).toBeNull();
  });

  it('reports an ordinary dirty tab as unsaved edits', () => {
    expect(classifyTab(dirty('a'))).toEqual({ id: 'a', path: '/w/a.ts', reason: 'unsaved' });
  });

  it('distinguishes a conflicted dirty tab from an ordinary one', () => {
    // Same casualty — the user's edits — but the disk still holds a version, and
    // the wording says so. Collapsing the two would make the prompt for a
    // conflict claim more, or less, than is true.
    expect(classifyTab(dirty('a', { diskState: 'conflict' }))).toEqual({
      id: 'a',
      path: '/w/a.ts',
      reason: 'conflicted',
    });
  });

  it('reports a missing tab as holding the only copy', () => {
    expect(classifyTab(dirty('a', { diskState: 'missing' }))).toEqual({
      id: 'a',
      path: '/w/a.ts',
      reason: 'only-copy',
    });
  });

  it('reports a missing tab as the only copy even when it is marked clean', () => {
    // Reconciliation only flags dirty tabs `missing`, so the two normally agree.
    // But `markTabDirty(id, false)` with no mtime leaves `diskState` in place, so
    // a clean-and-missing tab is reachable — and trusting `isDirty` alone there
    // would let the last copy of a deleted file close without a word. The severe
    // condition is checked first on purpose; this is that check.
    expect(classifyTab(tab({ id: 'a', isDirty: false, diskState: 'missing' }))).toEqual({
      id: 'a',
      path: '/w/a.ts',
      reason: 'only-copy',
    });
  });

  it('finds nothing to lose in an unsaved-lost tab', () => {
    // The edits were dropped for size on a previous boot and the tab now shows
    // the disk version with `isDirty` cleared. Prompting would ask the user to
    // authorise the loss of something already gone — a dialog whose only effect
    // is to teach people to dismiss dialogs.
    expect(classifyTab(tab({ id: 'a', isDirty: false, diskState: 'unsaved-lost' }))).toBeNull();
  });

  it('still reports a dirty unsaved-lost tab: the new edits are real', () => {
    // If the user has typed since the restore, that work exists nowhere else.
    expect(classifyTab(dirty('a', { diskState: 'unsaved-lost' }))?.reason).toBe('unsaved');
  });
});

describe('worstCasualty', () => {
  it('is nothing for an empty set', () => {
    expect(worstCasualty([])).toBe('nothing');
  });

  it('is my-edits when only unsaved work is at stake', () => {
    expect(
      worstCasualty([
        { id: 'a', path: '/w/a.ts', reason: 'unsaved' },
        { id: 'b', path: '/w/b.ts', reason: 'conflicted' },
      ])
    ).toBe('my-edits');
  });

  it('is only-copy when any tab holds the last copy', () => {
    // The worst outcome in the set decides the label. A prompt that said
    // "discard my unsaved edits" while one of the three files would cease to
    // exist would be understating it by the whole point.
    expect(
      worstCasualty([
        { id: 'a', path: '/w/a.ts', reason: 'unsaved' },
        { id: 'b', path: '/w/b.ts', reason: 'only-copy' },
      ])
    ).toBe('only-copy');
  });
});

describe('tabsClosedBy', () => {
  const open = [tab({ id: 'a' }), tab({ id: 'b' }), tab({ id: 'c' })];

  it('takes one tab for a single close', () => {
    expect(tabsClosedBy({ kind: 'tab', tabId: 'b' }, open).map((t) => t.id)).toEqual(['b']);
  });

  it('takes everything but the anchor for close-others', () => {
    expect(tabsClosedBy({ kind: 'others', tabId: 'b' }, open).map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('takes everything for close-all', () => {
    expect(tabsClosedBy({ kind: 'all' }, open).map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserves strip order, so a listed prompt reads in the order shown', () => {
    expect(tabsClosedBy({ kind: 'all' }, open).map((t) => t.id)).toEqual(open.map((t) => t.id));
  });
});

describe('planClose — when it does not ask', () => {
  it('closes a clean tab immediately', () => {
    const decision = planClose({ kind: 'tab', tabId: 'a' }, [tab({ id: 'a' })]);
    expect(decision).toEqual({ decision: 'close', scope: { kind: 'tab', tabId: 'a' } });
  });

  it('closes all tabs immediately when none is dirty', () => {
    const decision = planClose({ kind: 'all' }, [tab({ id: 'a' }), tab({ id: 'b' })]);
    expect(decision.decision).toBe('close');
  });

  it('closes others immediately when none of them is dirty', () => {
    // The *kept* tab being dirty is irrelevant: it is not being closed, so
    // nothing of it is lost. A prompt here would be a lie about the casualty.
    const decision = planClose({ kind: 'others', tabId: 'a' }, [
      dirty('a'),
      tab({ id: 'b' }),
      tab({ id: 'c' }),
    ]);
    expect(decision.decision).toBe('close');
  });

  it('refuses an unknown id rather than prompting for a close that cannot happen', () => {
    // The store's `closeTab` ignores unknown ids. Without the same guard here, a
    // stale id would raise a confirmation, the user would agree, and nothing
    // would close — a dialog that reports destroying work it did not destroy.
    expect(planClose({ kind: 'tab', tabId: 'gone' }, [dirty('a')])).toEqual({
      decision: 'noop',
      reason: 'unknown-tab',
    });
  });

  it('refuses close-others on an unknown id instead of naming every tab', () => {
    // This is the dangerous one. `closeOtherTabs(unknown)` once closed *every*
    // tab, because "all tabs except the one that is not here" is all of them. A
    // confirmation built from that would name every open file as a casualty and
    // then be refused by the store's guard.
    expect(planClose({ kind: 'others', tabId: 'gone' }, [dirty('a'), dirty('b')])).toEqual({
      decision: 'noop',
      reason: 'unknown-tab',
    });
  });

  it('refuses close-all with nothing open', () => {
    expect(planClose({ kind: 'all' }, [])).toEqual({ decision: 'noop', reason: 'no-tabs' });
  });

  it('refuses close-others when the anchor is the only tab', () => {
    expect(planClose({ kind: 'others', tabId: 'a' }, [dirty('a')])).toEqual({
      decision: 'noop',
      reason: 'no-others',
    });
  });
});

describe('planClose — a single dirty tab', () => {
  const decide = (t: ClosableTab) => planClose({ kind: 'tab', tabId: t.id }, [t]);

  it('asks, and names the casualty in the button label', () => {
    const decision = decide(dirty('a'));
    expect(decision.decision).toBe('confirm');
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    // The label, not only the body text. A user who reads three words off a
    // button and clicks still has to meet the consequence.
    expect(decision.prompt.confirmLabel).toBe(
      'Close without saving (discard my unsaved edits)'
    );
    expect(decision.prompt.destroys).toBe('my-edits');
  });

  it('pairs the neutral answer with a label that names what it preserves', () => {
    const decision = decide(dirty('a'));
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.cancelLabel).toBe('Cancel (keep the file open)');
  });

  it('titles the prompt with the file, not with "Are you sure?"', () => {
    const decision = decide(dirty('a'));
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.title).toBe('Close a.ts without saving?');
  });

  it('says in the body where the work goes', () => {
    const decision = decide(dirty('a'));
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.body).toContain('/w/a.ts');
    expect(decision.prompt.body).toContain('exist nowhere else');
  });

  it('mentions the surviving disk version for a conflicted tab', () => {
    const decision = decide(dirty('a', { diskState: 'conflict' }));
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.body).toMatch(/different version of this file is on disk/i);
    expect(decision.prompt.destroys).toBe('my-edits');
  });

  it('says the file itself is at stake for a missing tab', () => {
    // The mission's sharpest case. This tab holds the only surviving copy of a
    // file that was deleted on disk, so "discard my unsaved edits" would
    // understate it: closing destroys the file.
    const decision = decide(dirty('a', { diskState: 'missing' }));
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.title).toBe('Close a.ts and discard the only copy?');
    expect(decision.prompt.confirmLabel).toBe(
      'Close the file (discard the only copy that still exists)'
    );
    expect(decision.prompt.destroys).toBe('only-copy');
    expect(decision.prompt.body).toMatch(/only copy that still exists/i);
    // And it points at the way out, which for a deleted file is a save.
    expect(decision.prompt.body).toMatch(/saving it first would recreate it/i);
  });

  it('does not reuse the ordinary wording for a missing tab', () => {
    const ordinary = decide(dirty('a'));
    const missing = decide(dirty('a', { diskState: 'missing' }));
    if (ordinary.decision !== 'confirm' || missing.decision !== 'confirm') {
      throw new Error('expected prompts');
    }

    // Serving both from one sentence is how a click destroys something
    // unrecoverable under a label written for the recoverable case.
    expect(missing.prompt.confirmLabel).not.toBe(ordinary.prompt.confirmLabel);
    expect(missing.prompt.title).not.toBe(ordinary.prompt.title);
    expect(missing.prompt.destroys).not.toBe(ordinary.prompt.destroys);
  });

  it('lists the one doomed tab', () => {
    const decision = decide(dirty('a'));
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.doomed).toEqual([{ id: 'a', path: '/w/a.ts', reason: 'unsaved' }]);
  });

  it('carries the scope it was asked about, so confirming cannot drift', () => {
    const decision = planClose({ kind: 'tab', tabId: 'b' }, [dirty('a'), dirty('b')]);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.scope).toEqual({ kind: 'tab', tabId: 'b' });
    expect(decision.prompt.doomed.map((t) => t.id)).toEqual(['b']);
  });
});

describe('planClose — several dirty tabs at once', () => {
  it('counts them in the title and in the button', () => {
    // "Close all" with three dirty tabs is a different decision from with one,
    // and the gesture does not show the user which it is.
    const decision = planClose({ kind: 'all' }, [dirty('a'), tab({ id: 'b' }), dirty('c')]);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.title).toBe('Close 2 files without saving?');
    expect(decision.prompt.confirmLabel).toBe(
      'Close 2 files without saving (discard all unsaved edits)'
    );
    expect(decision.prompt.destroys).toBe('my-edits');
  });

  it('names which ones, in strip order', () => {
    // A count says how much is about to be lost; the list is what lets the user
    // notice that one of the three is the file they spent the morning on.
    const decision = planClose({ kind: 'all' }, [dirty('a'), tab({ id: 'b' }), dirty('c')]);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.doomed.map((t) => t.path)).toEqual(['/w/a.ts', '/w/c.ts']);
  });

  it('counts only the dirty tabs, not everything being closed', () => {
    const decision = planClose({ kind: 'all' }, [
      dirty('a'),
      tab({ id: 'b' }),
      tab({ id: 'c' }),
      tab({ id: 'd' }),
    ]);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    // One dirty tab among four: the single-tab wording, because the prompt
    // describes the loss, not the operation's breadth.
    expect(decision.prompt.doomed).toHaveLength(1);
    expect(decision.prompt.title).toBe('Close a.ts without saving?');
  });

  it('close-others excludes the kept tab from the casualties', () => {
    const decision = planClose({ kind: 'others', tabId: 'b' }, [
      dirty('a'),
      dirty('b'),
      dirty('c'),
    ]);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    // `b` is dirty and stays open, so it is not a casualty. Including it would
    // overstate the loss and make the count untrustworthy.
    expect(decision.prompt.doomed.map((t) => t.id)).toEqual(['a', 'c']);
    expect(decision.prompt.title).toBe('Close 2 files without saving?');
  });

  it('escalates the label when one of the set holds the only copy', () => {
    const decision = planClose({ kind: 'all' }, [
      dirty('a'),
      dirty('b', { diskState: 'missing' }),
      dirty('c'),
    ]);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.destroys).toBe('only-copy');
    expect(decision.prompt.confirmLabel).toBe(
      'Close 3 files without saving (discard all unsaved edits, including 1 file with no copy on disk)'
    );
    expect(decision.prompt.body).toMatch(/deleted on disk/i);
  });

  it('pluralises the only-copy count', () => {
    const decision = planClose({ kind: 'all' }, [
      dirty('a', { diskState: 'missing' }),
      dirty('b', { diskState: 'missing' }),
    ]);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.confirmLabel).toContain('including 2 files with no copy on disk');
    expect(decision.prompt.body).toMatch(/their tabs hold the only copy left/i);
  });

  it('keeps the cancel label plural too', () => {
    const decision = planClose({ kind: 'all' }, [dirty('a'), dirty('b')]);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    expect(decision.prompt.cancelLabel).toBe('Cancel (keep them open)');
  });
});

describe('the confirm and cancel labels are never confusable', () => {
  const cases: Array<[string, CloseScope, ClosableTab[]]> = [
    ['one unsaved tab', { kind: 'tab', tabId: 'a' }, [dirty('a')]],
    ['one conflicted tab', { kind: 'tab', tabId: 'a' }, [dirty('a', { diskState: 'conflict' })]],
    ['one missing tab', { kind: 'tab', tabId: 'a' }, [dirty('a', { diskState: 'missing' })]],
    ['close all, two dirty', { kind: 'all' }, [dirty('a'), dirty('b')]],
    [
      'close all, one missing among three',
      { kind: 'all' },
      [dirty('a'), dirty('b', { diskState: 'missing' }), dirty('c')],
    ],
    ['close others', { kind: 'others', tabId: 'a' }, [tab({ id: 'a' }), dirty('b'), dirty('c')]],
  ];

  it.each(cases)('%s: the destructive label is the one that says so', (_name, scope, tabs) => {
    const decision = planClose(scope, tabs);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');
    const { confirmLabel, cancelLabel, destroys } = decision.prompt;

    // The property a button swap violates: the destructive label announces a
    // close, the neutral one announces keeping the files, and they are never
    // both one or the other.
    expect(confirmLabel).toMatch(/^Close /);
    expect(cancelLabel).toMatch(/^Cancel /);
    expect(cancelLabel).toMatch(/keep/i);
    expect(confirmLabel).not.toMatch(/^Cancel/);
    expect(destroys).not.toBe('nothing');
  });

  it.each(cases)('%s: the destructive label names a casualty', (_name, scope, tabs) => {
    const decision = planClose(scope, tabs);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');

    // "Confirm" / "OK" / "Close" alone would all pass a rendering test and fail
    // this one, which is the point: the label has to carry the consequence.
    expect(decision.prompt.confirmLabel).toMatch(/discard/i);
  });
});

describe('DOOMED_REASON_TEXT', () => {
  it('explains every reason a tab can be doomed', () => {
    // A listed file with no explanation is a filename the user has to interpret.
    for (const reason of ['unsaved', 'conflicted', 'only-copy'] as const) {
      expect(DOOMED_REASON_TEXT[reason].length).toBeGreaterThan(0);
    }
  });

  it('tells the only-copy case apart from the others', () => {
    expect(DOOMED_REASON_TEXT['only-copy']).toMatch(/only copy left/i);
    expect(DOOMED_REASON_TEXT['only-copy']).not.toBe(DOOMED_REASON_TEXT.unsaved);
    expect(DOOMED_REASON_TEXT.conflicted).not.toBe(DOOMED_REASON_TEXT.unsaved);
  });
});

describe('buildClosePrompt', () => {
  it('uses the single-tab wording for exactly one casualty', () => {
    const prompt = buildClosePrompt({ kind: 'all' }, [
      { id: 'a', path: '/w/a.ts', reason: 'unsaved' },
    ]);
    // Scope is close-all, but only one file would be lost, so the prompt talks
    // about that file rather than about the gesture.
    expect(prompt.title).toBe('Close a.ts without saving?');
    expect(prompt.scope).toEqual({ kind: 'all' });
  });

  it('falls back to the basename when the path has no directory', () => {
    const prompt = buildClosePrompt({ kind: 'tab', tabId: 'a' }, [
      { id: 'a', path: 'README.md', reason: 'unsaved' },
    ]);
    expect(prompt.title).toBe('Close README.md without saving?');
  });

  it('falls back to the whole path when it has no basename to take', () => {
    // A trailing slash makes `split('/').pop()` return an empty string, and a
    // title reading `Close  without saving?` would name nothing at all. The same
    // `|| path` fallback that `TabManager.getFileName` uses.
    const prompt = buildClosePrompt({ kind: 'tab', tabId: 'a' }, [
      { id: 'a', path: '/w/dir/', reason: 'unsaved' },
    ]);
    expect(prompt.title).toBe('Close /w/dir/ without saving?');
  });
});

describe('prunePendingClose', () => {
  const prompt = (scope: CloseScope, tabs: ClosableTab[]) => {
    const decision = planClose(scope, tabs);
    if (decision.decision !== 'confirm') throw new Error('expected a prompt');
    return decision.prompt;
  };

  it('is null for no prompt', () => {
    expect(prunePendingClose(null, [dirty('a')])).toBeNull();
  });

  it('keeps a prompt whose subject is unchanged', () => {
    const tabs = [dirty('a'), dirty('b')];
    const pending = prompt({ kind: 'all' }, tabs);

    expect(prunePendingClose(pending, tabs)).toBe(pending);
  });

  it('drops a prompt whose doomed tab has been closed by another path', () => {
    const pending = prompt({ kind: 'tab', tabId: 'a' }, [dirty('a'), dirty('b')]);

    expect(prunePendingClose(pending, [dirty('b')])).toBeNull();
  });

  it('drops a prompt whose anchor has been closed, so close-others cannot widen', () => {
    // Without the anchor, "all tabs except b" is "all tabs". A prompt that
    // survived this would have its meaning silently widened between being read
    // and being confirmed.
    const pending = prompt({ kind: 'others', tabId: 'b' }, [dirty('a'), tab({ id: 'b' }), dirty('c')]);

    expect(prunePendingClose(pending, [dirty('a'), dirty('c')])).toBeNull();
  });

  it('drops a prompt whose file was saved while it was open', () => {
    // `Ctrl+S` is not blocked by this dialog. Once the file is saved there is
    // nothing to discard, and a prompt still offering to discard it is asking
    // the user to authorise a loss that would not happen.
    const pending = prompt({ kind: 'tab', tabId: 'a' }, [dirty('a')]);

    expect(prunePendingClose(pending, [tab({ id: 'a', isDirty: false })])).toBeNull();
  });

  it('drops a prompt when one of several files was saved, rather than rewording it', () => {
    // Rewriting the sentence and the button under the cursor would change what a
    // click does between the moment the user read it and the moment they clicked.
    const pending = prompt({ kind: 'all' }, [dirty('a'), dirty('b'), dirty('c')]);

    expect(prunePendingClose(pending, [dirty('a'), tab({ id: 'b' }), dirty('c')])).toBeNull();
  });

  it('drops a prompt when a tab became dirty, so the count cannot understate', () => {
    const pending = prompt({ kind: 'all' }, [dirty('a'), tab({ id: 'b' })]);

    expect(prunePendingClose(pending, [dirty('a'), dirty('b')])).toBeNull();
  });

  it('drops a prompt when every tab is gone', () => {
    const pending = prompt({ kind: 'all' }, [dirty('a')]);

    expect(prunePendingClose(pending, [])).toBeNull();
  });

  it('drops a prompt when the casualty changes but the tab set does not', () => {
    // Clearing a `missing` flag (the conflict dialog's Dismiss does this) leaves
    // the same tab doomed as an *ordinary* unsaved tab. An id-only staleness check
    // would keep a prompt whose button still claims to destroy the only copy of a
    // file that now has one on disk. Overstating the loss erodes the prompt just as
    // understating it does.
    const pending = prompt({ kind: 'tab', tabId: 'a' }, [dirty('a', { diskState: 'missing' })]);
    expect(pending.destroys).toBe('only-copy');

    expect(prunePendingClose(pending, [dirty('a')])).toBeNull();
  });

  it('drops a prompt when a conflict flag is cleared under it', () => {
    const pending = prompt({ kind: 'tab', tabId: 'a' }, [dirty('a', { diskState: 'conflict' })]);
    expect(pending.doomed[0].reason).toBe('conflicted');

    expect(prunePendingClose(pending, [dirty('a')])).toBeNull();
  });

  it('drops a prompt when a listed tab becomes the only surviving copy', () => {
    // The escalating direction. A prompt saying "discard my unsaved edits" must
    // not stay on screen once one of its files has been deleted on disk.
    const pending = prompt({ kind: 'all' }, [dirty('a'), dirty('b')]);
    expect(pending.destroys).toBe('my-edits');

    expect(prunePendingClose(pending, [dirty('a'), dirty('b', { diskState: 'missing' })])).toBeNull();
  });
});
