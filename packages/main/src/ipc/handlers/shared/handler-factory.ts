/**
 * Fabrique de handlers IPC avec validation de schéma et gestion d'erreurs
 * unifiée.
 *
 * Volontairement agnostique de la version de Zod : le schéma n'est requis que
 * structurellement (`parse`), et la détection des erreurs de validation se fait
 * par forme plutôt que par `instanceof`. Plusieurs versions de Zod coexistent
 * dans le monorepo (`zod@4` hoisté, `zod@3` dans `ai-engine`) et `instanceof`
 * échoue dès qu'une erreur traverse la frontière entre deux copies du module.
 */

import type { IpcMainInvokeEvent } from 'electron';
import type { IPCResponse } from '@cortex-ide/shared';
import { ErrorCode, getErrorCode } from './error-codes';

/**
 * Contrat minimal attendu d'un schéma de validation.
 *
 * Compatible avec `ZodType` de n'importe quelle version, et avec tout
 * validateur qui lève sur entrée invalide.
 */
export interface RequestSchema<TRequest> {
  parse: (input: unknown) => TRequest;
}

export type ValidatedHandler<TRequest, TResponse> = (
  request: TRequest,
  event: IpcMainInvokeEvent
) => Promise<TResponse>;

export type IpcInvokeHandler<TResponse> = (
  event: IpcMainInvokeEvent,
  request: unknown
) => Promise<IPCResponse<TResponse>>;

/**
 * Détails d'une erreur de validation, tels qu'exposés au renderer
 */
type ValidationIssues = unknown;

/**
 * Reconnaît une erreur de validation Zod par sa forme.
 *
 * Zod expose `issues` (v3 et v4) et `name === 'ZodError'`. On ne peut pas
 * utiliser `instanceof` : cf. le commentaire d'en-tête du module.
 *
 * Exporté pour les handlers qui renvoient une forme de réponse différente et ne
 * peuvent pas passer par `toErrorResponse` (ex. le handler de streaming AI).
 */
export function asValidationIssues(error: unknown): ValidationIssues | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { name?: unknown; issues?: unknown; errors?: unknown };

  if (candidate.name !== 'ZodError') {
    return undefined;
  }

  // `issues` en v3/v4 ; `errors` est un alias historique
  if (Array.isArray(candidate.issues)) {
    return candidate.issues;
  }

  if (Array.isArray(candidate.errors)) {
    return candidate.errors;
  }

  // ZodError sans issues exploitables : on signale quand même la validation
  return [];
}

/**
 * Enveloppe un handler avec validation du payload et normalisation des erreurs.
 *
 * Toute erreur est convertie en `IPCResponse` d'échec afin qu'aucune exception
 * ne traverse la frontière IPC.
 */
export function createHandler<TRequest, TResponse>(
  schema: RequestSchema<TRequest>,
  handler: ValidatedHandler<TRequest, TResponse>
): IpcInvokeHandler<TResponse> {
  return async (event, request) => {
    try {
      const validatedRequest = schema.parse(request);
      const data = await handler(validatedRequest, event);

      return { success: true, data };
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/**
 * Convertit une erreur inconnue en réponse IPC d'échec
 */
export function toErrorResponse<TResponse = never>(error: unknown): IPCResponse<TResponse> {
  const issues = asValidationIssues(error);

  if (issues !== undefined) {
    return {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: issues,
      },
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: getErrorCode(error),
        message: error.message,
        details: { stack: error.stack },
      },
    };
  }

  return {
    success: false,
    error: {
      code: ErrorCode.UNKNOWN_ERROR,
      message: 'An unknown error occurred',
      details: error,
    },
  };
}
