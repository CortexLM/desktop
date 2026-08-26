/**
 * Decides which error class an error body deserves.
 *
 * The service returns two shapes and they are not interchangeable:
 *
 *   application  { code: "AUTH_REQUIRED", message: "Authentication required" }
 *   OAuth device { error: "authorization_pending", error_description: "…" }
 *
 * Both arrive as 4xx, and the device endpoints answer `authorization_pending` with HTTP 400 —
 * which is the *expected* state for most of a device flow's life. So the discrimination has to
 * be on the body, not the status: a caller branching on `400` alone cannot tell "keep waiting"
 * from "this genuinely failed".
 *
 * Lives in its own module rather than as a private static on the client: it is pure, it is the
 * piece most worth reading on its own, and the client is otherwise about request and response
 * plumbing.
 */

import { CortexApiError, CortexDeviceFlowError, isDeviceFlowErrorCode } from './errors.ts';
import type { CortexErrorContext } from './errors.ts';
import { applicationErrorSchema, oauthErrorSchema } from './schemas.ts';

/**
 * RFC 7807 problem+json, which the v1 service answers for routing-level
 * failures — including "No such endpoint" when a contract moves under the
 * client. Surfacing its `code` and `detail` turns "404 unrecognised error body"
 * into something a person can act on.
 */
interface ProblemBody {
  code?: unknown;
  title?: unknown;
  detail?: unknown;
  status?: unknown;
}

function classifyProblem(payload: unknown, context: CortexErrorContext): Error | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const problem = payload as ProblemBody;
  if (typeof problem.code !== 'string' || typeof problem.title !== 'string') return undefined;

  const detail = typeof problem.detail === 'string' ? problem.detail : problem.title;
  return new CortexApiError(problem.code, detail, context);
}

export function classifyError(payload: unknown, context: CortexErrorContext): Error {
  const oauth = oauthErrorSchema.safeParse(payload);
  if (oauth.success && isDeviceFlowErrorCode(oauth.data.error)) {
    return new CortexDeviceFlowError(
      oauth.data.error,
      oauth.data.error_description ?? oauth.data.error,
      context,
    );
  }

  const problem = classifyProblem(payload, context);
  if (problem) return problem;

  const application = applicationErrorSchema.safeParse(payload);
  if (application.success) {
    return new CortexApiError(application.data.code, application.data.message, context);
  }

  if (oauth.success) {
    // `/auth/callback` returns both keys:
    //   { "error": "Missing authorization code", "code": "missing_code" }
    // Here `code` is the machine-readable identifier and `error` is the human message, which
    // is the opposite of how the device endpoints use them. When both are present, prefer
    // `code`, so callers can branch on a stable string rather than on prose.
    const hybrid = payload as { code?: unknown };
    const code = typeof hybrid.code === 'string' ? hybrid.code : oauth.data.error;
    return new CortexApiError(code, oauth.data.error_description ?? oauth.data.error, context);
  }

  return new CortexApiError('UNKNOWN_ERROR', `${context.status} unrecognised error body`, context);
}
