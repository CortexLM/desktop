/**
 * Shared Types and Schemas Index
 *
 * Tout le contenu du package vit sous `src/`. Les imports ci-dessous sont
 * relatifs à `src/` : aucun ne sort du `rootDir`, ce qui est la condition pour
 * que `tsc` n'émette pas de TS6059 (« n'est pas sous "rootDir" »).
 */

// Export all types from ipc.ts
export * from './types/ipc';

// Export all MCP types (requests/responses/events)
export * from './types/mcp';

// Core domain entities.
//
// `Automation` / `AutomationTrigger` / `AutomationAction` n'apparaissent plus
// ici : `./types/ipc/automation` en est la seule source (voir la note dans
// `./types/index.ts`), et `export * from './types/ipc'` les expose déjà.
export type {
  Workspace,
  Session,
  Message,
  Mission,
  UsageLog,
} from './types/index';

// Debug / logging types (also reachable via the `./types/debug` subpath export)
export type {
  LogLevel,
  LogEntry,
  IPCMessage,
  PerformanceMetric,
  MemorySnapshot,
  NetworkRequest,
  DebugSettings,
  ErrorReport,
} from './types/debug';

// Structured logger (also reachable via the `./logger` subpath export)
export { logger, Logger } from './logger';

// Export only Zod schemas (types are already in ipc.ts)
export {
  ReadFileRequestSchema,
  WriteFileRequestSchema,
  ReadDirRequestSchema,
  WatchFileRequestSchema,
  UnwatchFileRequestSchema,
} from './schemas/filesystem';

export {
  OpenFileRequestSchema,
  SaveFileRequestSchema,
  FormatDocumentRequestSchema,
} from './schemas/editor';

export {
  GitStatusRequestSchema,
  GitCommitRequestSchema,
  GitPushRequestSchema,
  GitPullRequestSchema,
  GitDiffRequestSchema,
  GitStageRequestSchema,
  GitUnstageRequestSchema,
  GitDiscardRequestSchema,
} from './schemas/git';

export {
  CreateSessionRequestSchema,
  SendMessageRequestSchema,
  StreamResponseRequestSchema,
} from './schemas/ai';

export {
  CreateTerminalRequestSchema,
  TerminalInputRequestSchema,
  TerminalResizeRequestSchema,
  TerminalKillRequestSchema,
} from './schemas/terminal';

export {
  DBQueryRequestSchema,
  DBExecuteRequestSchema,
} from './schemas/database';

export {
  CreateAutomationRequestSchema,
  UpdateAutomationRequestSchema,
  DeleteAutomationRequestSchema,
  ListAutomationsRequestSchema,
  GetAutomationRequestSchema,
  RunAutomationRequestSchema,
  GetAutomationLogsRequestSchema,
  ToggleAutomationRequestSchema,
  TriggerSchema,
  ActionSchema,
} from './schemas/automation';

export {
  ListMCPServersRequestSchema,
  GetMCPServerRequestSchema,
  InstallMCPServerRequestSchema,
  UninstallMCPServerRequestSchema,
  StartMCPServerRequestSchema,
  StopMCPServerRequestSchema,
  DiscoverMCPToolsRequestSchema,
  InvokeMCPToolRequestSchema,
  ListMCPPermissionsRequestSchema,
  GrantMCPPermissionRequestSchema,
  RevokeMCPPermissionRequestSchema,
  CheckMCPPermissionRequestSchema,
} from './schemas/mcp';

export {
  WorkspaceSettingsSchema,
  CreateWorkspaceRequestSchema,
  UpdateWorkspaceRequestSchema,
  type WorkspaceSettings,
  type CreateWorkspaceRequest,
  type UpdateWorkspaceRequest,
} from './schemas/workspace';

// ============================================================================
// Schémas des canaux câblés par `ipc/handlers/{workspace,search,git-stash,
// chat,debug}-handlers.ts`
// ============================================================================

export { NoPayloadSchema, OptionalLimitSchema, type NoPayload } from './schemas/ipc-common';

export {
  StashListRequestSchema,
  StashShowRequestSchema,
  StashSaveRequestSchema,
  StashApplyRequestSchema,
  StashPopRequestSchema,
  StashDropRequestSchema,
  StashBranchRequestSchema,
  type StashListRequest,
  type StashShowRequest,
  type StashSaveRequest,
  type StashApplyRequest,
  type StashPopRequest,
  type StashDropRequest,
  type StashBranchRequest,
} from './schemas/git-stash';

export {
  SearchFindRequestSchema,
  SearchReplaceRequestSchema,
  type SearchFindRequest,
  type SearchReplaceRequest,
} from './schemas/search';

export {
  WorkspaceSwitchRequestSchema,
  WorkspaceAddRequestSchema,
  WorkspaceRemoveRequestSchema,
  type WorkspaceSwitchRequest,
  type WorkspaceAddRequest,
  type WorkspaceRemoveRequest,
} from './schemas/workspace-ipc';

export { ChatExportRequestSchema, type ChatExportRequest } from './schemas/chat';

export {
  LogLevelSchema,
  DebugCategoriesSchema,
  DebugUpdateSettingsRequestSchema,
  type DebugCategories,
  type DebugUpdateSettingsRequest,
} from './schemas/debug';

// Schémas du domaine `settings:*` — le pont entre les réglages de l'UI et
// `AIProviderRegistry`. `SetProviderRequestSchema` valide le seul payload du
// dépôt qui transporte une clé d'API en clair à travers l'IPC.
export {
  ProviderIdSchema,
  GetProviderSettingsRequestSchema,
  SetProviderRequestSchema,
  GetWorkspaceRunSettingsRequestSchema,
  SetWorkspaceRunSettingsRequestSchema,
} from './schemas/settings';
