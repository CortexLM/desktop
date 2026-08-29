/**
 * Plugin tools come from connections the user already made.
 * Surfaces are Chat, Bot, or both (empty/absent list means both, as in
 * `plugin-surfaces.ts`). Code uses a Code-side catalog when the host
 * supplies one — never invented.
 */

import type { ToolDefinition } from './types';

export type PluginSurface = 'chat' | 'bot';
export type ProductSurface = 'chat' | 'bot' | 'code';

export interface PluginToolSpec {
  name: string;
  description: string;
  parameters?: ToolDefinition['parameters'];
}

export interface PluginConnection {
  id: string;
  slug?: string;
  name?: string;
  /** Empty or absent is both products, matching the account assignment. */
  surfaces?: ReadonlyArray<PluginSurface | 'both' | string>;
  tools?: PluginToolSpec[];
}

export function toolsFromConnections(
  connections: PluginConnection[],
  product: ProductSurface,
  codeCatalog?: PluginConnection[],
): ToolDefinition[] {
  const source = product === 'code' ? (codeCatalog ?? []) : connections.filter((row) =>
    matchesSurface(row, product),
  );
  return source.flatMap(toTools);
}

function matchesSurface(row: PluginConnection, product: ProductSurface): boolean {
  if (product === 'code') return false;
  const surfaces = row.surfaces ?? [];
  if (surfaces.length === 0 || surfaces.includes('both')) return true;
  return surfaces.includes(product);
}

function toTools(row: PluginConnection): ToolDefinition[] {
  const slug = row.slug ?? row.id;
  return (row.tools ?? []).map((tool) => ({
    name: `plugin__${slug}__${tool.name}`,
    description: tool.description,
    risk: 'write',
    parameters: tool.parameters ?? { type: 'object', properties: {} },
  }));
}
