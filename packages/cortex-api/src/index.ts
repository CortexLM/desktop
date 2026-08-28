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
  createMockRealtime,
  createRealtimeSocket,
  createStreamTransport,
  eventFromTurnFrame,
  REALTIME_PATH,
  realtimeUrl,
  type RealtimeClient,
  type RealtimeEvent,
  type RealtimeStatus,
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
