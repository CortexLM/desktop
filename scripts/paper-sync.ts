#!/usr/bin/env bun
/**
 * Keeps the codebase in lockstep with the Paper file that defines the product design.
 *
 * Subcommands:
 *   tokens     regenerate packages/tokens from the Paper design tokens
 *   manifest   write the screen manifest (artboard <-> route <-> viewport)
 *   spec       extract lossless geometry + computed styles per artboard
 *   jsx        archive Paper's JSX export for the UI-kit sections
 *   icons      extract the icon set into packages/ui/src/icons
 *   baselines  capture reference screenshots for visual review
 *   all        tokens + manifest + baselines
 *
 * Requires PAPER_MCP_URL, PAPER_MCP_AUTH and PAPER_FILE_ID.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { extractIcons, renderIconModule } from './paper/extract-icons.ts';
import { extractArtboardSpec } from './paper/extract-spec.ts';
import { generateTokens } from './paper/generate-tokens.ts';
import { PaperClient, PaperError } from './paper/mcp-client.ts';
import {
  parseArtboardName,
  type PaperBasicInfo,
  type PaperTokensResponse,
  slugify,
} from './paper/types.ts';

const REPO_ROOT = join(import.meta.dirname, '..');
const TOKENS_DIR = join(REPO_ROOT, 'packages/tokens/src');
const DESIGN_DIR = join(REPO_ROOT, 'design/paper');
const SPEC_DIR = join(DESIGN_DIR, 'spec');
const BASELINE_DIR = join(REPO_ROOT, 'tests/visual/paper-baselines');
const ICONS_PATH = join(REPO_ROOT, 'packages/ui/src/icons/geometry.generated.ts');
const MANIFEST_PATH = join(DESIGN_DIR, 'screens.json');

const SCREENS_PAGE = 'Screens';
const COMPONENTS_PAGE = 'Components';

async function writeFileEnsuringDir(path: string, contents: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

function log(message: string): void {
  process.stdout.write(`${message}\n`);
}

async function openPage(client: PaperClient, pageName: string): Promise<PaperBasicInfo> {
  const info = await client.callJson<PaperBasicInfo>('get_basic_info');
  if (info.pageName === pageName) return info;

  const page = info.pages.find((candidate) => candidate.name === pageName);
  if (!page) {
    throw new PaperError(
      `Paper file "${info.fileName}" has no page named "${pageName}" (pages: ${info.pages
        .map((p) => p.name)
        .join(', ')})`,
    );
  }
  return client.callJson<PaperBasicInfo>('open_file', { pageId: page.id });
}

async function syncTokens(client: PaperClient): Promise<void> {
  const response = await client.callJson<PaperTokensResponse>('get_tokens');
  const generated = generateTokens(response.tokens, response.contentHash.tokens);

  await writeFileEnsuringDir(join(TOKENS_DIR, 'tokens.generated.css'), generated.css);
  await writeFileEnsuringDir(join(TOKENS_DIR, 'tokens.generated.ts'), generated.ts);

  log(
    `tokens: ${Object.keys(generated.light).length} colour roles, ` +
      `${Object.keys(generated.neutral).length} scale tokens (hash ${generated.contentHash})`,
  );
}

export interface ScreenManifestEntry {
  slug: string;
  screen: string;
  group: string;
  width: number;
  height: number;
  artboards: { light?: string; dark?: string };
}

export interface ScreenManifest {
  fileName: string;
  fileUrl: string;
  pageId: string;
  tokenContentHash: string;
  generatedAt: string;
  screens: ScreenManifestEntry[];
  /** Artboards that did not follow the `Group / Screen — Theme` convention. */
  unparsed: string[];
}

function buildManifest(info: PaperBasicInfo): ScreenManifest {
  const screens = new Map<string, ScreenManifestEntry>();
  const unparsed: string[] = [];

  for (const artboard of info.artboards) {
    const parsed = parseArtboardName(artboard.name);
    if (!parsed) {
      unparsed.push(artboard.name);
      continue;
    }

    const existing = screens.get(parsed.slug);
    if (existing) {
      existing.artboards[parsed.theme] = artboard.id;
      // Light and dark are drawn at the same size; if they ever diverge, the larger box
      // is the safe viewport for both so nothing is clipped during verification.
      existing.width = Math.max(existing.width, artboard.width);
      existing.height = Math.max(existing.height, artboard.height);
      continue;
    }

    screens.set(parsed.slug, {
      slug: parsed.slug,
      screen: parsed.screen,
      group: parsed.group,
      width: artboard.width,
      height: artboard.height,
      artboards: { [parsed.theme]: artboard.id },
    });
  }

  return {
    fileName: info.fileName,
    fileUrl: info.url,
    pageId: info.pageId,
    tokenContentHash: info.contentHash.tokens,
    generatedAt: new Date().toISOString(),
    screens: [...screens.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    unparsed,
  };
}

async function syncManifest(client: PaperClient): Promise<ScreenManifest> {
  const info = await openPage(client, SCREENS_PAGE);
  const manifest = buildManifest(info);

  await writeFileEnsuringDir(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const incomplete = manifest.screens.filter((s) => !s.artboards.light || !s.artboards.dark);
  log(`manifest: ${manifest.screens.length} screens from ${info.artboardCount} artboards`);
  if (incomplete.length > 0) {
    log(`  missing a theme: ${incomplete.map((s) => s.slug).join(', ')}`);
  }
  if (manifest.unparsed.length > 0) {
    log(`  unparsed artboards: ${manifest.unparsed.join(', ')}`);
  }

  return manifest;
}

async function captureBaselines(client: PaperClient, only?: string[]): Promise<void> {
  const info = await openPage(client, SCREENS_PAGE);
  let captured = 0;

  for (const artboard of info.artboards) {
    const parsed = parseArtboardName(artboard.name);
    if (!parsed) continue;
    if (only && only.length > 0 && !only.includes(parsed.slug)) continue;

    const { bytes, mimeType } = await client.callImage('get_screenshot', { nodeId: artboard.id });
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    await writeFileEnsuringDir(
      join(BASELINE_DIR, `${parsed.slug}.${parsed.theme}.${extension}`),
      bytes,
    );
    captured += 1;
    log(`  baseline ${parsed.slug}.${parsed.theme}.${extension} (${bytes.byteLength} bytes)`);
  }

  log(`baselines: captured ${captured} artboards into ${BASELINE_DIR}`);
}

async function extractSpecs(client: PaperClient, only?: string[]): Promise<void> {
  const pages = only?.includes('components') ? [COMPONENTS_PAGE, SCREENS_PAGE] : [SCREENS_PAGE];

  for (const pageName of pages) {
    const info = await openPage(client, pageName);

    for (const artboard of info.artboards) {
      const parsed = parseArtboardName(artboard.name);
      // The Components page uses `Components / Light` rather than an em-dash theme suffix.
      const theme: 'light' | 'dark' = parsed?.theme ?? (/dark/i.test(artboard.name) ? 'dark' : 'light');
      const slug = parsed?.slug ?? slugify(artboard.name.split('/')[0]!.trim());

      if (only && only.length > 0 && !only.includes(slug) && !only.includes('all')) continue;

      const spec = await extractArtboardSpec(
        client,
        artboard,
        theme,
        info.contentHash.tokens,
        { maxDepth: 12 },
      );

      const path = join(SPEC_DIR, `${slug}.${theme}.json`);
      await writeFileEnsuringDir(path, `${JSON.stringify(spec, null, 2)}\n`);

      const count = countNodes(spec.root);
      log(`  spec ${slug}.${theme}: ${count} nodes`);
    }
  }
}

/**
 * The UI-kit sections on the Components page, keyed by the file they are archived to.
 *
 * Paper's JSX export resolves every style to either a literal or a `var(--token)`
 * reference, which makes it the authoritative source for a component's padding, type and
 * fills. Archiving it means a component's CSS can be reviewed against the design without
 * a live Paper connection, and a design change shows up as a diff in these files.
 */
const UI_KIT_SECTIONS: Record<string, string> = {
  'button-primary': 'BC-0',
  'button-secondary': 'BO-0',
  'button-ghost': 'C0-0',
  'button-destructive': 'CC-0',
  'text-field': 'CQ-0',
  composer: 'CW-0',
  'nav-item': 'DY-0',
  'session-card': 'EH-0',
  badge: 'FM-0',
  'tabs-toast-menu': 'G7-0',
  'automation-card': 'PN-0',
  'card-states': 'V0-0',
};

interface PaperJsxResponse {
  jsx?: string;
  code?: string;
}

async function archiveJsx(client: PaperClient, only?: string[]): Promise<void> {
  await openPage(client, COMPONENTS_PAGE);
  const outputDir = join(DESIGN_DIR, 'jsx');

  for (const [name, nodeId] of Object.entries(UI_KIT_SECTIONS)) {
    if (only && only.length > 0 && !only.includes(name)) continue;

    const response = await client.callJson<PaperJsxResponse>('get_jsx', {
      nodeId,
      format: 'inline-styles',
    });
    const jsx = response.jsx ?? response.code;
    if (!jsx) {
      log(`  jsx ${name}: Paper returned no JSX for ${nodeId}`);
      continue;
    }

    const header = [
      '// Paper JSX export - reference only, not compiled.',
      `// Section "${name}" (node ${nodeId}) of the Components page.`,
      '// Regenerate with: bun run paper:jsx',
      '',
    ].join('\n');

    await writeFileEnsuringDir(join(outputDir, `${name}.jsx`), `${header}${jsx}\n`);
    log(`  jsx ${name}: ${jsx.length} chars`);
  }

  log(`jsx: archived into ${outputDir}`);
}

async function syncIcons(client: PaperClient): Promise<void> {
  const info = await openPage(client, SCREENS_PAGE);

  // Light artboards only: the dark ones carry the same glyphs with different token
  // bindings, and normalisation would collapse them onto the same keys anyway.
  const artboards = info.artboards.filter((artboard) => {
    const parsed = parseArtboardName(artboard.name);
    return parsed?.theme === 'light';
  });

  const icons = await extractIcons(client, {
    artboards,
    onProgress: (name, found) => log(`  ${name}: ${found} svg nodes`),
  });

  await writeFileEnsuringDir(ICONS_PATH, renderIconModule(icons));
  log(`icons: ${icons.length} distinct glyphs from ${artboards.length} artboards`);
}

function countNodes(node: { children: Array<{ children: unknown[] }> }): number {
  let total = 1;
  for (const child of node.children) {
    total += countNodes(child as { children: Array<{ children: unknown[] }> });
  }
  return total;
}

async function main(): Promise<void> {
  const [command = 'all', ...rest] = process.argv.slice(2);
  const only = rest.filter((arg) => !arg.startsWith('-'));

  const client = new PaperClient();
  await client.connect();

  const info = await client.callJson<PaperBasicInfo>('open_file', {
    fileId: client.fileId,
  });
  log(`Paper file "${info.fileName}" (${info.artboardCount} artboards, ${info.nodeCount} nodes)`);

  switch (command) {
    case 'tokens':
      await syncTokens(client);
      break;
    case 'manifest':
      await syncManifest(client);
      break;
    case 'baselines':
      await captureBaselines(client, only);
      break;
    case 'spec':
      await extractSpecs(client, only);
      break;
    case 'jsx':
      await archiveJsx(client, only);
      break;
    case 'icons':
      await syncIcons(client);
      break;
    case 'all':
      await syncTokens(client);
      await syncManifest(client);
      await captureBaselines(client, only);
      break;
    default:
      throw new PaperError(`Unknown paper-sync command "${command}"`);
  }
}

main().catch((error: unknown) => {
  if (error instanceof PaperError) {
    process.stderr.write(`paper-sync: ${error.message}\n`);
    if (error.detail) process.stderr.write(`${JSON.stringify(error.detail, null, 2)}\n`);
  } else {
    process.stderr.write(`paper-sync: ${String(error)}\n`);
  }
  process.exitCode = 1;
});
