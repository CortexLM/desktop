/**
 * Channel contract for the `window.ipc` bridge.
 *
 * Distinct from `window.cortex` (see `packages/preload/src/index.ts`), which
 * exposes one method per domain. `window.ipc` stays channel-oriented and is
 * used by the panels whose main-process domains have no `cortex` façade yet
 * (git stash, advanced search, workspaces, chat export, terminals).
 *
 * `invoke` is typed per channel through `IPCChannelMap` rather than returning
 * `unknown`: callers already branch on `response.success` and read
 * `response.data.<field>`, and an `unknown` return silently pushed that whole
 * contract outside the type checker.
 */

import type {
  GetProviderSettingsResponse,
  IPCResponse,
  SetProviderRequest,
  SetProviderResponse,
  Workspace,
} from '@cortex-ide/shared';

// ============================================================================
// Payload shapes
// ============================================================================

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

export interface SearchMatch {
  line: number;
  column: number;
  length: number;
  text: string;
  beforeContext?: string[];
  afterContext?: string[];
}

export interface SearchResult {
  filePath: string;
  matches: SearchMatch[];
  totalMatches: number;
}

export interface ReplaceResult {
  filePath: string;
  replacements: number;
  preview?: string;
}

// `Workspace` is imported at the top of this file from `@cortex-ide/shared`
// and re-exported here, so the panels that type their state as `Workspace`
// line up with what the channel returns.
export type { Workspace };

/**
 * Maps each channel to its request payload and the `data` of its response.
 *
 * Kept in sync by hand with the main-process handlers; a channel missing from
 * here is a compile error at the call site rather than a silent `any`.
 */
export interface IPCChannelMap {
  // Git stash
  'git:stash-list': {
    request: { repoPath: string };
    response: { stashes: StashEntry[] };
  };
  'git:stash-show': {
    request: { repoPath: string; stashIndex: number };
    response: { diff: StashDiff };
  };
  'git:stash-save': {
    request: {
      repoPath: string;
      message?: string;
      includeUntracked?: boolean;
      keepIndex?: boolean;
    };
    response: Record<string, never>;
  };
  'git:stash-apply': {
    request: { repoPath: string; stashIndex: number };
    response: Record<string, never>;
  };
  'git:stash-pop': {
    request: { repoPath: string; stashIndex: number };
    response: Record<string, never>;
  };
  'git:stash-drop': {
    request: { repoPath: string; stashIndex: number };
    response: Record<string, never>;
  };
  'git:stash-branch': {
    request: { repoPath: string; branchName: string; stashIndex: number };
    response: Record<string, never>;
  };

  // Advanced search
  'search:find': {
    request: {
      rootPath: string;
      query: string;
      useRegex?: boolean;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      includePatterns?: string[];
      excludePatterns?: string[];
      maxResults?: number;
      contextLines?: number;
    };
    response: { results: SearchResult[] };
  };
  'search:replace': {
    request: {
      rootPath: string;
      query: string;
      replacement: string;
      useRegex?: boolean;
      caseSensitive?: boolean;
      wholeWord?: boolean;
      includePatterns?: string[];
      excludePatterns?: string[];
      dryRun?: boolean;
    };
    response: { results: ReplaceResult[] };
  };
  'search:get-history': {
    request: undefined;
    response: { history: string[] };
  };

  // Workspaces
  'workspace:list': {
    request: undefined;
    // `activeId` is the id, not the entity: consumers that need the active
    // workspace object resolve it from `workspaces`.
    response: { workspaces: Workspace[]; activeId: string | null };
  };
  'workspace:switch': {
    request: { workspaceId: string };
    response: Record<string, never>;
  };
  'workspace:add': {
    request: { path: string; name?: string };
    response: { workspace: Workspace };
  };
  'workspace:remove': {
    request: { workspaceId: string };
    response: Record<string, never>;
  };
  'workspace:open-dialog': {
    request: undefined;
    // `path` is absent when the user cancels the native dialog
    response: { path?: string };
  };

  // Chat export
  'chat:export': {
    request: {
      sessionId: string;
      format: 'markdown' | 'json' | 'html' | 'text';
      includeMetadata?: boolean;
      includeTimestamps?: boolean;
      prettify?: boolean;
    };
    response: { content: string; filename: string; size: number };
  };

  // Editor
  // Field names match the canonical `OpenFileRequest` in
  // `@cortex-ide/shared` (`path`, not `filePath`).
  'editor:open-file': {
    request: { path: string; line?: number; workspaceId?: string };
    response: Record<string, never>;
  };

  // Terminals
  'terminal:create': {
    request: { cwd?: string };
    response: { terminalId: string };
  };
  'terminal:input': {
    request: { terminalId: string; data: string };
    response: Record<string, never>;
  };
  'terminal:resize': {
    request: { terminalId: string; cols: number; rows: number };
    response: Record<string, never>;
  };
  'terminal:kill': {
    request: string;
    response: Record<string, never>;
  };
  /**
   * The PTYs currently alive in the main process.
   *
   * `TerminalGrid` calls this on mount to reattach: the view is unmounted on
   * every switch away from Terminal, and without this the renderer forgot its
   * terminals and never killed them — one leaked shell process per terminal.
   * Main is the source of truth because it owns the processes.
   */
  'terminal:list': {
    request: undefined;
    response: { terminals: Array<{ id: string; pid: number; cwd: string; shell: string }> };
  };

  // ==========================================================================
  // Provider settings
  //
  // Asymétrie voulue : `set-provider` envoie la clé en clair vers main,
  // `get-providers` ne renvoie que `maskedApiKey`. `ProviderSettingsView` n'a
  // délibérément pas de champ `apiKey`, donc un composant qui tenterait de lire
  // la clé depuis la réponse ne compile pas.
  // ==========================================================================
  'settings:get-providers': {
    request: undefined;
    response: GetProviderSettingsResponse;
  };
  'settings:set-provider': {
    request: SetProviderRequest;
    response: SetProviderResponse;
  };

  'ai:list-checkpoints': {
    request: undefined;
    response: { checkpoints: Array<{ id: string; label: string; createdAt: number }> };
  };
  'ai:restore-checkpoint': {
    request: { sessionId: string; checkpointId: string };
    response: { checkpointId: string };
  };
  'mission:list': {
    request: { workspaceId?: string };
    response: { missions: Array<{ id: string; name: string; status: string }> };
  };
}

export type IPCChannel = keyof IPCChannelMap;

export interface IPCApi {
  /**
   * Invokes a main-process handler.
   *
   * Overloaded on whether the channel takes a payload, so no-payload channels
   * (`workspace:list`, `search:get-history`, ...) can be called with one arg.
   */
  invoke<C extends IPCChannel>(
    channel: C,
    data: IPCChannelMap[C]['request']
  ): Promise<IPCResponse<IPCChannelMap[C]['response']>>;
  invoke<C extends IPCChannel>(
    channel: C
  ): Promise<IPCResponse<IPCChannelMap[C]['response']>>;

  /** Subscribes to a push channel. Returns an unsubscribe function. */
  on(channel: string, callback: (data: unknown) => void): () => void;
}
