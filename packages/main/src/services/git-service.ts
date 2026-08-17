/**
 * Git Service - Main Process
 * Gestion complète Git avec simple-git
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import simpleGit, { SimpleGit, StatusResult, DefaultLogFields, LogResult, BranchSummary } from 'simple-git';
import {
  GitStatusResponse,
  GitFileStatus,
  GitCommitResponse,
  GitPushResponse,
  GitDiffResponse,
  GitDiscardResponse,
} from '@cortex-ide/shared';

export class GitService {
  private gitInstances: Map<string, SimpleGit> = new Map();

  /**
   * Récupère ou crée une instance Git pour un repo
   */
  private getGit(repoPath: string): SimpleGit {
    if (!this.gitInstances.has(repoPath)) {
      const git = simpleGit({
        baseDir: repoPath,
        binary: 'git',
        maxConcurrentProcesses: 6,
        trimmed: false,
      });
      this.gitInstances.set(repoPath, git);
    }
    return this.gitInstances.get(repoPath)!;
  }

  /**
   * Récupère le statut Git du repo
   */
  async status(repoPath: string): Promise<GitStatusResponse> {
    const git = this.getGit(repoPath);
    const status: StatusResult = await git.status();
    const files = this.parseStatusFiles(status);

    return {
      branch: status.current || 'unknown',
      ahead: status.ahead,
      behind: status.behind,
      files,
      isClean: status.isClean(),
    };
  }

  /**
   * Parse les fichiers du statut Git
   */
  private parseStatusFiles(status: StatusResult): GitFileStatus[] {
    const files: GitFileStatus[] = [];

    this.addStagedFiles(files, status);
    this.addModifiedFiles(files, status);
    this.addUntrackedFiles(files, status);

    return files;
  }

  private addStagedFiles(files: GitFileStatus[], status: StatusResult): void {
    status.staged.forEach(file => {
      files.push({ path: file, status: 'modified', staged: true });
    });

    status.created.forEach(file => {
      files.push({ path: file, status: 'added', staged: true });
    });

    status.deleted.forEach(file => {
      files.push({ path: file, status: 'deleted', staged: true });
    });

    status.renamed.forEach(file => {
      files.push({ path: file.to || file.from, status: 'renamed', staged: true });
    });
  }

  private addModifiedFiles(files: GitFileStatus[], status: StatusResult): void {
    status.modified.forEach(file => {
      if (!files.find(f => f.path === file && f.staged)) {
        files.push({ path: file, status: 'modified', staged: false });
      }
    });
  }

  private addUntrackedFiles(files: GitFileStatus[], status: StatusResult): void {
    status.not_added.forEach(file => {
      files.push({ path: file, status: 'untracked', staged: false });
    });
  }

  /**
   * Crée un commit
   */
  async commit(repoPath: string, message: string, files?: string[]): Promise<GitCommitResponse> {
    const git = this.getGit(repoPath);

    // Stage les fichiers si spécifiés, sinon stage tout
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }

    // Commit
    await git.commit(message);

    // Récupère les infos du dernier commit
    const log = await git.log({ maxCount: 1 });
    const latestCommit = log.latest;

    if (!latestCommit) {
      throw new Error('Failed to retrieve commit information');
    }

    return {
      hash: latestCommit.hash,
      message: latestCommit.message,
      author: latestCommit.author_name,
      timestamp: new Date(latestCommit.date).getTime(),
    };
  }

  /**
   * Push vers remote
   */
  async push(repoPath: string, remote: string = 'origin', branch?: string): Promise<GitPushResponse> {
    const git = this.getGit(repoPath);

    // Détermine la branche actuelle si non spécifiée
    if (!branch) {
      const status = await git.status();
      branch = status.current || 'main';
    }

    // Push
    const result = await git.push(remote, branch);

    return {
      success: true,
      pushed: result.pushed?.length || 0,
    };
  }

  /**
   * Pull depuis remote
   */
  async pull(repoPath: string, remote: string = 'origin', branch?: string): Promise<void> {
    const git = this.getGit(repoPath);

    if (branch) {
      await git.pull(remote, branch);
    } else {
      await git.pull(remote);
    }
  }

  /**
   * Récupère les diffs
   */
  async diff(repoPath: string, path?: string, staged: boolean = false): Promise<GitDiffResponse> {
    const git = this.getGit(repoPath);

    let diffResult: string;

    if (staged) {
      // Diff des fichiers staged
      diffResult = path 
        ? await git.diff(['--cached', path])
        : await git.diff(['--cached']);
    } else {
      // Diff des fichiers non staged
      diffResult = path
        ? await git.diff([path])
        : await git.diff();
    }

    // Parse le diff pour extraire les changements par fichier
    const diffs = this.parseDiff(diffResult);

    return { diffs };
  }

  /**
   * Liste les branches
   */
  async branches(repoPath: string): Promise<BranchSummary> {
    const git = this.getGit(repoPath);
    return await git.branch();
  }

  /**
   * Crée une nouvelle branche
   */
  async createBranch(repoPath: string, branchName: string, checkout: boolean = true): Promise<void> {
    const git = this.getGit(repoPath);
    
    if (checkout) {
      await git.checkoutLocalBranch(branchName);
    } else {
      await git.branch([branchName]);
    }
  }

  /**
   * Change de branche
   */
  async checkout(repoPath: string, branchName: string): Promise<void> {
    const git = this.getGit(repoPath);
    await git.checkout(branchName);
  }

  /**
   * Récupère l'historique des commits
   */
  async log(repoPath: string, maxCount: number = 50): Promise<LogResult<DefaultLogFields>> {
    const git = this.getGit(repoPath);
    return await git.log({ maxCount });
  }

  /**
   * Jette les modifications d'un ou plusieurs fichiers.
   *
   * `discard` recouvre DEUX opérations que le mot unique masque, et les
   * confondre fait disparaître des fichiers sans que l'utilisateur l'ait
   * demandé. Mesuré sur git 2.43, dépôt scratch :
   *
   *   fichier suivi modifié : `git checkout HEAD -- f` -> restauré depuis HEAD
   *   fichier NON suivi     : `git checkout HEAD -- f` -> rc=1
   *                           « error: pathspec 'f' did not match any file(s)
   *                           known to git ». Le fichier reste sur disque.
   *
   * `checkout` ne peut rien restaurer d'un fichier absent de HEAD : il n'existe
   * aucun contenu vers lequel revenir. « Jeter » un fichier neuf ne peut donc
   * signifier que le SUPPRIMER, et rien ne le récupère — ni `reflog`, ni
   * `fsck --lost-found` : son contenu n'est jamais entré dans la base d'objets.
   *
   * D'où la séparation en trois seaux, dérivés de l'état RÉEL du dépôt et non
   * du libellé fourni par l'appelant :
   *
   *   restored : présent dans HEAD           -> `checkout HEAD -- <paths>`
   *   deleted  : absent de HEAD, mais modifié -> retiré du disque
   *   skipped  : le reste                    -> rien du tout
   *
   * `HEAD --` et non `--` seul : mesuré, `git checkout -- f` restaure depuis
   * l'INDEX. Sur un fichier indexé (`MM`) il ramène donc le worktree à la
   * version indexée, laissant le fichier toujours modifié vis-à-vis de HEAD —
   * « discard » laisserait des modifications en place. `checkout HEAD -- f`
   * remet index ET worktree sur HEAD en un seul appel, sans fenêtre où les deux
   * divergent.
   *
   * Le séparateur `--` est une protection, pas un style. Mesuré :
   *
   *   git checkout '-f'      -> rc=0, et TOUTES les modifications non commitées
   *                             du worktree sont perdues (`-f` = `--force`).
   *   git checkout -- '-f'   -> rc=0, seul le fichier nommé `-f` est restauré.
   *   git checkout HEAD '-f' -> rc=0, MÊME destruction : la présence d'un
   *                             tree-ish ne protège pas.
   *
   * Le précédent `git reset HEAD --hard` échouait au moins bruyamment ; ici
   * l'issue est silencieuse et à portée maximale. Chaque invocation ci-dessous
   * passe donc par `--`.
   */
  async discard(
    repoPath: string,
    filePath: string | string[],
    options: { deleteUntracked?: boolean } = {}
  ): Promise<GitDiscardResponse> {
    const git = this.getGit(repoPath);
    const requested = Array.isArray(filePath) ? filePath : [filePath];
    const deleteUntracked = options.deleteUntracked === true;

    // État réel, lu à l'instant. Le renderer sonde toutes les 5 s, donc son
    // libellé peut être périmé — et agir sur un « modified » périmé qui est en
    // réalité un fichier non suivi signifie supprimer au lieu de restaurer.
    const changed = await this.changedPaths(repoPath);
    const inHead = await this.pathsInHead(repoPath, requested);

    const restored: string[] = [];
    const toDelete: string[] = [];
    const skipped: GitDiscardResponse['skipped'] = [];

    for (const requestedPath of requested) {
      if (inHead.has(requestedPath)) {
        // Présent dans HEAD : restaurable, donc réversible.
        restored.push(requestedPath);
        continue;
      }

      const code = changed.get(requestedPath);

      if (code === undefined) {
        // Ni dans HEAD ni signalé par `status` : rien à jeter. Couvre aussi le
        // chemin inexistant et le répertoire (`status -uall` énumère les
        // fichiers, jamais les répertoires), qui restent donc inertes.
        skipped.push({ path: requestedPath, reason: 'unchanged' });
        continue;
      }

      if (requestedPath.endsWith('/')) {
        /*
         * Un répertoire, et non un fichier. Un seul cas y mène, mais il est
         * réel : `git status` replie un DÉPÔT IMBRIQUÉ en une entrée unique
         * `?? nested/` — y compris avec `-uall`, git ne descendant pas dans un
         * autre dépôt. Vérifié : `simple-git.status()` renvoie
         * `not_added: ['nested/']`, donc le panneau affiche cette ligne et son
         * bouton « Delete ».
         *
         * Supprimer cette entrée signifierait effacer récursivement un dépôt
         * entier — un `node_modules` cloné, une dépendance vendorée — sur un
         * clic présenté comme portant sur « un fichier ». Le refus est explicite
         * et remonté à l'utilisateur, plutôt qu'un `EISDIR` obscur ou, pire, une
         * suppression réussie.
         */
        skipped.push({ path: requestedPath, reason: 'directory' });
        continue;
      }

      if (!deleteUntracked) {
        // Absent de HEAD : la seule façon de le « jeter » est de le supprimer.
        // Sans confirmation explicite, on n'y touche pas.
        skipped.push({ path: requestedPath, reason: 'untracked-not-confirmed' });
        continue;
      }

      toDelete.push(requestedPath);
    }

    // Les restaurations d'abord : réversibles. `checkout HEAD -- a b` est
    // tout-ou-rien (mesuré : un seul chemin absent de HEAD fait échouer l'appel
    // entier et ne restaure RIEN), mais chaque chemin ici vient de `inHead`,
    // donc la condition d'échec est exclue par construction.
    if (restored.length > 0) {
      await git.checkout(['HEAD', '--', ...restored]);
    }

    if (toDelete.length > 0) {
      await this.deleteNotInHead(repoPath, toDelete, changed);
    }

    return { restored, deleted: toDelete, skipped };
  }

  /**
   * `git status --porcelain -z -uall` en map chemin -> code XY.
   *
   * `-z` et non la sortie par défaut : sans lui git *cite* et échappe les
   * chemins non-ASCII ou contenant guillemets/espaces
   * (`"na\303\257ve.txt"`), ce qui ne correspondrait plus au chemin demandé.
   * Mesuré : avec `-z`, `naïve.txt` sort littéralement.
   *
   * `-uall` et non le défaut : par défaut git replie un répertoire non suivi en
   * une seule entrée `?? newdir/`, alors que `-uall` liste `newdir/deep.txt`.
   * C'est ce que `simple-git.status()` utilise (vérifié : `not_added` contient
   * `newdir/deep.txt`), donc le panneau affiche des fichiers ; la classification
   * doit parler du même vocabulaire, sinon un chemin listé par le panneau ne
   * serait pas retrouvé ici.
   */
  private async changedPaths(repoPath: string): Promise<Map<string, string>> {
    const git = this.getGit(repoPath);
    const raw = await git.raw(['status', '--porcelain', '-z', '-uall']);
    const entries = new Map<string, string>();

    // Format : "XY <path>\0", et pour un rename/copy un second champ
    // "\0<origine>\0". L'origine est consommée sans être indexée : le chemin
    // que le panneau affiche est le nouveau.
    const records = raw.split('\0');

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      if (record.length < 4) continue;

      const code = record.slice(0, 2);
      entries.set(record.slice(3), code);

      // `R`/`C` en index ou worktree : le champ suivant est l'ancien chemin.
      if (code[0] === 'R' || code[0] === 'C' || code[1] === 'R' || code[1] === 'C') {
        i++;
      }
    }

    return entries;
  }

  /**
   * Sous-ensemble de `paths` réellement présent dans HEAD.
   *
   * `ls-tree` plutôt qu'une déduction depuis les codes de `status` : c'est la
   * question exacte à laquelle `checkout HEAD --` répond, posée à git. Un code
   * `status` ne suffit pas — `A ` (staged-new) et `R ` (nouveau nom d'un rename)
   * dénotent tous deux un chemin absent de HEAD, et s'en souvenir est
   * précisément le genre de détail qui se perd.
   *
   * `-z` pour la même raison de citation que ci-dessus, `--` pour la même
   * raison de sécurité, et les chemins absents sont simplement omis de la
   * sortie (mesuré) plutôt que de faire échouer l'appel.
   *
   * HEAD non né (aucun commit) : `rev-parse --verify HEAD` échoue, et rien
   * n'est dans HEAD. Le test se fait sur `rev-parse` et non en avalant l'erreur
   * de `ls-tree` : sur une opération destructive, une erreur inattendue doit
   * remonter, pas être interprétée comme « HEAD est vide » — ce qui basculerait
   * chaque chemin du seau restauré vers le seau supprimé.
   */
  private async pathsInHead(repoPath: string, paths: string[]): Promise<Set<string>> {
    const git = this.getGit(repoPath);

    try {
      await git.raw(['rev-parse', '--verify', 'HEAD']);
    } catch {
      return new Set();
    }

    const raw = await git.raw(['ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', ...paths]);

    return new Set(raw.split('\0').filter((entry) => entry.length > 0));
  }

  /**
   * Supprime du disque des chemins absents de HEAD.
   *
   * Deux mécanismes, selon la présence d'une entrée d'index :
   *
   *   `??`  fichier purement non suivi -> `fs.rm`
   *   sinon entrée d'index (`A `, `AM`, nouveau nom d'un `R `) -> `git rm -f`,
   *         qui retire l'entrée d'index ET le fichier. Mesuré : `fs.rm` seul
   *         laisserait une entrée `D ` fantôme dans l'index.
   *
   * `git rm` refuse un fichier non suivi (mesuré : rc=128, fichier intact),
   * donc les deux mécanismes ne sont pas interchangeables.
   *
   * `fs.rm` sans `recursive` : seconde ligne de défense. Les répertoires sont
   * déjà écartés en amont (entrée `?? nested/` d'un dépôt imbriqué), donc aucun
   * test ne peut atteindre ce cas — c'est assumé. Le garde reste parce qu'une
   * suppression récursive accidentelle est la pire issue possible ici, et que
   * l'absence de `recursive` la rend impossible plutôt qu'improbable.
   *
   * Le garde-fou de confinement est redondant — un chemin issu de `status` est
   * par construction dans le dépôt — et reste en place parce que redondant et
   * gratuit vaut mieux qu'absent sur un `rm`.
   */
  private async deleteNotInHead(
    repoPath: string,
    paths: string[],
    changed: Map<string, string>
  ): Promise<void> {
    const git = this.getGit(repoPath);
    const indexed = paths.filter((entry) => changed.get(entry) !== '??');
    const untracked = paths.filter((entry) => changed.get(entry) === '??');

    if (indexed.length > 0) {
      await git.raw(['rm', '-f', '--quiet', '--', ...indexed]);
    }

    const repoRoot = path.resolve(repoPath);

    for (const entry of untracked) {
      const absolute = path.resolve(repoRoot, entry);

      if (absolute !== repoRoot && !absolute.startsWith(repoRoot + path.sep)) {
        throw new Error(`Refusing to delete outside the repository: ${entry}`);
      }

      await fs.rm(absolute, { force: true });
    }
  }

  /**
   * Stage un ou plusieurs fichiers.
   *
   * Accepte un tableau autant qu'un chemin unique : `git add` prend N pathspecs
   * en une invocation, donc « Stage All » ne prend qu'un seul verrou d'index au
   * lieu d'un par fichier.
   *
   * Fonctionne sur les fichiers non suivis comme sur les fichiers suivis :
   * `git add` sur un fichier neuf l'ajoute à l'index (il devient « added »).
   *
   * `add -- <paths>` : sans le séparateur, un fichier dont le nom commence par
   * `-` est lu comme une option. `git add --hard` échoue en « unknown option »
   * au lieu de stager le fichier nommé `--hard`.
   */
  async stage(repoPath: string, filePath: string | string[]): Promise<void> {
    const git = this.getGit(repoPath);
    const paths = Array.isArray(filePath) ? filePath : [filePath];
    await git.add(['--', ...paths]);
  }

  /**
   * Unstage un ou plusieurs fichiers.
   *
   * `reset HEAD -- <paths>` et non `reset HEAD <paths>` : le `--` empêche Git
   * de lire un chemin comme une option. Un fichier nommé `--hard` transforme
   * `git reset HEAD --hard` en reset destructif — vérifié : la modification non
   * commitée d'un *autre* fichier est perdue. Le séparateur est donc une
   * protection, pas une préférence de style.
   *
   * Cas du fichier non suivi : le fichier n'existe pas dans HEAD, donc le reset
   * le retire simplement de l'index et il redevient non suivi — son contenu sur
   * disque n'est pas touché (à la différence de `reset --hard`).
   *
   * Dépôt sans aucun commit : aucun cas particulier n'est nécessaire. Pour un
   * reset limité à des chemins, Git résout `HEAD` non né vers l'arbre vide, donc
   * l'entrée d'index disparaît et le fichier redevient non suivi. Vérifié sur
   * git 2.43 — un repli `rm --cached` avait été écrit ici puis retiré : aucun
   * test ne pouvait l'atteindre, c'était du code mort.
   */
  async unstage(repoPath: string, filePath: string | string[]): Promise<void> {
    const git = this.getGit(repoPath);
    const paths = Array.isArray(filePath) ? filePath : [filePath];
    await git.reset(['HEAD', '--', ...paths]);
  }

  /**
   * Parse un diff Git en structure
   */
  private parseDiff(diffText: string): Array<{
    path: string;
    diff: string;
    additions: number;
    deletions: number;
  }> {
    const diffs: Array<{
      path: string;
      diff: string;
      additions: number;
      deletions: number;
    }> = [];

    if (!diffText || diffText.trim().length === 0) {
      return diffs;
    }

    // Split par fichier (commence par "diff --git")
    const fileDiffs = diffText.split(/(?=diff --git)/);

    for (const fileDiff of fileDiffs) {
      if (!fileDiff.trim()) continue;

      // Extrait le nom du fichier
      const pathMatch = fileDiff.match(/diff --git a\/(.*?) b\/(.*?)$/m);
      if (!pathMatch) continue;

      const path = pathMatch[2];

      // Compte les additions et deletions
      const lines = fileDiff.split('\n');
      let additions = 0;
      let deletions = 0;

      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          additions++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          deletions++;
        }
      }

      diffs.push({
        path,
        diff: fileDiff,
        additions,
        deletions,
      });
    }

    return diffs;
  }

  /**
   * Nettoie les instances Git en cache
   */
  clearCache(repoPath?: string): void {
    if (repoPath) {
      this.gitInstances.delete(repoPath);
    } else {
      this.gitInstances.clear();
    }
  }
}

// Instance singleton
export const gitService = new GitService();
