/**
 * Client for the Cortex API at https://api.cortex.foundation.
 *
 * The contract was established by probing the live service; see CONTRACT.md for exactly
 * what was observed and what remains unverified.
 */

export {
  CORTEX_API_BASE_URL,
  CortexApiClient,
  GUEST_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  type CortexApiClientOptions,
  type CortexCredentials,
  type RequestOptions,
} from './client.ts';

export { guestTokenFromSetCookie } from './cookies.ts';

export {
  createProject,
  deleteConversation,
  listConversationMessages,
  listConversations,
  listProjects,
  startGuestSession,
  streamConversationTurn,
  type StreamTurnRequest,
} from './product.ts';

export type {
  ApiConversation,
  ApiConversationMessage,
  ApiProject,
  GuestSession,
  Quota,
  TurnEvent,
} from './product-schemas.ts';

export {
  createMascot,
  createVncTicket,
  deleteMascot,
  heartbeatCodeHost,
  listMascotVideos,
  markNotificationRead,
  pairCodeHost,
  postScheduledResult,
} from './control-plane.ts';

export {
  getMascot,
  listMascots,
  listMascotMessages,
  patchMascot,
  postAskUser,
  postMascotMessage,
  postRespond,
  postSecret,
} from './bot-mascots.ts';

export {
  getComputer,
  getCursor,
  getScreenshot,
  listComputerFs,
  postComputerInput,
  postLifecycle,
  postRecord,
  postShell,
  readComputerFile,
  type ComputerInput,
  type ComputerInputAction,
  type LifecycleAction,
} from './bot-computer.ts';

export {
  addMemory,
  createBotTask,
  createRoutine,
  createSkill,
  DEFAULT_ROUTINE_CRON,
  deleteRoutine,
  deleteSkill,
  forgetMemory,
  getBotTask,
  getSkill,
  listBotGroups,
  listBotInbox,
  listMemory,
  listRoutines,
  listSkills,
  pauseRoutine,
  postBotInbox,
  postHandoff,
  postTeach,
  resumeRoutine,
  runSkill,
} from './bot-runtime.ts';

export {
  connectPlugin,
  disconnectPlugin,
  getPluginCatalog,
  listPluginConnections,
  listPlugins,
  setPluginSurfaces,
} from './bot-plugins.ts';

export { PLUGIN_SURFACES } from './bot-runtime-schemas.ts';

export {
  BACKEND_TOO_OLD,
  backendTooOldCopy,
  classifyBotError,
  farmOfflineCopy,
  isAccountRequired,
  isNotFound,
  isServiceUnavailable,
  PLUGIN_UNAVAILABLE,
} from './bot-errors.ts';

export {
  createHttpProductSurface,
  type ProductSurface,
} from './pending.ts';

export { listItems } from './lists.ts';

export {
  archiveCodeSession,
  createCodeSession,
  deleteCodeSession,
  followUpCodeSession,
  getCodeSession,
  getCodeUsage,
  listCodeRepositories,
  resolveCodePermission,
  stopCodeSession,
} from './code-control.ts';

export {
  createCodeAutomation,
  createCodeSecret,
  createCodeSshRuntime,
  createCodeTicket,
  deleteCodeAutomation,
  deleteCodeSecret,
  deleteCodeSshRuntime,
  deleteCodeTicket,
  getCodeSettings,
  getCodeTicket,
  listCodeAutomationLogs,
  listCodeAutomations,
  listCodeProviders,
  listCodeSecrets,
  listCodeSshRuntimes,
  listCodeTickets,
  patchCodeAutomation,
  patchCodeTicket,
  putCodeProvider,
  putCodeSettings,
  runCodeAutomation,
  unpairCodeHost,
} from './code-config.ts';

export type {
  ApiCodeAutomation,
  ApiCodeAutomationLog,
  ApiCodeFileChange,
  ApiCodePermissionRequest,
  ApiCodeProvider,
  ApiCodePullRequest,
  ApiCodeRepository,
  ApiCodeSecret,
  ApiCodeSessionDetail,
  ApiCodeSettings,
  ApiCodeSshRuntime,
  ApiCodeTicket,
  ApiCodeTimelineEntry,
  ApiCodeUsage,
} from './code-control-schemas.ts';

export {
  createLibraryItem,
  createPlanningTask,
  createProjectSource,
  createResearchTask,
  deleteLibraryItem,
  deletePlanningTask,
  deleteProject,
  deleteProjectSource,
  getChatPreferences,
  getProject,
  listLibraryItems,
  listPlanningRuns,
  listPlanningTasks,
  listProjectSources,
  listResearchTasks,
  patchPlanningTask,
  patchProject,
  putChatPreferences,
  runPlanningTask,
} from './chat-surface.ts';

export type {
  ApiChatPreferences,
  ApiLibraryItemDetail,
  ApiPlanningRun,
  ApiProjectDetail,
  ApiProjectSource,
  ApiResearchTask,
} from './chat-surface-schemas.ts';

export type {
  ApiCodeHost,
  ApiCodeSession,
  ApiLibraryItem,
  ApiMascot,
  ApiMascotVideo,
  ApiNotification,
  ApiPlanningTask,
  ApiPlugin,
  HostHeartbeat,
  HostPairing,
  ScheduledResult,
  VncTicket,
} from './pending-schemas.ts';

export type {
  ApiBotMessage,
  ApiComputer,
  ApiComputerStatus,
  ApiCursor,
  ApiFilePreview,
  ApiFsEntry,
  ApiScreenshot,
  ApiShellResult,
} from './bot-schemas.ts';

export type {
  ApiBotGroup,
  ApiBotInboxItem,
  ApiBotTask,
  ApiMemoryFact,
  ApiPluginCatalog,
  ApiPluginCatalogEntry,
  ApiPluginConnection,
  ApiRoutine,
  ApiSkill,
  ApiSkillRun,
  MemoryTier,
  PluginSurface,
} from './bot-runtime-schemas.ts';

export {
  CONNECTION_LOCAL_TYPES,
  createRealtimeSse,
  createRealtimeSocket,
  createStreamTransport,
  eventFromTurnFrame,
  isConnectionLocalType,
  parseRoom,
  REALTIME_EVENTS_PATH,
  REALTIME_PATH,
  realtimeUrl,
  roomName,
  type RealtimeClient,
  type RealtimeEvent,
  type RealtimeRoom,
  type RealtimeRoomKind,
  type RealtimeStatus,
  type StreamChannel,
  type StreamTransport,
} from './realtime/index.ts';

export {
  authorizeDevice,
  DeviceFlowAbortedError,
  pollDeviceToken,
  type DeviceFlowState,
  type PollDeviceTokenOptions,
} from './device-flow.ts';

export {
  CortexApiError,
  CortexDeviceFlowError,
  DEVICE_FLOW_ERRORS,
  isCortexApiError,
  isCortexDeviceFlowError,
  isDeviceFlowErrorCode,
  type DeviceFlowErrorCode,
} from './errors.ts';

export {
  annotateCatalogue,
  ANONYMOUS_CAPABILITIES,
  AUTHENTICATED_CAPABILITIES,
  canUseRuntime,
  capabilitiesFor,
  capabilitiesOn,
  runtimesOn,
  modelAvailability,
  modelLabel,
  type AppSurface,
  type Capabilities,
  type ModelAvailability,
  type ModelLockReason,
  type RuntimeKind,
} from './capabilities.ts';

export {
  PROVIDER_CATALOG,
  providerById,
  type CatalogAuthKind,
  type ProviderCatalogEntry,
} from './provider-catalog.ts';

export type {
  ChatCompletion,
  ChatCompletionRequest,
  ChatMessage,
  CortexModel,
  CortexUser,
  DeviceCode,
  DeviceToken,
  Health,
  ModelList,
  Organization,
  UpstreamProvider,
} from './schemas.ts';
