/**
 * Conflict resolution decisions — the rules that decide whether work gets destroyed.
 *
 * ## Why these tests exist
 *
 * `editor-session.ts` detects that a file changed on disk under unsaved edits and
 * flags the tab. Detection alone made things *worse* than no detection: the user
 * was told both versions existed and `Ctrl+S` still overwrote the disk one without
 * a word. The functions under test are the ones that close that hole, so the
 * properties asserted here are the ones whose inversion destroys user data:
 *
 *  - a dirty conflicting tab blocks the save (remove the gate → red);
 *  - `keep-mine` writes and `take-disk` adopts, never the reverse (swap → red);
 *  - the decision carries the tab id it was made for (wrong tab → red).
 *
 * Everything here is a pure function, so none of it needs a DOM, a Monaco
 * instance or an IPC bridge. That is the point of the module existing separately
 * from the dialog: the wording and the semantics of the destructive buttons are
 * asserted by tests rather than living only in JSX.
 */

import { describe, it, expect } from 'vitest';

import {
  RESOLUTION_LABELS,
  STALE_REASON_MESSAGE,
  planResolutionApply,
  planResolutionPanel,
  planSave,
  type Casualty,
  type ResolutionAction,
  type SaveGateTab,
} from '../conflict-resolution';
import type { DiskReadResult, TabDiskState } from '../editor-session';

function tab(overrides: Partial<SaveGateTab> = {}): SaveGateTab {
  return { id: 'tab-1', isDirty: true, ...overrides };
}

const okRead = (content: string, mtime: number): DiskReadResult => ({
  ok: true,
  file: { content, mtime },
});

describe('planSave — the gate', () => {
  it('blocks a dirty tab flagged conflict', () => {
    // The whole mission in one assertion: before the gate, this returned "write".
    expect(planSave(tab({ diskState: 'conflict' }))).toEqual({
      save: false,
      reason: 'conflict',
      tabId: 'tab-1',
    });
  });

  it('reports the id of the tab being saved, not just that it blocked', () => {
    // The caller opens the dialog from this id. Dropping it would mean opening
    // the dialog for whichever tab happens to be focused when the promise
    // settles — a resolution applied to the wrong file.
    const decision = planSave(tab({ id: 'tab-other', diskState: 'conflict' }));

    expect(decision).toMatchObject({ save: false, tabId: 'tab-other' });
  });

  it('allows an ordinary dirty save', () => {
    expect(planSave(tab())).toEqual({ save: true });
  });

  it('allows a dirty save on a tab that agrees with disk', () => {
    expect(planSave(tab({ diskState: 'clean' }))).toEqual({ save: true });
  });

  it('saves a missing file rather than blocking: writing recreates it', () => {
    // Refusing here would strand the user's only remaining copy inside a tab.
    // There is no second version to destroy, so there is nothing to protect.
    expect(planSave(tab({ diskState: 'missing' }))).toEqual({ save: true });
  });

  it('saves an unsaved-lost tab: the loss predates this boot', () => {
    // The flag describes edits dropped for size *before* this boot, and the
    // baseline was refreshed from disk during reconciliation. Blocking would
    // gate today's work on yesterday's accident.
    expect(planSave(tab({ diskState: 'unsaved-lost' }))).toEqual({ save: true });
  });

  it('skips a clean tab', () => {
    expect(planSave(tab({ isDirty: false }))).toEqual({
      save: false,
      reason: 'not-dirty',
    });
  });

  it('skips a clean tab even when it conflicts', () => {
    // Nothing to write and nothing to lose: the tab holds no unsaved work, so
    // there is no reason to make the user look at a diff.
    expect(planSave(tab({ isDirty: false, diskState: 'conflict' }))).toEqual({
      save: false,
      reason: 'not-dirty',
    });
  });

  it('skips a missing tab', () => {
    expect(planSave(undefined)).toEqual({ save: false, reason: 'not-dirty' });
  });
});

describe('planResolutionPanel — the three states are not interchangeable', () => {
  it.each([
    ['conflict', 'conflict'],
    ['missing', 'missing'],
    ['unsaved-lost', 'unsaved-lost'],
  ] as const)('gives %s its own panel', (state, kind) => {
    expect(planResolutionPanel(state)).toMatchObject({ kind });
  });

  it.each([['clean'], [undefined]] as Array<[TabDiskState | undefined]>)(
    'has nothing to resolve for %s',
    (state) => {
      expect(planResolutionPanel(state)).toBeNull();
    }
  );

  it('has nothing to resolve for an unrecognised state', () => {
    // Same rule the tab-strip indicator follows: an unexplained dialog is worse
    // than no dialog.
    expect(planResolutionPanel('something-new' as TabDiskState)).toBeNull();
  });

  it('only offers a diff where two versions exist', () => {
    expect(planResolutionPanel('conflict')?.showsDiff).toBe(true);
    // Nothing on disk to compare against, and nothing left to compare with.
    expect(planResolutionPanel('missing')?.showsDiff).toBe(false);
    expect(planResolutionPanel('unsaved-lost')?.showsDiff).toBe(false);
  });

  it('names a casualty for every action it offers', () => {
    for (const state of ['conflict', 'missing', 'unsaved-lost'] as const) {
      const panel = planResolutionPanel(state)!;

      expect(panel.actions.length).toBeGreaterThan(0);
      for (const spec of panel.actions) {
        expect(spec.label.length).toBeGreaterThan(0);
        // The consequence is spelled out next to the button, not only implied.
        expect(spec.detail.length).toBeGreaterThan(0);
        expect(['disk-changes', 'my-edits', 'nothing']).toContain(spec.destroys);
        // A destructive action must not be styled as an ordinary one.
        expect(spec.tone).toBe(spec.destroys === 'nothing' ? 'neutral' : 'danger');
      }
    }
  });

  it('never offers the same action twice in one panel', () => {
    for (const state of ['conflict', 'missing', 'unsaved-lost'] as const) {
      const actions = planResolutionPanel(state)!.actions.map((spec) => spec.action);

      expect(new Set(actions).size).toBe(actions.length);
    }
  });
});

describe('the conflict panel names what each choice destroys', () => {
  const panel = planResolutionPanel('conflict')!;
  const spec = (action: ResolutionAction) => panel.actions.find((a) => a.action === action)!;

  it('offers exactly keep-mine, take-disk and cancel', () => {
    expect(panel.actions.map((a) => a.action)).toEqual(['keep-mine', 'take-disk', 'cancel']);
  });

  it('says in the label that keeping mine overwrites the file on disk', () => {
    // A user who reads three words off a button and clicks still has to have
    // read the consequence, so it is in the label and not only the small print.
    expect(spec('keep-mine').label).toBe('Keep my version (overwrite the file on disk)');
    expect(spec('keep-mine').label).toMatch(/overwrite/i);
    expect(spec('keep-mine').destroys).toBe<Casualty>('disk-changes');
    expect(spec('keep-mine').detail).toMatch(/lost/i);
  });

  it('says in the label that taking disk discards the unsaved edits', () => {
    expect(spec('take-disk').label).toBe('Use the file on disk (discard my unsaved edits)');
    expect(spec('take-disk').label).toMatch(/discard/i);
    expect(spec('take-disk').destroys).toBe<Casualty>('my-edits');
    // These edits exist nowhere else, which the small print has to say.
    expect(spec('take-disk').detail).toMatch(/cannot be recovered|nowhere else/i);
  });

  it('does not let the two destructive actions claim the same casualty', () => {
    // This is the assertion that fails if the two are ever swapped or copied:
    // both destroy something, and it must not be the same something.
    expect(spec('keep-mine').destroys).not.toBe(spec('take-disk').destroys);
  });

  it('leaves the conflict flagged when cancelled, and says so', () => {
    expect(spec('cancel').destroys).toBe<Casualty>('nothing');
    expect(spec('cancel').label).toMatch(/cancel/i);
    expect(spec('cancel').detail).toMatch(/flagged|writes nothing/i);
  });

  it('states that nothing has been written yet', () => {
    // The user is being asked to choose, not being told the choice was made.
    expect(panel.body).toMatch(/nothing has been written/i);
  });
});

describe('the missing panel does not reuse the discard button', () => {
  const panel = planResolutionPanel('missing')!;

  it('offers recreate and cancel only', () => {
    expect(panel.actions.map((a) => a.action)).toEqual(['recreate', 'cancel']);
  });

  it('has no action that discards the last surviving copy', () => {
    // The tab holds the only copy of the file. A "discard my edits" button here
    // — one pixel from where the conflict panel legitimately offers one, on a
    // case where a copy *does* survive on disk — is the click that loses data
    // with no undo. Absent, not disabled.
    expect(panel.actions.map((a) => a.action)).not.toContain('take-disk');
    expect(panel.actions.every((a) => a.destroys !== 'my-edits')).toBe(true);
  });

  it('destroys nothing, whichever action is chosen', () => {
    // Nothing on disk to overwrite: recreating is a pure gain.
    expect(panel.actions.every((a) => a.destroys === 'nothing')).toBe(true);
  });

  it('says the tab holds the only copy left', () => {
    expect(panel.body).toMatch(/only copy/i);
  });
});

describe('the unsaved-lost panel is a report, not a choice', () => {
  const panel = planResolutionPanel('unsaved-lost')!;

  it('offers only a dismissal', () => {
    expect(panel.actions.map((a) => a.action)).toEqual(['dismiss']);
    expect(panel.actions[0].destroys).toBe<Casualty>('nothing');
  });

  it('does not offer to resolve something that cannot be resolved', () => {
    // Zero versions of the edits exist — they were dropped for size before this
    // boot. Offering "keep my version" would promise something impossible.
    const actions = panel.actions.map((a) => a.action);
    expect(actions).not.toContain('keep-mine');
    expect(actions).not.toContain('take-disk');
    expect(actions).not.toContain('recreate');
  });

  it('explains why, rather than only that', () => {
    expect(panel.body).toMatch(/too large/i);
  });
});

describe('the labels of the three panels do not collide', () => {
  it('gives the two irreversible conflict choices distinguishable labels', () => {
    expect(RESOLUTION_LABELS.keepMine).not.toBe(RESOLUTION_LABELS.takeDisk);
  });

  it('does not label recreating a deleted file like discarding edits', () => {
    // `recreate` and `take-disk` are the pair a careless refactor merges.
    expect(RESOLUTION_LABELS.recreate).not.toBe(RESOLUTION_LABELS.takeDisk);
    expect(RESOLUTION_LABELS.recreate).toMatch(/recreate/i);
    expect(RESOLUTION_LABELS.recreate).not.toMatch(/discard/i);
  });

  it('uses each label on the panel it belongs to', () => {
    const labelsFor = (state: TabDiskState) =>
      planResolutionPanel(state)!.actions.map((a) => a.label);

    expect(labelsFor('conflict')).toContain(RESOLUTION_LABELS.keepMine);
    expect(labelsFor('conflict')).toContain(RESOLUTION_LABELS.takeDisk);
    expect(labelsFor('missing')).toContain(RESOLUTION_LABELS.recreate);
    expect(labelsFor('unsaved-lost')).toContain(RESOLUTION_LABELS.dismiss);
  });
});

describe('planResolutionApply — re-checking disk before writing', () => {
  it('maps keep-mine to a write', () => {
    expect(planResolutionApply('keep-mine', { content: 'disk', mtime: 10 }, okRead('disk', 10)))
      .toEqual({ apply: 'write' });
  });

  it('maps take-disk to adopting the file, never to a write', () => {
    // The inversion of this pair is the mutation that silently destroys the
    // user's work: `take-disk` writing would push the edits the user asked to
    // throw away over the version they asked to keep.
    const plan = planResolutionApply(
      'take-disk',
      { content: 'disk', mtime: 10 },
      okRead('disk', 10)
    );

    expect(plan).toEqual({ apply: 'adopt', file: { content: 'disk', mtime: 10 } });
  });

  it('sends the two actions in opposite directions from identical input', () => {
    const shown = { content: 'disk', mtime: 10 };
    const read = okRead('disk', 10);

    // Same disk state, same shown version: only the action differs, and it must
    // decide which version survives.
    expect(planResolutionApply('keep-mine', shown, read).apply).toBe('write');
    expect(planResolutionApply('take-disk', shown, read).apply).toBe('adopt');
  });

  it('adopts the bytes it just read, not the ones the dialog rendered', () => {
    // Content identical, mtime newer: not a conflict by the detector's own rule,
    // but the fresh read is still the authority on what the file contains.
    const plan = planResolutionApply(
      'take-disk',
      { content: 'same', mtime: 10 },
      okRead('same', 99)
    );

    expect(plan).toEqual({ apply: 'adopt', file: { content: 'same', mtime: 99 } });
  });

  it('maps recreate to a write', () => {
    expect(planResolutionApply('recreate', { content: '' }, { ok: false, missing: true })).toEqual({
      apply: 'write',
    });
  });

  it('refuses when the file changed again while the dialog was open', () => {
    // A diff is a photograph. Applying a choice made against a version that has
    // since been replaced would overwrite a *third* version the user never saw
    // — the exact failure this feature exists to prevent, one step later.
    const plan = planResolutionApply(
      'keep-mine',
      { content: 'as shown', mtime: 10 },
      okRead('changed by someone else', 20)
    );

    expect(plan).toEqual({ apply: 'refuse', reason: 'changed-again' });
  });

  it('refuses take-disk too when the file changed again', () => {
    const plan = planResolutionApply(
      'take-disk',
      { content: 'as shown', mtime: 10 },
      okRead('changed again', 20)
    );

    expect(plan).toEqual({ apply: 'refuse', reason: 'changed-again' });
  });

  it('does not call a touched file changed: newer mtime, identical bytes', () => {
    // `touch`, or a checkout restoring the same content. Re-prompting for this
    // would train the user to click through the dialog without reading it.
    expect(
      planResolutionApply('keep-mine', { content: 'same', mtime: 10 }, okRead('same', 5_000))
    ).toEqual({ apply: 'write' });
  });

  it('does not call an older mtime a change, even with different bytes', () => {
    // Same asymmetry as detection: only a *newer* mtime suggests someone else
    // wrote. A clock skew backwards is not evidence of a third version.
    expect(
      planResolutionApply('keep-mine', { content: 'shown', mtime: 10 }, okRead('other', 5))
    ).toEqual({ apply: 'write' });
  });

  it('does not claim a change when there was no mtime to compare against', () => {
    // No reference point means any claim would be a guess — the rule the
    // detector already follows when a tab has no baseline.
    expect(
      planResolutionApply('keep-mine', { content: 'shown' }, okRead('quite different', 999))
    ).toEqual({ apply: 'write' });
  });

  it('refuses both actions when disk cannot be read', () => {
    // Writing blind is how you overwrite something you never managed to look
    // at, so a permission blip or transient IPC failure stops the write.
    const unreadable: DiskReadResult = { ok: false, missing: false };

    expect(planResolutionApply('keep-mine', { content: 'x', mtime: 1 }, unreadable)).toEqual({
      apply: 'refuse',
      reason: 'unreadable',
    });
    expect(planResolutionApply('take-disk', { content: 'x', mtime: 1 }, unreadable)).toEqual({
      apply: 'refuse',
      reason: 'unreadable',
    });
  });

  it('lets keep-mine recreate a file that vanished while the dialog was open', () => {
    // Writing destroys nothing here: there is no longer anything on disk.
    expect(
      planResolutionApply('keep-mine', { content: 'x', mtime: 1 }, { ok: false, missing: true })
    ).toEqual({ apply: 'write' });
  });

  it('refuses take-disk when the file vanished: there is nothing left to take', () => {
    expect(
      planResolutionApply('take-disk', { content: 'x', mtime: 1 }, { ok: false, missing: true })
    ).toEqual({ apply: 'refuse', reason: 'vanished' });
  });
});

describe('refusal messages', () => {
  it('explains every refusal the planner can produce', () => {
    // A refusal the caller cannot explain is a dialog that appears to do
    // nothing when clicked.
    for (const reason of ['changed-again', 'vanished', 'unreadable'] as const) {
      expect(STALE_REASON_MESSAGE[reason]).toBeTruthy();
    }
  });

  it('states that nothing was written, in each case', () => {
    // The user has just clicked a destructive button and it did not fire. The
    // one thing they need told is that their file is intact.
    expect(STALE_REASON_MESSAGE['changed-again']).toMatch(/nothing was written/i);
    expect(STALE_REASON_MESSAGE.unreadable).toMatch(/nothing was written/i);
    expect(STALE_REASON_MESSAGE.vanished).toMatch(/only copy left/i);
  });

  it('tells the user to choose again when the comparison was refreshed', () => {
    expect(STALE_REASON_MESSAGE['changed-again']).toMatch(/choose again/i);
  });
});
