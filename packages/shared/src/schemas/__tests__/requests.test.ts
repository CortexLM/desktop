/**
 * Contrat des schémas de requête IPC restants.
 *
 * L'accent est mis sur les **valeurs par défaut** appliquées par Zod : ce sont
 * elles qui décident du comportement quand le renderer omet un champ, et une
 * régression y est invisible au typecheck. Le cas le plus coûteux est
 * `SearchReplaceRequestSchema.dryRun`, qui vaut `true` par défaut parce qu'un
 * remplacement global écrit sur le disque et n'est pas annulable.
 */

import { describe, expect, it } from 'vitest';

import {
  ReadDirRequestSchema,
  ReadFileRequestSchema,
  UnwatchFileRequestSchema,
  WatchFileRequestSchema,
  WriteFileRequestSchema,
} from '../filesystem';
import {
  FormatDocumentRequestSchema,
  OpenFileRequestSchema,
  SaveFileRequestSchema,
} from '../editor';
import {
  GitCommitRequestSchema,
  GitDiffRequestSchema,
  GitPullRequestSchema,
  GitPushRequestSchema,
  GitStatusRequestSchema,
} from '../git';
import {
  StashApplyRequestSchema,
  StashBranchRequestSchema,
  StashDropRequestSchema,
  StashListRequestSchema,
  StashPopRequestSchema,
  StashSaveRequestSchema,
  StashShowRequestSchema,
} from '../git-stash';
import { SearchFindRequestSchema, SearchReplaceRequestSchema } from '../search';
import {
  CreateWorkspaceRequestSchema,
  UpdateWorkspaceRequestSchema,
  WorkspaceSettingsSchema,
} from '../workspace';
import {
  WorkspaceAddRequestSchema,
  WorkspaceRemoveRequestSchema,
  WorkspaceSwitchRequestSchema,
} from '../workspace-ipc';
import { ChatExportRequestSchema } from '../chat';
import { DBExecuteRequestSchema, DBQueryRequestSchema } from '../database';
import {
  CreateSessionRequestSchema,
  SendMessageRequestSchema,
  StreamResponseRequestSchema,
} from '../ai';
import {
  CreateTerminalRequestSchema,
  TerminalInputRequestSchema,
  TerminalKillRequestSchema,
  TerminalResizeRequestSchema,
} from '../terminal';
import {
  CheckMCPPermissionRequestSchema,
  GrantMCPPermissionRequestSchema,
  InstallMCPServerRequestSchema,
  InvokeMCPToolRequestSchema,
  ListMCPPermissionsRequestSchema,
  ListMCPServersRequestSchema,
  RevokeMCPPermissionRequestSchema,
  StartMCPServerRequestSchema,
} from '../mcp';

describe('schémas filesystem', () => {
  it("applique l'encodage par défaut 'utf-8' en lecture et écriture", () => {
    expect(ReadFileRequestSchema.parse({ path: '/f' }).encoding).toBe('utf-8');
    expect(WriteFileRequestSchema.parse({ path: '/f', content: '' }).encoding).toBe('utf-8');
  });

  it('accepte les encodages supportés et rejette les autres', () => {
    for (const encoding of ['utf8', 'utf-8', 'ascii', 'base64', 'binary', 'hex']) {
      expect(ReadFileRequestSchema.safeParse({ path: '/f', encoding }).success).toBe(true);
    }

    // `latin1` et `utf16le` sont valides pour Node mais pas déclarés ici : le
    // handler les refuserait, donc le schéma doit le dire.
    expect(ReadFileRequestSchema.safeParse({ path: '/f', encoding: 'latin1' }).success).toBe(
      false
    );
  });

  it('exige un chemin non vide', () => {
    const result = ReadFileRequestSchema.safeParse({ path: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Path is required');
    }
  });

  it('accepte un contenu vide en écriture (troncature volontaire)', () => {
    expect(WriteFileRequestSchema.parse({ path: '/f', content: '' }).content).toBe('');
  });

  it('rejette une écriture sans contenu', () => {
    // `content: undefined` produirait `writeFile(path, undefined)`, qui écrit
    // la chaîne "undefined".
    expect(WriteFileRequestSchema.safeParse({ path: '/f' }).success).toBe(false);
  });

  it('rend readdir non récursif par défaut', () => {
    expect(ReadDirRequestSchema.parse({ path: '/d' }).recursive).toBe(false);
    expect(ReadDirRequestSchema.parse({ path: '/d', recursive: true }).recursive).toBe(true);
  });

  it('exige un watchId des deux côtés du watch/unwatch', () => {
    expect(WatchFileRequestSchema.safeParse({ path: '/f', watchId: '' }).success).toBe(false);
    expect(WatchFileRequestSchema.safeParse({ path: '/f', watchId: 'w1' }).success).toBe(true);
    expect(UnwatchFileRequestSchema.safeParse({ watchId: '' }).success).toBe(false);
    expect(UnwatchFileRequestSchema.safeParse({ watchId: 'w1' }).success).toBe(true);
  });
});

describe('schémas editor', () => {
  it('rend workspaceId optionnel à l’ouverture', () => {
    expect(OpenFileRequestSchema.parse({ path: '/f' })).toEqual({ path: '/f' });
  });

  it('exige le contenu à la sauvegarde et accepte le vide', () => {
    expect(SaveFileRequestSchema.safeParse({ path: '/f' }).success).toBe(false);
    expect(SaveFileRequestSchema.safeParse({ path: '/f', content: '' }).success).toBe(true);
  });

  it('exige un langage non vide pour le formatage', () => {
    expect(
      FormatDocumentRequestSchema.safeParse({ path: '/f', content: 'x', language: '' }).success
    ).toBe(false);
    expect(
      FormatDocumentRequestSchema.safeParse({ path: '/f', content: 'x', language: 'ts' })
        .success
    ).toBe(true);
  });
});

describe('schémas git', () => {
  it("applique le remote par défaut 'origin' sur push et pull", () => {
    expect(GitPushRequestSchema.parse({ repoPath: '/r' }).remote).toBe('origin');
    expect(GitPullRequestSchema.parse({ repoPath: '/r' }).remote).toBe('origin');
  });

  it('conserve un remote explicite', () => {
    expect(GitPushRequestSchema.parse({ repoPath: '/r', remote: 'upstream' }).remote).toBe(
      'upstream'
    );
  });

  it('rend le diff non-staged par défaut', () => {
    expect(GitDiffRequestSchema.parse({ repoPath: '/r' }).staged).toBe(false);
  });

  it('exige un message de commit non vide', () => {
    const result = GitCommitRequestSchema.safeParse({ repoPath: '/r', message: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Commit message is required');
    }
  });

  it('exige repoPath partout', () => {
    for (const schema of [
      GitStatusRequestSchema,
      GitPushRequestSchema,
      GitPullRequestSchema,
      GitDiffRequestSchema,
    ]) {
      expect(schema.safeParse({ repoPath: '' }).success).toBe(false);
    }
  });
});

describe('schémas git stash', () => {
  it('applique stashIndex = 0 par défaut là où le stash le plus récent est visé', () => {
    expect(StashShowRequestSchema.parse({ repoPath: '/r' }).stashIndex).toBe(0);
    expect(StashApplyRequestSchema.parse({ repoPath: '/r' }).stashIndex).toBe(0);
    expect(StashPopRequestSchema.parse({ repoPath: '/r' }).stashIndex).toBe(0);
    expect(
      StashBranchRequestSchema.parse({ repoPath: '/r', branchName: 'b' }).stashIndex
    ).toBe(0);
  });

  it('exige stashIndex explicite pour drop, qui est destructif', () => {
    // Un défaut à 0 ici supprimerait le stash le plus récent sur un appel
    // incomplet. C'est le seul schéma stash sans défaut, et c'est délibéré.
    expect(StashDropRequestSchema.safeParse({ repoPath: '/r' }).success).toBe(false);
    expect(StashDropRequestSchema.safeParse({ repoPath: '/r', stashIndex: 2 }).success).toBe(
      true
    );
  });

  it.each([-1, 1.5, '0'])('rejette le stashIndex %s', (stashIndex) => {
    expect(StashApplyRequestSchema.safeParse({ repoPath: '/r', stashIndex }).success).toBe(
      false
    );
  });

  it('applique includeUntracked et keepIndex à false par défaut', () => {
    const parsed = StashSaveRequestSchema.parse({ repoPath: '/r' });
    expect(parsed.includeUntracked).toBe(false);
    expect(parsed.keepIndex).toBe(false);
    expect(parsed.message).toBeUndefined();
  });

  it('exige repoPath', () => {
    expect(StashListRequestSchema.safeParse({ repoPath: '' }).success).toBe(false);
  });

  it('exige un branchName non vide', () => {
    expect(
      StashBranchRequestSchema.safeParse({ repoPath: '/r', branchName: '' }).success
    ).toBe(false);
  });
});

describe('schémas search', () => {
  it('applique dryRun = true par défaut sur replace', () => {
    // Le défaut sûr : sans lui, un `search:replace` sans `dryRun` écrirait sur
    // le disque de façon non annulable.
    const parsed = SearchReplaceRequestSchema.parse({
      rootPath: '/w',
      query: 'foo',
      replacement: 'bar',
    });
    expect(parsed.dryRun).toBe(true);
  });

  it('respecte dryRun: false explicite', () => {
    const parsed = SearchReplaceRequestSchema.parse({
      rootPath: '/w',
      query: 'foo',
      replacement: 'bar',
      dryRun: false,
    });
    expect(parsed.dryRun).toBe(false);
  });

  it('exige un replacement, y compris vide (suppression)', () => {
    expect(
      SearchReplaceRequestSchema.safeParse({ rootPath: '/w', query: 'foo' }).success
    ).toBe(false);
    expect(
      SearchReplaceRequestSchema.safeParse({ rootPath: '/w', query: 'foo', replacement: '' })
        .success
    ).toBe(true);
  });

  it('exige query et rootPath non vides', () => {
    expect(SearchFindRequestSchema.safeParse({ rootPath: '/w', query: '' }).success).toBe(
      false
    );
    expect(SearchFindRequestSchema.safeParse({ rootPath: '', query: 'x' }).success).toBe(
      false
    );
  });

  it('laisse includePatterns / excludePatterns absents plutôt que vides', () => {
    // Le service applique ses propres défauts (dont l'exclusion de
    // node_modules) ; un tableau vide injecté ici les écraserait.
    const parsed = SearchFindRequestSchema.parse({ rootPath: '/w', query: 'x' });
    expect(parsed.includePatterns).toBeUndefined();
    expect(parsed.excludePatterns).toBeUndefined();
  });

  it('borne maxResults et contextLines', () => {
    expect(
      SearchFindRequestSchema.parse({ rootPath: '/w', query: 'x', maxResults: 100_000 })
        .maxResults
    ).toBe(100_000);
    expect(
      SearchFindRequestSchema.safeParse({ rootPath: '/w', query: 'x', maxResults: 100_001 })
        .success
    ).toBe(false);
    expect(
      SearchFindRequestSchema.safeParse({ rootPath: '/w', query: 'x', maxResults: 0 }).success
    ).toBe(false);

    // contextLines accepte 0 (aucun contexte) mais pas 51.
    expect(
      SearchFindRequestSchema.parse({ rootPath: '/w', query: 'x', contextLines: 0 })
        .contextLines
    ).toBe(0);
    expect(
      SearchFindRequestSchema.safeParse({ rootPath: '/w', query: 'x', contextLines: 51 })
        .success
    ).toBe(false);
  });
});

describe('schémas workspace (entité persistée)', () => {
  it('applique tous les réglages par défaut', () => {
    expect(WorkspaceSettingsSchema.parse({})).toEqual({
      theme: 'system',
      fontSize: 14,
      tabSize: 2,
      formatOnSave: true,
      autoSave: true,
      autoSaveDelay: 1000,
    });
  });

  it('borne fontSize, tabSize et autoSaveDelay', () => {
    expect(WorkspaceSettingsSchema.safeParse({ fontSize: 7 }).success).toBe(false);
    expect(WorkspaceSettingsSchema.safeParse({ fontSize: 33 }).success).toBe(false);
    expect(WorkspaceSettingsSchema.safeParse({ tabSize: 0 }).success).toBe(false);
    expect(WorkspaceSettingsSchema.safeParse({ tabSize: 9 }).success).toBe(false);
    expect(WorkspaceSettingsSchema.safeParse({ autoSaveDelay: 99 }).success).toBe(false);
    expect(WorkspaceSettingsSchema.safeParse({ autoSaveDelay: 10_001 }).success).toBe(false);
  });

  it('restreint le thème à light/dark/system', () => {
    expect(WorkspaceSettingsSchema.safeParse({ theme: 'high-contrast' }).success).toBe(false);
  });

  it('exige nom et chemin à la création', () => {
    expect(CreateWorkspaceRequestSchema.safeParse({ name: 'w', path: '' }).success).toBe(
      false
    );
    expect(CreateWorkspaceRequestSchema.safeParse({ name: '', path: '/p' }).success).toBe(
      false
    );
  });

  it("n'injecte pas de settings par défaut quand la clé est absente", () => {
    // `settings` est `.optional()` sans `.default()` : l'absence doit rester
    // l'absence, sinon une création écraserait les réglages existants.
    const parsed = CreateWorkspaceRequestSchema.parse({ name: 'w', path: '/p' });
    expect(parsed.settings).toBeUndefined();
  });

  it('accepte une mise à jour partielle des réglages', () => {
    const parsed = UpdateWorkspaceRequestSchema.parse({
      id: 'w1',
      settings: { fontSize: 16 },
    });
    expect(parsed.settings).toEqual({ fontSize: 16 });
  });

  it('valide encore les bornes dans une mise à jour partielle', () => {
    expect(
      UpdateWorkspaceRequestSchema.safeParse({ id: 'w1', settings: { fontSize: 99 } }).success
    ).toBe(false);
  });
});

describe('schémas workspace IPC (canaux workspace:*)', () => {
  it('exigent un workspaceId non vide', () => {
    expect(WorkspaceSwitchRequestSchema.safeParse({ workspaceId: '' }).success).toBe(false);
    expect(WorkspaceRemoveRequestSchema.safeParse({ workspaceId: '' }).success).toBe(false);
    expect(WorkspaceSwitchRequestSchema.safeParse({ workspaceId: 'w1' }).success).toBe(true);
  });

  it('rend le nom optionnel à l’ajout mais refuse un nom vide', () => {
    expect(WorkspaceAddRequestSchema.parse({ path: '/p' })).toEqual({ path: '/p' });
    expect(WorkspaceAddRequestSchema.safeParse({ path: '/p', name: '' }).success).toBe(false);
  });
});

describe('schéma chat export', () => {
  it('restreint le format aux quatre sorties implémentées', () => {
    for (const format of ['markdown', 'json', 'html', 'text']) {
      expect(ChatExportRequestSchema.safeParse({ sessionId: 's', format }).success).toBe(true);
    }

    // `pdf` et `md` n'ont pas de branche dans le service : les accepter
    // produirait une sortie vide.
    expect(ChatExportRequestSchema.safeParse({ sessionId: 's', format: 'pdf' }).success).toBe(
      false
    );
    expect(ChatExportRequestSchema.safeParse({ sessionId: 's', format: 'md' }).success).toBe(
      false
    );
  });

  it('exige un sessionId et un format', () => {
    expect(ChatExportRequestSchema.safeParse({ sessionId: '', format: 'json' }).success).toBe(
      false
    );
    expect(ChatExportRequestSchema.safeParse({ sessionId: 's' }).success).toBe(false);
  });
});

describe('schémas database', () => {
  it('exige une requête non vide', () => {
    expect(DBQueryRequestSchema.safeParse({ query: '' }).success).toBe(false);
    expect(DBQueryRequestSchema.parse({ query: 'SELECT 1' })).toEqual({ query: 'SELECT 1' });
  });

  it('accepte des params hétérogènes, y compris null', () => {
    const parsed = DBQueryRequestSchema.parse({
      query: 'SELECT ?',
      params: [1, 'a', null, true],
    });
    expect(parsed.params).toEqual([1, 'a', null, true]);
  });

  it('exige au moins un statement en exécution groupée', () => {
    const result = DBExecuteRequestSchema.safeParse({ statements: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('At least one statement is required');
    }
  });

  it('valide chaque statement du lot', () => {
    expect(
      DBExecuteRequestSchema.safeParse({
        statements: [{ query: 'SELECT 1' }, { query: '' }],
      }).success
    ).toBe(false);
  });
});

describe('schémas ai', () => {
  it('restreint les providers de session — grok en est absent', () => {
    for (const provider of ['openai', 'anthropic', 'openrouter', 'ollama']) {
      expect(
        CreateSessionRequestSchema.safeParse({ model: 'm', provider }).success
      ).toBe(true);
    }

    // Divergence réelle et assumée : `schemas/automation.ts` accepte 'grok'
    // pour une action `ai_task`, ce canal non. Le test fixe l'écart pour qu'il
    // soit constaté plutôt que découvert.
    expect(
      CreateSessionRequestSchema.safeParse({ model: 'm', provider: 'grok' }).success
    ).toBe(false);
  });

  it('exige un modèle non vide', () => {
    expect(
      CreateSessionRequestSchema.safeParse({ model: '', provider: 'openai' }).success
    ).toBe(false);
  });

  it('exige sessionId et message non vides', () => {
    expect(SendMessageRequestSchema.safeParse({ sessionId: '', message: 'm' }).success).toBe(
      false
    );
    expect(SendMessageRequestSchema.safeParse({ sessionId: 's', message: '' }).success).toBe(
      false
    );
  });

  it('valide la sélection de contexte complètement ou pas du tout', () => {
    expect(
      SendMessageRequestSchema.safeParse({
        sessionId: 's',
        message: 'm',
        context: { selection: { path: '/f', start: 0, end: 10 } },
      }).success
    ).toBe(true);

    // `end` manquant : une sélection partielle produirait un slice invalide.
    expect(
      SendMessageRequestSchema.safeParse({
        sessionId: 's',
        message: 'm',
        context: { selection: { path: '/f', start: 0 } },
      }).success
    ).toBe(false);
  });

  it('partage la forme entre send-message et stream-response', () => {
    // `StreamResponseRequestSchema` est un alias : si quelqu'un les dissocie,
    // ce test le signale.
    const payload = { sessionId: 's', message: 'm' };
    expect(StreamResponseRequestSchema.parse(payload)).toEqual(
      SendMessageRequestSchema.parse(payload)
    );
    expect(StreamResponseRequestSchema.safeParse({ sessionId: 's' }).success).toBe(false);
  });
});

describe('schémas terminal', () => {
  it('accepte une création sans aucun champ', () => {
    expect(CreateTerminalRequestSchema.parse({})).toEqual({});
  });

  it('exige un terminalId non vide', () => {
    for (const schema of [TerminalInputRequestSchema, TerminalKillRequestSchema]) {
      expect(schema.safeParse({ terminalId: '', data: '' }).success).toBe(false);
    }
  });

  it('accepte une entrée vide mais pas absente', () => {
    expect(TerminalInputRequestSchema.safeParse({ terminalId: 't', data: '' }).success).toBe(
      true
    );
    expect(TerminalInputRequestSchema.safeParse({ terminalId: 't' }).success).toBe(false);
  });

  it('exige des dimensions entières strictement positives', () => {
    expect(
      TerminalResizeRequestSchema.safeParse({ terminalId: 't', cols: 80, rows: 24 }).success
    ).toBe(true);

    // `cols: 0` déclencherait une division par zéro dans le calcul de layout du
    // pty ; `80.5` n'est pas une taille de grille valide.
    for (const dims of [
      { cols: 0, rows: 24 },
      { cols: 80, rows: 0 },
      { cols: -80, rows: 24 },
      { cols: 80.5, rows: 24 },
    ]) {
      expect(
        TerminalResizeRequestSchema.safeParse({ terminalId: 't', ...dims }).success
      ).toBe(false);
    }
  });

  it('rejette un env non-string', () => {
    expect(
      CreateTerminalRequestSchema.safeParse({ env: { PORT: 3000 } }).success
    ).toBe(false);
    expect(CreateTerminalRequestSchema.safeParse({ env: { PORT: '3000' } }).success).toBe(
      true
    );
  });
});

describe('schémas mcp', () => {
  it("applique le transport par défaut 'stdio' à l'installation", () => {
    const parsed = InstallMCPServerRequestSchema.parse({
      id: 's1',
      name: 'srv',
      description: 'd',
      command: 'node',
    });
    expect(parsed.transport).toBe('stdio');
  });

  it('restreint le transport à stdio/http', () => {
    expect(
      InstallMCPServerRequestSchema.safeParse({
        id: 's1',
        name: 'srv',
        description: 'd',
        command: 'node',
        transport: 'sse',
      }).success
    ).toBe(false);
  });

  it('exige la commande à l’installation', () => {
    expect(
      InstallMCPServerRequestSchema.safeParse({ id: 's1', name: 'srv', description: 'd' })
        .success
    ).toBe(false);
  });

  it('restreint le filtre de statut', () => {
    for (const status of ['installed', 'available', 'running', 'error', 'stopped']) {
      expect(ListMCPServersRequestSchema.safeParse({ status }).success).toBe(true);
    }
    expect(ListMCPServersRequestSchema.safeParse({ status: 'starting' }).success).toBe(false);
    expect(ListMCPServersRequestSchema.parse({})).toEqual({});
  });

  it('exige serverId et toolName pour invoquer un outil', () => {
    expect(
      InvokeMCPToolRequestSchema.safeParse({
        serverId: 's',
        toolName: 't',
        arguments: { a: 1 },
      }).success
    ).toBe(true);

    // `arguments` absent : le serveur MCP recevrait `undefined` au lieu d'un
    // objet.
    expect(
      InvokeMCPToolRequestSchema.safeParse({ serverId: 's', toolName: 't' }).success
    ).toBe(false);
  });

  it('exige serverId et toolName sur les canaux de permission', () => {
    for (const schema of [
      GrantMCPPermissionRequestSchema,
      RevokeMCPPermissionRequestSchema,
      CheckMCPPermissionRequestSchema,
    ]) {
      expect(schema.safeParse({ serverId: 's', toolName: 't' }).success).toBe(true);
      expect(schema.safeParse({ serverId: 's' }).success).toBe(false);
    }
  });

  it('rend serverId optionnel pour lister les permissions', () => {
    expect(ListMCPPermissionsRequestSchema.parse({})).toEqual({});
  });

  it('exige serverId pour démarrer un serveur', () => {
    expect(StartMCPServerRequestSchema.safeParse({}).success).toBe(false);
  });
});
