/**
 * Preload Script - Bridge between main and renderer
 * Expose un API type-safe via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { IPC_CHANNELS } from '@cortex-ide/shared';
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
  StreamResponseRequest,
  StreamChunk,
  CreateTerminalRequest,
  CreateTerminalResponse,
  TerminalInputRequest,
  TerminalResizeRequest,
  DBQueryRequest,
  DBQueryResponse,
  DBExecuteRequest,
  DBExecuteResponse,
  FileChangeEvent,
  TerminalDataEvent,
  TerminalExitEvent,
  CreateAutomationRequest,
  CreateAutomationResponse,
  UpdateAutomationRequest,
  UpdateAutomationResponse,
  DeleteAutomationRequest,
  DeleteAutomationResponse,
  ListAutomationsRequest,
  ListAutomationsResponse,
  GetAutomationRequest,
  GetAutomationResponse,
  RunAutomationRequest,
  RunAutomationResponse,
  ToggleAutomationRequest,
  ToggleAutomationResponse,
  GetAutomationLogsRequest,
  GetAutomationLogsResponse,
  AutomationStartedEvent,
  AutomationCompletedEvent,
  AutomationFailedEvent,
  AutomationNotificationEvent,
  CortexAccountState,
  CortexDeviceStartResponse,
  CortexDeviceStatusEvent,
  CortexListModelsResponse,
  CortexProductRequest,
  CortexProductResponse,
  ArchiveSessionRequest,
  FollowUpSessionRequest,
  GetSessionRequest,
  GetSessionResponse,
  ListRepositoriesResponse,
  ListSessionsRequest,
  ListSessionsResponse,
  OpenWorkspaceResponse,
  ResolveSessionPermissionRequest,
  SessionIdRequest,
  SessionProgressEvent,
  ChatIdRequest,
  ChatProgressEvent,
  IsWindowMaximizedResponse,
  WindowMaximizedEvent,
  NotifyShowRequest,
  NotifyShowResponse,
  GetConversationRequest,
  GetConversationResponse,
  ListConversationsResponse,
  SendChatMessageRequest,
  SendChatMessageResponse,
  StartConversationRequest,
  StartConversationResponse,
  SessionSummary,
  StartSessionRequest,
  StartSessionResponse,
  GetProviderSettingsResponse,
  GetWorkspaceRunSettingsResponse,
  SetProviderRequest,
  SetProviderResponse,
  SetWorkspaceRunSettingsRequest,
  SetWorkspaceRunSettingsResponse,
  SecretView,
} from '@cortex-ide/shared';

// MCP Types - Import from types/mcp.ts which are properly exported
import type {
  ListMCPServersRequest,
  GetMCPServerRequest,
  InstallMCPServerRequest,
  UninstallMCPServerRequest,
  StartMCPServerRequest,
  StopMCPServerRequest,
  DiscoverMCPToolsRequest,
  InvokeMCPToolRequest,
  ListMCPPermissionsRequest,
  GrantMCPPermissionRequest,
  RevokeMCPPermissionRequest,
  CheckMCPPermissionRequest,
  ListMCPServersResponse,
  GetMCPServerResponse,
  InstallMCPServerResponse,
  UninstallMCPServerResponse,
  StartMCPServerResponse,
  StopMCPServerResponse,
  DiscoverMCPToolsResponse,
  InvokeMCPToolResponse,
  ListMCPPermissionsResponse,
  GrantMCPPermissionResponse,
  RevokeMCPPermissionResponse,
  CheckMCPPermissionResponse,
  MCPServerStartedEvent,
  MCPServerStoppedEvent,
  MCPServerErrorEvent,
  MCPToolInvokedEvent,
  MCPPermissionGrantedEvent,
  MCPPermissionRevokedEvent,
} from '@cortex-ide/shared';

// ============================================================================
// API Definition
// ============================================================================

export interface CortexAPI {
  // Filesystem
  fs: {
    readFile: (request: ReadFileRequest) => Promise<IPCResponse<ReadFileResponse>>;
    writeFile: (request: WriteFileRequest) => Promise<IPCResponse<WriteFileResponse>>;
    readDir: (request: ReadDirRequest) => Promise<IPCResponse<ReadDirResponse>>;
    watch: (path: string, watchId: string) => Promise<void>;
    unwatch: (watchId: string) => Promise<void>;
    onFileChange: (callback: (event: FileChangeEvent) => void) => () => void;
  };

  // Editor
  editor: {
    openFile: (request: OpenFileRequest) => Promise<IPCResponse<OpenFileResponse>>;
    saveFile: (request: SaveFileRequest) => Promise<IPCResponse<SaveFileResponse>>;
    format: (request: FormatDocumentRequest) => Promise<IPCResponse<FormatDocumentResponse>>;
  };

  // Git
  git: {
    status: (request: GitStatusRequest) => Promise<IPCResponse<GitStatusResponse>>;
    commit: (request: GitCommitRequest) => Promise<IPCResponse<GitCommitResponse>>;
    push: (request: GitPushRequest) => Promise<IPCResponse<GitPushResponse>>;
    pull: (request: GitPullRequest) => Promise<IPCResponse<GitPullResponse>>;
    diff: (request: GitDiffRequest) => Promise<IPCResponse<GitDiffResponse>>;
    stage: (request: GitStageRequest) => Promise<IPCResponse<GitStageResponse>>;
    unstage: (request: GitUnstageRequest) => Promise<IPCResponse<GitUnstageResponse>>;
    discard: (request: GitDiscardRequest) => Promise<IPCResponse<GitDiscardResponse>>;
  };

  // AI
  ai: {
    createSession: (request: CreateSessionRequest) => Promise<IPCResponse<CreateSessionResponse>>;
    sendMessage: (request: SendMessageRequest) => Promise<IPCResponse<SendMessageResponse>>;
    streamResponse: (request: StreamResponseRequest, onChunk: (chunk: StreamChunk) => void) => Promise<void>;
    stopStream: (sessionId: string) => Promise<void>;
    resolvePermission: (request: {
      sessionId: string;
      requestId: string;
      decision: 'allow-once' | 'allow-always' | 'deny';
    }) => Promise<IPCResponse<{ requestId: string }>>;
  };

  mission: {
    list: (request: { workspaceId?: string }) => Promise<
      IPCResponse<{
        missions: Array<{
          id: string;
          name: string;
          status: string;
          description: string;
          steps: Array<{ id: string; name: string; status: string; result?: string; error?: string }>;
          currentStep: number;
        }>;
      }>
    >;
    create: (request: {
      workspaceId?: string;
      name?: string;
      description?: string;
      steps?: string[];
    }) => Promise<IPCResponse<{ mission: { id: string; name: string; status: string } }>>;
    start: (request: { id: string }) => Promise<IPCResponse<{ mission: { id: string; status: string } }>>;
    pause: (request: { id: string }) => Promise<IPCResponse<{ mission: { id: string; status: string } }>>;
    resume: (request: { id: string }) => Promise<IPCResponse<{ mission: { id: string; status: string } }>>;
  };

  /**
   * Compte Cortex et catalogue de modèles.
   *
   * Le seul chemin par lequel le renderer peut atteindre `api.cortex.foundation` :
   * chargé depuis `file://`, il a une origine opaque et le contrôle CORS rejette
   * ses requêtes avant l'envoi. Le contrat est dans `shared/types/ipc/cortex.ts`.
   *
   * Aucune méthode ne rend de jeton. `deviceStart` renvoie le code utilisateur et
   * l'URL de vérification — faits pour être affichés — et l'issue arrive par
   * `onDeviceStatus`. Le `device_code`, échangeable contre un jeton, ne sort pas
   * de main.
   */
  cortex: {
    getState: () => Promise<IPCResponse<CortexAccountState>>;
    listModels: () => Promise<IPCResponse<CortexListModelsResponse>>;
    deviceStart: () => Promise<IPCResponse<CortexDeviceStartResponse>>;
    deviceCancel: () => Promise<IPCResponse<{ cancelled: true }>>;
    /** Opens the approval page. Takes no URL: main uses the flow it started. */
    openVerification: () => Promise<IPCResponse<{ opened: boolean }>>;
    signOut: () => Promise<IPCResponse<CortexAccountState>>;
    listApiKeys: () => Promise<
      IPCResponse<{ keys: Array<{ id: string; name: string; lastFour?: string }> }>
    >;
    createApiKey: (request: {
      name: string;
    }) => Promise<IPCResponse<{ key: { id: string; name: string; key?: string } }>>;
    revokeApiKey: (request: { id: string }) => Promise<IPCResponse<{ revoked: true }>>;
    productRequest: (
      request: CortexProductRequest,
    ) => Promise<IPCResponse<CortexProductResponse>>;
    onDeviceStatus: (callback: (event: CortexDeviceStatusEvent) => void) => () => void;
    onAccountChanged: (callback: (state: CortexAccountState) => void) => () => void;
  };

  /**
   * Runs.
   *
   * Separate from `ai`, which carries a conversation. There is no "poll for the
   * next event" method: a run advances in main at its own pace and the renderer
   * learns of it through `onProgress`.
   */
  session: {
    list: (request?: ListSessionsRequest) => Promise<IPCResponse<ListSessionsResponse>>;
    get: (request: GetSessionRequest) => Promise<IPCResponse<GetSessionResponse>>;
    start: (request: StartSessionRequest) => Promise<IPCResponse<StartSessionResponse>>;
    followUp: (
      request: FollowUpSessionRequest
    ) => Promise<IPCResponse<{ session: SessionSummary | null }>>;
    stop: (request: SessionIdRequest) => Promise<IPCResponse<{ session: SessionSummary | null }>>;
    archive: (
      request: ArchiveSessionRequest
    ) => Promise<IPCResponse<{ session: SessionSummary | null }>>;
    remove: (request: SessionIdRequest) => Promise<IPCResponse<{ deleted: true }>>;
    resolvePermission: (
      request: ResolveSessionPermissionRequest
    ) => Promise<IPCResponse<{ resolved: true }>>;
    listRepositories: () => Promise<IPCResponse<ListRepositoriesResponse>>;
    /** Opens the native folder picker and adopts the choice. Takes no path. */
    openWorkspace: () => Promise<IPCResponse<OpenWorkspaceResponse>>;
    onProgress: (callback: (event: SessionProgressEvent) => void) => () => void;
  };

  /**
   * Which OS the app runs on. The renderer sizes its custom title bar with it:
   * macOS reserves the traffic-light inset, Windows and Linux draw their own
   * window controls. A function rather than a value: the bridge is a wall of
   * functions, and the exposed-surface guard keeps it that way.
   */
  platform: () => NodeJS.Platform;

  /** What the native frame used to do, for the custom title bar's buttons. */
  windowControls: {
    minimize: () => Promise<IPCResponse<{ minimized: true }>>;
    toggleMaximize: () => Promise<IPCResponse<IsWindowMaximizedResponse>>;
    close: () => Promise<IPCResponse<{ closed: true }>>;
    isMaximized: () => Promise<IPCResponse<IsWindowMaximizedResponse>>;
    onMaximizedChange: (callback: (event: WindowMaximizedEvent) => void) => () => void;
  };

  notify: {
    show: (request: NotifyShowRequest) => Promise<IPCResponse<NotifyShowResponse>>;
  };

  /**
   * The Chat product's conversations: linear exchanges with a provider, streamed
   * over `event:chat-progress`.
   */
  chat: {
    list: () => Promise<IPCResponse<ListConversationsResponse>>;
    get: (request: GetConversationRequest) => Promise<IPCResponse<GetConversationResponse>>;
    start: (request: StartConversationRequest) => Promise<IPCResponse<StartConversationResponse>>;
    send: (request: SendChatMessageRequest) => Promise<IPCResponse<SendChatMessageResponse>>;
    stop: (request: ChatIdRequest) => Promise<IPCResponse<{ stopped: true }>>;
    remove: (request: ChatIdRequest) => Promise<IPCResponse<{ deleted: true }>>;
    onProgress: (callback: (event: ChatProgressEvent) => void) => () => void;
  };

  /**
   * Provider credentials and run settings.
   *
   * `setProvider` is the one call in the app that carries an API key in plaintext,
   * and it goes one way only: `getProviders` answers with masks. The run settings
   * are held by main because they govern what the agent may do — a permission
   * whose value is read from a store the renderer can write is not a permission.
   */
  settings: {
    getProviders: () => Promise<IPCResponse<GetProviderSettingsResponse>>;
    setProvider: (request: SetProviderRequest) => Promise<IPCResponse<SetProviderResponse>>;
    getWorkspace: () => Promise<IPCResponse<GetWorkspaceRunSettingsResponse>>;
    setWorkspace: (
      request: SetWorkspaceRunSettingsRequest
    ) => Promise<IPCResponse<SetWorkspaceRunSettingsResponse>>;
  };

  /**
   * Secrets exposed to runs as environment variables.
   *
   * There is deliberately no method that reads a value back. The one that returns
   * values is main-process only, called by the agent loop — that the renderer
   * cannot reach it is the entire point.
   */
  secrets: {
    list: () => Promise<IPCResponse<{ secrets: SecretView[] }>>;
    create: (request: {
      name: string;
      value: string;
    }) => Promise<IPCResponse<{ secret: SecretView }>>;
    remove: (request: { id: string }) => Promise<IPCResponse<{ deleted: true }>>;
  };

  // MCP
  mcp: {
    listServers: (request: ListMCPServersRequest) => Promise<IPCResponse<ListMCPServersResponse>>;
    getServer: (request: GetMCPServerRequest) => Promise<IPCResponse<GetMCPServerResponse>>;
    installServer: (request: InstallMCPServerRequest) => Promise<IPCResponse<InstallMCPServerResponse>>;
    uninstallServer: (request: UninstallMCPServerRequest) => Promise<IPCResponse<UninstallMCPServerResponse>>;
    startServer: (request: StartMCPServerRequest) => Promise<IPCResponse<StartMCPServerResponse>>;
    stopServer: (request: StopMCPServerRequest) => Promise<IPCResponse<StopMCPServerResponse>>;
    discoverTools: (request: DiscoverMCPToolsRequest) => Promise<IPCResponse<DiscoverMCPToolsResponse>>;
    invokeTool: (request: InvokeMCPToolRequest) => Promise<IPCResponse<InvokeMCPToolResponse>>;
    listPermissions: (request: ListMCPPermissionsRequest) => Promise<IPCResponse<ListMCPPermissionsResponse>>;
    grantPermission: (request: GrantMCPPermissionRequest) => Promise<IPCResponse<GrantMCPPermissionResponse>>;
    revokePermission: (request: RevokeMCPPermissionRequest) => Promise<IPCResponse<RevokeMCPPermissionResponse>>;
    checkPermission: (request: CheckMCPPermissionRequest) => Promise<IPCResponse<CheckMCPPermissionResponse>>;
    onServerStarted: (callback: (event: MCPServerStartedEvent) => void) => () => void;
    onServerStopped: (callback: (event: MCPServerStoppedEvent) => void) => () => void;
    onServerError: (callback: (event: MCPServerErrorEvent) => void) => () => void;
    onToolInvoked: (callback: (event: MCPToolInvokedEvent) => void) => () => void;
    onPermissionGranted: (callback: (event: MCPPermissionGrantedEvent) => void) => () => void;
    onPermissionRevoked: (callback: (event: MCPPermissionRevokedEvent) => void) => () => void;
  };

  // Terminal
  terminal: {
    create: (request: CreateTerminalRequest) => Promise<IPCResponse<CreateTerminalResponse>>;
    input: (request: TerminalInputRequest) => Promise<IPCResponse<void>>;
    resize: (request: TerminalResizeRequest) => Promise<IPCResponse<void>>;
    kill: (terminalId: string) => Promise<IPCResponse<void>>;
    onData: (callback: (event: TerminalDataEvent) => void) => () => void;
    onExit: (callback: (event: TerminalExitEvent) => void) => () => void;
  };

  // Database
  db: {
    // Generic in the row type: callers pass the shape they expect back, which
    // is what makes `response.data.rows` typed instead of `any`.
    query: <TRow = unknown>(
      request: DBQueryRequest
    ) => Promise<IPCResponse<DBQueryResponse<TRow>>>;
    execute: (request: DBExecuteRequest) => Promise<IPCResponse<DBExecuteResponse>>;
  };

  // Automation
  automation: {
    create: (request: CreateAutomationRequest) => Promise<IPCResponse<CreateAutomationResponse>>;
    update: (request: UpdateAutomationRequest) => Promise<IPCResponse<UpdateAutomationResponse>>;
    delete: (request: DeleteAutomationRequest) => Promise<IPCResponse<DeleteAutomationResponse>>;
    list: (request: ListAutomationsRequest) => Promise<IPCResponse<ListAutomationsResponse>>;
    get: (request: GetAutomationRequest) => Promise<IPCResponse<GetAutomationResponse>>;
    run: (request: RunAutomationRequest) => Promise<IPCResponse<RunAutomationResponse>>;
    toggle: (request: ToggleAutomationRequest) => Promise<IPCResponse<ToggleAutomationResponse>>;
    getLogs: (request: GetAutomationLogsRequest) => Promise<IPCResponse<GetAutomationLogsResponse>>;
    onStarted: (callback: (event: AutomationStartedEvent) => void) => () => void;
    onCompleted: (callback: (event: AutomationCompletedEvent) => void) => () => void;
    onFailed: (callback: (event: AutomationFailedEvent) => void) => () => void;
    onNotification: (callback: (event: AutomationNotificationEvent) => void) => () => void;
  };

  // Updates
  update: {
    check: () => Promise<{ success: boolean; error?: string }>;
    download: () => Promise<{ success: boolean; error?: string }>;
    install: () => Promise<{ success: boolean }>;
    onChecking: (callback: () => void) => () => void;
    onAvailable: (callback: (info: UpdateInfo) => void) => () => void;
    onNotAvailable: (callback: (info: { version: string }) => void) => () => void;
    onDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void;
    onDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
    onError: (callback: (error: { message: string }) => void) => () => void;
  };

  /**
   * Escape hatch for channels with no typed façade yet.
   *
   * `unknown` rather than `any`: callers must narrow the result, so a missing
   * façade cannot silently leak an untyped value through the whole renderer.
   */
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
}

// ============================================================================
// Update event payloads
//
// Mirror what `packages/main/src/updater.ts` sends on the `update:*` channels.
// ============================================================================

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseName?: string;
  releaseNotes?: string | { path: string; releaseDate: string; note: string | null }[] | null;
}

export interface UpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createEventListener<T>(channel: string): (callback: (event: T) => void) => () => void {
  return (callback: (event: T) => void) => {
    const listener = (_event: IpcRendererEvent, data: T) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

/**
 * Listener for channels emitted without a payload (e.g. `update:checking`).
 */
function createVoidEventListener(channel: string): (callback: () => void) => () => void {
  return (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

// ============================================================================
// Expose API
// ============================================================================

const cortexAPI: CortexAPI = {
  // Filesystem
  fs: {
    readFile: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, request),
    writeFile: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE_FILE, request),
    readDir: (request) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_DIR, request),
    watch: (path, watchId) => ipcRenderer.invoke(IPC_CHANNELS.FS_WATCH, { path, watchId }),
    unwatch: (watchId) => ipcRenderer.invoke(IPC_CHANNELS.FS_UNWATCH, watchId),
    onFileChange: createEventListener<FileChangeEvent>(IPC_CHANNELS.EVENT_FILE_CHANGE),
  },

  // Editor
  editor: {
    openFile: (request) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_OPEN_FILE, request),
    saveFile: (request) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_SAVE_FILE, request),
    format: (request) => ipcRenderer.invoke(IPC_CHANNELS.EDITOR_FORMAT, request),
  },

  // Git
  git: {
    status: (request) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STATUS, request),
    commit: (request) => ipcRenderer.invoke(IPC_CHANNELS.GIT_COMMIT, request),
    push: (request) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PUSH, request),
    pull: (request) => ipcRenderer.invoke(IPC_CHANNELS.GIT_PULL, request),
    diff: (request) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DIFF, request),
    stage: (request) => ipcRenderer.invoke(IPC_CHANNELS.GIT_STAGE, request),
    unstage: (request) => ipcRenderer.invoke(IPC_CHANNELS.GIT_UNSTAGE, request),
    discard: (request) => ipcRenderer.invoke(IPC_CHANNELS.GIT_DISCARD, request),
  },

  // AI
  ai: {
    createSession: (request) => ipcRenderer.invoke(IPC_CHANNELS.AI_CREATE_SESSION, request),
    sendMessage: (request) => ipcRenderer.invoke(IPC_CHANNELS.AI_SEND_MESSAGE, request),
    /**
     * Streams a response, invoking `onChunk` for each chunk until the stream
     * reports `done` or `error`.
     *
     * The main process broadcasts chunks on a per-session channel, so the
     * listener has to be attached *before* the invoke: a fast provider can
     * emit its first chunk before the invoke promise settles, and that chunk
     * would otherwise be dropped.
     *
     * Resolves when the stream finishes; rejects if it cannot be started or
     * ends in an error, which lets callers use ordinary try/catch.
     */
    streamResponse: (request, onChunk) => {
      const channel = `ai:stream:${request.sessionId}`;

      return new Promise<void>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          ipcRenderer.removeListener(channel, listener);
        };

        const listener = (_event: IpcRendererEvent, chunk: StreamChunk) => {
          onChunk(chunk);

          if (chunk.type === 'done') {
            settled = true;
            cleanup();
            resolve();
          } else if (chunk.type === 'error') {
            settled = true;
            cleanup();
            reject(new Error(chunk.error ?? 'AI stream failed'));
          }
        };

        ipcRenderer.on(channel, listener);

        ipcRenderer
          .invoke(IPC_CHANNELS.AI_STREAM_RESPONSE, request)
          .then((response: { success: boolean; error?: { message?: string } }) => {
            if (response?.success || settled) return;
            cleanup();
            reject(new Error(response?.error?.message ?? 'Could not start AI stream'));
          })
          .catch((error: unknown) => {
            if (settled) return;
            cleanup();
            reject(error);
          });
      });
    },
    stopStream: async (sessionId) => {
      await ipcRenderer.invoke(IPC_CHANNELS.AI_STOP_STREAM, sessionId);
    },
    resolvePermission: (request) => ipcRenderer.invoke(IPC_CHANNELS.AI_RESOLVE_PERMISSION, request),
  },

  mission: {
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.MISSION_LIST, request),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.MISSION_CREATE, request),
    start: (request) => ipcRenderer.invoke(IPC_CHANNELS.MISSION_START, request),
    pause: (request) => ipcRenderer.invoke(IPC_CHANNELS.MISSION_PAUSE, request),
    resume: (request) => ipcRenderer.invoke(IPC_CHANNELS.MISSION_RESUME, request),
  },

  cortex: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_GET_STATE),
    listModels: () => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_LIST_MODELS),
    deviceStart: () => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_DEVICE_START),
    deviceCancel: () => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_DEVICE_CANCEL),
    openVerification: () => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_OPEN_VERIFICATION),
    signOut: () => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_SIGN_OUT),
    listApiKeys: () => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_LIST_API_KEYS),
    createApiKey: (request) => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_CREATE_API_KEY, request),
    revokeApiKey: (request) => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_REVOKE_API_KEY, request),
    productRequest: (request) => ipcRenderer.invoke(IPC_CHANNELS.CORTEX_PRODUCT_REQUEST, request),
    onDeviceStatus: createEventListener<CortexDeviceStatusEvent>(
      IPC_CHANNELS.EVENT_CORTEX_DEVICE_STATUS,
    ),
    onAccountChanged: createEventListener<CortexAccountState>(
      IPC_CHANNELS.EVENT_CORTEX_ACCOUNT_CHANGED,
    ),
  },

  session: {
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST, request),
    get: (request) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_GET, request),
    start: (request) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_START, request),
    followUp: (request) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_FOLLOW_UP, request),
    stop: (request) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_STOP, request),
    archive: (request) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_ARCHIVE, request),
    remove: (request) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, request),
    resolvePermission: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_RESOLVE_PERMISSION, request),
    listRepositories: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST_REPOSITORIES),
    openWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_OPEN_WORKSPACE),
    onProgress: createEventListener<SessionProgressEvent>(IPC_CHANNELS.EVENT_SESSION_PROGRESS),
  },

  platform: () => process.platform,

  windowControls: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
    onMaximizedChange: createEventListener<WindowMaximizedEvent>(
      IPC_CHANNELS.EVENT_WINDOW_MAXIMIZED,
    ),
  },

  notify: {
    show: (request) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFY_SHOW, request),
  },

  chat: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.CHAT_LIST),
    get: (request) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_GET, request),
    start: (request) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_START, request),
    send: (request) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, request),
    stop: (request) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_STOP, request),
    remove: (request) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_DELETE, request),
    onProgress: createEventListener<ChatProgressEvent>(IPC_CHANNELS.EVENT_CHAT_PROGRESS),
  },

  settings: {
    getProviders: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_PROVIDERS),
    setProvider: (request) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_PROVIDER, request),
    getWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_WORKSPACE),
    setWorkspace: (request) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET_WORKSPACE, request),
  },

  secrets: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_LIST),
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_CREATE, request),
    remove: (request) => ipcRenderer.invoke(IPC_CHANNELS.SECRETS_DELETE, request),
  },

  // MCP
  mcp: {
    listServers: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_LIST_SERVERS, request),
    getServer: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_GET_SERVER, request),
    installServer: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_INSTALL_SERVER, request),
    uninstallServer: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_UNINSTALL_SERVER, request),
    startServer: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_START_SERVER, request),
    stopServer: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_STOP_SERVER, request),
    discoverTools: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_DISCOVER_TOOLS, request),
    invokeTool: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_INVOKE_TOOL, request),
    listPermissions: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_LIST_PERMISSIONS, request),
    grantPermission: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_GRANT_PERMISSION, request),
    revokePermission: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_REVOKE_PERMISSION, request),
    checkPermission: (request) => ipcRenderer.invoke(IPC_CHANNELS.MCP_CHECK_PERMISSION, request),
    // Bridged from MCPService EventEmitter events in mcp-handlers.ts
    // (`setupMCPEvents`). MCPExtensionList refreshes on start/stop/error.
    onServerStarted: createEventListener(IPC_CHANNELS.EVENT_MCP_SERVER_STARTED),
    onServerStopped: createEventListener(IPC_CHANNELS.EVENT_MCP_SERVER_STOPPED),
    onServerError: createEventListener(IPC_CHANNELS.EVENT_MCP_SERVER_ERROR),
    onToolInvoked: createEventListener(IPC_CHANNELS.EVENT_MCP_TOOL_INVOKED),
    onPermissionGranted: createEventListener(IPC_CHANNELS.EVENT_MCP_PERMISSION_GRANTED),
    onPermissionRevoked: createEventListener(IPC_CHANNELS.EVENT_MCP_PERMISSION_REVOKED),
  },

  // Terminal
  terminal: {
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_CREATE, request),
    input: (request) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_INPUT, request),
    resize: (request) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_RESIZE, request),
    kill: (terminalId) => ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_KILL, terminalId),
    onData: createEventListener<TerminalDataEvent>(IPC_CHANNELS.EVENT_TERMINAL_DATA),
    onExit: createEventListener<TerminalExitEvent>(IPC_CHANNELS.EVENT_TERMINAL_EXIT),
  },

  // Database
  db: {
    query: (request) => ipcRenderer.invoke(IPC_CHANNELS.DB_QUERY, request),
    execute: (request) => ipcRenderer.invoke(IPC_CHANNELS.DB_EXECUTE, request),
  },

  // Automation
  automation: {
    create: (request) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_CREATE, request),
    update: (request) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_UPDATE, request),
    delete: (request) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_DELETE, request),
    list: (request) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_LIST, request),
    get: (request) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_GET, request),
    run: (request) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_RUN, request),
    toggle: (request) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_TOGGLE, request),
    getLogs: (request) => ipcRenderer.invoke(IPC_CHANNELS.AUTOMATION_GET_LOGS, request),
    onStarted: createEventListener(IPC_CHANNELS.EVENT_AUTOMATION_STARTED),
    onCompleted: createEventListener(IPC_CHANNELS.EVENT_AUTOMATION_COMPLETED),
    onFailed: createEventListener(IPC_CHANNELS.EVENT_AUTOMATION_FAILED),
    onNotification: createEventListener(IPC_CHANNELS.EVENT_NOTIFICATION),
  },

  // Updates
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onChecking: createVoidEventListener('update:checking'),
    onAvailable: createEventListener<UpdateInfo>('update:available'),
    onNotAvailable: createEventListener<{ version: string }>('update:not-available'),
    onDownloadProgress: createEventListener<UpdateDownloadProgress>('update:download-progress'),
    onDownloaded: createEventListener<UpdateInfo>('update:downloaded'),
    onError: createEventListener<{ message: string }>('update:error'),
  },

  // Generic invoke for extensions.
  //
  // Restricted to the same allowlist as `window.electron.invoke` (defined
  // below; the function declaration is hoisted, and it is only *called* at
  // runtime). It has no consumer in the renderer today, so leaving it as an open
  // forwarder would have kept a second unrestricted door onto every registered
  // handler after the first one was closed.
  invoke: (channel: string, ...args: unknown[]) => invokeAllowedChannel(channel, ...args),
};

// ============================================================================
// `window.ipc` — channel-oriented bridge
//
// Used by the panels whose main-process domains have no `cortex` façade yet
// (git stash, advanced search, workspaces, chat export, terminals). It was
// referenced by seven renderer components but never exposed here, so every one
// of them threw `Cannot read properties of undefined (reading 'invoke')`.
//
// Restricted to an explicit allowlist rather than forwarding any channel: the
// renderer is the least-trusted process, and an open `invoke` would let any
// injected script reach every registered main-process handler.
// ============================================================================

const IPC_ALLOWED_CHANNELS = [
  'git:stash-list',
  'git:stash-show',
  'git:stash-save',
  'git:stash-apply',
  'git:stash-pop',
  'git:stash-drop',
  'git:stash-branch',
  'search:find',
  'search:replace',
  'search:get-history',
  'workspace:list',
  'workspace:switch',
  'workspace:add',
  'workspace:remove',
  'workspace:open-dialog',
  'chat:export',
  'editor:open-file',
  'terminal:create',
  'terminal:input',
  'terminal:resize',
  'terminal:kill',
  // Lets TerminalGrid reattach to the PTYs still running in main after its view
  // was unmounted. Without it the renderer forgot its terminals and never sent
  // `terminal:kill`, leaking one shell process per terminal created.
  'terminal:list',
  // Réglages des providers AI. `settings:set-provider` transporte la clé d'API
  // en clair du renderer vers main : c'est le seul sens autorisé, et
  // `settings:get-providers` ne renvoie que des clés masquées. Un canal absent
  // de cette liste est rejeté par le bridge, donc l'omettre rendrait le bouton
  // Save inopérant à l'exécution sans erreur de compilation.
  //
  // Ajoutés ici et pas à `ELECTRON_ALLOWED_CHANNELS` : rien sur le bridge
  // `electron` n'en a besoin, et les deux listes restent indépendantes.
  'settings:get-providers',
  'settings:set-provider',
  'mission:list',
  'mission:create',
  'mission:start',
  'mission:pause',
  'mission:resume',
] as const;

const IPC_ALLOWED_EVENT_CHANNELS = [
  IPC_CHANNELS.EVENT_TERMINAL_DATA,
  IPC_CHANNELS.EVENT_TERMINAL_EXIT,
  // NOTE (verified 2026-08-17): `fs:watch` / `fs:unwatch` have no handler in
  // main and nothing there emits `event:file-change` — `chokidar` is imported
  // only by `automation-service.ts`, for automation triggers. A renderer
  // subscribing to this event never receives anything. Kept listed so the
  // channel is reachable the moment a watcher is wired up in main; treat it as
  // not-yet-implemented, not as working.
  IPC_CHANNELS.EVENT_FILE_CHANGE,
  // `workspace-handlers.ts` DOES relay WorkspaceManager's internal
  // 'workspace-switched' EventEmitter event to every window as
  // `event:workspace-switched` (see the `switchedListener` registered in
  // `manager()`), so the emitter side is real — same as the `event:mcp-*`
  // family, which `setupMCPEvents` now forwards from MCPService.
  //
  // But (verified 2026-08-17) the only renderer subscriber is
  // `components/workspace/WorkspaceSwitcher.tsx`, which no file imports and
  // which does not appear in the production bundle. So at runtime this event is
  // emitted to nobody.
  'event:workspace-switched',
] as const;

const ipcAllowedChannels: ReadonlySet<string> = new Set(IPC_ALLOWED_CHANNELS);
const ipcAllowedEventChannels: ReadonlySet<string> = new Set(IPC_ALLOWED_EVENT_CHANNELS);

// ============================================================================
// `window.electron.invoke` — allowlist
//
// Same posture as `window.ipc` above, and for the same reason: this bridge used
// to forward *any* channel to `ipcRenderer.invoke`, which handed the renderer
// every registered main-process handler — filesystem, database, Git — and the
// renderer is the least-trusted process (it renders remote content, including
// through a `<webview>`).
//
// The list is the inventory of what actually calls `window.electron.invoke`:
//
//   1. the `debug:*` family (12 channels), consumed by DebugPanel and its
//      sub-panels, which have no typed façade;
//   2. the channels reachable through `renderer/src/lib/ipc.ts`, whose generic
//      `invoke()` helper routes its typed façade through this same bridge.
//
// Group 2 grants no capability that is not already exposed by `window.cortex`
// (`cortex.fs.readFile` and `ipc.fs.readFile` hit the identical channel), so
// allowing it closes the open forwarding without widening the surface.
// ============================================================================

const ELECTRON_ALLOWED_CHANNELS = [
  // --- debug panel (no typed façade) ---
  'debug:get-settings',
  'debug:update-settings',
  'debug:get-logs',
  'debug:clear-logs',
  'debug:get-metrics',
  'debug:clear-metrics',
  'debug:get-memory',
  'debug:get-ipc-messages',
  'debug:get-ipc-stats',
  'debug:clear-ipc',
  'debug:export-logs',
  'debug:get-system-info',

  // --- reached through `renderer/src/lib/ipc.ts` ---
  IPC_CHANNELS.FS_READ_FILE,
  IPC_CHANNELS.FS_WRITE_FILE,
  IPC_CHANNELS.FS_READ_DIR,
  IPC_CHANNELS.EDITOR_OPEN_FILE,
  IPC_CHANNELS.EDITOR_SAVE_FILE,
  IPC_CHANNELS.EDITOR_FORMAT,
  IPC_CHANNELS.GIT_STATUS,
  IPC_CHANNELS.GIT_COMMIT,
  IPC_CHANNELS.GIT_PUSH,
  IPC_CHANNELS.GIT_PULL,
  IPC_CHANNELS.GIT_DIFF,
  // Staging, consommé par GitPanel via `renderer/src/lib/ipc.ts`. Un canal
  // absent de cette liste est rejeté par le bridge, donc l'omettre rendrait le
  // staging inopérant à l'exécution sans erreur de compilation.
  IPC_CHANNELS.GIT_STAGE,
  IPC_CHANNELS.GIT_UNSTAGE,
  // Discard, consommé par GitPanel. Destructif, donc allowlisté au même titre
  // que les autres : l'omettre ne produirait pas d'erreur de compilation mais
  // ferait échouer chaque discard à l'exécution sur `IPC channel not allowed`.
  IPC_CHANNELS.GIT_DISCARD,
  IPC_CHANNELS.AI_CREATE_SESSION,
  IPC_CHANNELS.AI_SEND_MESSAGE,
  IPC_CHANNELS.TERMINAL_CREATE,
  IPC_CHANNELS.TERMINAL_INPUT,
  IPC_CHANNELS.TERMINAL_RESIZE,
  IPC_CHANNELS.DB_QUERY,
  IPC_CHANNELS.DB_EXECUTE,
] as const;

const electronAllowedChannels: ReadonlySet<string> = new Set(ELECTRON_ALLOWED_CHANNELS);

/**
 * Forwards to `ipcRenderer.invoke` only for allowlisted channels.
 *
 * Rejects rather than throws synchronously: every caller already awaits this
 * (and the `debug:*` panels each have a `try/catch`), so a rejected promise is
 * handled by existing code paths instead of crashing the calling component.
 *
 * Spreads `...args`: `debug:get-metrics` is invoked as
 * `(channel, category, limit)`, so a single-payload signature would silently
 * drop the limit.
 */
function invokeAllowedChannel(channel: string, ...args: unknown[]): Promise<unknown> {
  if (!electronAllowedChannels.has(channel)) {
    return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

const ipcBridge = {
  invoke: (channel: string, data?: unknown) => {
    if (!ipcAllowedChannels.has(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, data);
  },
  on: (channel: string, callback: (data: unknown) => void) => {
    if (!ipcAllowedEventChannels.has(channel)) {
      throw new Error(`IPC event channel not allowed: ${channel}`);
    }
    const listener = (_event: IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

// Expose l'API au renderer process
contextBridge.exposeInMainWorld('cortex', cortexAPI);
contextBridge.exposeInMainWorld('ipc', ipcBridge);
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: unknown[]) => invokeAllowedChannel(channel, ...args),
});

// Type declaration pour TypeScript
declare global {
  interface Window {
    cortex: CortexAPI;
    electron: {
      /**
       * Bridge for channels with no typed façade (the `debug:*` family) and for
       * `renderer/src/lib/ipc.ts`. Generic in the result and defaulting to
       * `unknown`, so callers state the shape they expect instead of silently
       * receiving `any`.
       *
       * Restricted to `ELECTRON_ALLOWED_CHANNELS`: any other channel rejects
       * with `IPC channel not allowed: <channel>`.
       */
      invoke: <TResult = unknown>(channel: string, ...args: unknown[]) => Promise<TResult>;
    };
  }
}
