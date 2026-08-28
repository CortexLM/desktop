/**
 * Path-allowlisted HTTP proxy for Bot / skills / plugins.
 *
 * The renderer cannot fetch api.cortex.foundation from file://. Main already
 * holds the session. This forwards the request and returns status + body so
 * the renderer CortexApiClient can classify errors itself.
 */

import type { CortexProductRequest, CortexProductResponse } from '@cortex-ide/shared';

import { getCortexAccountService } from './cortex-account-service';

const ALLOWED = [/^\/v1\/mascots(?:\/|$)/, /^\/v1\/skills(?:\/|$)/, /^\/v1\/plugins(?:\/|$)/];

export function isProductPath(path: string): boolean {
  const pathname = path.split('?')[0] ?? path;
  return ALLOWED.some((rule) => rule.test(pathname));
}

export async function proxyProductRequest(
  request: CortexProductRequest,
): Promise<CortexProductResponse> {
  if (!isProductPath(request.path)) {
    throw new Error(`Product path is not allowlisted: ${request.path}`);
  }

  const client = getCortexAccountService().getApiClient();
  const response = await client.exchange(request.path, {
    method: request.method,
    body: request.body,
  });

  return {
    status: response.status,
    headers: headerMap(response.headers),
    bodyText: await response.text(),
  };
}

function headerMap(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    out[name] = value;
  });
  return out;
}
