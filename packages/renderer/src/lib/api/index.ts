/**
 * IPC Client API - Renderer Process
 *
 * Client type-safe pour invoquer les handlers IPC. Une façade par domaine,
 * agrégée dans `ipc` pour un accès unique.
 */

import { filesystem } from './filesystem';
import { editor } from './editor';
import { git } from './git';
import { ai } from './ai';
import { terminal } from './terminal';
import { database } from './database';
import { automation } from './automation';
import { mcp } from './mcp';

// ============================================================================
// Façades par domaine
// ============================================================================

export { filesystem } from './filesystem';
export { editor } from './editor';
export { git } from './git';
export { ai, type AIProviderId } from './ai';
export { terminal } from './terminal';
export { database, type DBStatement } from './database';
export {
  automation,
  type AutomationEvent,
  type AutomationFailedEvent,
  type AutomationNotification,
} from './automation';
export { mcp } from './mcp';

// ============================================================================
// Primitives partagées
// ============================================================================

export { IPCError, getAPI, unwrapResponse } from './client';

// ============================================================================
// Agrégat
// ============================================================================

export const ipc = {
  filesystem,
  editor,
  git,
  ai,
  terminal,
  database,
  automation,
  mcp,
};

export default ipc;
