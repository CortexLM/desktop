/**
 * Client for the Cortex API at https://api.cortex.foundation.
 *
 * The contract was established by probing the live service; see CONTRACT.md for exactly
 * what was observed and what remains unverified.
 */

export {
  CORTEX_API_BASE_URL,
  CortexApiClient,
  SESSION_COOKIE_NAME,
  type CortexApiClientOptions,
  type CortexCredentials,
  type RequestOptions,
} from './client.ts';

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
  modelAvailability,
  modelLabel,
  type Capabilities,
  type ModelAvailability,
  type ModelLockReason,
  type RuntimeKind,
} from './capabilities.ts';

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
