/**
 * Extracts a lossless geometry + style specification for a Paper artboard.
 *
 * Screenshots come back from Paper as JPEG, so they are a *verification* signal, not a
 * source of truth — lossy artefacts would poison any exact comparison. The numeric truth
 * lives in `get_children` (names, sizes, positions) and `get_computed_styles` (resolved
 * CSS), so those are what the implementation and its tests are driven from.
 */

import type { PaperClient } from './mcp-client.ts';
import { slugify } from './types.ts';

const STYLE_BATCH_SIZE = 40;

/** Style properties worth pinning. Paper resolves far more, most of them defaults. */
const TRACKED_STYLES = [
  'display',
  'flexDirection',
  'alignItems',
  'justifyContent',
  'gap',
  'rowGap',
  'columnGap',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'margin',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'overflow',
  'backgroundColor',
  'backgroundImage',
  'borderRadius',
  'borderWidth',
  'borderColor',
  'borderStyle',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'boxShadow',
  'opacity',
  'color',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textTransform',
  'textDecoration',
  'whiteSpace',
  'fill',
  'stroke',
  'strokeWidth',
  'zIndex',
] as const;

interface PaperChild {
  id: string;
  name: string;
  componentType?: string;
  type?: string;
  childCount?: number;
  worldX?: number;
  worldY?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface PaperChildrenResponse {
  children?: PaperChild[];
  nodes?: PaperChild[];
}

interface PaperNodeInfo {
  id: string;
  name: string;
  componentType?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  worldX?: number;
  worldY?: number;
  textContent?: string;
  text?: string;
  visible?: boolean;
  locked?: boolean;
  childIds?: string[];
}

export interface SpecNode {
  id: string;
  name: string;
  type: string;
  /** Position relative to the artboard origin, so specs stay stable if the board moves. */
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  styles: Record<string, string>;
  children: SpecNode[];
}

export interface ArtboardSpec {
  artboardId: string;
  artboardName: string;
  slug: string;
  theme: 'light' | 'dark';
  width: number;
  height: number;
  /** Paper's token content hash, so a token change invalidates stale specs. */
  tokenContentHash: string;
  extractedAt: string;
  root: SpecNode;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pickTracked(styles: Record<string, string> | undefined): Record<string, string> {
  if (!styles) return {};
  const out: Record<string, string> = {};
  for (const key of TRACKED_STYLES) {
    const value = styles[key];
    if (value !== undefined && value !== '' && value !== 'none' && value !== 'normal') {
      out[key] = value;
    }
  }
  return out;
}

async function fetchChildren(client: PaperClient, nodeId: string): Promise<PaperChild[]> {
  const response = await client.callJson<PaperChildrenResponse>('get_children', { nodeId });
  return response.children ?? response.nodes ?? [];
}

export interface ExtractOptions {
  /** Stop descending past this depth. Artboards average ~200 nodes; 12 covers them all. */
  maxDepth?: number;
  /** Called for each node visited, for progress reporting on large artboards. */
  onProgress?: (visited: number) => void;
}

export async function extractArtboardSpec(
  client: PaperClient,
  artboard: { id: string; name: string; width: number; height: number; worldX: number; worldY: number },
  theme: 'light' | 'dark',
  tokenContentHash: string,
  options: ExtractOptions = {},
): Promise<ArtboardSpec> {
  const maxDepth = options.maxDepth ?? 12;

  // Collect the tree first so computed styles can be requested in batches; one call per
  // node would multiply an already slow walk by the number of tracked properties.
  const collected: Array<{ node: SpecNode; depth: number }> = [];
  const origin = { x: artboard.worldX, y: artboard.worldY };
  let visited = 0;

  const rootInfo = await client.callJson<PaperNodeInfo>('get_node_info', { nodeId: artboard.id });
  const root: SpecNode = {
    id: artboard.id,
    name: artboard.name,
    type: rootInfo.componentType ?? 'Frame',
    x: 0,
    y: 0,
    width: artboard.width,
    height: artboard.height,
    styles: {},
    children: [],
  };
  collected.push({ node: root, depth: 0 });

  const queue: Array<{ node: SpecNode; depth: number }> = [{ node: root, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    const children = await fetchChildren(client, current.node.id);
    for (const child of children) {
      const worldX = asNumber(child.worldX, origin.x + asNumber(child.x));
      const worldY = asNumber(child.worldY, origin.y + asNumber(child.y));

      const node: SpecNode = {
        id: child.id,
        name: child.name,
        type: child.componentType ?? child.type ?? 'Frame',
        x: Math.round((worldX - origin.x) * 100) / 100,
        y: Math.round((worldY - origin.y) * 100) / 100,
        width: asNumber(child.width),
        height: asNumber(child.height),
        styles: {},
        children: [],
      };

      current.node.children.push(node);
      collected.push({ node, depth: current.depth + 1 });
      queue.push({ node, depth: current.depth + 1 });

      visited += 1;
      options.onProgress?.(visited);
    }
  }

  // Text content only exists on Text nodes, and get_children does not carry it.
  const textNodes = collected.filter(({ node }) => node.type === 'Text');
  for (const { node } of textNodes) {
    const info = await client.callJson<PaperNodeInfo>('get_node_info', { nodeId: node.id });
    const text = info.textContent ?? info.text;
    if (text) node.text = text;
  }

  for (let i = 0; i < collected.length; i += STYLE_BATCH_SIZE) {
    const batch = collected.slice(i, i + STYLE_BATCH_SIZE);
    const styles = await client.callJson<Record<string, Record<string, string>>>('get_computed_styles', {
      nodeIds: batch.map(({ node }) => node.id),
    });
    for (const { node } of batch) {
      node.styles = pickTracked(styles[node.id]);
    }
  }

  return {
    artboardId: artboard.id,
    artboardName: artboard.name,
    slug: slugify(artboard.name.split('\u2014')[0]!.split('/').pop()!.trim()),
    theme,
    width: artboard.width,
    height: artboard.height,
    tokenContentHash,
    extractedAt: new Date().toISOString(),
    root,
  };
}
