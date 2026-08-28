/**
 * Planning results stay in the local inbox. The control-plane inbox is
 * POST /v1/conversations/{id}/scheduled-results — owner-only, idempotent on
 * user+task_id. A conversation id is never invented here.
 */

import { isCortexApiError, postScheduledResult } from '@cortex-ide/cortex-api';

import { liveSession } from './realtime-session.ts';

/** Live conversation ids observed on the API are `cnv_` + ULID. */
export function isLiveConversationId(id: string | undefined): id is string {
  return typeof id === 'string' && id.startsWith('cnv_') && id.length > 4;
}

export async function deliverScheduledResult(options: {
  taskId: string;
  message?: string;
  conversationId?: string;
}): Promise<boolean> {
  const live = liveSession();
  if (!live || !isLiveConversationId(options.conversationId)) return false;
  try {
    await postScheduledResult(live.client, options.conversationId, {
      task_id: options.taskId,
      message: options.message,
    });
    return true;
  } catch (error) {
    if (isCortexApiError(error) && error.code === 'not_found') return false;
    return false;
  }
}
