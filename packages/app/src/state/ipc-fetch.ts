/**
 * CortexApiClient fetch that goes through main. Tokens never enter the renderer.
 */

import type { CortexProductRequest, CortexProductResponse, IPCResponse } from '@cortex-ide/shared';

import { CORTEX_API_BASE_URL } from '@cortex-ide/cortex-api';

import { resolveHost } from './host.ts';

export function productUrlPath(input: RequestInfo | URL): string {
  const raw = String(input);
  try {
    const url = new URL(raw, `${CORTEX_API_BASE_URL}/`);
    return `${url.pathname}${url.search}`;
  } catch {
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}

export async function ipcProductFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase() as CortexProductRequest['method'];
  const request: CortexProductRequest = {
    method,
    path: productUrlPath(input),
  };
  const parsed = parseBody(init?.body);
  if (parsed !== undefined) request.body = parsed;

  const result = await resolveHost().productRequest(request);
  return new Response(result.bodyText, {
    status: result.status,
    headers: result.headers,
  });
}

export function unwrapProductResponse(
  response: IPCResponse<CortexProductResponse>,
): CortexProductResponse {
  if (response.success) return response.data;
  throw new Error(response.error.message);
}

function parseBody(body: BodyInit | null | undefined): unknown {
  if (body === undefined || body === null || body === '') return undefined;
  if (typeof body !== 'string') return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
