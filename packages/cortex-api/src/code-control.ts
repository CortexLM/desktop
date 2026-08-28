/**
 * The Code control plane over HTTP.
 *
 * This is what makes Code usable from a browser. The desktop app runs the agent
 * loop, the PTY and SQLite in its main process; a browser tab cannot, so every
 * Code surface that used to be Electron-only needs a route here instead. Runs
 * execute on Cloud or on a paired host that is already running Cortex Code —
 * never in the tab.
 *
 * Sessions stream over `/v1/realtime`; these are the request/response halves:
 * reading a session's timeline, listing repositories, and the settings, secrets,
 * automations, tickets and usage the workbench is configured with.
 *
 * The public deployment answered 404 for all of it when this was written. That
 * is why callers get `not_found` rather than an empty list — an account with no
 * secrets and a backend with no secrets route are different facts, and the UI
 * says different things about them.
 */

import type { CortexApiClient } from './client.ts';
import { listItems } from './lists.ts';
import { unknownSchema } from './schemas.ts';
import {
  codeAutomationListSchema,
  codeAutomationLogListSchema,
  codeAutomationLogSchema,
  codeAutomationSchema,
  codeProviderListSchema,
  codeProviderSchema,
  codeRepositoryListSchema,
  codeSecretListSchema,
  codeSecretSchema,
  codeSessionDetailSchema,
  codeSettingsSchema,
  codeSshRuntimeListSchema,
  codeSshRuntimeSchema,
  codeTicketListSchema,
  codeTicketSchema,
  codeUsageSchema,
  type ApiCodeAutomation,
  type ApiCodeAutomationLog,
  type ApiCodeProvider,
  type ApiCodeRepository,
  type ApiCodeSecret,
  type ApiCodeSessionDetail,
  type ApiCodeSettings,
  type ApiCodeSshRuntime,
  type ApiCodeTicket,
  type ApiCodeUsage,
} from './code-control-schemas.ts';

const SESSIONS = '/v1/code/sessions';
const AUTOMATIONS = '/v1/code/automations';
const SECRETS = '/v1/code/secrets';
const TICKETS = '/v1/code/tickets';
const HOSTS = '/v1/code/hosts';

function sessionPath(id: string, suffix = ''): string {
  return `${SESSIONS}/${encodeURIComponent(id)}${suffix}`;
}

/* ------------------------------------------------------------------------- */
/* Sessions                                                                  */
/* ------------------------------------------------------------------------- */

export function getCodeSession(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(sessionPath(id), codeSessionDetailSchema, { signal });
}

/**
 * Starts a run. Returns the session the service created.
 *
 * The id comes back from the service rather than being minted locally: a
 * client-invented id cannot be followed up on, stopped, or reopened later.
 */
export function createCodeSession(
  client: CortexApiClient,
  body: {
    prompt: string;
    runtime?: string;
    repository?: string;
    branch?: string;
    model?: string;
    host_id?: string;
    ticket_id?: string;
  },
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(SESSIONS, codeSessionDetailSchema, { method: 'POST', body, signal });
}

export function followUpCodeSession(
  client: CortexApiClient,
  id: string,
  body: { message: string },
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(sessionPath(id, '/turns'), codeSessionDetailSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export function stopCodeSession(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(sessionPath(id, '/stop'), codeSessionDetailSchema, {
    method: 'POST',
    body: {},
    signal,
  });
}

export function archiveCodeSession(
  client: CortexApiClient,
  id: string,
  archived: boolean,
  signal?: AbortSignal,
): Promise<ApiCodeSessionDetail> {
  return client.request(sessionPath(id, '/archive'), codeSessionDetailSchema, {
    method: 'POST',
    body: { archived },
    signal,
  });
}

export async function deleteCodeSession(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(sessionPath(id), unknownSchema, { method: 'DELETE', signal });
}

/**
 * Answers an Allow / Always / Deny prompt.
 *
 * Also available on the realtime socket. This is the HTTP half, used when the
 * socket is down and the SSE fallback is read-only — a blocked run the user
 * cannot answer is worse than a slower answer.
 */
export async function resolveCodePermission(
  client: CortexApiClient,
  id: string,
  body: { request_permission_id: string; decision: 'allow' | 'always' | 'deny' },
  signal?: AbortSignal,
): Promise<void> {
  await client.request(sessionPath(id, '/permissions'), unknownSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export function listCodeRepositories(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeRepository[]> {
  return listItems(client, '/v1/code/repositories', codeRepositoryListSchema, { signal });
}

/* ------------------------------------------------------------------------- */
/* Settings and providers                                                    */
/* ------------------------------------------------------------------------- */

export function getCodeSettings(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeSettings> {
  return client.request('/v1/code/settings', codeSettingsSchema, { signal });
}

export function putCodeSettings(
  client: CortexApiClient,
  body: ApiCodeSettings,
  signal?: AbortSignal,
): Promise<ApiCodeSettings> {
  return client.request('/v1/code/settings', codeSettingsSchema, {
    method: 'PUT',
    body,
    signal,
  });
}

export function listCodeProviders(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeProvider[]> {
  return listItems(client, '/v1/code/providers', codeProviderListSchema, { signal });
}

/**
 * Saves a provider credential. The key travels once, in the request body, and
 * the response carries a mask — the same asymmetry the desktop IPC channel has.
 */
export function putCodeProvider(
  client: CortexApiClient,
  id: string,
  body: { api_key?: string; base_url?: string },
  signal?: AbortSignal,
): Promise<ApiCodeProvider> {
  return client.request(`/v1/code/providers/${encodeURIComponent(id)}`, codeProviderSchema, {
    method: 'PUT',
    body,
    signal,
  });
}

/* ------------------------------------------------------------------------- */
/* Secrets                                                                   */
/* ------------------------------------------------------------------------- */

export function listCodeSecrets(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeSecret[]> {
  return listItems(client, SECRETS, codeSecretListSchema, { signal });
}

export function createCodeSecret(
  client: CortexApiClient,
  body: { name: string; value: string },
  signal?: AbortSignal,
): Promise<ApiCodeSecret> {
  return client.request(SECRETS, codeSecretSchema, { method: 'POST', body, signal });
}

export async function deleteCodeSecret(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`${SECRETS}/${encodeURIComponent(id)}`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}

/* ------------------------------------------------------------------------- */
/* Automations                                                               */
/* ------------------------------------------------------------------------- */

export function listCodeAutomations(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeAutomation[]> {
  return listItems(client, AUTOMATIONS, codeAutomationListSchema, { signal });
}

export function createCodeAutomation(
  client: CortexApiClient,
  body: { name: string; enabled?: boolean; trigger?: unknown; actions?: unknown[] },
  signal?: AbortSignal,
): Promise<ApiCodeAutomation> {
  return client.request(AUTOMATIONS, codeAutomationSchema, { method: 'POST', body, signal });
}

export function patchCodeAutomation(
  client: CortexApiClient,
  id: string,
  body: { name?: string; enabled?: boolean },
  signal?: AbortSignal,
): Promise<ApiCodeAutomation> {
  return client.request(`${AUTOMATIONS}/${encodeURIComponent(id)}`, codeAutomationSchema, {
    method: 'PATCH',
    body,
    signal,
  });
}

export async function deleteCodeAutomation(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`${AUTOMATIONS}/${encodeURIComponent(id)}`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}

export function runCodeAutomation(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCodeAutomationLog> {
  return client.request(`${AUTOMATIONS}/${encodeURIComponent(id)}/run`, codeAutomationLogSchema, {
    method: 'POST',
    body: {},
    signal,
  });
}

export function listCodeAutomationLogs(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCodeAutomationLog[]> {
  return listItems(
    client,
    `${AUTOMATIONS}/${encodeURIComponent(id)}/logs`,
    codeAutomationLogListSchema,
    { signal },
  );
}

/* ------------------------------------------------------------------------- */
/* Tickets                                                                   */
/* ------------------------------------------------------------------------- */

export function listCodeTickets(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeTicket[]> {
  return listItems(client, TICKETS, codeTicketListSchema, { signal });
}

export function getCodeTicket(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCodeTicket> {
  return client.request(`${TICKETS}/${encodeURIComponent(id)}`, codeTicketSchema, { signal });
}

export function createCodeTicket(
  client: CortexApiClient,
  body: { title: string; body?: string; repository?: string },
  signal?: AbortSignal,
): Promise<ApiCodeTicket> {
  return client.request(TICKETS, codeTicketSchema, { method: 'POST', body, signal });
}

export function patchCodeTicket(
  client: CortexApiClient,
  id: string,
  body: { title?: string; body?: string; status?: string },
  signal?: AbortSignal,
): Promise<ApiCodeTicket> {
  return client.request(`${TICKETS}/${encodeURIComponent(id)}`, codeTicketSchema, {
    method: 'PATCH',
    body,
    signal,
  });
}

export async function deleteCodeTicket(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`${TICKETS}/${encodeURIComponent(id)}`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}

/* ------------------------------------------------------------------------- */
/* Usage, hosts, SSH runtimes                                                */
/* ------------------------------------------------------------------------- */

export function getCodeUsage(client: CortexApiClient, signal?: AbortSignal): Promise<ApiCodeUsage> {
  return client.request('/v1/code/usage', codeUsageSchema, { signal });
}

export async function unpairCodeHost(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`${HOSTS}/${encodeURIComponent(id)}`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}

export function listCodeSshRuntimes(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeSshRuntime[]> {
  return listItems(client, '/v1/code/runtimes/ssh', codeSshRuntimeListSchema, { signal });
}

/**
 * Registers an SSH runtime.
 *
 * Takes no key or password: the service completes the handshake out of band and
 * reports a fingerprint. A browser that forwarded a private key would be storing
 * one in a tab, which is why the form does not ask for it.
 */
export function createCodeSshRuntime(
  client: CortexApiClient,
  body: { host: string; user: string; port?: number },
  signal?: AbortSignal,
): Promise<ApiCodeSshRuntime> {
  return client.request('/v1/code/runtimes/ssh', codeSshRuntimeSchema, {
    method: 'POST',
    body,
    signal,
  });
}

export async function deleteCodeSshRuntime(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(`/v1/code/runtimes/ssh/${encodeURIComponent(id)}`, unknownSchema, {
    method: 'DELETE',
    signal,
  });
}
