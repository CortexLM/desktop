/**
 * The side-by-side comparison inside the resolution dialog.
 *
 * Its own module, and lazy-loaded by the dialog, for two reasons:
 *
 *  1. Monaco is heavy and nobody should pay for it to resolve a conflict they
 *     are not having. The dialog is rare; the editor bundle is already
 *     lazy-loaded elsewhere for the same reason.
 *  2. `monaco-editor` and its five `?worker` imports do not load under jsdom.
 *     Keeping it out of `ConflictResolutionDialog` is what lets the dialog's
 *     labels, wiring and destructive-action semantics be unit-tested at all —
 *     a test stubs this module and asserts everything around it.
 *
 * `DiffEditor` from `@monaco-editor/react` is `monaco.editor.createDiffEditor`
 * with a React lifecycle attached. Hand-rolling a diff for this would be a
 * poorly reinvented wheel, and Monaco is already a dependency.
 */

import React from 'react';
// Side-effect import: binds Monaco to the bundled copy instead of the CDN. The
// dialog can be the first thing that needs Monaco in a session (a conflict is
// detected on boot, before the user has focused the editor), so this module
// cannot rely on `EditorView` having run it.
import '../../lib/monaco-setup';
import { DiffEditor, type MonacoDiffEditor } from '@monaco-editor/react';

import { Spinner } from '../../components/ui/spinner';

export interface ConflictDiffViewProps {
  /** The file as it is on disk right now: the version that would be overwritten. */
  diskContent: string;
  /** The user's unsaved version. */
  myContent: string;
  language: string;
  theme: 'dark' | 'light';
  /**
   * Called with a getter for the right-hand side's current text.
   *
   * The modified pane is left editable, so "keep my version" can write a hand-
   * merged result rather than forcing an all-or-nothing choice. The dialog reads
   * through this at click time instead of subscribing to every keystroke: a
   * merge only matters at the moment it is applied.
   */
  onEditorReady?: (getMergedContent: () => string) => void;
}

/**
 * Disk on the left, the user's version on the right.
 *
 * That orientation is not cosmetic: Monaco renders the left pane as "original"
 * and the right as "modified", so additions and deletions read as *your* changes
 * relative to disk. Swapping the sides would invert the sign of every marker and
 * make "keep my version" look like it discards the lines it actually keeps.
 */
export const ConflictDiffView: React.FC<ConflictDiffViewProps> = ({
  diskContent,
  myContent,
  language,
  theme,
  onEditorReady,
}) => {
  const handleMount = (editor: MonacoDiffEditor) => {
    onEditorReady?.(() => editor.getModifiedEditor().getValue());
  };

  return (
    <div
      className="h-full w-full border border-border rounded-sm overflow-hidden"
      data-testid="conflict-diff"
    >
      <DiffEditor
        height="100%"
        original={diskContent}
        modified={myContent}
        language={language}
        theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
        loading={<Spinner size="lg" />}
        onMount={handleMount}
        options={{
          // Disk is a reference, not something to type into: editing it would
          // suggest the left pane can be saved, which no action here does.
          originalEditable: false,
          readOnly: false,
          renderSideBySide: true,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          fontSize: 12,
        }}
      />
    </div>
  );
};

export default ConflictDiffView;
