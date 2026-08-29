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

import { existsSync } from 'node:fs';
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

/** "Cortex FF1 v1" — the Concept 3 file. Overridable for design explorations. */
const DEFAULT_FILE_ID = '01M0WGA7TGHQFZ2H22QFE3YZ9C';

const SCREENS_PAGE = 'Concept 03';
const COMPONENTS_PAGE = 'Components';
const CHAT_STATES_PAGE = 'Chat states';

/**
 * Concept-03 screens that are not part of the desktop app.
 *
 * `Product Code` is the marketing "coming soon" web page that shares the page with
 * the app artboards. `Code / Secrets` is a board for a page the product does not
 * have: Cortex Code stores no secrets of its own and offers no screen to manage
 * them (`.rules/06-product.md`). Keeping either out here keeps it out of the
 * manifest, the specs, the baselines and the icon scan all at once.
 */
const NON_APP_SCREENS = new Set(['Product Code', 'Code / Secrets']);

function isAppScreen(screen: string): boolean {
  return !NON_APP_SCREENS.has(screen);
}

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
    if (!isAppScreen(parsed.screen)) continue;

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

  const force = only?.includes('force') ?? false;

  for (const artboard of info.artboards) {
    const parsed = parseArtboardName(artboard.name);
    if (!parsed || !isAppScreen(parsed.screen)) continue;
    const named = (only ?? []).filter((arg) => arg !== 'force');
    if (named.length > 0 && !named.includes(parsed.slug)) continue;

    // Resumable, like the spec extraction: a 52-board capture that dies on one
    // slow render picks up where it stopped.
    const jpgPath = join(BASELINE_DIR, `${parsed.slug}.${parsed.theme}.jpg`);
    const pngPath = join(BASELINE_DIR, `${parsed.slug}.${parsed.theme}.png`);
    if (!force && (existsSync(jpgPath) || existsSync(pngPath))) {
      continue;
    }

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
  const withComponents = only?.includes('components') ?? false;
  const pages = withComponents
    ? [COMPONENTS_PAGE, CHAT_STATES_PAGE, SCREENS_PAGE]
    : [SCREENS_PAGE];
  const force = only?.includes('force') ?? false;

  // Off the components page, only the sections the app draws: the page also carries
  // the marketing site's navbar/hero/footer/pricing boards, which are large enough
  // to time the extraction out and describe nothing the desktop app renders.
  const appSections = new Set(
    UI_KIT_SECTIONS.filter((section) => section.page === COMPONENTS_PAGE).map((s) => s.nodeId),
  );

  for (const pageName of pages) {
    const info = await openPage(client, pageName);

    for (const artboard of info.artboards) {
      const parsed = parseArtboardName(artboard.name);
      // The Components page names sections `Components 02 — Sidebar app` rather than
      // using an em-dash theme suffix, so those fall back to a light, whole-name slug.
      const theme: 'light' | 'dark' = parsed?.theme ?? (/dark/i.test(artboard.name) ? 'dark' : 'light');
      const slug = parsed?.slug ?? slugify(artboard.name);
      if (parsed && !isAppScreen(parsed.screen)) continue;
      if (pageName === COMPONENTS_PAGE && !appSections.has(artboard.id)) continue;

      if (only && only.length > 0) {
        const named = only.filter((arg) => arg !== 'components' && arg !== 'all' && arg !== 'force');
        if (named.length > 0 && !named.includes(slug)) continue;
      }

      const path = join(SPEC_DIR, `${slug}.${theme}.json`);
      // Resumable: a 50-artboard extraction that dies on a network blip picks up where
      // it stopped instead of re-walking every tree. `force` re-extracts everything.
      if (!force && existsSync(path)) {
        log(`  spec ${slug}.${theme}: already extracted, skipping`);
        continue;
      }

      const spec = await extractArtboardSpec(
        client,
        artboard,
        theme,
        info.contentHash.tokens,
        { maxDepth: 12 },
      );

      await writeFileEnsuringDir(path, `${JSON.stringify(spec, null, 2)}\n`);

      const count = countNodes(spec.root);
      log(`  spec ${slug}.${theme}: ${count} nodes`);
    }
  }
}

/**
 * The UI-kit sections archived as JSX, keyed by the file they are archived to.
 *
 * Paper's JSX export resolves every style to either a literal or a `var(--token)`
 * reference, which makes it the authoritative source for a component's padding, type and
 * fills. Archiving it means a component's CSS can be reviewed against the design without
 * a live Paper connection, and a design change shows up as a diff in these files.
 *
 * Only the app-relevant sections are archived: the Components page also carries the
 * marketing site's navbar/hero/footer/pricing, which the desktop app never draws.
 */
const UI_KIT_SECTIONS: Array<{ name: string; page: string; nodeId: string }> = [
  { name: 'sidebar-app', page: COMPONENTS_PAGE, nodeId: 'BG-0' },
  { name: 'composer-apps-row', page: COMPONENTS_PAGE, nodeId: 'GF-0' },
  { name: 'conversation', page: COMPONENTS_PAGE, nodeId: 'JS-0' },
  { name: 'basics', page: COMPONENTS_PAGE, nodeId: 'VD-0' },
  { name: 'tabs-chips-controls', page: COMPONENTS_PAGE, nodeId: '3VJ-0' },
  { name: 'cards-sources-states', page: COMPONENTS_PAGE, nodeId: '419-0' },
  { name: 'chat-components', page: CHAT_STATES_PAGE, nodeId: '602-0' },
  { name: 'chat-thinking', page: CHAT_STATES_PAGE, nodeId: '5L7-0' },
  { name: 'chat-streaming', page: CHAT_STATES_PAGE, nodeId: '5ZI-0' },
  { name: 'chat-web-search', page: CHAT_STATES_PAGE, nodeId: '5ZJ-0' },
  { name: 'chat-tool-calls', page: CHAT_STATES_PAGE, nodeId: '5ZK-0' },
  { name: 'chat-file-viewer', page: CHAT_STATES_PAGE, nodeId: '5ZL-0' },
  { name: 'chat-agent-run', page: CHAT_STATES_PAGE, nodeId: '5ZM-0' },
  { name: 'chat-errors', page: CHAT_STATES_PAGE, nodeId: '5ZN-0' },
];

interface PaperJsxResponse {
  jsx?: string;
  code?: string;
}

async function archiveJsx(client: PaperClient, only?: string[]): Promise<void> {
  const outputDir = join(DESIGN_DIR, 'jsx');
  let currentPage: string | undefined;

  for (const { name, page, nodeId } of UI_KIT_SECTIONS) {
    if (only && only.length > 0 && !only.includes(name)) continue;

    if (currentPage !== page) {
      await openPage(client, page);
      currentPage = page;
    }

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
      `// Section "${name}" (node ${nodeId}) of the "${page}" page.`,
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
    return parsed?.theme === 'light' && isAppScreen(parsed.screen);
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

  const client = new PaperClient({
    fileId: process.env.PAPER_FILE_ID ?? DEFAULT_FILE_ID,
  });
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
