/**
 * Plugin tools come from connections the user already made.
 * Chat / Bot share those connections (surface chat, bot, or both).
 * Code uses a Code-side catalog when the host supplies one — never invented.
 */

import type { ToolDefinition } from './types';

export type PluginSurface = 'chat' | 'bot' | 'both';
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
  surfaces?: PluginSurface[];
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
  const surfaces = row.surfaces ?? ['both'];
  return surfaces.includes('both') || surfaces.includes(product as PluginSurface);
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
