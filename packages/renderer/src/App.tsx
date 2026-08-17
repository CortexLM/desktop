/**
 * App - root of the renderer.
 *
 * Composes the providers, gates on a chosen workspace, and owns the command
 * palette (which needs to reach across every view, so it lives above them).
 */

import * as React from 'react';
import { Bug, FolderOpen, PanelLeft, Sun } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/toast';
import { DebugProvider, useDebug } from './contexts/DebugContext';
import { WorkbenchProvider, useWorkbench } from './contexts/WorkbenchContext';
import { Workbench } from './components/layout/Workbench';
import { WorkspaceSelector } from './components/WorkspaceSelector';
import { CommandPalette, type Command, type PaletteMode } from './components/CommandPalette';
import { UpdateNotification } from './components/UpdateNotification';
import { InteractiveTutorial, WelcomeScreen } from './components/onboarding';
import { useOnboarding } from './hooks/use-onboarding';
import { useWorkspaceFiles, type IndexedFile } from './hooks/use-workspace-files';
import { useErrorHandler } from './hooks/use-error-handler';
import { useEditorStore } from './store/editor-store';
import { useTheme } from './hooks/use-theme';
import { VIEWS, formatShortcut } from './components/layout/views';
import { detectLanguageFromPath } from './lib/language-detect';
import { setupErrorHandlers } from './utils/error-handlers';

setupErrorHandlers();

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <DebugProvider>
          <WorkbenchProvider>
            <AppContent />
          </WorkbenchProvider>
        </DebugProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { workspacePath, openWorkspace, activeView, setActiveView, toggleSidebar } = useWorkbench();
  const { toggleDebugMode, showDebugPanel, setShowDebugPanel } = useDebug();
  const { resolvedTheme, setTheme } = useTheme();
  const { handleError } = useErrorHandler();
  const openTab = useEditorStore((state) => state.openTab);

  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [paletteMode, setPaletteMode] = React.useState<PaletteMode>('files');

  // Indexing starts only once the palette has been opened at least once, so
  // startup isn't spent walking a tree the user may never search.
  const [filesRequested, setFilesRequested] = React.useState(false);
  const {
    files,
    isLoading: isIndexing,
    truncated: filesTruncated,
  } = useWorkspaceFiles(workspacePath, filesRequested);

  const {
    shouldShowWelcome,
    markWelcomeSeen,
    markTutorialCompleted,
  } = useOnboarding();
  const [showTutorial, setShowTutorial] = React.useState(false);

  const openPalette = React.useCallback((mode: PaletteMode) => {
    setFilesRequested(true);
    setPaletteMode(mode);
    setPaletteOpen(true);
  }, []);

  /** Opens a file from the palette into an editor tab. */
  const openFile = React.useCallback(
    async (file: IndexedFile) => {
      try {
        const response = await window.cortex.editor.openFile({ path: file.path });

        // IPCResponse is a discriminated union: the failure branch carries the
        // reason, so narrow on `success` before reaching for either side.
        if (!response?.success) {
          throw new Error(response?.error?.message ?? `Could not read ${file.name}`);
        }

        openTab(file.path, response.data.content, detectLanguageFromPath(file.path));
        setActiveView('explorer');
      } catch (error) {
        handleError(error, {
          title: `Could not open ${file.name}`,
          retry: () => void openFile(file),
        });
      }
    },
    [openTab, setActiveView, handleError]
  );

  const commands = React.useMemo<Command[]>(
    () => [
      // View navigation, generated from the same registry the activity bar uses
      // so a new view shows up in the palette automatically.
      ...VIEWS.map((view) => ({
        id: `view.${view.id}`,
        label: `Go to ${view.label}`,
        description: 'View',
        keywords: ['view', 'go', 'open', view.id],
        shortcut: formatShortcut(view.shortcut),
        icon: <view.icon className="w-4 h-4" aria-hidden="true" />,
        action: () => setActiveView(view.id),
      })),
      {
        id: 'session.new',
        label: 'New session',
        description: 'Session',
        keywords: ['session', 'new', 'chat'],
        shortcut: formatShortcut('Cmd+N'),
        action: () => setActiveView('session'),
      },
      {
        id: 'session.terminal',
        label: 'Toggle terminal',
        description: 'Session',
        keywords: ['terminal'],
        shortcut: formatShortcut('Cmd+J'),
        action: () => setActiveView('terminal'),
      },
      {
        id: 'session.changes',
        label: 'Open changes',
        description: 'Session',
        keywords: ['git', 'diff', 'changes'],
        shortcut: formatShortcut('Cmd+D'),
        action: () => setActiveView('git'),
      },
      {
        id: 'session.model',
        label: 'Switch model',
        description: 'Session',
        keywords: ['model', 'claude', 'provider'],
        shortcut: formatShortcut('Cmd+M'),
        action: () => setActiveView('session'),
      },
      {
        id: 'session.attach',
        label: 'Attach file',
        description: 'Session',
        keywords: ['attach', 'file', 'context'],
        shortcut: formatShortcut('Cmd+Shift+A'),
        action: () => setActiveView('explorer'),
      },
      {
        id: 'workbench.toggleSidebar',
        label: 'Toggle sidebar',
        description: 'View',
        keywords: ['panel', 'hide', 'show', 'collapse'],
        shortcut: formatShortcut('Cmd+B'),
        icon: <PanelLeft className="w-4 h-4" aria-hidden="true" />,
        action: toggleSidebar,
      },
      {
        id: 'workbench.toggleTheme',
        label: `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`,
        description: 'Preferences',
        keywords: ['theme', 'dark', 'light', 'appearance'],
        icon: <Sun className="w-4 h-4" aria-hidden="true" />,
        action: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
      },
      {
        id: 'workbench.toggleDebugMode',
        label: 'Toggle debug mode',
        description: 'Developer',
        keywords: ['debug', 'developer', 'diagnostics'],
        icon: <Bug className="w-4 h-4" aria-hidden="true" />,
        action: () => void toggleDebugMode(),
      },
      {
        id: 'workbench.toggleDebugPanel',
        label: showDebugPanel ? 'Hide debug panel' : 'Show debug panel',
        description: 'Developer',
        keywords: ['debug', 'panel', 'ipc', 'console'],
        shortcut: formatShortcut('Cmd+Shift+D'),
        icon: <Bug className="w-4 h-4" aria-hidden="true" />,
        action: () => setShowDebugPanel(!showDebugPanel),
      },
      {
        id: 'workspace.close',
        label: 'Close folder',
        description: 'Workspace',
        keywords: ['workspace', 'folder', 'switch', 'change'],
        icon: <FolderOpen className="w-4 h-4" aria-hidden="true" />,
        action: () => {
          // Full reload so every view drops state tied to the old folder.
          window.localStorage.removeItem('cortex:workspace-path');
          window.location.reload();
        },
      },
    ],
    [
      setActiveView,
      toggleSidebar,
      resolvedTheme,
      setTheme,
      toggleDebugMode,
      showDebugPanel,
      setShowDebugPanel,
    ]
  );

  // Global shortcuts. Registered here rather than in the shell because the
  // palette and view switching have to work from anywhere in the app.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;

      const key = event.key.toLowerCase();

      if (key === 'p') {
        event.preventDefault();
        openPalette(event.shiftKey ? 'commands' : 'files');
        return;
      }

      // Cmd+Shift+D predates the palette and is documented in the debug docs.
      if (event.shiftKey && key === 'd') {
        event.preventDefault();
        setShowDebugPanel(!showDebugPanel);
        return;
      }

      if (key === 'l') {
        event.preventDefault();
        setActiveView('session');
        return;
      }

      if (key === 'j') {
        event.preventDefault();
        // Live session keeps ⌘J on the 320 terminal surface; IDE chrome still
        // routes to the full terminal view.
        if (activeView !== 'session') {
          setActiveView('terminal');
        }
        return;
      }

      if (key === ',') {
        event.preventDefault();
        setActiveView('settings');
        return;
      }

      if (event.shiftKey) {
        // Cmd+Shift+E / F / G / X mirror the activity bar's tooltips.
        const viewByKey: Record<string, Parameters<typeof setActiveView>[0]> = {
          e: 'explorer',
          f: 'search',
          g: 'git',
          x: 'extensions',
        };

        const view = viewByKey[key];
        if (view) {
          event.preventDefault();
          setActiveView(view);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeView, openPalette, setActiveView, setShowDebugPanel, showDebugPanel]);

  // Ctrl+` for the terminal, kept separate because it carries no shift/meta
  // combination and `key` is a backtick rather than a letter.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === '`') {
        event.preventDefault();
        setActiveView('terminal');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveView]);

  if (!workspacePath) {
    return <WorkspaceSelector onOpen={openWorkspace} />;
  }

  return (
    <>
      <Workbench onOpenCommandPalette={() => openPalette('files')} />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        mode={paletteMode}
        onModeChange={setPaletteMode}
        commands={commands}
        files={files}
        isIndexing={isIndexing}
        filesTruncated={filesTruncated}
        onSelectFile={(file) => void openFile(file)}
      />

      <UpdateNotification />

      {shouldShowWelcome && (
        <WelcomeScreen
          onClose={markWelcomeSeen}
          onStartTutorial={() => {
            markWelcomeSeen();
            setShowTutorial(true);
          }}
        />
      )}

      {showTutorial && (
        <InteractiveTutorial
          onComplete={() => {
            markTutorialCompleted();
            setShowTutorial(false);
          }}
          onSkip={() => setShowTutorial(false)}
        />
      )}
    </>
  );
}
