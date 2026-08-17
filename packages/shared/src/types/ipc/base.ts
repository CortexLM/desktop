/**
 * Types IPC - Base
 */

/**
 * Enveloppe de toute réponse IPC.
 *
 * Discriminée par `success` : le renderer n'accède à `data` qu'après avoir
 * vérifié le succès, et à `error` qu'en cas d'échec.
 */
export type IPCResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: unknown } };

export interface ProgressEvent {
  type: 'progress';
  progress: number;
  message?: string;
}
