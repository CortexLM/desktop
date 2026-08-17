/**
 * Contrat de la surface publique du package.
 *
 * Les autres packages n'importent pas les modules internes : ils écrivent
 * `from '@cortex-ide/shared'`, ou l'un des trois sous-chemins déclarés dans
 * `exports` (`./types/ipc`, `./types/debug`, `./logger`). Ce fichier passe par
 * ces points d'entrée plutôt que par les chemins profonds, pour deux raisons :
 *
 * - Les barrels (`index.ts`) sont du code exécuté. Un export oublié pendant un
 *   déplacement de fichier ne se voit qu'ici : les tests qui importent
 *   directement `../schemas/git` continueraient de passer alors que
 *   `@cortex-ide/shared` ne réexporte plus rien.
 * - Le package a récemment été restructuré sous `src/` avec une `exports` map
 *   qui pointait auparavant sur deux arborescences parallèles. Un import cassé
 *   de barrel est exactement le mode de défaillance que cette restructuration
 *   devait éliminer.
 *
 * Chaque schéma réexporté est ici *utilisé* (un parse valide, un parse
 * invalide), pas simplement constaté présent : `expect(Schema).toBeDefined()`
 * passerait sur un objet vide.
 */

import { describe, expect, it } from 'vitest';

import * as shared from '../index';
import { logger as loggerFromSubpath, Logger } from '../logger';
import { IPC_CHANNELS as channelsFromSubpath } from '../types/ipc';

describe('surface publique de @cortex-ide/shared', () => {
  it('réexporte le logger, et c’est le même singleton que le sous-chemin ./logger', () => {
    // Deux instances signifieraient que les logs écrits via le barrel sont
    // invisibles pour `debug:get-logs`, qui lit l'autre.
    expect(shared.logger).toBe(loggerFromSubpath);
    expect(shared.logger).toBe(Logger.getInstance());
    expect(shared.Logger).toBe(Logger);
  });

  it('réexporte IPC_CHANNELS, identique au sous-chemin ./types/ipc', () => {
    expect(shared.IPC_CHANNELS).toBe(channelsFromSubpath);
    expect(shared.IPC_CHANNELS.FS_READ_FILE).toBe('fs:read-file');
  });

  it('le logger réexporté est fonctionnel à travers le barrel', () => {
    shared.logger.clear();
    shared.logger.info('barrel', 'via index');

    const [entry] = shared.logger.getLogs();
    expect(entry.message).toBe('via index');
    shared.logger.clear();
  });
});

/**
 * Chaque paire est (payload valide, payload invalide). Le schéma doit accepter
 * la première et refuser la seconde — donc un objet inerte réexporté par erreur
 * échoue au premier `parse`.
 */
const SCHEMA_CASES: Array<{
  name: keyof typeof shared;
  valid: unknown;
  invalid: unknown;
}> = [
  // filesystem
  { name: 'ReadFileRequestSchema', valid: { path: '/f' }, invalid: { path: '' } },
  {
    name: 'WriteFileRequestSchema',
    valid: { path: '/f', content: 'x' },
    invalid: { path: '/f' },
  },
  { name: 'ReadDirRequestSchema', valid: { path: '/d' }, invalid: {} },
  {
    name: 'WatchFileRequestSchema',
    valid: { path: '/f', watchId: 'w' },
    invalid: { path: '/f' },
  },
  { name: 'UnwatchFileRequestSchema', valid: { watchId: 'w' }, invalid: {} },

  // editor
  { name: 'OpenFileRequestSchema', valid: { path: '/f' }, invalid: {} },
  {
    name: 'SaveFileRequestSchema',
    valid: { path: '/f', content: '' },
    invalid: { path: '/f' },
  },
  {
    name: 'FormatDocumentRequestSchema',
    valid: { path: '/f', content: 'x', language: 'ts' },
    invalid: { path: '/f', content: 'x' },
  },

  // git
  { name: 'GitStatusRequestSchema', valid: { repoPath: '/r' }, invalid: {} },
  {
    name: 'GitCommitRequestSchema',
    valid: { repoPath: '/r', message: 'm' },
    invalid: { repoPath: '/r', message: '' },
  },
  { name: 'GitPushRequestSchema', valid: { repoPath: '/r' }, invalid: { repoPath: '' } },
  { name: 'GitPullRequestSchema', valid: { repoPath: '/r' }, invalid: { repoPath: '' } },
  { name: 'GitDiffRequestSchema', valid: { repoPath: '/r' }, invalid: {} },
  {
    name: 'GitStageRequestSchema',
    valid: { repoPath: '/r', files: ['a.ts'] },
    // Liste vide : un `git add` sans pathspec n'a pas de sens, et une chaîne
    // vide ne doit jamais pouvoir s'élargir en « tout ».
    invalid: { repoPath: '/r', files: [] },
  },
  {
    name: 'GitUnstageRequestSchema',
    valid: { repoPath: '/r', files: ['a.ts', 'b.ts'] },
    invalid: { repoPath: '/r', files: [''] },
  },
  {
    name: 'GitDiscardRequestSchema',
    valid: { repoPath: '/r', files: ['a.ts'] },
    // `deleteUntracked` doit rester un booléen : une chaîne truthy ne doit pas
    // pouvoir se transformer en permission de supprimer.
    invalid: { repoPath: '/r', files: ['a.ts'], deleteUntracked: 'yes' },
  },

  // ai
  {
    name: 'CreateSessionRequestSchema',
    valid: { model: 'm', provider: 'openai' },
    invalid: { model: 'm', provider: 'grok' },
  },
  {
    name: 'SendMessageRequestSchema',
    valid: { sessionId: 's', message: 'm' },
    invalid: { sessionId: 's' },
  },
  {
    name: 'StreamResponseRequestSchema',
    valid: { sessionId: 's', message: 'm' },
    invalid: {},
  },

  // terminal
  { name: 'CreateTerminalRequestSchema', valid: {}, invalid: { env: { A: 1 } } },
  {
    name: 'TerminalInputRequestSchema',
    valid: { terminalId: 't', data: '' },
    invalid: { terminalId: 't' },
  },
  {
    name: 'TerminalResizeRequestSchema',
    valid: { terminalId: 't', cols: 80, rows: 24 },
    invalid: { terminalId: 't', cols: 0, rows: 24 },
  },
  { name: 'TerminalKillRequestSchema', valid: { terminalId: 't' }, invalid: {} },

  // database
  { name: 'DBQueryRequestSchema', valid: { query: 'SELECT 1' }, invalid: { query: '' } },
  {
    name: 'DBExecuteRequestSchema',
    valid: { statements: [{ query: 'SELECT 1' }] },
    invalid: { statements: [] },
  },

  // automation
  {
    name: 'CreateAutomationRequestSchema',
    valid: {
      workspaceId: 'w',
      name: 'n',
      enabled: true,
      trigger: { type: 'manual' },
      actions: [{ type: 'run_script', script: 's' }],
    },
    // Le discriminant kebab-case, refusé jusque depuis le barrel.
    invalid: {
      workspaceId: 'w',
      name: 'n',
      enabled: true,
      trigger: { type: 'file-watch' },
      actions: [{ type: 'run_script', script: 's' }],
    },
  },
  { name: 'UpdateAutomationRequestSchema', valid: { id: 'a' }, invalid: { id: '' } },
  { name: 'DeleteAutomationRequestSchema', valid: { id: 'a' }, invalid: {} },
  { name: 'ListAutomationsRequestSchema', valid: {}, invalid: { workspaceId: 1 } },
  { name: 'GetAutomationRequestSchema', valid: { id: 'a' }, invalid: { id: '' } },
  { name: 'RunAutomationRequestSchema', valid: { id: 'a' }, invalid: {} },
  {
    name: 'GetAutomationLogsRequestSchema',
    valid: { automationId: 'a' },
    invalid: { automationId: 'a', limit: 0 },
  },
  {
    name: 'ToggleAutomationRequestSchema',
    valid: { id: 'a', enabled: false },
    invalid: { id: 'a' },
  },
  { name: 'TriggerSchema', valid: { type: 'manual' }, invalid: { type: 'file-watch' } },
  {
    name: 'ActionSchema',
    valid: { type: 'run_script', script: 's' },
    invalid: { type: 'run-script', script: 's' },
  },

  // mcp
  { name: 'ListMCPServersRequestSchema', valid: {}, invalid: { status: 'starting' } },
  { name: 'GetMCPServerRequestSchema', valid: { serverId: 's' }, invalid: {} },
  {
    name: 'InstallMCPServerRequestSchema',
    valid: { id: 's', name: 'n', description: 'd', command: 'node' },
    invalid: { id: 's', name: 'n', description: 'd' },
  },
  { name: 'UninstallMCPServerRequestSchema', valid: { serverId: 's' }, invalid: {} },
  { name: 'StartMCPServerRequestSchema', valid: { serverId: 's' }, invalid: {} },
  { name: 'StopMCPServerRequestSchema', valid: { serverId: 's' }, invalid: {} },
  { name: 'DiscoverMCPToolsRequestSchema', valid: { serverId: 's' }, invalid: {} },
  {
    name: 'InvokeMCPToolRequestSchema',
    valid: { serverId: 's', toolName: 't', arguments: {} },
    invalid: { serverId: 's', toolName: 't' },
  },
  { name: 'ListMCPPermissionsRequestSchema', valid: {}, invalid: { serverId: 1 } },
  {
    name: 'GrantMCPPermissionRequestSchema',
    valid: { serverId: 's', toolName: 't' },
    invalid: { serverId: 's' },
  },
  {
    name: 'RevokeMCPPermissionRequestSchema',
    valid: { serverId: 's', toolName: 't' },
    invalid: { toolName: 't' },
  },
  {
    name: 'CheckMCPPermissionRequestSchema',
    valid: { serverId: 's', toolName: 't' },
    invalid: {},
  },

  // workspace (entité)
  { name: 'WorkspaceSettingsSchema', valid: {}, invalid: { theme: 'neon' } },
  {
    name: 'CreateWorkspaceRequestSchema',
    valid: { name: 'w', path: '/p' },
    invalid: { name: 'w' },
  },
  { name: 'UpdateWorkspaceRequestSchema', valid: { id: 'w' }, invalid: { id: '' } },

  // workspace (canaux IPC)
  { name: 'WorkspaceSwitchRequestSchema', valid: { workspaceId: 'w' }, invalid: {} },
  { name: 'WorkspaceAddRequestSchema', valid: { path: '/p' }, invalid: { path: '' } },
  { name: 'WorkspaceRemoveRequestSchema', valid: { workspaceId: 'w' }, invalid: {} },

  // git stash
  { name: 'StashListRequestSchema', valid: { repoPath: '/r' }, invalid: {} },
  { name: 'StashShowRequestSchema', valid: { repoPath: '/r' }, invalid: { repoPath: '' } },
  { name: 'StashSaveRequestSchema', valid: { repoPath: '/r' }, invalid: {} },
  {
    name: 'StashApplyRequestSchema',
    valid: { repoPath: '/r' },
    invalid: { repoPath: '/r', stashIndex: -1 },
  },
  { name: 'StashPopRequestSchema', valid: { repoPath: '/r' }, invalid: { repoPath: '' } },
  {
    name: 'StashDropRequestSchema',
    valid: { repoPath: '/r', stashIndex: 0 },
    // Pas de défaut pour drop : c'est destructif.
    invalid: { repoPath: '/r' },
  },
  {
    name: 'StashBranchRequestSchema',
    valid: { repoPath: '/r', branchName: 'b' },
    invalid: { repoPath: '/r', branchName: '' },
  },

  // search
  {
    name: 'SearchFindRequestSchema',
    valid: { rootPath: '/w', query: 'q' },
    invalid: { rootPath: '/w', query: '' },
  },
  {
    name: 'SearchReplaceRequestSchema',
    valid: { rootPath: '/w', query: 'q', replacement: 'r' },
    invalid: { rootPath: '/w', query: 'q' },
  },

  // chat
  {
    name: 'ChatExportRequestSchema',
    valid: { sessionId: 's', format: 'json' },
    invalid: { sessionId: 's', format: 'pdf' },
  },

  // debug
  { name: 'LogLevelSchema', valid: 'info', invalid: 'verbose' },
  {
    name: 'DebugCategoriesSchema',
    valid: {
      ipc: true,
      performance: true,
      network: true,
      database: true,
      ai: true,
      git: true,
    },
    invalid: { ipc: true },
  },
  {
    name: 'DebugUpdateSettingsRequestSchema',
    valid: { enabled: true },
    invalid: { logLevel: 'verbose' },
  },

  // payloads communs
  { name: 'NoPayloadSchema', valid: undefined, invalid: 'not-a-payload' },
  { name: 'OptionalLimitSchema', valid: 10, invalid: 0 },
];

describe('schémas réexportés par le barrel', () => {
  it('sont tous présents', () => {
    const missing = SCHEMA_CASES.filter(({ name }) => shared[name] === undefined).map(
      ({ name }) => name
    );
    expect(missing).toEqual([]);
  });

  it.each(SCHEMA_CASES)('$name accepte sa forme valide', ({ name, valid }) => {
    const schema = shared[name] as { safeParse: (v: unknown) => { success: boolean } };
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(SCHEMA_CASES)('$name rejette sa forme invalide', ({ name, invalid }) => {
    const schema = shared[name] as { safeParse: (v: unknown) => { success: boolean } };
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});
