/**
 * The close confirmation, as the user meets it.
 *
 * WHAT IS BEING PROTECTED
 * -----------------------
 * The store decides whether to ask; these tests are about whether the dialog that
 * results is honest, and whether *every* gesture in the strip reaches it. Two
 * failures are specifically hunted:
 *
 *  - **A gesture that skips the gate.** Six paths close tabs (close button,
 *    middle-click, three context-menu items, `Ctrl+W` / `Ctrl+Shift+W`). The
 *    original bug was one path — right-click — destroying work while the others
 *    asked. Each path is driven here against a dirty tab and must leave it open.
 *  - **A swapped pair of buttons.** Asserted through `data-destroys` rather than
 *    by button order or label alone, so an inversion is caught by a test instead
 *    of only being visible to someone reading the screen.
 *
 * RENDERED TOGETHER, AS `EditorView` MOUNTS THEM
 * ---------------------------------------------
 * `TabManager` and `CloseConfirmationDialog` are siblings in `EditorView`. They
 * are rendered as siblings here too: testing the strip with no dialog mounted
 * would let a "the tab did not close" assertion pass for a build where the prompt
 * never appears, which is a hang, not a save.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { CloseConfirmationDialog } from '../CloseConfirmationDialog';
import { TabManager } from '../TabManager';
import { useEditorStore } from '../../../store/editor-store';
import type { TabDiskState } from '../../../store/editor-session';
import { useKeyboardShortcuts } from '../../../hooks/use-keyboard-shortcuts';

const store = () => useEditorStore.getState();

/** The strip and the dialog, mounted the way `EditorView` mounts them. */
const Harness: React.FC = () =>
  React.createElement(
    React.Fragment,
    null,
    React.createElement(TabManager),
    React.createElement(CloseConfirmationDialog)
  );

/** Same, plus the global shortcut listener, for the `Ctrl+W` paths. */
const HarnessWithShortcuts: React.FC = () => {
  useKeyboardShortcuts();
  return React.createElement(Harness);
};

beforeEach(() => {
  useEditorStore.setState({
    tabs: [],
    activeTabId: null,
    conflictDialogTabId: null,
    pendingClose: null,
  });
});

afterEach(() => {
  cleanup();
  useEditorStore.setState({
    tabs: [],
    activeTabId: null,
    conflictDialogTabId: null,
    pendingClose: null,
  });
});

function openTabs(...paths: string[]): void {
  for (const path of paths) store().openTab(path, `content of ${path}`, 'typescript');
}

const idFor = (path: string): string => {
  const tab = store().tabs.find((candidate) => candidate.path === path);
  if (!tab) throw new Error(`no tab open for ${path}`);
  return tab.id;
};

const soil = (path: string): void => {
  store().markTabDirty(idFor(path), true);
};

const setDiskState = (path: string, diskState: TabDiskState): void => {
  useEditorStore.setState((current) => ({
    tabs: current.tabs.map((tab) => (tab.path === path ? { ...tab, diskState } : tab)),
  }));
};

const paths = (): string[] => store().tabs.map((tab) => tab.path);

const tabNodes = (): HTMLElement[] =>
  Array.from(document.querySelectorAll('[data-testid="editor-tab"]'));

const tabFor = (path: string): HTMLElement => {
  const node = tabNodes().find((element) => element.getAttribute('data-filepath') === path);
  if (!node) throw new Error(`no rendered tab for ${path}`);
  return node;
};

const dialog = (): HTMLElement | null =>
  document.querySelector('[data-testid="close-confirm-dialog"]');

const acceptButton = (): HTMLElement =>
  document.querySelector('[data-testid="close-confirm-accept"]') as HTMLElement;

const cancelButton = (): HTMLElement =>
  document.querySelector('[data-testid="close-confirm-cancel"]') as HTMLElement;

const openContextMenu = async (path: string): Promise<void> => {
  await userEvent.pointer({ target: tabFor(path), keys: '[MouseRight]' });
};

/**
 * Drives a store action from a test and flushes the render it causes.
 *
 * `userEvent` wraps its own dispatch in `act`, so the gesture-driven tests do not
 * need this; a bare `store().requestCloseTab(...)` does. Without it the store
 * updates and the component does not, so an assertion that the dialog is absent
 * passes for the wrong reason — which is exactly the hollow test this suite is
 * supposed to be immune to.
 */
const fromStore = (mutate: () => void): void => {
  act(() => {
    mutate();
  });
};

describe('the dialog only exists when there is something to confirm', () => {
  it('renders nothing with no pending close', () => {
    openTabs('/a.ts');

    render(React.createElement(Harness));

    expect(dialog()).toBeNull();
  });

  it('renders nothing after a clean tab is closed', () => {
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    fromStore(() => store().requestCloseTab(idFor('/a.ts')));

    expect(dialog()).toBeNull();
    expect(paths()).toEqual(['/b.ts']);
  });
});

describe('closing a clean tab stays instant', () => {
  /**
   * The mirror-image property. Friction on the harmless case is not extra safety:
   * it is how a user learns to dismiss the prompt without reading it, which
   * disarms it on the one close in fifty where it mattered.
   */
  it('closes from the close button with no dialog', async () => {
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    expect(paths()).toEqual(['/b.ts']);
    expect(dialog()).toBeNull();
  });

  it('closes on middle click with no dialog', async () => {
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await userEvent.pointer({ target: tabFor('/a.ts'), keys: '[MouseMiddle]' });

    expect(paths()).toEqual(['/b.ts']);
    expect(dialog()).toBeNull();
  });

  it('closes from the context menu with no dialog', async () => {
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close'));

    expect(paths()).toEqual(['/b.ts']);
    expect(dialog()).toBeNull();
  });

  it('closes all with no dialog', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close-all'));

    expect(paths()).toEqual([]);
    expect(dialog()).toBeNull();
  });

  it('closes others with no dialog', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');

    render(React.createElement(Harness));
    await openContextMenu('/b.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close-others'));

    expect(paths()).toEqual(['/b.ts']);
    expect(dialog()).toBeNull();
  });
});

describe('every close gesture asks before discarding unsaved edits', () => {
  /**
   * The inventory, driven end to end. A mutation that removes the confirmation
   * from one path in six — the shape of the original bug — turns exactly one of
   * these red.
   */
  it('the close button asks', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(dialog()).not.toBeNull();
  });

  it('middle click asks', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.pointer({ target: tabFor('/a.ts'), keys: '[MouseMiddle]' });

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(dialog()).not.toBeNull();
  });

  it('the context menu Close item asks', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close'));

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(dialog()).not.toBeNull();
  });

  it('Close other tabs asks', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/c.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close-others'));

    expect(paths()).toEqual(['/a.ts', '/b.ts', '/c.ts']);
    expect(dialog()).not.toBeNull();
  });

  it('Close all tabs asks', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/b.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close-all'));

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(dialog()).not.toBeNull();
  });

  it('Ctrl+W asks', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/b.ts');
    // `/b.ts` is active, having been opened last.

    render(React.createElement(HarnessWithShortcuts));
    await userEvent.keyboard('{Control>}w{/Control}');

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(dialog()).not.toBeNull();
  });

  it('Ctrl+Shift+W asks', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(HarnessWithShortcuts));
    await userEvent.keyboard('{Control>}{Shift>}W{/Shift}{/Control}');

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(dialog()).not.toBeNull();
  });

  it('Ctrl+W still closes a clean tab instantly', async () => {
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(HarnessWithShortcuts));
    await userEvent.keyboard('{Control>}w{/Control}');

    expect(paths()).toEqual(['/a.ts']);
    expect(dialog()).toBeNull();
  });

  it('Ctrl+W does nothing with no tab focused', async () => {
    render(React.createElement(HarnessWithShortcuts));
    await userEvent.keyboard('{Control>}w{/Control}');

    expect(paths()).toEqual([]);
    expect(dialog()).toBeNull();
  });

  it('Cmd+W asks on a Mac', async () => {
    // The modifier is chosen from `navigator.platform`. If that branch picked the
    // wrong key, the shortcut would be dead on one platform — and a dead shortcut
    // is not a data-loss bug, but a `Ctrl+W` that fired on a Mac *while* the
    // metaKey path was expected would close a tab from a keystroke the user did
    // not make.
    const platform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });

    try {
      openTabs('/a.ts');
      soil('/a.ts');

      render(React.createElement(HarnessWithShortcuts));
      await userEvent.keyboard('{Meta>}w{/Meta}');

      expect(paths()).toEqual(['/a.ts']);
      expect(dialog()).not.toBeNull();
    } finally {
      Object.defineProperty(navigator, 'platform', {
        value: platform,
        configurable: true,
      });
    }
  });

  it('Cmd+Shift+W asks on a Mac', async () => {
    const platform = navigator.platform;
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });

    try {
      openTabs('/a.ts', '/b.ts');
      soil('/b.ts');

      render(React.createElement(HarnessWithShortcuts));
      await userEvent.keyboard('{Meta>}{Shift>}W{/Shift}{/Meta}');

      expect(paths()).toEqual(['/a.ts', '/b.ts']);
      expect(dialog()).not.toBeNull();
    } finally {
      Object.defineProperty(navigator, 'platform', {
        value: platform,
        configurable: true,
      });
    }
  });

  it('an unmodified w does not close anything', async () => {
    // Typing in the editor must not close tabs.
    openTabs('/a.ts');
    soil('/a.ts');

    render(React.createElement(HarnessWithShortcuts));
    await userEvent.keyboard('w');

    expect(paths()).toEqual(['/a.ts']);
    expect(dialog()).toBeNull();
  });
});

describe('right-click no longer destroys anything by itself', () => {
  it('opens a menu instead of closing the tab', async () => {
    // The bug, stated as a test. A right-click used to close the tab outright,
    // discarding unsaved edits with no prompt.
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(screen.getByTestId('tab-context-menu')).toBeDefined();
    // Not even a confirmation: a right-click is an inspection gesture, so it
    // raises no modal at all.
    expect(dialog()).toBeNull();
  });

  it('does not close a clean tab either', async () => {
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
  });

  it('anchors the menu on the tab that was right-clicked', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');

    render(React.createElement(Harness));
    await openContextMenu('/b.ts');

    expect(screen.getByTestId('tab-context-menu').getAttribute('data-tab-id')).toBe(
      idFor('/b.ts')
    );
  });

  it('focuses the right-clicked tab, so the menu and the strip agree', async () => {
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');

    expect(store().activeTabId).toBe(idFor('/a.ts'));
  });

  it('closes the menu on Escape, closing nothing', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.keyboard('{Escape}');

    expect(document.querySelector('[data-testid="tab-context-menu"]')).toBeNull();
    expect(paths()).toEqual(['/a.ts', '/b.ts']);
  });

  it('closes the menu on a click elsewhere, closing nothing', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.click(document.body);

    expect(document.querySelector('[data-testid="tab-context-menu"]')).toBeNull();
    expect(paths()).toEqual(['/a.ts', '/b.ts']);
  });

  it('disables Close other tabs when there are none', async () => {
    openTabs('/a.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');

    expect(screen.getByTestId('tab-menu-close-others')).toBeDisabled();
  });

  it('enables Close other tabs once a second tab exists', async () => {
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');

    expect(screen.getByTestId('tab-menu-close-others')).not.toBeDisabled();
  });

  it('dismisses the menu when its item is chosen', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close'));

    expect(document.querySelector('[data-testid="tab-context-menu"]')).toBeNull();
  });

  it('stays open on a key that is not Escape', async () => {
    // The dismissal listener runs on every keydown and filters by key. Getting
    // that filter wrong the other way would make the menu unusable by keyboard.
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByTestId('tab-context-menu')).toBeDefined();
  });

  it('stays open when the click lands inside it', async () => {
    // The outside-click listener is on `window`, so it also sees clicks on the
    // menu itself. Dismissing on those would close the menu before its own item
    // could run.
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    await userEvent.click(screen.getByTestId('tab-context-menu'));

    expect(screen.getByTestId('tab-context-menu')).toBeDefined();
  });

  it('closes with the tab it is anchored to', async () => {
    // A menu whose anchor is gone has "Close other tabs" pointing at an id the
    // store would refuse — a menu that looks live and does nothing.
    openTabs('/a.ts', '/b.ts');

    render(React.createElement(Harness));
    await openContextMenu('/a.ts');
    expect(screen.getByTestId('tab-context-menu')).toBeDefined();

    fromStore(() => store().closeTab(idFor('/a.ts')));

    expect(document.querySelector('[data-testid="tab-context-menu"]')).toBeNull();
  });
});

describe('the two buttons, and which one destroys', () => {
  it('marks the destructive button and the neutral one distinctly', async () => {
    openTabs('/a.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    // Machine-readable, so an inversion is caught by a test rather than only by
    // someone reading the screen.
    expect(acceptButton().getAttribute('data-destroys')).toBe('my-edits');
    expect(cancelButton().getAttribute('data-destroys')).toBe('nothing');
  });

  it('names the casualty in the destructive label', async () => {
    openTabs('/a.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    expect(acceptButton().textContent).toBe(
      'Close without saving (discard my unsaved edits)'
    );
    expect(cancelButton().textContent).toBe('Cancel (keep the file open)');
  });

  it('pairs each label with the behaviour it advertises', async () => {
    // The mutation this is for: swap the handlers and leave the labels alone. The
    // button whose label says it destroys must be the one that closes the tab.
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    const neutral = cancelButton();
    expect(neutral.getAttribute('data-destroys')).toBe('nothing');
    await userEvent.click(neutral);

    // The button marked as destroying nothing destroyed nothing.
    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(store().getTab(idFor('/a.ts'))?.isDirty).toBe(true);
    expect(dialog()).toBeNull();
  });

  it('closes the tab from the button marked destructive', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );
    await userEvent.click(acceptButton());

    expect(paths()).toEqual(['/b.ts']);
    expect(dialog()).toBeNull();
  });

  it('gives the neutral button the focus', async () => {
    // In a dialog the user did not ask for, the button their hands reach for
    // first must be the one that keeps their work.
    openTabs('/a.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    expect(document.activeElement).toBe(cancelButton());
  });

  it('cancels on Escape rather than closing the tab', async () => {
    // Escape is how every modal is dismissed. One that discarded work when
    // dismissed that way would be a trap.
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );
    await userEvent.keyboard('{Escape}');

    expect(paths()).toEqual(['/a.ts', '/b.ts']);
    expect(store().pendingClose).toBeNull();
  });
});

describe('what the dialog says', () => {
  it('names the file and where the work goes', async () => {
    openTabs('/home/dev/app/src/index.ts');
    soil('/home/dev/app/src/index.ts');

    render(React.createElement(Harness));
    fromStore(() => store().requestCloseTab(idFor('/home/dev/app/src/index.ts')));

    expect(screen.getByTestId('close-confirm-title').textContent).toBe(
      'Close index.ts without saving?'
    );
    expect(screen.getByTestId('close-confirm-body').textContent).toContain(
      '/home/dev/app/src/index.ts'
    );
  });

  it('escalates for a tab holding the only surviving copy', async () => {
    openTabs('/a.ts');
    soil('/a.ts');
    setDiskState('/a.ts', 'missing');

    render(React.createElement(Harness));
    fromStore(() => store().requestCloseTab(idFor('/a.ts')));

    expect(dialog()?.getAttribute('data-destroys')).toBe('only-copy');
    expect(acceptButton().textContent).toBe(
      'Close the file (discard the only copy that still exists)'
    );
    expect(screen.getByTestId('close-confirm-title').textContent).toBe(
      'Close a.ts and discard the only copy?'
    );
  });

  it('lists the files by name when several would be lost', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts', '/d.ts');
    soil('/a.ts');
    soil('/c.ts');
    soil('/d.ts');

    render(React.createElement(Harness));
    fromStore(() => store().requestCloseAllTabs());

    expect(dialog()?.getAttribute('data-doomed-count')).toBe('3');
    const listed = Array.from(document.querySelectorAll('[data-testid="close-confirm-doomed"]'));
    expect(listed.map((node) => node.getAttribute('data-filepath'))).toEqual([
      '/a.ts',
      '/c.ts',
      '/d.ts',
    ]);
    expect(acceptButton().textContent).toBe(
      'Close 3 files without saving (discard all unsaved edits)'
    );
  });

  it('explains each listed file, including the one with no copy on disk', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');
    soil('/b.ts');
    setDiskState('/b.ts', 'missing');

    render(React.createElement(Harness));
    fromStore(() => store().requestCloseAllTabs());

    const listed = Array.from(document.querySelectorAll('[data-testid="close-confirm-doomed"]'));
    expect(listed.map((node) => node.getAttribute('data-doomed-reason'))).toEqual([
      'unsaved',
      'only-copy',
    ]);
    expect(listed[1].textContent).toMatch(/only copy left/i);
    expect(dialog()?.getAttribute('data-destroys')).toBe('only-copy');
  });

  it('does not list a single file: the title already names it', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    fromStore(() => store().requestCloseAllTabs());

    expect(document.querySelector('[data-testid="close-confirm-list"]')).toBeNull();
    expect(screen.getByTestId('close-confirm-title').textContent).toBe(
      'Close a.ts without saving?'
    );
  });

  it('reports the scope it is about', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/b.ts');

    render(React.createElement(Harness));
    fromStore(() => store().requestCloseOtherTabs(idFor('/a.ts')));

    expect(dialog()?.getAttribute('data-scope')).toBe('others');
  });
});

describe('close all with three dirty tabs, end to end', () => {
  it('names three, then closes all five when confirmed', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts', '/d.ts', '/e.ts');
    soil('/a.ts');
    soil('/c.ts');
    soil('/e.ts');

    render(React.createElement(Harness));
    await openContextMenu('/b.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close-all'));

    expect(screen.getByTestId('close-confirm-title').textContent).toBe(
      'Close 3 files without saving?'
    );
    expect(paths()).toHaveLength(5);

    await userEvent.click(acceptButton());

    // Every tab closes, not only the dirty ones: the gesture was "close all".
    expect(paths()).toEqual([]);
    expect(store().activeTabId).toBeNull();
  });

  it('keeps all five when cancelled', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts', '/d.ts', '/e.ts');
    soil('/a.ts');
    soil('/c.ts');
    soil('/e.ts');

    render(React.createElement(Harness));
    await openContextMenu('/b.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close-all'));
    await userEvent.click(cancelButton());

    expect(paths()).toEqual(['/a.ts', '/b.ts', '/c.ts', '/d.ts', '/e.ts']);
    expect(store().hasUnsavedChanges()).toBe(true);
  });
});

describe('confirming acts on the tabs the dialog named', () => {
  it('closes the named tab even after the focus has moved', async () => {
    // The mutation: confirm, then close the wrong tab. Focus moves while the
    // dialog is open, and a confirm that re-derived its target from the active
    // tab would discard work in a file the dialog never mentioned.
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );

    fromStore(() => store().setActiveTab(idFor('/c.ts')));
    await userEvent.click(acceptButton());

    expect(paths()).toEqual(['/b.ts', '/c.ts']);
  });

  it('closes only the named tab, leaving other dirty tabs alone', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/a.ts');
    soil('/b.ts');
    soil('/c.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/b.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );
    await userEvent.click(acceptButton());

    expect(paths()).toEqual(['/a.ts', '/c.ts']);
    expect(store().getTab(idFor('/a.ts'))?.isDirty).toBe(true);
    expect(store().getTab(idFor('/c.ts'))?.isDirty).toBe(true);
  });

  it('keeps the anchor when confirming a close-others prompt', async () => {
    openTabs('/a.ts', '/b.ts', '/c.ts');
    soil('/a.ts');
    soil('/c.ts');

    render(React.createElement(Harness));
    await openContextMenu('/b.ts');
    await userEvent.click(screen.getByTestId('tab-menu-close-others'));
    await userEvent.click(acceptButton());

    expect(paths()).toEqual(['/b.ts']);
    expect(store().activeTabId).toBe(idFor('/b.ts'));
  });

  it('vanishes without closing anything when its file is saved underneath it', async () => {
    openTabs('/a.ts', '/b.ts');
    soil('/a.ts');

    render(React.createElement(Harness));
    await userEvent.click(
      tabFor('/a.ts').querySelector('[data-testid="tab-close"]') as HTMLElement
    );
    expect(dialog()).not.toBeNull();

    // A save lands while the prompt is up: `Ctrl+S` is not blocked by this dialog.
    fromStore(() => store().markTabDirty(idFor('/a.ts'), false, 4242));

    expect(dialog()).toBeNull();
    expect(paths()).toEqual(['/a.ts', '/b.ts']);
  });
});
