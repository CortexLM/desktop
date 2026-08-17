/**
 * Git Stash Service
 * Gestion avancée des stashes Git
 */

import simpleGit, { SimpleGit } from 'simple-git';

export interface StashEntry {
  index: number;
  message: string;
  hash: string;
  branch: string;
  timestamp: number;
}

export interface StashDiff {
  files: Array<{
    path: string;
    status: 'modified' | 'added' | 'deleted';
    additions: number;
    deletions: number;
  }>;
  totalAdditions: number;
  totalDeletions: number;
}

export class GitStashService {
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
      });
      this.gitInstances.set(repoPath, git);
    }
    return this.gitInstances.get(repoPath)!;
  }

  /**
   * Liste tous les stashes
   */
  async list(repoPath: string): Promise<StashEntry[]> {
    const git = this.getGit(repoPath);
    const result = await git.stashList();

    return result.all.map((stash, index) => {
      const branch = this.extractBranchFromMessage(stash.message || '');

      return {
        index,
        // simple-git's log entries carry no `branch` field, so the fallback
        // reuses the branch parsed out of the stash message.
        message: stash.message || `WIP on ${branch}`,
        hash: stash.hash,
        branch,
        timestamp: this.extractTimestamp(stash.date),
      };
    });
  }

  /**
   * Crée un nouveau stash
   */
  async save(
    repoPath: string,
    message?: string,
    options?: {
      includeUntracked?: boolean;
      keepIndex?: boolean;
    }
  ): Promise<void> {
    const git = this.getGit(repoPath);
    const args: string[] = ['push'];

    if (message) {
      args.push('-m', message);
    }

    if (options?.includeUntracked) {
      args.push('-u');
    }

    if (options?.keepIndex) {
      args.push('--keep-index');
    }

    await git.stash(args);
  }

  /**
   * Applique un stash (sans le supprimer)
   */
  async apply(repoPath: string, stashIndex: number = 0): Promise<void> {
    const git = this.getGit(repoPath);
    await git.stash(['apply', `stash@{${stashIndex}}`]);
  }

  /**
   * Applique et supprime un stash
   */
  async pop(repoPath: string, stashIndex: number = 0): Promise<void> {
    const git = this.getGit(repoPath);
    await git.stash(['pop', `stash@{${stashIndex}}`]);
  }

  /**
   * Supprime un stash
   */
  async drop(repoPath: string, stashIndex: number): Promise<void> {
    const git = this.getGit(repoPath);
    await git.stash(['drop', `stash@{${stashIndex}}`]);
  }

  /**
   * Efface tous les stashes
   */
  async clear(repoPath: string): Promise<void> {
    const git = this.getGit(repoPath);
    await git.stash(['clear']);
  }

  /**
   * Crée une branche à partir d'un stash
   */
  async branch(repoPath: string, branchName: string, stashIndex: number = 0): Promise<void> {
    const git = this.getGit(repoPath);
    await git.stash(['branch', branchName, `stash@{${stashIndex}}`]);
  }

  /**
   * Affiche le diff d'un stash
   */
  async show(repoPath: string, stashIndex: number = 0): Promise<StashDiff> {
    const git = this.getGit(repoPath);
    const diffOutput = await git.raw(['stash', 'show', '-p', `stash@{${stashIndex}}`]);
    
    return this.parseDiff(diffOutput);
  }

  /**
   * Récupère le contenu d'un fichier dans un stash
   */
  async showFile(repoPath: string, stashIndex: number, filePath: string): Promise<string> {
    const git = this.getGit(repoPath);
    return await git.raw(['show', `stash@{${stashIndex}}:${filePath}`]);
  }

  /**
   * Cherche dans les stashes
   */
  async search(repoPath: string, query: string): Promise<StashEntry[]> {
    const stashes = await this.list(repoPath);
    const lowerQuery = query.toLowerCase();

    return stashes.filter(stash => 
      stash.message.toLowerCase().includes(lowerQuery) ||
      stash.branch.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Récupère les statistiques d'un stash
   */
  async stats(repoPath: string, stashIndex: number = 0): Promise<{
    files: number;
    additions: number;
    deletions: number;
  }> {
    const git = this.getGit(repoPath);
    const output = await git.raw(['stash', 'show', '--numstat', `stash@{${stashIndex}}`]);
    
    const lines = output.split('\n').filter(line => line.trim());
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const line of lines) {
      const [additions, deletions] = line.split(/\s+/);
      totalAdditions += parseInt(additions, 10) || 0;
      totalDeletions += parseInt(deletions, 10) || 0;
    }

    return {
      files: lines.length,
      additions: totalAdditions,
      deletions: totalDeletions,
    };
  }

  /**
   * Parse un diff Git
   */
  private parseDiff(diffOutput: string): StashDiff {
    const lines = diffOutput.split('\n');
    const files: StashDiff['files'] = [];
    let currentFile: StashDiff['files'][0] | null = null;
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const line of lines) {
      // Nouveau fichier
      if (line.startsWith('diff --git')) {
        if (currentFile) {
          files.push(currentFile);
        }

        const match = line.match(/diff --git a\/(.*?) b\/(.*?)$/);
        if (match) {
          currentFile = {
            path: match[2],
            status: 'modified',
            additions: 0,
            deletions: 0,
          };
        }
      }
      // Fichier supprimé
      else if (line.startsWith('deleted file')) {
        if (currentFile) {
          currentFile.status = 'deleted';
        }
      }
      // Nouveau fichier
      else if (line.startsWith('new file')) {
        if (currentFile) {
          currentFile.status = 'added';
        }
      }
      // Ligne ajoutée
      else if (line.startsWith('+') && !line.startsWith('+++')) {
        if (currentFile) {
          currentFile.additions++;
          totalAdditions++;
        }
      }
      // Ligne supprimée
      else if (line.startsWith('-') && !line.startsWith('---')) {
        if (currentFile) {
          currentFile.deletions++;
          totalDeletions++;
        }
      }
    }

    if (currentFile) {
      files.push(currentFile);
    }

    return {
      files,
      totalAdditions,
      totalDeletions,
    };
  }

  /**
   * Extrait le nom de branche du message de stash
   */
  private extractBranchFromMessage(message: string): string {
    const match = message.match(/WIP on (.*?):/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Extrait le timestamp du date string
   */
  private extractTimestamp(dateStr: string): number {
    try {
      return new Date(dateStr).getTime();
    } catch {
      return Date.now();
    }
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
let gitStashService: GitStashService | null = null;

export function getGitStashService(): GitStashService {
  if (!gitStashService) {
    gitStashService = new GitStashService();
  }
  return gitStashService;
}
