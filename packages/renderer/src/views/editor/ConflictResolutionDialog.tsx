/**
 * ConflictResolutionDialog — where a detected disagreement with disk gets resolved.
 *
 * WHY IT EXISTS
 * -------------
 * Session restore detects that a file changed under unsaved edits and flags the
 * tab. Until this dialog, that was the end of it: the tab strip showed a warning
 * and `Ctrl+S` still overwrote the other version with no friction at all. A
 * warning the user can walk straight through is worse than no warning, because it
 * transfers the blame for a data loss onto someone who was never given a way to
 * avoid it.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * It does not present one set of buttons for the three disk states. `conflict`,
 * `missing` and `unsaved-lost` get three panels from `planResolutionPanel`, and
 * the `missing` panel deliberately has no discard action: there, the tab holds
 * the only surviving copy of the file, and a "discard" button sitting where the
 * conflict panel puts one — on a case where a copy *does* survive on disk — is
 * how a click destroys something unrecoverable.
 *
 * Every action names what it destroys in its own label, not only in the small
 * print, and the write is re-checked against disk at click time.
 */

import React from 'react';

import {
  RESOLUTION_LABELS,
  STALE_REASON_MESSAGE,
  planResolutionPanel,
  type ResolutionAction,
  type RefusalReason,
} from '../../store/conflict-resolution';
import { createIpcDiskReader, type DiskReader } from '../../store/editor-session';
import { useEditorStore } from '../../store/editor-store';
import {
  createIpcWriter,
  resolveConflict,
  type ResolveDeps,
  type ResolveResult,
} from './save-actions';
import { ConflictDiffView } from './ConflictDiffView';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Spinner } from '../../components/ui/spinner';
import { useTheme } from '../../hooks/use-theme';

/** The disk version the comparison is rendered from. */
interface DiskVersion {
  content: string;
  mtime: number;
}

export interface ConflictResolutionDialogProps {
  /** Injectable for tests; defaults to the preload bridge. */
  reader?: DiskReader | null;
  writer?: ResolveDeps['writeFile'];
  /** Reported outcomes, so a host can toast them. */
  onResolved?: (result: ResolveResult) => void;
}

export const ConflictResolutionDialog: React.FC<ConflictResolutionDialogProps> = ({
  reader,
  writer,
  onResolved,
}) => {
  const tabId = useEditorStore((state) => state.conflictDialogTabId);
  // Subscribed by id rather than handed a tab object: reconciliation can rewrite
  // the tab while the dialog is open, and the panel must follow it.
  const tab = useEditorStore((state) => state.tabs.find((entry) => entry.id === tabId));
  const closeConflictDialog = useEditorStore((state) => state.closeConflictDialog);
  const { theme } = useTheme();

  const [diskVersion, setDiskVersion] = React.useState<DiskVersion | null>(null);
  const [isReading, setIsReading] = React.useState(false);
  const [notice, setNotice] = React.useState<RefusalReason | null>(null);
  const [isApplying, setIsApplying] = React.useState(false);

  // Getter for the right-hand pane, installed by the diff editor once mounted.
  // Null whenever no diff is shown, which is why every read of it falls back to
  // the tab's stored content rather than to an empty string.
  const mergedContentRef = React.useRef<(() => string) | null>(null);

  const panel = planResolutionPanel(tab?.diskState);
  const isOpen = Boolean(tab && panel);

  const path = tab?.path;
  const needsDiff = panel?.showsDiff === true;

  /**
   * Reads the version on disk when the dialog opens on a two-version
   * disagreement.
   *
   * Read here rather than taken from the tab because the tab does not carry it:
   * reconciliation deliberately keeps the user's content and only records that
   * disk differs. Showing a diff means fetching the other side.
   */
  React.useEffect(() => {
    if (!isOpen || !needsDiff || !path) {
      setDiskVersion(null);
      setNotice(null);
      return;
    }

    const read = reader === undefined ? createIpcDiskReader() : reader;
    if (!read) {
      // No bridge: the comparison cannot be shown. Say so rather than render an
      // empty left-hand pane, which would read as "disk is empty" and make
      // "keep my version" look free.
      setDiskVersion(null);
      setNotice('unreadable');
      return;
    }

    let cancelled = false;
    setIsReading(true);
    setNotice(null);

    void read(path)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setDiskVersion({ content: result.file.content, mtime: result.file.mtime });
        } else {
          setDiskVersion(null);
          setNotice(result.missing ? 'vanished' : 'unreadable');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDiskVersion(null);
          setNotice('unreadable');
        }
      })
      .finally(() => {
        if (!cancelled) setIsReading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, needsDiff, path, reader]);

  const handleAction = async (action: ResolutionAction) => {
    if (!tab) return;

    const store = useEditorStore.getState();
    const deps: ResolveDeps = {
      getTab: (id) => useEditorStore.getState().tabs.find((entry) => entry.id === id),
      writeFile: writer ?? createIpcWriter(),
      markSaved: (id, mtime) => store.markTabDirty(id, false, mtime),
      openConflictDialog: store.openConflictDialog,
      applyDiskVersion: store.applyDiskVersion,
      acknowledgeDiskState: store.acknowledgeDiskState,
      closeConflictDialog: store.closeConflictDialog,
      updateTabContent: store.updateTabContent,
      read: (target) => {
        const read = reader === undefined ? createIpcDiskReader() : reader;
        // No bridge means no way to confirm what is on disk. Reporting it
        // unreadable makes the resolution refuse rather than write blind.
        return read ? read(target) : Promise.resolve({ ok: false, missing: false });
      },
    };

    // A hand-merged right-hand pane has to reach the store before the write
    // reads it, or the merge is silently discarded and the user's original
    // version goes to disk under a button that promised the merge.
    if (action === 'keep-mine' || action === 'recreate') {
      const merged = mergedContentRef.current?.();
      if (typeof merged === 'string' && merged !== tab.content) {
        deps.updateTabContent(tab.id, merged);
      }
    }

    setIsApplying(true);
    try {
      const result = await resolveConflict(
        deps,
        tab.id,
        action,
        // The version the user was actually shown. Undefined mtime for the
        // no-diff panels: with no reference point the planner does not claim the
        // file changed again, which is the same rule detection follows.
        { content: diskVersion?.content ?? '', mtime: diskVersion?.mtime }
      );

      if (result.status === 'stale') {
        // Nothing was written. Re-render the comparison against what is on disk
        // now and let the user choose again.
        setDiskVersion(result.shown);
        setNotice(result.reason);
      }

      onResolved?.(result);
    } finally {
      setIsApplying(false);
    }
  };

  if (!tab || !panel) return null;

  const diffReady = diskVersion !== null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        // Dismissing with Escape or the overlay is the cancel path: it must not
        // be a shortcut for any action that writes or discards.
        if (!next) closeConflictDialog();
      }}
    >
      <DialogContent
        className="max-w-5xl w-[90vw]"
        data-testid="conflict-dialog"
        data-disk-state={panel.kind}
        data-tab-id={tab.id}
      >
        <DialogHeader>
          <DialogTitle data-testid="conflict-dialog-title">{panel.title}</DialogTitle>
          <DialogDescription>
            <span className="block font-mono text-xs mb-1" data-testid="conflict-dialog-path">
              {tab.path}
            </span>
            {panel.body}
          </DialogDescription>
        </DialogHeader>

        {notice && (
          <p
            className="text-sm text-red border border-red/40 rounded-sm px-3 py-2"
            role="alert"
            data-testid="conflict-dialog-notice"
            data-notice={notice}
          >
            {STALE_REASON_MESSAGE[notice]}
          </p>
        )}

        {panel.showsDiff && (
          <div className="h-[45vh] min-h-[240px]">
            {isReading && (
              <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
              </div>
            )}
            {!isReading && diffReady && (
              <ConflictDiffView
                diskContent={diskVersion.content}
                myContent={tab.content}
                language={tab.language}
                theme={theme === 'dark' ? 'dark' : 'light'}
                onEditorReady={(getMergedContent) => {
                  mergedContentRef.current = getMergedContent;
                }}
              />
            )}
          </div>
        )}

        {panel.showsDiff && diffReady && (
          <p className="text-xs text-text-secondary" data-testid="conflict-dialog-merge-hint">
            Left: the file on disk. Right: your version, which you can edit here before keeping it.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {panel.actions.map((spec) => (
            <div key={spec.action} className="flex items-start gap-3">
              <Button
                variant={spec.tone === 'danger' ? 'destructive' : 'outline'}
                size="sm"
                className="shrink-0 min-w-[19rem] justify-start"
                // A destructive action must not fire while the comparison it is
                // meant to be read from has not arrived: that is the click that
                // overwrites a version the user never saw.
                disabled={
                  isApplying || (spec.destroys !== 'nothing' && panel.showsDiff && !diffReady)
                }
                onClick={() => void handleAction(spec.action)}
                data-testid={`conflict-action-${spec.action}`}
                data-destroys={spec.destroys}
              >
                {spec.label}
              </Button>
              <span className="text-xs text-text-secondary pt-1.5">{spec.detail}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export { RESOLUTION_LABELS };
export default ConflictResolutionDialog;
