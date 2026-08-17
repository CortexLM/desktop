/**
 * TabManager — the `data-filename` attribute, and what consumes it.
 *
 * ## Why this exists
 *
 * `TabManager` rendered `data-filename={tab.name}`, but `EditorTab` has no `name`
 * field: it was the last type error outside test files. Fixing it is a choice
 * between the basename and the full path, and the attribute is E2E-facing, so the
 * choice is locked here rather than left to whoever next reads the JSX.
 *
 * **Basename**, because:
 *   1. it is what the tab visibly shows (`getFileName(tab.path)`), so attribute
 *      and label cannot drift apart;
 *   2. it matches the only `data-filename` any page object looks a file up by —
 *      `EditorPage.fileItem(filename)` targets
 *      `[data-testid="file-item"][data-filename="..."]`, which FileExplorer sets
 *      from `node.data.name`, a basename. The E2E specs pass basenames
 *      (`openFile('file1.ts')`);
 *   3. GitPanel's `data-filename` is a repo-relative path, but for a different
 *      job: git status is path-keyed and two same-named files must be stageable
 *      independently.
 *
 * `data-filepath` carries the full path alongside, so a future selector can
 * disambiguate two open files sharing a basename without redefining
 * `data-filename`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { TabManager } from '../TabManager';
import { useEditorStore } from '../../../store/editor-store';

function openTabs(...paths: Array<[path: string, content?: string]>) {
  for (const [path, content] of paths) {
    useEditorStore.getState().openTab(path, content ?? '', 'typescript');
  }
}

function tabs(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-testid="editor-tab"]'));
}

describe('TabManager data-filename', () => {
  beforeEach(() => {
    // Fresh store per test: tabs persist in module state otherwise.
    useEditorStore.getState().closeAllTabs();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().closeAllTabs();
  });

  it('is the basename, not the full path', () => {
    openTabs(['/home/dev/projects/app/src/index.ts']);

    render(React.createElement(TabManager));

    expect(tabs()[0].getAttribute('data-filename')).toBe('index.ts');
  });

  it('matches the label the tab displays', () => {
    openTabs(['/home/dev/projects/app/src/index.ts']);

    render(React.createElement(TabManager));

    const attribute = tabs()[0].getAttribute('data-filename');
    // The visible label goes through the same `getFileName`, so a divergence
    // here would mean the attribute names a file the user cannot see.
    expect(screen.getByText(attribute!)).toBeDefined();
  });

  it('uses the same convention as the explorer, which page objects query by', () => {
    // FileExplorer sets `data-filename` from `node.data.name` (a basename) and
    // `EditorPage.fileItem('file1.ts')` looks files up that way. The specs pass
    // basenames, so the editor tab agrees with them.
    openTabs(['/tmp/workspace/file1.ts']);

    render(React.createElement(TabManager));

    expect(tabs()[0].getAttribute('data-filename')).toBe('file1.ts');
  });

  it('exposes the full path as data-filepath', () => {
    openTabs(['/home/dev/projects/app/src/index.ts']);

    render(React.createElement(TabManager));

    expect(tabs()[0].getAttribute('data-filepath')).toBe(
      '/home/dev/projects/app/src/index.ts'
    );
  });

  it('lets two files with the same basename be told apart by path', () => {
    openTabs(['/app/src/index.ts'], ['/app/lib/index.ts']);

    render(React.createElement(TabManager));

    const rendered = tabs();
    expect(rendered.map((t) => t.getAttribute('data-filename'))).toEqual([
      'index.ts',
      'index.ts',
    ]);
    // Ambiguous by name, unambiguous by path — which is why both attributes are
    // present.
    expect(rendered.map((t) => t.getAttribute('data-filepath'))).toEqual([
      '/app/src/index.ts',
      '/app/lib/index.ts',
    ]);
  });

  it('handles a bare filename with no directory', () => {
    openTabs(['README.md']);

    render(React.createElement(TabManager));

    expect(tabs()[0].getAttribute('data-filename')).toBe('README.md');
    expect(tabs()[0].getAttribute('data-filepath')).toBe('README.md');
  });

  it('sets the attribute on every open tab', () => {
    openTabs(['/w/a.ts'], ['/w/b.ts'], ['/w/c.ts']);

    render(React.createElement(TabManager));

    expect(tabs().map((t) => t.getAttribute('data-filename'))).toEqual([
      'a.ts',
      'b.ts',
      'c.ts',
    ]);
  });

  it('renders the empty state with no tabs', () => {
    render(React.createElement(TabManager));

    expect(screen.getByText('No files open')).toBeDefined();
    expect(tabs()).toHaveLength(0);
  });

  it('keeps the testid the page objects address tabs by', () => {
    // `EditorPage` counts and clicks tabs through `[data-testid="editor-tab"]`,
    // by index. Renaming it would break every editor spec.
    openTabs(['/w/a.ts']);

    render(React.createElement(TabManager));

    expect(tabs()).toHaveLength(1);
  });
});

/**
 * Session-restore outcomes surfaced in the strip.
 *
 * Detecting a conflict and not showing it is the same as not detecting it, so
 * each state `reconcileTabs` can produce has to reach the DOM with an
 * explanation attached. The indicator carries an accessible name rather than
 * relying on colour alone.
 */
describe('TabManager disk-state indicator', () => {
  const indicators = (): HTMLElement[] =>
    Array.from(document.querySelectorAll('[data-testid="disk-state-indicator"]'));

  beforeEach(() => {
    useEditorStore.getState().closeAllTabs();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().closeAllTabs();
  });

  /** Sets a diskState directly: only reconciliation produces these in real use. */
  function setDiskState(path: string, diskState: string): void {
    useEditorStore.setState((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, diskState: diskState as never } : tab
      ),
    }));
  }

  it('shows nothing for an ordinary tab', () => {
    openTabs(['/w/a.ts']);

    render(React.createElement(TabManager));

    expect(indicators()).toHaveLength(0);
  });

  it('shows nothing for a tab that agrees with disk', () => {
    openTabs(['/w/a.ts']);
    setDiskState('/w/a.ts', 'clean');

    render(React.createElement(TabManager));

    expect(indicators()).toHaveLength(0);
  });

  it.each([
    ['conflict', /changed on disk/i],
    ['missing', /no longer exists/i],
    ['unsaved-lost', /too large to store/i],
  ])('explains the %s state in its accessible name', (diskState, pattern) => {
    openTabs(['/w/a.ts']);
    setDiskState('/w/a.ts', diskState);

    render(React.createElement(TabManager));

    const [indicator] = indicators();
    expect(indicator).toBeDefined();
    expect(indicator.getAttribute('data-disk-state')).toBe(diskState);
    // Reachable by name, not only by colour.
    expect(screen.getByRole('img', { name: pattern })).toBeDefined();
    expect(indicator.getAttribute('title')).toMatch(pattern);
  });

  it('flags only the affected tab', () => {
    openTabs(['/w/a.ts'], ['/w/b.ts'], ['/w/c.ts']);
    setDiskState('/w/b.ts', 'conflict');

    render(React.createElement(TabManager));

    expect(indicators()).toHaveLength(1);
    expect(indicators()[0].closest('[data-testid="editor-tab"]')?.getAttribute('data-filename')).toBe(
      'b.ts'
    );
  });

  it('shows the conflict alongside the dirty dot, not instead of it', () => {
    // A conflicted tab is still unsaved; hiding the dirty marker would suggest
    // the work was already written.
    openTabs(['/w/a.ts']);
    const id = useEditorStore.getState().tabs[0].id;
    useEditorStore.getState().markTabDirty(id, true);
    setDiskState('/w/a.ts', 'conflict');

    render(React.createElement(TabManager));

    expect(document.querySelectorAll('[data-testid="modified-indicator"]')).toHaveLength(1);
    expect(indicators()).toHaveLength(1);
  });

  it('renders nothing for an unrecognised state rather than an unexplained icon', () => {
    // An icon with no label is worse than no icon: the user sees a warning and
    // cannot find out what it means.
    openTabs(['/w/a.ts']);
    setDiskState('/w/a.ts', 'something-new');

    render(React.createElement(TabManager));

    expect(indicators()).toHaveLength(0);
  });

  it('invites the user to compare rather than describing the old overwrite', () => {
    // The tooltip used to say saving would overwrite the version on disk. It no
    // longer does, and a tooltip describing the old behaviour would be worse
    // than none: it would tell the user the one thing that is no longer true.
    openTabs(['/w/a.ts']);
    setDiskState('/w/a.ts', 'conflict');

    render(React.createElement(TabManager));

    const title = indicators()[0].getAttribute('title')!;
    expect(title).toMatch(/click to compare/i);
    expect(title).not.toMatch(/overwrite/i);
  });
});

/**
 * The indicator as the safe entry point to resolution.
 *
 * The save path reaches the same dialog, but only after a keystroke whose
 * documented meaning is "write this to disk". Opening it from the indicator lets
 * the user compare and choose *without first attempting an overwrite*, which is
 * why the indicator is a real button rather than decoration.
 */
describe('TabManager — clicking the indicator resolves without saving', () => {
  const indicators = (): HTMLElement[] =>
    Array.from(document.querySelectorAll('[data-testid="disk-state-indicator"]'));

  beforeEach(() => {
    useEditorStore.setState({ tabs: [], activeTabId: null, conflictDialogTabId: null });
  });

  afterEach(() => {
    cleanup();
    useEditorStore.setState({ tabs: [], activeTabId: null, conflictDialogTabId: null });
  });

  function setDiskState(path: string, diskState: string): void {
    useEditorStore.setState((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.path === path ? { ...tab, diskState: diskState as never } : tab
      ),
    }));
  }

  it.each(['conflict', 'missing', 'unsaved-lost'])(
    'opens the dialog for a %s tab',
    async (diskState) => {
      openTabs(['/w/a.ts']);
      setDiskState('/w/a.ts', diskState);

      render(React.createElement(TabManager));
      await userEvent.click(indicators()[0]);

      expect(useEditorStore.getState().conflictDialogTabId).toBe(
        useEditorStore.getState().tabs[0].id
      );
    }
  );

  it('opens the dialog for the tab whose indicator was clicked', async () => {
    // Three tabs, two conflicting. Opening the dialog for the wrong one would
    // show a diff of a file the user did not click, and its buttons would write
    // to that file.
    openTabs(['/w/a.ts'], ['/w/b.ts'], ['/w/c.ts']);
    setDiskState('/w/a.ts', 'conflict');
    setDiskState('/w/c.ts', 'conflict');

    render(React.createElement(TabManager));
    const forC = indicators().find(
      (node) =>
        node.closest('[data-testid="editor-tab"]')?.getAttribute('data-filename') === 'c.ts'
    )!;
    await userEvent.click(forC);

    const { tabs, conflictDialogTabId } = useEditorStore.getState();
    expect(conflictDialogTabId).toBe(tabs.find((tab) => tab.path === '/w/c.ts')!.id);
  });

  it('focuses the tab it opened the dialog for', async () => {
    // Leaving the strip highlighting a different tab while a modal discusses
    // this one is how a resolution gets applied to the wrong file, if only in
    // the user's head.
    openTabs(['/w/a.ts'], ['/w/b.ts']);
    setDiskState('/w/a.ts', 'conflict');
    const targetId = useEditorStore.getState().tabs[0].id;
    // `/w/b.ts` is focused, having been opened last.
    expect(useEditorStore.getState().activeTabId).not.toBe(targetId);

    render(React.createElement(TabManager));
    await userEvent.click(indicators()[0]);

    expect(useEditorStore.getState().activeTabId).toBe(targetId);
    expect(useEditorStore.getState().conflictDialogTabId).toBe(targetId);
  });

  it('does not close the tab it was clicked on', async () => {
    // The indicator sits between the dirty dot and the close button. A click
    // that bubbled to either the tab body or past it would be a click that
    // discards unsaved edits instead of offering to resolve them.
    openTabs(['/w/a.ts']);
    setDiskState('/w/a.ts', 'conflict');

    render(React.createElement(TabManager));
    await userEvent.click(indicators()[0]);

    expect(useEditorStore.getState().tabs).toHaveLength(1);
  });

  it('writes nothing: it is the entry point that does not attempt an overwrite', async () => {
    // The whole reason this button exists. Content and dirty flag are untouched
    // and the conflict is still flagged; only the dialog opened.
    openTabs(['/w/a.ts', 'my unsaved edits']);
    const id = useEditorStore.getState().tabs[0].id;
    useEditorStore.getState().markTabDirty(id, true);
    setDiskState('/w/a.ts', 'conflict');

    render(React.createElement(TabManager));
    await userEvent.click(indicators()[0]);

    const tab = useEditorStore.getState().getTab(id)!;
    expect(tab.content).toBe('my unsaved edits');
    expect(tab.isDirty).toBe(true);
    expect(tab.diskState).toBe('conflict');
  });
});

/**
 * The other things a click on the strip can do.
 *
 * Covered because the resolution indicator sits between the dirty dot and the
 * close button: a click on it that bubbled, or a close handler that fired on the
 * wrong tab, would destroy unsaved edits from a gesture that promised to explain
 * a conflict.
 */
describe('TabManager — the surrounding click handlers', () => {
  beforeEach(() => {
    useEditorStore.setState({ tabs: [], activeTabId: null, conflictDialogTabId: null });
  });

  afterEach(() => {
    cleanup();
    useEditorStore.setState({ tabs: [], activeTabId: null, conflictDialogTabId: null });
  });

  it('focuses a tab when its body is clicked', async () => {
    openTabs(['/w/a.ts'], ['/w/b.ts']);
    const firstId = useEditorStore.getState().tabs[0].id;

    render(React.createElement(TabManager));
    await userEvent.click(tabs()[0]);

    expect(useEditorStore.getState().activeTabId).toBe(firstId);
  });

  it('closes a tab from its close button, and only that tab', async () => {
    openTabs(['/w/a.ts'], ['/w/b.ts']);

    render(React.createElement(TabManager));
    await userEvent.click(
      tabs()[0].querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    expect(useEditorStore.getState().tabs.map((tab) => tab.path)).toEqual(['/w/b.ts']);
  });

  it('does not focus the tab being closed on the way out', async () => {
    // `stopPropagation` on the close handler. Without it the click also runs the
    // tab-body handler, focusing a tab that is about to disappear.
    openTabs(['/w/a.ts'], ['/w/b.ts']);
    const secondId = useEditorStore.getState().tabs[1].id;

    render(React.createElement(TabManager));
    await userEvent.click(
      tabs()[0].querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    expect(useEditorStore.getState().activeTabId).toBe(secondId);
  });

  it('closes a tab on middle click', async () => {
    openTabs(['/w/a.ts'], ['/w/b.ts']);

    render(React.createElement(TabManager));
    await userEvent.pointer({ target: tabs()[0], keys: '[MouseMiddle]' });

    expect(useEditorStore.getState().tabs.map((tab) => tab.path)).toEqual(['/w/b.ts']);
  });

  it('leaves the tab open on a left mouse-down', async () => {
    // The middle-click handler runs on every mousedown and filters by button.
    // Getting that test wrong would close a tab on an ordinary click.
    openTabs(['/w/a.ts']);

    render(React.createElement(TabManager));
    await userEvent.pointer({ target: tabs()[0], keys: '[MouseLeft>]' });

    expect(useEditorStore.getState().tabs).toHaveLength(1);
  });

  it('does not close the tab when its indicator is middle-clicked', async () => {
    // The indicator is inside the tab body, which handles mousedown. A middle
    // click landing on the warning icon of a dirty tab must not discard it.
    openTabs(['/w/a.ts']);
    const id = useEditorStore.getState().tabs[0].id;
    useEditorStore.getState().markTabDirty(id, true);
    useEditorStore.setState((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, diskState: 'conflict' as never } : tab
      ),
    }));

    render(React.createElement(TabManager));
    const indicator = document.querySelector(
      '[data-testid="disk-state-indicator"]'
    ) as HTMLElement;
    await userEvent.click(indicator);

    // Documented behaviour: opening the dialog, not closing the tab.
    expect(useEditorStore.getState().tabs).toHaveLength(1);
    expect(useEditorStore.getState().conflictDialogTabId).toBe(id);
  });
});
