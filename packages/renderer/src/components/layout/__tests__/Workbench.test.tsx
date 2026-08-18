/**
 * Workbench — the router that places the active view into the shell.
 *
 * The lazily-loaded views are mocked; the router, the shell, the boundaries and
 * the store are real. That is the point of the file under test: it decides which
 * view goes into the sidebar, which goes into the main area, what testid the
 * wrapper carries, and what happens when a view fails to load. Mocking the
 * leaves keeps Monaco and xterm out of the test and leaves the routing logic
 * itself unmocked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as React from 'react';

const sessionRail = vi.hoisted(() => ({
  setActiveView: (_view: string) => {
    /* assigned after WorkbenchProvider mounts */
  },
}));

// --- Lazy view stubs ---------------------------------------------------------
// Paths mirror the specifiers in Workbench.tsx, resolved from this directory.

vi.mock('../../../views/editor/EditorView', () => ({
  EditorView: () => <p>editor view</p>,
}));
vi.mock('../../../views/editor/FileExplorer', () => ({
  FileExplorer: ({ workspacePath }: { workspacePath: string }) => (
    <p>file explorer: {workspacePath}</p>
  ),
}));
vi.mock('../../../views/workspace/GitPanel', () => ({
  GitPanel: ({ repoPath }: { repoPath: string }) => <p>git panel: {repoPath}</p>,
}));
vi.mock('../../search/AdvancedSearchPanel', () => ({
  AdvancedSearchPanel: ({ workspacePath }: { workspacePath: string }) => (
    <p>search panel: {workspacePath}</p>
  ),
}));
vi.mock('../../../views/workspace/TerminalGrid', () => ({
  TerminalGrid: () => <p>terminal grid</p>,
}));
vi.mock('../../../views/agents/ChatView', () => ({
  ChatView: ({ sessionId }: { sessionId: string }) => <p>chat: {sessionId}</p>,
}));
vi.mock('../../../views/agents/SessionList', () => ({
  SessionList: ({ onNewSession }: { onNewSession: () => void }) => (
    <button type="button" onClick={onNewSession}>
      new session
    </button>
  ),
}));
vi.mock('../../../views/extensions/MCPExtensions', () => ({
  MCPExtensions: () => <p>mcp extensions</p>,
}));
// A spy, not a plain function: the failure-boundary tests replace its
// implementation to make the view throw.
vi.mock('../../../views/workspace/NotesView', () => ({
  NotesView: vi.fn(({ workspaceId }: { workspaceId: string }) => <p>notes: {workspaceId}</p>),
}));
vi.mock('../../../views/workspace/PlansView', () => ({
  PlansView: ({ workspaceId }: { workspaceId: string }) => <p>plans: {workspaceId}</p>,
}));
vi.mock('../../../views/workspace/BrowserView', () => ({
  BrowserView: () => <p>browser view</p>,
}));
vi.mock('../../../views/account/ProfileView', () => ({ ProfileView: () => <p>profile</p> }));
vi.mock('../../../views/account/TeamView', () => ({ TeamView: () => <p>team</p> }));
vi.mock('../../../views/account/BillingView', () => ({ BillingView: () => <p>billing</p> }));
vi.mock('../../../views/automations/AutomationList', () => ({
  AutomationList: ({ onCreate }: { onCreate: () => void }) => (
    <button type="button" onClick={onCreate}>
      new automation
    </button>
  ),
}));
vi.mock('../../../views/automations/AutomationEditor', () => ({
  AutomationEditor: ({ onCancel }: { onCancel: () => void }) => (
    <button type="button" onClick={onCancel}>
      cancel edit
    </button>
  ),
}));
vi.mock('../../../views/automations/LogsViewer', () => ({ LogsViewer: () => <p>logs</p> }));
vi.mock('../../../views/settings/SettingsView', () => ({
  SettingsView: () => <p>settings view</p>,
}));
vi.mock('../../cortex/CortexCodeShell', () => ({
  CortexCodeShell: function MockCortexCodeShell() {
    return (
      <div data-testid="cortex-code-shell">
        <div data-testid="sidebar-panel">No folder open. Open a folder to start.</div>
        <nav data-testid="sidebar">
          {['explorer', 'search', 'git', 'terminal', 'extensions', 'notes', 'plans', 'browser', 'settings', 'ai-chat', 'account', 'automations', 'security', 'review', 'knowledge', 'missions', 'session'].map(
            (id) => (
              <button
                key={id}
                type="button"
                data-testid={`sidebar-${id}`}
                onClick={() => sessionRail.setActiveView(id)}
              >
                {id}
              </button>
            )
          )}
        </nav>
      </div>
    );
  },
}));
vi.mock('../../../views/security/SecurityView', () => ({
  SecurityView: () => <p>security view</p>,
}));
vi.mock('../../../views/review/ReviewView', () => ({
  ReviewView: () => <p>review view</p>,
}));
vi.mock('../../../views/knowledge/KnowledgeView', () => ({
  KnowledgeView: () => <p>knowledge view</p>,
}));
vi.mock('../../../views/missions/MissionsView', () => ({
  MissionsView: () => <p>missions view</p>,
}));
vi.mock('../../../views/debug/DebugPanel', () => ({
  DebugPanel: ({ onClose }: { onClose: () => void }) => (
    <button type="button" onClick={onClose}>
      close debug
    </button>
  ),
}));

import { Workbench } from '../Workbench';
import { WorkbenchProvider, useWorkbench } from '../../../contexts/WorkbenchContext';
import { DebugProvider } from '../../../contexts/DebugContext';
import { useEditorStore } from '../../../store/editor-store';
import { VIEW_BY_ID } from '../views';

const WORKSPACE_STORAGE_KEY = 'cortex:workspace-path';

let workbench: ReturnType<typeof useWorkbench>;

function ContextProbe() {
  workbench = useWorkbench();
  sessionRail.setActiveView = (view) => workbench.setActiveView(view as typeof workbench.activeView);
  return null;
}

beforeEach(() => {
  window.localStorage.clear();
  useEditorStore.setState({ tabs: [], activeTabId: null });
  (window as unknown as Record<string, unknown>).electron = {
    invoke: vi.fn(async () => ({ enabled: false, categories: {} })),
  };
  (window as unknown as Record<string, unknown>).cortex = {
    ai: {
      createSession: vi.fn(async () => ({ success: true, data: { sessionId: 'session-1' } })),
    },
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  useEditorStore.setState({ tabs: [], activeTabId: null });
});

function renderWorkbench(options: { workspacePath?: string } = {}) {
  if (options.workspacePath) {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, options.workspacePath);
  }

  return render(
    <WorkbenchProvider>
      <DebugProvider>
        <ContextProbe />
        <Workbench />
      </DebugProvider>
    </WorkbenchProvider>
  );
}

const goTo = (viewId: string) => fireEvent.click(screen.getByTestId(`sidebar-${viewId}`));

/** Session is the default chrome; AppShell tests need an IDE view first. */
const enterIdeShell = () => goTo('explorer');

describe('Workbench routing', () => {
  describe('main-area testid', () => {
    it('labels the main area "editor-area" for the sidebar views', async () => {
      // Explorer, search and git leave the editor in the main area, so their own
      // panel testid belongs to the sidebar and the main area is just the editor.
      renderWorkbench({ workspacePath: '/repo' });

      for (const viewId of ['explorer', 'search', 'git']) {
        goTo(viewId);
        if (workbench.activeView !== viewId) goTo(viewId);
        await waitFor(() => expect(screen.getByTestId('editor-area')).toBeInTheDocument());
      }
    });

    it('labels the main area with the view\'s own panel testid for document views', async () => {
      // The E2E workspace suite asserts on these wrappers, and they sit outside
      // the error boundary so the panel stays identifiable when the view throws.
      renderWorkbench({ workspacePath: '/repo' });

      for (const viewId of ['terminal', 'extensions', 'notes', 'plans', 'browser', 'settings', 'missions']) {
        goTo(viewId);
        if (workbench.activeView !== viewId) goTo(viewId);
        const expected = VIEW_BY_ID[viewId as 'notes'].panelTestId;
        await waitFor(() => expect(screen.getByTestId(expected)).toBeInTheDocument());
      }
    });
  });

  describe('sidebar memory', () => {
    it('keeps the last sidebar view in place while a document view is open', async () => {
      // Opening the terminal must not blank the sidebar out.
      renderWorkbench({ workspacePath: '/repo' });

      goTo('git');
      await waitFor(() => expect(screen.getByText('git panel: /repo')).toBeInTheDocument());

      goTo('terminal');

      await waitFor(() => expect(screen.getByText('terminal grid')).toBeInTheDocument());
      // Still the git panel in the sidebar, not a blank or reset explorer.
      expect(screen.getByText('git panel: /repo')).toBeInTheDocument();
    });

    it('restores the remembered sidebar view when returning from a document view', async () => {
      renderWorkbench({ workspacePath: '/repo' });
      goTo('search');
      await waitFor(() => expect(screen.getByText('search panel: /repo')).toBeInTheDocument());

      goTo('notes');
      await waitFor(() => expect(screen.getByText('notes: /repo')).toBeInTheDocument());
      expect(screen.getByText('search panel: /repo')).toBeInTheDocument();
    });

    it('starts on the explorer as the remembered sidebar view', async () => {
      renderWorkbench({ workspacePath: '/repo' });

      goTo('browser');

      await waitFor(() => expect(screen.getByText('browser view')).toBeInTheDocument());
      expect(screen.getByText('file explorer: /repo')).toBeInTheDocument();
    });
  });

  describe('no folder open', () => {
    it('offers to open a folder instead of an empty file tree', () => {
      renderWorkbench();

      // Scoped to the sidebar: the header shows "No folder open" too, and the
      // point here is the sidebar's empty state rather than the header's label.
      const sidebar = screen.getByTestId('sidebar-panel');
      expect(sidebar.textContent).toContain('No folder open');
      expect(sidebar.textContent).toContain('Open a folder');
      expect(screen.queryByText(/file explorer/)).not.toBeInTheDocument();
    });

    it('does not load a sidebar view module when there is no folder', () => {
      renderWorkbench();

      goTo('git');

      expect(screen.queryByText(/git panel/)).not.toBeInTheDocument();
      expect(screen.getByTestId('sidebar-panel').textContent).toContain('No folder open');
    });

    it('falls back to a default workspace id for the views that need one', async () => {
      renderWorkbench();

      goTo('notes');

      await waitFor(() => expect(screen.getByText('notes: default')).toBeInTheDocument());
    });
  });

  describe('editor area', () => {
    it('shows the empty state, not the editor, when no file is open', async () => {
      renderWorkbench({ workspacePath: '/repo' });
      enterIdeShell();

      expect(screen.getByTestId('editor-empty-state')).toBeInTheDocument();
      expect(screen.queryByText('editor view')).not.toBeInTheDocument();
    });

    it('renders the editor once a tab exists', async () => {
      renderWorkbench({ workspacePath: '/repo' });
      enterIdeShell();

      useEditorStore.getState().openTab('/repo/a.ts', 'x', 'typescript');

      await waitFor(() => expect(screen.getByText('editor view')).toBeInTheDocument());
      expect(screen.queryByTestId('editor-empty-state')).not.toBeInTheDocument();
    });

    it('routes the empty state\'s actions to the explorer and to search', async () => {
      renderWorkbench({ workspacePath: '/repo' });
      enterIdeShell();

      // Scoped to the empty state: the activity bar also has a "Search" button.
      const emptyState = screen.getByTestId('editor-empty-state');
      fireEvent.click(within(emptyState).getByRole('button', { name: /search/i }));
      expect(workbench.activeView).toBe('search');

      // Back to the editor area, which is where the empty state lives.
      goTo('explorer');
      fireEvent.click(
        within(screen.getByTestId('editor-empty-state')).getByRole('button', {
          name: /browse files/i,
        })
      );
      expect(workbench.activeView).toBe('explorer');
    });
  });

  describe('status bar tab count', () => {
    it('reports the open-tab count, correctly pluralised, from any view', async () => {
      // This is the only place editor state is observable from a document view,
      // where the tab strip is unmounted; the E2E suite reads it to check tabs
      // survive a view switch.
      renderWorkbench({ workspacePath: '/repo' });
      enterIdeShell();
      expect(screen.getByTestId('status-open-tabs').textContent).toBe('No files open');

      useEditorStore.getState().openTab('/repo/a.ts', 'x', 'typescript');
      await waitFor(() =>
        expect(screen.getByTestId('status-open-tabs').textContent).toBe('1 file open')
      );

      useEditorStore.getState().openTab('/repo/b.ts', 'y', 'typescript');
      await waitFor(() =>
        expect(screen.getByTestId('status-open-tabs').textContent).toBe('2 files open')
      );

      // Still reported after switching to a view that unmounts the tab strip.
      goTo('terminal');
      await waitFor(() => expect(screen.getByText('terminal grid')).toBeInTheDocument());
      expect(screen.getByTestId('status-open-tabs').textContent).toBe('2 files open');

      useEditorStore.getState().closeAllTabs();
      await waitFor(() =>
        expect(screen.getByTestId('status-open-tabs').textContent).toBe('No files open')
      );
    });

    it('links the status bar to source control', () => {
      renderWorkbench({ workspacePath: '/repo' });
      enterIdeShell();

      fireEvent.click(screen.getByRole('button', { name: 'Open source control' }));

      expect(workbench.activeView).toBe('git');
    });
  });

  describe('account panel', () => {
    it('reaches all three account tabs, which were previously dead code', async () => {
      renderWorkbench({ workspacePath: '/repo' });
      goTo('account');

      await waitFor(() => expect(screen.getByText('profile')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('team-tab'));
      await waitFor(() => expect(screen.getByText('team')).toBeInTheDocument());
      expect(screen.queryByText('profile')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('billing-tab'));
      await waitFor(() => expect(screen.getByText('billing')).toBeInTheDocument());
    });

    it('marks the selected account tab with aria-selected', async () => {
      renderWorkbench({ workspacePath: '/repo' });
      goTo('account');
      await waitFor(() => expect(screen.getByText('profile')).toBeInTheDocument());

      const selected = screen
        .getAllByRole('tab')
        .filter((tab) => tab.getAttribute('aria-selected') === 'true');
      expect(selected).toHaveLength(1);
      expect(selected[0]).toHaveAttribute('data-testid', 'profile-tab');
    });
  });

  describe('automations panel', () => {
    it('opens the editor from the list and comes back on cancel', async () => {
      // The list's callbacks were wired to no-ops, so these were dead buttons
      // and AutomationEditor was unreachable.
      renderWorkbench({ workspacePath: '/repo' });
      goTo('automations');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'new automation' })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole('button', { name: 'new automation' }));
      await waitFor(() => expect(screen.getByTestId('automation-editor')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: 'cancel edit' }));
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'new automation' })).toBeInTheDocument()
      );
      expect(screen.queryByTestId('automation-editor')).not.toBeInTheDocument();
    });
  });

  describe('AI chat panel', () => {
    it('starts on an empty state and creates a session on demand', async () => {
      // A session has to exist before ChatView can render; creating one on mount
      // behind the user's back is what this avoids.
      renderWorkbench({ workspacePath: '/repo' });
      goTo('ai-chat');

      await waitFor(() => expect(screen.getByTestId('ai-chat-empty-state')).toBeInTheDocument());
      expect(window.cortex.ai.createSession).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /new chat session/i }));

      await waitFor(() => expect(screen.getByText('chat: session-1')).toBeInTheDocument());
    });

    it('stays on the empty state when the response reports failure', async () => {
      // `success: false` *with* a usable-looking payload: the failure has to be
      // decided by the `success` flag, not by the data happening to be absent.
      // A handler that ignored `success` would open a chat on a session the main
      // process never created.
      (window.cortex.ai.createSession as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: { message: 'no provider configured' },
        data: { sessionId: 'session-that-does-not-exist' },
      });
      renderWorkbench({ workspacePath: '/repo' });
      goTo('ai-chat');
      await waitFor(() => expect(screen.getByTestId('ai-chat-empty-state')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /new chat session/i }));

      await waitFor(() => expect(window.cortex.ai.createSession).toHaveBeenCalledTimes(1));
      expect(screen.queryByText('chat: session-that-does-not-exist')).not.toBeInTheDocument();
      expect(screen.getByTestId('ai-chat-empty-state')).toBeInTheDocument();
    });
  });

  describe('view failure boundary', () => {
    /**
     * Swaps NotesView's implementation for the duration of a test.
     *
     * The mock's original implementation is captured and put back by hand:
     * `vi.restoreAllMocks()` would leave the factory spy with no implementation
     * at all, so a later test would render `undefined` instead of the stub.
     */
    async function withNotesView(
      implementation: () => React.ReactElement,
      run: () => Promise<void>
    ): Promise<void> {
      const { NotesView } = await import('../../../views/workspace/NotesView');
      const spy = vi.mocked(NotesView);
      const original = spy.getMockImplementation();
      spy.mockImplementation(implementation as typeof NotesView);
      try {
        await run();
      } finally {
        if (original) spy.mockImplementation(original);
        else spy.mockReset();
      }
    }

    it('keeps the shell and the panel wrapper alive when a view throws', async () => {
      // One broken view must not blank the workbench: the activity bar, the
      // status bar and the panel's testid all have to survive so the user can
      // navigate away and the E2E selectors still resolve.
      await withNotesView(
        () => {
          throw new Error('notes view exploded');
        },
        async () => {
          renderWorkbench({ workspacePath: '/repo' });
          goTo('notes');

          await waitFor(() =>
            expect(screen.getByText(/this view failed to load/i)).toBeInTheDocument()
          );
          expect(screen.getByText('notes view exploded')).toBeInTheDocument();
          // Shell intact.
          expect(screen.getByTestId('sidebar')).toBeInTheDocument();
          expect(screen.getByTestId('status-bar')).toBeInTheDocument();
          expect(screen.getByTestId('app-header')).toBeInTheDocument();
          // The panel wrapper's testid lives outside the boundary, so the panel
          // keeps its identity even though the view inside it failed.
          expect(screen.getByTestId('notes-view')).toBeInTheDocument();
        }
      );
    });

    it('lets the user navigate away from a broken view', async () => {
      await withNotesView(
        () => {
          throw new Error('notes view exploded');
        },
        async () => {
          renderWorkbench({ workspacePath: '/repo' });
          goTo('notes');
          await waitFor(() =>
            expect(screen.getByText(/this view failed to load/i)).toBeInTheDocument()
          );

          goTo('browser');

          await waitFor(() => expect(screen.getByText('browser view')).toBeInTheDocument());
          expect(screen.queryByText(/this view failed to load/i)).not.toBeInTheDocument();
        }
      );
    });

    it('remounts the view when retry is pressed, so a fixed view recovers', async () => {
      let shouldThrow = true;
      await withNotesView(
        () => {
          if (shouldThrow) throw new Error('transient failure');
          return <p>notes recovered</p>;
        },
        async () => {
          renderWorkbench({ workspacePath: '/repo' });
          goTo('notes');
          await waitFor(() =>
            expect(screen.getByText(/this view failed to load/i)).toBeInTheDocument()
          );

          shouldThrow = false;
          fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));

          await waitFor(() => expect(screen.getByText('notes recovered')).toBeInTheDocument());
          expect(screen.queryByText(/this view failed to load/i)).not.toBeInTheDocument();
        }
      );
    });

    it('recovers repeatedly, so a second failure is also retryable', async () => {
      // Scope note: this covers retry for a view that throws while rendering. It
      // does *not* prove the boundary is re-keyed — with a render-time throw,
      // clearing the error state alone is enough to recover, so both a keyed and
      // an unkeyed boundary pass. The re-key requirement is specific to a lazy
      // import whose promise rejected (React caches the rejection), and is
      // covered in views.test.tsx against `lazyNamed`, where the loader can be
      // made to fail once.
      let shouldThrow = true;

      await withNotesView(
        () => {
          if (shouldThrow) throw new Error('transient failure');
          return <p>notes recovered</p>;
        },
        async () => {
          renderWorkbench({ workspacePath: '/repo' });
          goTo('notes');
          await waitFor(() =>
            expect(screen.getByText(/this view failed to load/i)).toBeInTheDocument()
          );

          shouldThrow = false;
          fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
          await waitFor(() => expect(screen.getByText('notes recovered')).toBeInTheDocument());

          // Fail again, then recover again.
          shouldThrow = true;
          goTo('browser');
          await waitFor(() => expect(screen.getByText('browser view')).toBeInTheDocument());
          goTo('notes');
          await waitFor(() =>
            expect(screen.getByText(/this view failed to load/i)).toBeInTheDocument()
          );

          shouldThrow = false;
          fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));
          await waitFor(() => expect(screen.getByText('notes recovered')).toBeInTheDocument());
        }
      );
    });
  });

  describe('debug panel docking', () => {
    it('docks under the active view and closes from its own control', async () => {
      window.localStorage.setItem('debug:panel-visible', 'true');
      renderWorkbench({ workspacePath: '/repo' });
      enterIdeShell();

      await waitFor(() => expect(screen.getByTestId('debug-panel')).toBeInTheDocument());
      // The view it docks under is still mounted.
      expect(screen.getByTestId('editor-area')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'close debug' }));

      await waitFor(() => expect(screen.queryByTestId('debug-panel')).not.toBeInTheDocument());
    });

    it('is absent by default', () => {
      renderWorkbench({ workspacePath: '/repo' });

      expect(screen.queryByTestId('debug-panel')).not.toBeInTheDocument();
    });
  });
});
