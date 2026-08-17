/**
 * Types IPC - Database
 */

export interface DBQueryRequest {
  query: string;
  params?: unknown[];
}

export interface DBQueryResponse<T = unknown> {
  rows: T[];
  changes?: number;
  lastInsertRowid?: number;
}

export interface DBExecuteRequest {
  statements: Array<{
    query: string;
    params?: unknown[];
  }>;
}

export interface DBExecuteResponse {
  success: boolean;
  changes: number;
}
