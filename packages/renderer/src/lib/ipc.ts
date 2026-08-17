/**
 * IPC Client - Type-safe API pour communication avec main process
 */

import type {
  IPCResponse,
  ReadFileRequest,
  ReadFileResponse,
  WriteFileRequest,
  WriteFileResponse,
  ReadDirRequest,
  ReadDirResponse,
  OpenFileRequest,
  OpenFileResponse,
  SaveFileRequest,
  SaveFileResponse,
  FormatDocumentRequest,
  FormatDocumentResponse,
  GitStatusRequest,
  GitStatusResponse,
  GitCommitRequest,
  GitCommitResponse,
  GitPushRequest,
  GitPushResponse,
  GitPullRequest,
  GitPullResponse,
  GitDiffRequest,
  GitDiffResponse,
  GitStageRequest,
  GitStageResponse,
  GitUnstageRequest,
  GitUnstageResponse,
  GitDiscardRequest,
  GitDiscardResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalInputRequest,
  TerminalResizeRequest,
  DBQueryRequest,
  DBQueryResponse,
  DBExecuteRequest,
  DBExecuteResponse,
} from '@cortex-ide/shared';
import { IPC_CHANNELS } from '@cortex-ide/shared';

// Wrapper type-safe pour l'invoke exposé par le preload.
//
// `window.electron.invoke`, pas `window.electron.ipcRenderer.invoke` : le
// preload expose une fonction `invoke` à plat (voir
// `packages/preload/src/index.ts`), il n'y a pas d'objet `ipcRenderer`
// intermédiaire — chaque appel d'ici levait donc
// « Cannot read properties of undefined (reading 'invoke') ».
async function invoke<TRequest, TResponse>(
  channel: string,
  request: TRequest
): Promise<TResponse> {
  const response = (await window.electron.invoke(channel, request)) as IPCResponse<TResponse>;

  if (!response.success) {
    throw new Error(response.error.message);
  }

  return response.data;
}

/**
 * API IPC côté renderer
 */
export const ipc = {
  // Filesystem
  fs: {
    readFile: (request: ReadFileRequest) => 
      invoke<ReadFileRequest, ReadFileResponse>(IPC_CHANNELS.FS_READ_FILE, request),
    
    writeFile: (request: WriteFileRequest) => 
      invoke<WriteFileRequest, WriteFileResponse>(IPC_CHANNELS.FS_WRITE_FILE, request),
    
    readDir: (request: ReadDirRequest) => 
      invoke<ReadDirRequest, ReadDirResponse>(IPC_CHANNELS.FS_READ_DIR, request),
  },

  // Editor
  editor: {
    openFile: (request: OpenFileRequest) => 
      invoke<OpenFileRequest, OpenFileResponse>(IPC_CHANNELS.EDITOR_OPEN_FILE, request),
    
    saveFile: (request: SaveFileRequest) => 
      invoke<SaveFileRequest, SaveFileResponse>(IPC_CHANNELS.EDITOR_SAVE_FILE, request),
    
    format: (request: FormatDocumentRequest) => 
      invoke<FormatDocumentRequest, FormatDocumentResponse>(IPC_CHANNELS.EDITOR_FORMAT, request),
  },

  // Git
  git: {
    status: (request: GitStatusRequest) => 
      invoke<GitStatusRequest, GitStatusResponse>(IPC_CHANNELS.GIT_STATUS, request),
    
    commit: (request: GitCommitRequest) => 
      invoke<GitCommitRequest, GitCommitResponse>(IPC_CHANNELS.GIT_COMMIT, request),
    
    push: (request: GitPushRequest) => 
      invoke<GitPushRequest, GitPushResponse>(IPC_CHANNELS.GIT_PUSH, request),
    
    pull: (request: GitPullRequest) => 
      invoke<GitPullRequest, GitPullResponse>(IPC_CHANNELS.GIT_PULL, request),
    
    diff: (request: GitDiffRequest) => 
      invoke<GitDiffRequest, GitDiffResponse>(IPC_CHANNELS.GIT_DIFF, request),

    stage: (request: GitStageRequest) =>
      invoke<GitStageRequest, GitStageResponse>(IPC_CHANNELS.GIT_STAGE, request),

    unstage: (request: GitUnstageRequest) =>
      invoke<GitUnstageRequest, GitUnstageResponse>(IPC_CHANNELS.GIT_UNSTAGE, request),

    discard: (request: GitDiscardRequest) =>
      invoke<GitDiscardRequest, GitDiscardResponse>(IPC_CHANNELS.GIT_DISCARD, request),
  },

  // AI
  ai: {
    createSession: (request: CreateSessionRequest) => 
      invoke<CreateSessionRequest, CreateSessionResponse>(IPC_CHANNELS.AI_CREATE_SESSION, request),
    
    sendMessage: (request: SendMessageRequest) => 
      invoke<SendMessageRequest, SendMessageResponse>(IPC_CHANNELS.AI_SEND_MESSAGE, request),
  },

  // Terminal
  terminal: {
    create: (request: CreateTerminalRequest) => 
      invoke<CreateTerminalRequest, CreateTerminalResponse>(IPC_CHANNELS.TERMINAL_CREATE, request),
    
    input: (request: TerminalInputRequest) => 
      invoke<TerminalInputRequest, void>(IPC_CHANNELS.TERMINAL_INPUT, request),
    
    resize: (request: TerminalResizeRequest) => 
      invoke<TerminalResizeRequest, void>(IPC_CHANNELS.TERMINAL_RESIZE, request),
  },

  // Database
  db: {
    query: <T = unknown>(request: DBQueryRequest) => 
      invoke<DBQueryRequest, DBQueryResponse<T>>(IPC_CHANNELS.DB_QUERY, request),
    
    execute: (request: DBExecuteRequest) => 
      invoke<DBExecuteRequest, DBExecuteResponse>(IPC_CHANNELS.DB_EXECUTE, request),
  },
};
