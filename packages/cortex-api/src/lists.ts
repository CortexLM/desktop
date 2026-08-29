/**
 * Reads an `{ items: [...] }` envelope and returns the rows.
 *
 * Shared so the control-plane modules do not each carry their own copy: the
 * envelope is one contract, and three private helpers would be three places to
 * change when it moves.
 */

import type { z } from 'zod';

import type { CortexApiClient, RequestOptions } from './client.ts';

export async function listItems<T>(
  client: CortexApiClient,
  path: string,
  schema: z.ZodType<{ items: T[] }>,
  options: RequestOptions = {},
): Promise<T[]> {
  const list = await client.request(path, schema, options);
  return list.items;
}
