/**
 * Façade database
 */

import type { DBQueryResponse, DBExecuteResponse } from '@cortex-ide/shared';

import { getAPI, unwrapResponse } from './client';

export interface DBStatement {
  query: string;
  params?: unknown[];
}

export const database = {
  /**
   * Exécute une requête en lecture (SELECT)
   *
   * Le process main n'autorise que les lectures sur ce canal.
   *
   * @param params valeurs liées ; toujours les utiliser plutôt que
   *   d'interpoler dans le SQL
   */
  async query<T = unknown>(query: string, params?: unknown[]): Promise<DBQueryResponse<T>> {
    return unwrapResponse<DBQueryResponse<T>>(await getAPI().db.query({ query, params }));
  },

  /**
   * Exécute des écritures (INSERT/UPDATE/DELETE) dans une transaction
   */
  async execute(statements: DBStatement[]): Promise<DBExecuteResponse> {
    return unwrapResponse(await getAPI().db.execute({ statements }));
  },
};
