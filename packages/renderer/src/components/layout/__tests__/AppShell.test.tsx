/**
 * AppShell — the workbench chrome: header, activity bar, sidebar, status bar.
 *
 * AppShell owns no view logic, so the things worth asserting are the ones a
 * broken shell takes down with it: every view reachable from the activity bar,
 * the sidebar's collapse behaviour and its persistence, the Cmd/Ctrl+B binding,
 * and the accessibility attributes the a11y suite and screen readers depend on.
 *
 * The real `WorkbenchProvider` and `DebugProvider` are used rather than stubs:
 * the sidebar's collapsed state lives in the provider and is persisted to
 * localStorage, so a stub would assert against the test's own bookkeeping.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as React from 'react';

import { AppShell } from '../AppShell';
import { VIEWS } from '../views';
import { WorkbenchProvider, useWorkbench } from '../../../contexts/WorkbenchContext';
import { DebugProvider } from '../../../contexts/DebugContext';

const SIDEBAR_STORAGE_KEY = 'cortex:sidebar-collapsed';
const WORKSPACE_STORAGE_KEY = 'cortex:workspace-path';

beforeEach(() => {
  window.localStorage.clear();

  // DebugContext calls window.electron.invoke('debug:get-settings') on mount.
  (window as unknown as Record<string, unknown>).electron = {
    invoke: vi.fn(async () => ({ enabled: false, categories: {} })),
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/** Exposes the workbench context to a test, so assertions can read real state. */
let workbench: ReturnType<typeof useWorkbench>;

function ContextProbe() {
  workbench = useWorkbench();
  return null;
}

/** Session is the default workbench view; AppShell tests start from Explorer. */
function enterIdeShell() {
  fireEvent.click(screen.getByTestId('sidebar-explorer'));
}

function renderShell(props: Partial<React.ComponentProps<typeof AppShell>> = {}) {
  return render(
    <WorkbenchProvider>
      <DebugProvider>
        <ContextProbe />
        <AppShell sidebar={<p>sidebar content</p>} statusBar={<span>status content</span>} {...props}>
          <p>main content</p>
        </AppShell>
      </DebugProvider>
    </WorkbenchProvider>
  );
}

describe('AppShell', () => {
  describe('frame', () => {
    it('renders the caller\'s sidebar, main content and status bar in their landmarks', () => {
      const { container } = renderShell();

      expect(screen.getByText('sidebar content')).toBeInTheDocument();
      expect(screen.getByText('main content')).toBeInTheDocument();
      expect(screen.getByText('status content')).toBeInTheDocument();

      // Each slot goes into the region that owns it, not merely somewhere on the
      // page: main content inside <main>, status inside the status bar.
      expect(screen.getByTestId('content-area').textContent).toContain('main content');
      expect(screen.getByTestId('status-bar').textContent).toContain('status content');
      expect(screen.getByTestId('sidebar-panel').textContent).toContain('sidebar content');
      expect(container.querySelector('header')).toBeTruthy();
    });

    it('renders without a sidebar or status bar', () => {
      render(
        <WorkbenchProvider>
          <DebugProvider>
            <AppShell>
              <p>only main</p>
            </AppShell>
          </DebugProvider>
        </WorkbenchProvider>
      );

      expect(screen.getByText('only main')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-panel')).toBeInTheDocument();
    });

    it('exposes the landmarks assistive tech navigates by', () => {
      renderShell();

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Primary navigation' })).toBeInTheDocument();
      expect(screen.getByRole('main', { name: 'Main content' })).toBeInTheDocument();
      // The status bar reports changes that happen without user action.
      const status = screen.getByTestId('status-bar');
      expect(status).toHaveAttribute('role', 'status');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('activity bar', () => {
    it('renders a button for every registered view', () => {
      renderShell();

      for (const view of VIEWS) {
        const button = screen.getByTestId(view.testId);
        expect(button, `no activity-bar button for ${view.id}`).toBeInTheDocument();
        // Icon-only control: the name has to come from aria-label.
        expect(button).toHaveAttribute('aria-label', view.label);
      }
      expect(screen.getAllByRole('button', { name: VIEWS[0].label })).toHaveLength(1);
    });

    it('marks only the active view with aria-current', () => {
      // aria-current is how a screen-reader user knows which view is showing;
      // the colour change alone does not convey it.
      renderShell();
      enterIdeShell();

      const active = VIEWS.filter(
        (view) => screen.getByTestId(view.testId).getAttribute('aria-current') === 'page'
      );
      expect(active.map((view) => view.id)).toEqual(['explorer']);

      fireEvent.click(screen.getByTestId('sidebar-git'));

      const afterSwitch = VIEWS.filter(
        (view) => screen.getByTestId(view.testId).getAttribute('aria-current') === 'page'
      );
      expect(afterSwitch.map((view) => view.id)).toEqual(['git']);
    });

    it('switches view and reveals the sidebar when a different icon is clicked', () => {
      renderShell();
      // Start collapsed, as a user who hid the sidebar would be.
      fireEvent.click(screen.getByTestId('toggle-sidebar'));
      expect(workbench.sidebarCollapsed).toBe(true);

      fireEvent.click(screen.getByTestId('sidebar-search'));

      // Selecting a view while collapsed must not appear to do nothing.
      expect(workbench.activeView).toBe('search');
      expect(workbench.sidebarCollapsed).toBe(false);
    });

    it('toggles the sidebar when the already-active icon is clicked, keeping the view', () => {
      renderShell();
      enterIdeShell();
      expect(workbench.activeView).toBe('explorer');

      fireEvent.click(screen.getByTestId('sidebar-explorer'));
      expect(workbench.sidebarCollapsed).toBe(true);
      expect(workbench.activeView).toBe('explorer');

      fireEvent.click(screen.getByTestId('sidebar-explorer'));
      expect(workbench.sidebarCollapsed).toBe(false);
      expect(workbench.activeView).toBe('explorer');
    });

    it('reaches every view through its own button', () => {
      renderShell();

      for (const view of VIEWS) {
        fireEvent.click(screen.getByTestId(view.testId));
        // Clicking the active icon collapses instead of switching, so re-click
        // through a different view when the target is already active.
        if (workbench.activeView !== view.id) {
          fireEvent.click(screen.getByTestId(view.testId));
        }
        expect(workbench.activeView, `${view.id} not reachable`).toBe(view.id);
      }
    });
  });

  describe('sidebar collapse', () => {
    it('keeps the panel mounted when collapsed, so its state survives', () => {
      // The width animates to 0 rather than unmounting: a collapse that
      // unmounted the panel would reset the explorer's scroll position and
      // expanded folders every time.
      renderShell();

      fireEvent.click(screen.getByTestId('toggle-sidebar'));

      expect(workbench.sidebarCollapsed).toBe(true);
      expect(screen.getByText('sidebar content')).toBeInTheDocument();
      const aside = screen.getByTestId('sidebar-panel');
      expect(aside).toHaveAttribute('aria-hidden', 'true');
      expect(aside.className).toContain('w-0');
    });

    it('hides the collapsed panel from assistive tech and reveals it again', () => {
      renderShell();
      const aside = screen.getByTestId('sidebar-panel');
      expect(aside).toHaveAttribute('aria-hidden', 'false');

      fireEvent.click(screen.getByTestId('toggle-sidebar'));
      expect(screen.getByTestId('sidebar-panel')).toHaveAttribute('aria-hidden', 'true');

      fireEvent.click(screen.getByTestId('toggle-sidebar'));
      expect(screen.getByTestId('sidebar-panel')).toHaveAttribute('aria-hidden', 'false');
      expect(screen.getByTestId('sidebar-panel').className).toContain('w-[320px]');
    });

    it('keeps the toggle button\'s label and aria-expanded in step with the state', () => {
      renderShell();
      const toggle = screen.getByTestId('toggle-sidebar');
      expect(toggle).toHaveAttribute('aria-label', 'Hide sidebar');
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(toggle);

      expect(screen.getByTestId('toggle-sidebar')).toHaveAttribute('aria-label', 'Show sidebar');
      expect(screen.getByTestId('toggle-sidebar')).toHaveAttribute('aria-expanded', 'false');
    });

    it('persists the collapsed state and restores it on the next mount', () => {
      const { unmount } = renderShell();
      fireEvent.click(screen.getByTestId('toggle-sidebar'));
      expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');

      unmount();
      renderShell();

      expect(workbench.sidebarCollapsed).toBe(true);
      expect(screen.getByTestId('sidebar-panel')).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Cmd/Ctrl+B', () => {
    it('toggles the sidebar from anywhere in the window', () => {
      renderShell();

      fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
      expect(workbench.sidebarCollapsed).toBe(true);

      fireEvent.keyDown(window, { key: 'b', metaKey: true });
      expect(workbench.sidebarCollapsed).toBe(false);
    });

    it('responds to an uppercase B, as Caps Lock or Shift produces', () => {
      renderShell();

      fireEvent.keyDown(window, { key: 'B', ctrlKey: true });

      expect(workbench.sidebarCollapsed).toBe(true);
    });

    it('ignores B without a modifier, so typing b in a field is not swallowed', () => {
      renderShell();

      fireEvent.keyDown(window, { key: 'b' });

      expect(workbench.sidebarCollapsed).toBe(false);
    });

    it('stops toggling once unmounted', () => {
      // A listener left on window after unmount keeps calling into a dead tree —
      // React logs a warning and the next mount gets two handlers, so one press
      // toggles twice and appears to do nothing.
      const { unmount } = renderShell();
      fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
      expect(workbench.sidebarCollapsed).toBe(true);
      unmount();

      fireEvent.keyDown(window, { key: 'b', ctrlKey: true });

      // Remount and confirm the stored state moved exactly once.
      expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe('true');

      renderShell();
      fireEvent.keyDown(window, { key: 'b', ctrlKey: true });
      expect(workbench.sidebarCollapsed).toBe(false);
    });
  });

  describe('header', () => {
    it('shows the folder name rather than the whole path, with the path as a title', () => {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '/home/dev/projects/cortex-ide');
      renderShell();

      // Scoped to the header: the status bar shows the full path on purpose, so
      // an unscoped query would match there too.
      const header = screen.getByTestId('app-header');
      expect(header.textContent).toContain('cortex-ide');
      expect(header.textContent).not.toContain('/home/dev/projects');
      // The full path stays reachable on hover rather than being dropped.
      expect(
        header.querySelector('[title="/home/dev/projects/cortex-ide"]')
      ).toBeTruthy();
    });

    it('tolerates a trailing separator when deriving the folder name', () => {
      // `'/a/b/'.split('/')` ends in an empty segment, which would render a
      // blank folder name in the header.
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '/home/dev/projects/cortex-ide/');
      renderShell();

      const header = screen.getByTestId('app-header');
      expect(header.textContent).toContain('cortex-ide');
    });

    it('handles a Windows path', () => {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, 'C:\\Users\\dev\\cortex-ide');
      renderShell();

      const header = screen.getByTestId('app-header');
      expect(header.textContent).toContain('cortex-ide');
      expect(header.textContent).not.toContain('Users');
    });

    it('falls back to the root path itself rather than rendering an empty name', () => {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '/');
      renderShell();

      // Every segment of '/' is empty, so the basename helper must fall back to
      // the path rather than leaving the header's folder line blank.
      const folderLine = screen.getByTestId('app-header').querySelector('p');
      expect(folderLine?.textContent).toBe('/');
    });

    it('says no folder is open when there is none', () => {
      renderShell();

      expect(screen.getByText('No folder open')).toBeInTheDocument();
    });

    it('opens the command palette from the visible affordance', () => {
      // Cmd+P is undiscoverable on its own, so the button is the discoverable
      // path in. A dead button here means new users never find the palette.
      const onOpenCommandPalette = vi.fn();
      renderShell({ onOpenCommandPalette });

      fireEvent.click(screen.getByTestId('command-palette-trigger'));

      expect(onOpenCommandPalette).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the palette callback is absent', () => {
      renderShell({ onOpenCommandPalette: undefined });

      expect(() => fireEvent.click(screen.getByTestId('command-palette-trigger'))).not.toThrow();
    });

    it('routes Ask AI and the settings icon to their views', () => {
      renderShell();

      fireEvent.click(screen.getByTestId('ask-ai'));
      expect(workbench.activeView).toBe('ai-chat');

      fireEvent.click(screen.getByTestId('open-settings'));
      expect(workbench.activeView).toBe('settings');
    });

    it('reports the debug toggle\'s state through aria-pressed', async () => {
      renderShell();

      const toggle = await waitFor(() => screen.getByTestId('toggle-debug'));
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(toggle).toHaveAttribute('aria-label', 'Enable debug mode');
    });
  });

  describe('status bar', () => {
    it('names the active view and follows a view switch', () => {
      renderShell();
      enterIdeShell();
      const statusBar = screen.getByTestId('status-bar');
      expect(statusBar.textContent).toContain('Explorer');

      fireEvent.click(screen.getByTestId('sidebar-git'));

      expect(screen.getByTestId('status-bar').textContent).toContain('Source Control');
    });

    it('shows the workspace path only when a folder is open', () => {
      renderShell();
      expect(screen.getByTestId('status-bar').textContent).not.toContain('/home/dev');

      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '/home/dev/app');
      renderShell();

      expect(screen.getAllByTestId('status-bar').at(-1)?.textContent).toContain('/home/dev/app');
    });
  });
});
