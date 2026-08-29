/**
 * Translating an agent stream chunk into a timeline entry.
 *
 * The chunks come from the engine rather than from a user, but they are a
 * structurally-typed bag: a shape change upstream writes `undefined` into a stored
 * row and the screen renders an entry with no title. Every field is checked, so this
 * is where that checking is exercised.
 */

import { describe, expect, it } from 'vitest';

import { toSessionEvent } from '../session-events';

const AT = 1_700_000_000_000;

describe('tool chunks', () => {
  it('carries the fields the timeline shows', () => {
    expect(
      toSessionEvent(
        {
          tool: {
            name: 'Edit',
            title: 'Edit src/index.ts',
            detail: 'src/index.ts',
            ok: true,
            output: 'ok',
            additions: 4,
            deletions: 1,
            durationMs: 120,
          },
        },
        AT,
      ),
    ).toEqual({
      kind: 'tool',
      at: AT,
      name: 'Edit',
      title: 'Edit src/index.ts',
      detail: 'src/index.ts',
      ok: true,
      output: 'ok',
      additions: 4,
      deletions: 1,
      durationMs: 120,
    });
  });

  it('falls back to the tool name when there is no title', () => {
    const event = toSessionEvent({ tool: { name: 'Grep' } }, AT);
    expect(event).toEqual({ kind: 'tool', at: AT, name: 'Grep', title: 'Grep' });
  });

  it('drops a tool chunk with no name', () => {
    // A row with no name renders as a blank line in the worklog, which reads as a
    // rendering bug rather than as missing data.
    expect(toSessionEvent({ tool: { title: 'something' } }, AT)).toBeUndefined();
  });

  it('ignores fields of the wrong type instead of storing them', () => {
    const event = toSessionEvent(
      { tool: { name: 'Edit', ok: 'yes', additions: '4', durationMs: null } },
      AT,
    );

    expect(event).toEqual({ kind: 'tool', at: AT, name: 'Edit', title: 'Edit' });
  });

  it('truncates a large output', () => {
    // A single `cat` of a big file would otherwise put megabytes in a row the screen
    // shows four lines of.
    const event = toSessionEvent({ tool: { name: 'Execute', output: 'x'.repeat(9000) } }, AT);

    expect((event as { output: string }).output).toHaveLength(4000);
  });
});

describe('permission chunks', () => {
  it('reads the engine shape: `id`, with risks named write/exec', () => {
    // This is the exact payload the agent loop emits (PermissionRequest). Reading
    // only a `requestId` field is how these vanished from the timeline — and a
    // permission request nobody sees is a run that waits forever.
    expect(
      toSessionEvent(
        { permission: { id: 'perm-call-1', tool: 'Create', summary: 'Create NOTES.md', risk: 'write' } },
        AT,
      ),
    ).toEqual({
      kind: 'permission',
      at: AT,
      requestId: 'perm-call-1',
      summary: 'Create NOTES.md',
      risk: 'caution',
    });
  });

  it('reads exec risk as dangerous', () => {
    const event = toSessionEvent(
      { permission: { id: 'perm-2', summary: 'Execute rm -rf build', risk: 'exec' } },
      AT,
    );

    expect((event as { risk: string }).risk).toBe('dangerous');
  });

  it('still accepts the stored `requestId` shape', () => {
    expect(
      toSessionEvent(
        { permission: { requestId: 'req-1', summary: 'Run `rm -rf build`', risk: 'dangerous' } },
        AT,
      ),
    ).toEqual({
      kind: 'permission',
      at: AT,
      requestId: 'req-1',
      summary: 'Run `rm -rf build`',
      risk: 'dangerous',
    });
  });

  it('reads an unknown risk as safe', () => {
    // The agent loop is what gates the call. Inflating an unrecognised value to
    // `dangerous` would train the user to dismiss the warning.
    const event = toSessionEvent({ permission: { requestId: 'r', risk: 'apocalyptic' } }, AT);

    expect((event as { risk: string }).risk).toBe('safe');
  });

  it('supplies a summary when the engine sent none', () => {
    const event = toSessionEvent({ permission: { requestId: 'r' } }, AT);
    expect((event as { summary: string }).summary).toBe('Permission needed');
  });

  it('drops a permission chunk with no request id', () => {
    // Without one there is nothing to answer, so the row would be a prompt the user
    // cannot resolve.
    expect(toSessionEvent({ permission: { summary: 'something' } }, AT)).toBeUndefined();
  });
});

describe('plan chunks', () => {
  it('normalises every step', () => {
    expect(
      toSessionEvent(
        {
          plan: {
            steps: [
              { id: 'a', label: 'Read the test', state: 'done' },
              { label: 'Fix it', state: 'current' },
              'Ship it',
            ],
          },
        },
        AT,
      ),
    ).toEqual({
      kind: 'plan',
      at: AT,
      steps: [
        { id: 'a', label: 'Read the test', state: 'done' },
        { id: 'step-1', label: 'Fix it', state: 'current' },
        { id: 'step-2', label: 'Ship it', state: 'pending' },
      ],
    });
  });

  it('ignores a plan whose steps are not a list', () => {
    expect(toSessionEvent({ plan: { steps: 'soon' } }, AT)).toBeUndefined();
  });

  it('maps engine title/status steps onto the timeline labels', () => {
    expect(
      toSessionEvent(
        {
          plan: {
            steps: [{ id: 's1', title: 'Read the tree', status: 'active' }],
            mermaid: 'flowchart TD\n  A-->B',
          },
        },
        AT,
      ),
    ).toEqual({
      kind: 'plan',
      at: AT,
      mermaid: 'flowchart TD\n  A-->B',
      steps: [{ id: 's1', label: 'Read the tree', state: 'current' }],
    });
  });

  it('keeps a mermaid fence on the plan', () => {
    expect(
      toSessionEvent(
        { plan: { steps: [{ label: 'A', state: 'current' }], mermaid: 'flowchart TD\n  A-->B' } },
        AT,
      ),
    ).toMatchObject({ kind: 'plan', mermaid: 'flowchart TD\n  A-->B' });
  });

  it('records a background task completion', () => {
    expect(
      toSessionEvent(
        { task: { id: 'task_1', phase: 'completed', summary: 'explored', artifact_id: 'art_1' } },
        AT,
      ),
    ).toEqual({
      kind: 'task',
      at: AT,
      id: 'task_1',
      phase: 'completed',
      summary: 'explored',
      artifact_id: 'art_1',
    });
  });
});

describe('text chunks', () => {
  it('becomes a reply', () => {
    expect(toSessionEvent({ content: 'Here is what I found' }, AT)).toEqual({
      kind: 'reply',
      at: AT,
      text: 'Here is what I found',
    });
  });

  it('ignores an empty string', () => {
    // Streaming emits these between tokens; each one stored would be a row.
    expect(toSessionEvent({ content: '' }, AT)).toBeUndefined();
  });
});

describe('anything else', () => {
  it.each([[null], [undefined], ['a string'], [42], [{}], [{ unknownKind: {} }]])(
    'yields nothing for %p',
    (chunk) => {
      // A newer engine event must not fill the timeline with rows the UI has no way
      // to render.
      expect(toSessionEvent(chunk, AT)).toBeUndefined();
    },
  );
});
