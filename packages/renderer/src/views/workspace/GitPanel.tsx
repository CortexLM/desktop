/**
 * GitPanel - Vue principale Git avec branches, commits, changes
 */

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  GitBranch,
  RefreshCw,
  RotateCcw,
  SquareSplitHorizontal,
  Trash2,
} from 'lucide-react';
import { ipc } from '../../lib/ipc';
import type {
  GitStatusResponse,
  GitFileStatus,
  GitDiscardResponse,
} from '@cortex-ide/shared';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Spinner } from '../../components/ui/spinner';
import { Hint } from '../../components/ui/tooltip';
import { EmptyState, ErrorState } from '../../components/EmptyState';
import { useErrorHandler, toErrorMessage } from '../../hooks/use-error-handler';
import { useOptionalToast } from '../../components/ui/toast';
import { cn } from '../../lib/utils';
import { BranchSelector } from './BranchSelector';
import { CommitDialog } from './CommitDialog';
import { DiffViewer } from './DiffViewer';

interface GitPanelProps {
  repoPath: string;
  className?: string;
}

export function GitPanel({ repoPath, className }: GitPanelProps) {
  const [status, setStatus] = React.useState<GitStatusResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = React.useState(false);
  const [showDiff, setShowDiff] = React.useState(false);
  const { handleError } = useErrorHandler();
  // Optional: GitPanel is rendered without a ToastProvider in unit tests, and a
  // required hook would throw there rather than in the code under test.
  const toast = useOptionalToast();

  // Charge le statut Git
  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipc.git.status({ repoPath });
      setStatus(result);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  // Charge au mount et rafraîchit toutes les 5s
  React.useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  // Stage/unstage un fichier.
  //
  // `loadStatus()` est rappelé immédiatement après la mutation : le polling de
  // 5 s existe comme filet, pas comme mécanisme de mise à jour — attendre le
  // tick suivant laisserait la case cochée/décochée jusqu'à 5 s en désaccord
  // avec l'index réel.
  //
  // Le refresh est dans un `finally` : si le stage échoue, la liste doit
  // quand même être relue, sinon l'UI resterait sur un état qu'elle ne peut plus
  // garantir.
  const toggleStage = async (file: GitFileStatus) => {
    const staging = !file.staged;

    try {
      if (staging) {
        await ipc.git.stage({ repoPath, files: [file.path] });
      } else {
        await ipc.git.unstage({ repoPath, files: [file.path] });
      }
    } catch (err) {
      handleError(err, {
        title: staging ? 'Could not stage file' : 'Could not unstage file',
        retry: () => void toggleStage(file),
      });
    } finally {
      await loadStatus();
    }
  };

  // Stage tous les fichiers non stagés, en un seul appel.
  //
  // Un `git add` avec N pathspecs plutôt que N appels : un seul verrou d'index,
  // et l'UI ne traverse pas N états intermédiaires.
  const stageAll = async (files: GitFileStatus[]) => {
    if (files.length === 0) return;

    try {
      await ipc.git.stage({ repoPath, files: files.map((file) => file.path) });
    } catch (err) {
      handleError(err, {
        title: 'Could not stage all files',
        retry: () => void stageAll(files),
      });
    } finally {
      await loadStatus();
    }
  };

  // Discard d'un fichier — la seule action destructive du panneau.
  //
  // Deux confirmations distinctes, parce que ce sont deux opérations
  // différentes et que « annuler les modifications » ne décrit pas une
  // suppression de fichier :
  //
  //   fichier suivi     -> restauré depuis le dernier commit. Ce qui est perdu,
  //                        ce sont les modifications non commitées.
  //   fichier non suivi -> SUPPRIMÉ du disque. Il n'a jamais été commité, donc
  //                        il n'existe aucune version vers laquelle revenir.
  //
  // Le libellé nomme laquelle des deux va se produire. Un message unique
  // (« Discard changes to X? ») laisserait l'utilisateur accepter une
  // suppression définitive en croyant annuler une modification.
  //
  // `deleteUntracked` n'est vrai que sur ce chemin-là : la suppression exige un
  // clic sur un contrôle explicitement étiqueté « Delete », jamais sur
  // « Discard ». Le main process revalide de toute façon l'état réel du fichier
  // avant d'agir, donc un statut périmé de 5 s ne peut pas transformer un
  // discard en suppression.
  const discardChanges = async (file: GitFileStatus) => {
    const deleting = file.status === 'untracked';

    const message = deleting
      ? `Delete ${file.path}?\n\n` +
        'This file has never been committed, so there is no previous version to ' +
        'restore. It will be removed from disk permanently and cannot be recovered.'
      : `Discard changes to ${file.path}?\n\n` +
        'The file will be restored to its last committed version. Uncommitted ' +
        'changes to it will be lost and cannot be recovered.';

    if (!confirm(message)) return;

    try {
      const result = await ipc.git.discard({
        repoPath,
        files: [file.path],
        deleteUntracked: deleting,
      });

      reportSkipped(result.skipped);
    } catch (err) {
      handleError(err, {
        title: deleting ? 'Could not delete file' : 'Could not discard changes',
      });
    } finally {
      await loadStatus();
    }
  };

  // Discard de masse.
  //
  // Friction supérieure à « Stage All » : la confirmation nomme le nombre de
  // fichiers concernés, et surtout distingue les suivis des non suivis — les
  // non suivis sont EXCLUS. Deux raisons :
  //
  //   - l'asymétrie de récupération : un fichier suivi restauré est récupérable
  //     (`git checkout` depuis HEAD, le contenu est dans la base d'objets) ; un
  //     fichier non suivi supprimé ne l'est pas, jamais.
  //   - une action de masse est justement celle où l'utilisateur ne lit pas
  //     chaque nom. Y glisser des suppressions définitives fait porter le coût
  //     maximal au geste le moins attentif.
  //
  // Les non suivis restent supprimables un par un, via un contrôle étiqueté
  // « Delete ». La confirmation les mentionne pour que leur survie soit un fait
  // annoncé et non une surprise.
  const discardAll = async (files: GitFileStatus[]) => {
    const tracked = files.filter((file) => file.status !== 'untracked');
    const untrackedCount = files.length - tracked.length;

    if (tracked.length === 0) return;

    const count = `${tracked.length} file${tracked.length === 1 ? '' : 's'}`;
    const untrackedNote =
      untrackedCount > 0
        ? `\n\n${untrackedCount} untracked file${untrackedCount === 1 ? '' : 's'} will be ` +
          'left alone. Untracked files have never been committed, so discarding them ' +
          'would delete them permanently — remove those one at a time if you mean to.'
        : '';

    const confirmed = confirm(
      `Discard changes to ${count}?\n\n` +
        `${tracked.map((file) => file.path).join('\n')}\n\n` +
        'Each file will be restored to its last committed version. Uncommitted ' +
        `changes will be lost and cannot be recovered.${untrackedNote}`
    );

    if (!confirmed) return;

    try {
      const result = await ipc.git.discard({
        repoPath,
        files: tracked.map((file) => file.path),
        // Explicite bien que ce soit le défaut du schéma : sur un discard de
        // masse, la valeur qui compte est celle-ci.
        deleteUntracked: false,
      });

      reportSkipped(result.skipped);
    } catch (err) {
      handleError(err, { title: 'Could not discard changes' });
    } finally {
      await loadStatus();
    }
  };

  // Un chemin ignoré signifie que le clic n'a rien fait, et l'utilisateur doit
  // le savoir. Le cas courant : le fichier était non suivi alors que la liste
  // (sondée toutes les 5 s) le montrait encore modifié, donc le main process a
  // refusé de le supprimer. Silencieux, cela ressemblerait à un discard réussi.
  const reportSkipped = (skipped: GitDiscardResponse['skipped']) => {
    const directories = skipped.filter((entry) => entry.reason === 'directory');

    if (directories.length > 0) {
      // Une ligne `nested/` est un dépôt imbriqué, que git ne détaille pas.
      // Sans ce message, le clic « Delete » semblerait n'avoir rien fait.
      toast?.warning(
        'Directories are not deleted here',
        `${directories.map((entry) => entry.path).join(', ')} ${
          directories.length === 1 ? 'is a directory' : 'are directories'
        } — most often a nested Git repository. Deleting it would remove everything ` +
          'inside, so it has been left alone. Remove it outside the IDE if you mean to.'
      );
    }

    const notConfirmed = skipped.filter((entry) => entry.reason === 'untracked-not-confirmed');
    if (notConfirmed.length === 0) return;

    const names = notConfirmed.map((entry) => entry.path).join(', ');
    toast?.warning(
      'Some files were left alone',
      `${names} ${notConfirmed.length === 1 ? 'is' : 'are'} not tracked by Git, so ` +
        'discarding would delete rather than restore. Delete them individually if that ' +
        'is what you want.'
    );
  };

  // Ouvre le diff viewer
  const viewDiff = (file: GitFileStatus) => {
    setSelectedFile(file.path);
    setShowDiff(true);
  };

  // Push. A failed push is worth a toast: it's an explicit action whose result
  // isn't otherwise visible, and it's usually retryable.
  const handlePush = async () => {
    if (!status) return;
    setLoading(true);
    try {
      await ipc.git.push({ repoPath });
      await loadStatus();
    } catch (err) {
      handleError(err, { title: 'Push failed', retry: () => void handlePush() });
    } finally {
      setLoading(false);
    }
  };

  // Pull
  const handlePull = async () => {
    setLoading(true);
    try {
      await ipc.git.pull({ repoPath });
      await loadStatus();
    } catch (err) {
      handleError(err, { title: 'Pull failed', retry: () => void handlePull() });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <Spinner />
      </div>
    );
  }

  if (error && !status) {
    // A missing repository is the common case here, and it isn't really an
    // error, so it gets a distinct message from a genuine Git failure.
    const looksLikeNoRepo = /not a git repos|no such file|enoent/i.test(error);

    return looksLikeNoRepo ? (
      <EmptyState
        className={className}
        icon={<GitBranch className="w-8 h-8" />}
        title="No Git repository"
        description="This folder isn't tracked by Git, so there's nothing to show. Initialise a repository to see changes here."
        action={{ label: 'Check again', onClick: loadStatus }}
      />
    ) : (
      <ErrorState
        className={className}
        title="Could not read Git status"
        message={error}
        onRetry={loadStatus}
      />
    );
  }

  if (!status) {
    return null;
  }

  const stagedFiles = status.files.filter(f => f.staged);
  const unstagedFiles = status.files.filter(f => !f.staged);
  // Ce que « Discard All » peut réellement jeter : les non suivis en sont
  // exclus, donc c'est ce compte, et non `unstagedFiles.length`, qui décide si
  // le bouton a quelque chose à faire.
  const unstagedTracked = unstagedFiles.filter(f => f.status !== 'untracked');

  return (
    <div className={cn('flex flex-col h-full bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-text">Git</h2>
          <BranchSelector
            repoPath={repoPath}
            currentBranch={status.branch}
            onBranchChange={loadStatus}
          />
        </div>
        <div className="flex items-center gap-2">
          {status.ahead > 0 && (
            <Hint content={`${status.ahead} commit(s) to push`}>
              <Badge variant="secondary" className="text-xs gap-1">
                <ArrowUp className="w-3 h-3" aria-hidden="true" />
                {status.ahead}
              </Badge>
            </Hint>
          )}
          {status.behind > 0 && (
            <Hint content={`${status.behind} commit(s) to pull`}>
              <Badge variant="secondary" className="text-xs gap-1">
                <ArrowDown className="w-3 h-3" aria-hidden="true" />
                {status.behind}
              </Badge>
            </Hint>
          )}
          <Hint content="Refresh Git status">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={loadStatus}
              disabled={loading}
              aria-label="Refresh Git status"
              data-testid="git-refresh"
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5', loading && 'animate-spin')}
                aria-hidden="true"
              />
            </Button>
          </Hint>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <Button
          size="sm"
          onClick={() => setShowCommitDialog(true)}
          disabled={stagedFiles.length === 0}
          data-testid="commit-button"
        >
          Commit
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => stageAll(unstagedFiles)}
          disabled={unstagedFiles.length === 0}
          data-testid="stage-all-button"
        >
          Stage All
        </Button>
        {/* Le pendant destructif de « Stage All ». Désactivé s'il n'y a aucun
            fichier SUIVI non stagé : un dépôt où toutes les modifications sont
            des fichiers non suivis n'a rien à jeter en masse, et un bouton
            actif qui ne ferait rien serait un piège. */}
        <Button
          variant="secondary"
          size="sm"
          className="text-red hover:bg-red-soft"
          onClick={() => discardAll(unstagedFiles)}
          disabled={unstagedTracked.length === 0}
          data-testid="discard-all-button"
        >
          Discard All
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePush}
          disabled={status.ahead === 0}
          data-testid="push-button"
        >
          Push
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePull}
          data-testid="pull-button"
        >
          Pull
        </Button>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto">
        {/* Staged Changes */}
        {stagedFiles.length > 0 && (
          <div className="border-b border-border">
            <div className="px-4 py-2 bg-tint text-xs font-semibold text-text-secondary">
              Staged Changes ({stagedFiles.length})
            </div>
            <div className="divide-y divide-border">
              {stagedFiles.map((file) => (
                <FileItem
                  key={file.path}
                  file={file}
                  onToggleStage={toggleStage}
                  onDiscard={discardChanges}
                  onViewDiff={viewDiff}
                />
              ))}
            </div>
          </div>
        )}

        {/* Unstaged Changes */}
        {unstagedFiles.length > 0 && (
          <div>
            <div className="px-4 py-2 bg-tint text-xs font-semibold text-text-secondary">
              Changes ({unstagedFiles.length})
            </div>
            <div className="divide-y divide-border">
              {unstagedFiles.map((file) => (
                <FileItem
                  key={file.path}
                  file={file}
                  onToggleStage={toggleStage}
                  onDiscard={discardChanges}
                  onViewDiff={viewDiff}
                />
              ))}
            </div>
          </div>
        )}

        {/* Clean State.
            `no-changes` is the id git.spec.ts asserts on. It was unreachable
            until staging worked: with `toggleStage` stubbed, nothing could be
            staged, so no commit ever succeeded and the fixture repo never
            became clean. */}
        {status.isClean && (
          <EmptyState
            icon={<Check className="w-8 h-8" />}
            title="No changes"
            description={`Everything on ${status.branch} is committed.`}
            data-testid="no-changes"
          />
        )}
      </div>

      {/* Commit Dialog */}
      {showCommitDialog && (
        <CommitDialog
          repoPath={repoPath}
          files={stagedFiles}
          onClose={() => setShowCommitDialog(false)}
          onCommit={() => {
            setShowCommitDialog(false);
            loadStatus();
          }}
        />
      )}

      {/* Diff Viewer */}
      {showDiff && selectedFile && (
        <DiffViewer
          repoPath={repoPath}
          filePath={selectedFile}
          onClose={() => setShowDiff(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// FileItem Component
// ============================================================================

interface FileItemProps {
  file: GitFileStatus;
  onToggleStage: (file: GitFileStatus) => void;
  onDiscard: (file: GitFileStatus) => void;
  onViewDiff: (file: GitFileStatus) => void;
}

function FileItem({ file, onToggleStage, onDiscard, onViewDiff }: FileItemProps) {
  // Semantic tokens: `yellow-500`/`blue-500` aren't in this theme's palette, so
  // those classes produced no colour at all.
  const statusColor = {
    modified: 'text-amber',
    added: 'text-green',
    deleted: 'text-red',
    renamed: 'text-accent',
    untracked: 'text-text-secondary',
  }[file.status];

  const statusLabel = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
    untracked: 'U',
  }[file.status];

  // The single-letter code is Git shorthand; spell it out for tooltips and
  // screen readers.
  const statusTitle = {
    modified: 'Modified',
    added: 'Added',
    deleted: 'Deleted',
    renamed: 'Renamed',
    untracked: 'Untracked',
  }[file.status];

  const fileName = file.path.split('/').pop() ?? file.path;

  return (
    <div
      className="group flex items-center gap-3 px-4 py-2 hover:bg-tint transition-colors"
      data-testid={file.staged ? 'staged-file' : 'changed-file'}
      data-filename={file.path}
    >
      {/* A real checkbox: staging state is a checked/unchecked control, and
          screen readers need to hear which it is. */}
      <button
        role="checkbox"
        aria-checked={file.staged}
        aria-label={file.staged ? `Unstage ${fileName}` : `Stage ${fileName}`}
        onClick={() => onToggleStage(file)}
        data-testid={file.staged ? 'unstage-file' : 'stage-file'}
        className={cn(
          'w-4 h-4 border rounded-xs flex items-center justify-center flex-shrink-0 transition-colors',
          file.staged
            ? 'bg-accent border-accent text-white'
            : 'border-border hover:border-accent'
        )}
      >
        {file.staged && <Check className="w-3 h-3" aria-hidden="true" />}
      </button>

      <Hint content={statusTitle}>
        <span
          className={cn('text-xs font-mono font-semibold w-4 flex-shrink-0', statusColor)}
          aria-label={statusTitle}
        >
          {statusLabel}
        </span>
      </Hint>

      <button
        onClick={() => onViewDiff(file)}
        className="flex-1 text-left text-sm text-text hover:text-accent transition-colors truncate rounded-xs"
        aria-label={`View changes in ${fileName}`}
      >
        {file.path}
      </button>

      {/* Hover-reveal for the mouse, but focus-within keeps these reachable by
          keyboard instead of being effectively invisible. */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <Hint content="View diff">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onViewDiff(file)}
            aria-label={`View diff for ${fileName}`}
          >
            <SquareSplitHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
          </Button>
        </Hint>

        {/* Deux contrôles distincts pour les deux opérations, jamais un seul.
            Le libellé et l'icône disent laquelle : « Discard changes » +
            RotateCcw restaure, « Delete » + Trash2 supprime. Un contrôle unique
            étiqueté « Discard » qui supprime parfois est exactement la
            confusion qui fait perdre des fichiers.

            Restreint aux fichiers non stagés, comme avant : jeter un fichier
            déjà stagé demanderait de défaire deux gestes d'un coup. */}
        {!file.staged && file.status !== 'untracked' && (
          <Hint content="Discard changes">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red hover:bg-red-soft"
              onClick={() => onDiscard(file)}
              aria-label={`Discard changes to ${fileName}`}
              data-testid="discard-file"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </Hint>
        )}

        {!file.staged && file.status === 'untracked' && (
          <Hint content="Delete file permanently">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red hover:bg-red-soft"
              onClick={() => onDiscard(file)}
              aria-label={`Delete ${fileName}`}
              data-testid="delete-file"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </Button>
          </Hint>
        )}
      </div>
    </div>
  );
}
