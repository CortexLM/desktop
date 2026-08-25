/**
 * Noms des canaux IPC.
 *
 * Source de vérité partagée entre le process main (enregistrement des
 * handlers) et le preload (exposition au renderer).
 */

export const IPC_CHANNELS = {
  // Filesystem
  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_READ_DIR: 'fs:read-dir',
  FS_WATCH: 'fs:watch',
  FS_UNWATCH: 'fs:unwatch',

  // Editor
  EDITOR_OPEN_FILE: 'editor:open-file',
  EDITOR_SAVE_FILE: 'editor:save-file',
  EDITOR_FORMAT: 'editor:format',

  // Git
  GIT_STATUS: 'git:status',
  GIT_COMMIT: 'git:commit',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_DIFF: 'git:diff',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_DISCARD: 'git:discard',

  // AI
  AI_CREATE_SESSION: 'ai:create-session',
  AI_SEND_MESSAGE: 'ai:send-message',
  AI_STREAM_RESPONSE: 'ai:stream-response',
  AI_STOP_STREAM: 'ai:stop-stream',
  AI_RESOLVE_PERMISSION: 'ai:resolve-permission',
  AI_LIST_CHECKPOINTS: 'ai:list-checkpoints',
  AI_RESTORE_CHECKPOINT: 'ai:restore-checkpoint',
  MISSION_LIST: 'mission:list',
  MISSION_CREATE: 'mission:create',
  MISSION_START: 'mission:start',
  MISSION_PAUSE: 'mission:pause',
  MISSION_RESUME: 'mission:resume',

  // MCP
  MCP_LIST_SERVERS: 'mcp:list-servers',
  MCP_GET_SERVER: 'mcp:get-server',
  MCP_INSTALL_SERVER: 'mcp:install-server',
  MCP_UNINSTALL_SERVER: 'mcp:uninstall-server',
  MCP_START_SERVER: 'mcp:start-server',
  MCP_STOP_SERVER: 'mcp:stop-server',
  MCP_DISCOVER_TOOLS: 'mcp:discover-tools',
  MCP_INVOKE_TOOL: 'mcp:invoke-tool',
  MCP_LIST_PERMISSIONS: 'mcp:list-permissions',
  MCP_GRANT_PERMISSION: 'mcp:grant-permission',
  MCP_REVOKE_PERMISSION: 'mcp:revoke-permission',
  MCP_CHECK_PERMISSION: 'mcp:check-permission',

  // Terminal
  TERMINAL_CREATE: 'terminal:create',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_KILL: 'terminal:kill',

  // Database
  DB_QUERY: 'db:query',
  DB_EXECUTE: 'db:execute',

  // Automations
  AUTOMATION_CREATE: 'automation:create',
  AUTOMATION_UPDATE: 'automation:update',
  AUTOMATION_DELETE: 'automation:delete',
  AUTOMATION_LIST: 'automation:list',
  AUTOMATION_GET: 'automation:get',
  AUTOMATION_RUN: 'automation:run',
  AUTOMATION_TOGGLE: 'automation:toggle',
  AUTOMATION_GET_LOGS: 'automation:get-logs',

  // Settings — réglages de providers AI.
  //
  // Le pont qui manquait : `SettingsView` écrivait dans
  // `localStorage['cortex:settings']` et `AIService` ne lisait que
  // `AIProviderRegistry.fromEnv()`. Aucun canal ne reliait les deux, donc
  // saisir une clé et l'enregistrer n'avait aucun effet sur le service.
  //
  // `SETTINGS_SET_PROVIDER` transporte la clé en clair du renderer vers main.
  // C'est le seul sens autorisé : `SETTINGS_GET_PROVIDERS` ne renvoie que des
  // clés masquées (cf. `types/ipc/settings.ts`).
  SETTINGS_GET_PROVIDERS: 'settings:get-providers',
  SETTINGS_SET_PROVIDER: 'settings:set-provider',
  // Défauts et permissions appliqués à chaque exécution. Persistés dans
  // `app_state` : ce sont les préférences de la personne, pas du dossier.
  SETTINGS_GET_WORKSPACE: 'settings:get-workspace',
  SETTINGS_SET_WORKSPACE: 'settings:set-workspace',

  // Compte Cortex — cf. `types/ipc/cortex.ts` pour le contrat.
  //
  // Ces canaux existent parce que le renderer, chargé depuis `file://`, ne peut
  // pas appeler l'API lui-même : son origine est opaque et le contrôle CORS
  // rejette la requête avant l'envoi. Le flux d'appareil est mené dans main de
  // bout en bout, donc il n'y a pas de canal « poll » : le renderer démarre,
  // puis écoute `EVENT_CORTEX_DEVICE_STATUS`.
  CORTEX_GET_STATE: 'cortex:get-state',
  CORTEX_LIST_MODELS: 'cortex:list-models',
  CORTEX_DEVICE_START: 'cortex:device-start',
  CORTEX_DEVICE_CANCEL: 'cortex:device-cancel',
  // Ouvre la page d'approbation dans le navigateur système. Ne prend pas d'URL :
  // main connaît celle du flux qu'il a lui-même démarré. Un canal « ouvre cette
  // URL » aurait fait du renderer la source d'une URL à ouvrir hors de l'app —
  // il n'y a rien à valider si rien n'est transmis.
  CORTEX_OPEN_VERIFICATION: 'cortex:open-verification',
  CORTEX_SIGN_OUT: 'cortex:sign-out',

  // Sessions (« runs ») — cf. `types/ipc/session.ts`.
  //
  // Distinct de `ai:*`, qui transporte une conversation. Ce domaine transporte
  // une exécution : un état que l'inbox trie, un dépôt, une statistique de diff
  // et une chronologie où un appel d'outil est une entrée à part entière. Il
  // s'appuie sur l'orchestrateur d'`ai` au lieu de le dupliquer.
  SESSION_LIST: 'session:list',
  SESSION_GET: 'session:get',
  SESSION_START: 'session:start',
  SESSION_FOLLOW_UP: 'session:follow-up',
  SESSION_STOP: 'session:stop',
  SESSION_ARCHIVE: 'session:archive',
  SESSION_DELETE: 'session:delete',
  SESSION_RESOLVE_PERMISSION: 'session:resolve-permission',
  SESSION_LIST_REPOSITORIES: 'session:list-repositories',
  // Ouvre le sélecteur de dossier natif et enregistre le résultat comme espace de
  // travail actif. Deux étapes en un canal : le renderer n'a aucun usage d'un
  // chemin disque, et lui en faire faire l'aller-retour ne servirait qu'à le lui
  // faire traverser.
  SESSION_OPEN_WORKSPACE: 'session:open-workspace',

  // Events (main -> renderer)
  EVENT_FILE_CHANGE: 'event:file-change',
  EVENT_TERMINAL_DATA: 'event:terminal-data',
  EVENT_TERMINAL_EXIT: 'event:terminal-exit',
  EVENT_PROGRESS: 'event:progress',
  EVENT_AUTOMATION_STARTED: 'event:automation-started',
  EVENT_AUTOMATION_COMPLETED: 'event:automation-completed',
  EVENT_AUTOMATION_FAILED: 'event:automation-failed',
  EVENT_NOTIFICATION: 'event:notification',
  EVENT_MCP_SERVER_STARTED: 'event:mcp-server-started',
  EVENT_MCP_SERVER_STOPPED: 'event:mcp-server-stopped',
  EVENT_MCP_SERVER_ERROR: 'event:mcp-server-error',
  EVENT_MCP_TOOL_INVOKED: 'event:mcp-tool-invoked',
  EVENT_MCP_PERMISSION_GRANTED: 'event:mcp-permission-granted',
  EVENT_MCP_PERMISSION_REVOKED: 'event:mcp-permission-revoked',
  EVENT_CORTEX_DEVICE_STATUS: 'event:cortex-device-status',
  EVENT_CORTEX_ACCOUNT_CHANGED: 'event:cortex-account-changed',
  EVENT_SESSION_PROGRESS: 'event:session-progress',
} as const;

export type IPCChannelName = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
