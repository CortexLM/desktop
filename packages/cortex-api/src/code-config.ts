/**
 * How Code is configured, over HTTP.
 *
 * Split from `code-control.ts`, which owns the run surface — starting, reading and
 * stopping sessions. This module is everything a run is configured *with*: workspace
 * defaults, provider credentials, secrets, automations, the ticket queue, and where
 * runs are allowed to happen.
 *
 * Same honesty rule as its sibling: none of it answered on the public deployment when
 * this was written, so a 404 reaches the caller as `not_found`. An account with no
 * secrets and a backend with no secrets route are different facts.
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
  codeSecretListSchema,
  codeSecretSchema,
  codeSettingsSchema,
  codeSshRuntimeListSchema,
  codeSshRuntimeSchema,
  codeTicketListSchema,
  codeTicketSchema,
  type ApiCodeAutomation,
  type ApiCodeAutomationLog,
  type ApiCodeProvider,
  type ApiCodeSecret,
  type ApiCodeSettings,
  type ApiCodeSshRuntime,
  type ApiCodeTicket,
} from './code-control-schemas.ts';

const AUTOMATIONS = '/v1/code/automations';
const SECRETS = '/v1/code/secrets';
const TICKETS = '/v1/code/tickets';
const HOSTS = '/v1/code/hosts';
const SSH = '/v1/code/runtimes/ssh';

function at(base: string, id: string, suffix = ''): string {
  return `${base}/${encodeURIComponent(id)}${suffix}`;
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
  return client.request(at('/v1/code/providers', id), codeProviderSchema, {
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
  await client.request(at(SECRETS, id), unknownSchema, { method: 'DELETE', signal });
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
  return client.request(at(AUTOMATIONS, id), codeAutomationSchema, {
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
  await client.request(at(AUTOMATIONS, id), unknownSchema, { method: 'DELETE', signal });
}

export function runCodeAutomation(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<ApiCodeAutomationLog> {
  return client.request(at(AUTOMATIONS, id, '/run'), codeAutomationLogSchema, {
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
  return listItems(client, at(AUTOMATIONS, id, '/logs'), codeAutomationLogListSchema, { signal });
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
  return client.request(at(TICKETS, id), codeTicketSchema, { signal });
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
  return client.request(at(TICKETS, id), codeTicketSchema, { method: 'PATCH', body, signal });
}

export async function deleteCodeTicket(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(at(TICKETS, id), unknownSchema, { method: 'DELETE', signal });
}

/* ------------------------------------------------------------------------- */
/* Where runs are allowed to happen                                          */
/* ------------------------------------------------------------------------- */

export async function unpairCodeHost(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(at(HOSTS, id), unknownSchema, { method: 'DELETE', signal });
}

export function listCodeSshRuntimes(
  client: CortexApiClient,
  signal?: AbortSignal,
): Promise<ApiCodeSshRuntime[]> {
  return listItems(client, SSH, codeSshRuntimeListSchema, { signal });
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
  return client.request(SSH, codeSshRuntimeSchema, { method: 'POST', body, signal });
}

export async function deleteCodeSshRuntime(
  client: CortexApiClient,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await client.request(at(SSH, id), unknownSchema, { method: 'DELETE', signal });
}
