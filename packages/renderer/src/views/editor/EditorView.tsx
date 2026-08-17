/**
 * EditorView - Main editor component with Monaco Editor integration
 */

import React, { useEffect, useRef, useState } from 'react';
// Side-effect import: binds Monaco to the bundled copy instead of the CDN.
// Without it the editor never finishes loading offline.
import '../../lib/monaco-setup';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Monaco, OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../store/editor-store';
import { TabManager } from './TabManager';
import { ConflictResolutionDialog } from './ConflictResolutionDialog';
import { CloseConfirmationDialog } from './CloseConfirmationDialog';
import { attemptSave, createIpcWriter, type SaveDeps } from './save-actions';
import { useTheme } from '../../hooks/use-theme';
import { Spinner } from '../../components/ui/spinner';

export const EditorView: React.FC = () => {
  const { 
    activeTabId, 
    updateTabContent, 
    markTabDirty,
    updateCursorPosition,
    updateScrollPosition,
    getActiveTab,
    openConflictDialog,
  } = useEditorStore();
  
  const { theme } = useTheme();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeTab = getActiveTab();

  // Monaco commands are registered once, on mount, so a handler passed directly
  // to addCommand() keeps the `activeTab` it closed over then — which is the tab
  // as it looked before any edit (isDirty: false). handleSaveFile() would return
  // early every time and Ctrl+S silently did nothing. Calling through a ref that
  // is refreshed each render means the command always runs the current handler.
  const saveFileRef = useRef<() => void>(() => {});

  // Configure Monaco Editor on mount
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsLoading(false);

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontLigatures: true,
      lineHeight: 24,
      minimap: {
        enabled: true,
        scale: 1,
        showSlider: 'mouseover',
      },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'all',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: {
        enabled: true,
      },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
      suggest: {
        preview: true,
        showInlineDetails: true,
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: false,
      },
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'mouseover',
      matchBrackets: 'always',
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      formatOnPaste: true,
      formatOnType: true,
    });

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      if (activeTabId) {
        updateCursorPosition(
          activeTabId,
          e.position.lineNumber,
          e.position.column
        );
      }
    });

    // Track scroll position
    editor.onDidScrollChange((e) => {
      if (activeTabId) {
        updateScrollPosition(activeTabId, e.scrollTop, e.scrollLeft);
      }
    });

    // Keyboard shortcuts. Save goes through the ref so it always sees the
    // current tab state rather than the mount-time snapshot.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFileRef.current();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => {
        editor.getAction('editor.action.startFindReplaceAction')?.run();
      }
    );

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
      window.dispatchEvent(new CustomEvent('cortex:add-to-chat'));
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      window.dispatchEvent(new CustomEvent('cortex:inline-edit'));
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
      window.dispatchEvent(new CustomEvent('cortex:accept-hunk'));
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyN, () => {
      window.dispatchEvent(new CustomEvent('cortex:reject-hunk'));
    });
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyY,
      () => {
        window.dispatchEvent(new CustomEvent('cortex:accept-file'));
      }
    );
    editor.addCommand(monaco.KeyCode.F7, () => {
      window.dispatchEvent(new CustomEvent('cortex:next-hunk'));
    });
    editor.addCommand(monaco.KeyCode.F8, () => {
      window.dispatchEvent(new CustomEvent('cortex:next-conflict'));
    });

    // Focus editor
    editor.focus();
  };

  // Handle content changes
  const handleEditorChange = (value: string | undefined) => {
    if (!activeTabId || !activeTab) return;

    const newContent = value || '';
    const isDirty = newContent !== activeTab.content;

    updateTabContent(activeTabId, newContent);
    markTabDirty(activeTabId, isDirty);
  };

  /**
   * Save, gated on the tab's disk state.
   *
   * The sequencing lives in `attemptSave` rather than here because this module
   * imports Monaco and therefore cannot be loaded by a jsdom test, and the save
   * gate is the one path whose failure destroys a file. `SaveDeps` is rebuilt per
   * call so `getTab` reads current state: the tab can be reconciled between the
   * keystroke and the write, and a save decided from a stale snapshot is a save
   * that ignores a conflict detected a moment ago.
   *
   * On a `conflict` tab this writes nothing and opens the resolution dialog. That
   * is the behaviour change: the conflict indicator used to be a warning the same
   * `Ctrl+S` walked straight through.
   */
  const saveDeps = (): SaveDeps => ({
    getTab: (id) => useEditorStore.getState().tabs.find((tab) => tab.id === id),
    writeFile: createIpcWriter(),
    markSaved: (id, mtime) => markTabDirty(id, false, mtime),
    openConflictDialog,
  });

  const handleSaveFile = async () => {
    if (!activeTabId) return;
    await attemptSave(saveDeps(), activeTabId);
  };

  // Keep the Ctrl+S command pointing at the current handler (see saveFileRef).
  saveFileRef.current = () => {
    void handleSaveFile();
  };

  // Restore cursor and scroll position when switching tabs
  useEffect(() => {
    if (!editorRef.current || !activeTab) return;

    const editor = editorRef.current;

    // Restore cursor position
    if (activeTab.cursorPosition) {
      editor.setPosition({
        lineNumber: activeTab.cursorPosition.line,
        column: activeTab.cursorPosition.column,
      });
    }

    // Restore scroll position
    if (activeTab.scrollPosition) {
      editor.setScrollPosition({
        scrollTop: activeTab.scrollPosition.top,
        scrollLeft: activeTab.scrollPosition.left,
      });
    }

    editor.focus();
  }, [activeTabId]);

  /**
   * Auto-save when the window loses focus.
   *
   * This is the more dangerous of the two save paths: it fires without any
   * gesture from the user, so before the gate it would overwrite a conflicting
   * file merely because the user alt-tabbed — plausibly to the editor that made
   * the other change. It goes through the same `attemptSave`, so a `conflict`
   * tab writes nothing.
   *
   * It does *not* open the dialog. A modal appearing in a window the user has
   * just left, to be discovered on return with no memory of what triggered it, is
   * a prompt nobody asked for; the tab strip already flags the conflict and the
   * indicator is clickable. Blocking silently here is the difference between
   * "your file was not overwritten" and "your file was not overwritten, and also
   * here is a modal".
   */
  useEffect(() => {
    const handleBlur = () => {
      if (!activeTabId) return;
      void attemptSave(
        { ...saveDeps(), openConflictDialog: () => {} },
        activeTabId
      );
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [activeTabId]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Tab Bar */}
      <TabManager />

      {/*
        Renders only when a tab has something to resolve, and reads which tab
        from the store. Mounted here rather than inside TabManager so it survives
        the tab strip re-rendering underneath it.
      */}
      <ConflictResolutionDialog />

      {/*
        Renders only while a close gesture is waiting on an answer. Mounted beside
        the conflict dialog and for the same reason: it must survive the tab strip
        re-rendering underneath it, and `Ctrl+W` can raise it while no tab strip
        interaction is in progress at all.
      */}
      <CloseConfirmationDialog />

      {/* Editor Area */}
      <div className="flex-1 relative">
        {!activeTab ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">No file open</p>
              <p className="text-sm">Open a file from the explorer to start editing</p>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                <Spinner size="lg" />
              </div>
            )}
            
            <Editor
              height="100%"
              language={activeTab.language}
              value={activeTab.content}
              theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
              onChange={handleEditorChange}
              onMount={handleEditorMount}
              loading={<Spinner size="lg" />}
              options={{
                readOnly: false,
                automaticLayout: true,
              }}
            />

            {/* Status bar */}
            <div className="absolute bottom-0 left-0 right-0 h-6 bg-accent/50 border-t border-border flex items-center justify-between px-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>
                  {activeTab.language.toUpperCase()}
                </span>
                {activeTab.cursorPosition && (
                  <span>
                    Ln {activeTab.cursorPosition.line}, Col {activeTab.cursorPosition.column}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeTab.isDirty && (
                  <span className="text-primary">● Modified</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
