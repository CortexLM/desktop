#!/usr/bin/env bun
/**
 * Measures the bundle impact of lazy-loading Prism.js in the chat view.
 *
 * Why this script exists: ChatView is not currently reachable from the app
 * entry, so a normal `vite build` tree-shakes it away entirely and the
 * optimization is invisible in dist/. This builds two isolated bundles that
 * differ *only* in how the syntax-highlighting stack is loaded, and reports the
 * change in eagerly-loaded (initial) bytes.
 *
 *   before : Prism core + grammars + theme + DOMPurify imported statically
 *            (the original ChatView import block)
 *   after  : the same capability reached through lib/syntax-highlight, which
 *            imports them on first use
 *
 * Both variants also import the real ChatView so the shared app-code baseline
 * is identical and the delta is attributable to the highlighting stack alone.
 *
 * Usage: bun packages/renderer/scripts/measure-prism-split.ts
 *   (lives inside the renderer package so `vite` resolves from its node_modules)
 */

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readdir, stat, rm, readFile, writeFile, mkdir } from 'fs/promises';
import { gzipSync } from 'zlib';

const RENDERER = resolve(import.meta.dir, '..');
const TMP_SRC = resolve(RENDERER, 'src/__perf_tmp__');
const OUT_ROOT = resolve(RENDERER, '.perf-dist');

/**
 * "Before": replicates the original static import block from ChatView, so
 * Prism, its grammars, the theme and DOMPurify all land in the entry chunk.
 */
const ENTRY_STATIC = `
import Prism from 'prismjs';
import DOMPurify from 'dompurify';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-json';
import { ChatView } from '../views/agents/ChatView';

// Reference everything so nothing is tree-shaken.
export function highlight(code: string, language: string): string {
  const grammar = Prism.languages[language];
  const html = Prism.highlight(code, grammar, language);
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] });
}
(globalThis as Record<string, unknown>).__probe = { ChatView, highlight };
`;

/**
 * "After": same capability, but reached through the lazy module, so the
 * highlighting stack is emitted as separate on-demand chunks.
 */
const ENTRY_LAZY = `
import { highlightCode } from '../lib/syntax-highlight';
import { ChatView } from '../views/agents/ChatView';

export async function highlight(code: string, language: string): Promise<string | null> {
  const result = await highlightCode(code, language);
  return result.html;
}
(globalThis as Record<string, unknown>).__probe = { ChatView, highlight };
`;

interface Variant {
  name: string;
  file: string;
  source: string;
  outDir: string;
}

const VARIANTS: Variant[] = [
  {
    name: 'static Prism imports (before)',
    file: resolve(TMP_SRC, 'entry-static.ts'),
    source: ENTRY_STATIC,
    outDir: resolve(OUT_ROOT, 'static'),
  },
  {
    name: 'lazy Prism loading (after)',
    file: resolve(TMP_SRC, 'entry-lazy.ts'),
    source: ENTRY_LAZY,
    outDir: resolve(OUT_ROOT, 'lazy'),
  },
];

interface ChunkInfo {
  name: string;
  size: number;
  gzip: number;
  /** Eager chunks load before the UI can render; others are fetched on demand. */
  isEager: boolean;
}

async function buildVariant(v: Variant): Promise<ChunkInfo[]> {
  await rm(v.outDir, { recursive: true, force: true });

  await build({
    root: resolve(RENDERER, 'src'),
    configFile: false,
    plugins: [react()],
    resolve: { alias: { '@': resolve(RENDERER, 'src') } },
    logLevel: 'error',
    build: {
      outDir: v.outDir,
      emptyOutDir: true,
      sourcemap: false,
      minify: 'esbuild',
      target: 'esnext',
      reportCompressedSize: false,
      cssCodeSplit: true,
      lib: { entry: v.file, formats: ['es'], fileName: 'entry' },
    },
  });

  const entryBase = v.file.split('/').pop()!.replace(/\.ts$/, '');
  const files = await readdir(v.outDir);
  const chunks: ChunkInfo[] = [];

  for (const f of files) {
    const full = resolve(v.outDir, f);
    const s = await stat(full);
    if (!s.isFile() || !/\.(js|mjs|css)$/.test(f)) continue;
    const content = await readFile(full);
    chunks.push({
      name: f,
      size: s.size,
      gzip: gzipSync(content).length,
      isEager: f.startsWith('entry'),
    });
  }

  void entryBase;
  return chunks.sort((a, b) => b.size - a.size);
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const sum = (chunks: ChunkInfo[], key: 'size' | 'gzip') =>
  chunks.reduce((n, c) => n + c[key], 0);

async function main() {
  console.log('\n=== Prism lazy-loading bundle impact ===\n');

  await mkdir(TMP_SRC, { recursive: true });
  const results: { variant: Variant; chunks: ChunkInfo[] }[] = [];

  try {
    for (const v of VARIANTS) {
      await writeFile(v.file, v.source.trimStart());
    }

    for (const v of VARIANTS) {
      const chunks = await buildVariant(v);
      results.push({ variant: v, chunks });

      const eager = chunks.filter((c) => c.isEager);
      const lazy = chunks.filter((c) => !c.isEager);

      console.log(`--- ${v.name} ---`);
      console.log(
        `  initial (eager) : ${fmt(sum(eager, 'size'))}  (${fmt(sum(eager, 'gzip'))} gzip)`
      );
      console.log(
        `  deferred chunks : ${fmt(sum(lazy, 'size'))} across ${lazy.length} file(s)`
      );
      for (const c of chunks) {
        console.log(`    [${c.isEager ? 'EAGER' : 'lazy '}] ${fmt(c.size).padStart(9)}  ${c.name}`);
      }
      console.log();
    }

    const [before, after] = results;
    const beforeEager = before.chunks.filter((c) => c.isEager);
    const afterEager = after.chunks.filter((c) => c.isEager);

    const bSize = sum(beforeEager, 'size');
    const aSize = sum(afterEager, 'size');
    const bGzip = sum(beforeEager, 'gzip');
    const aGzip = sum(afterEager, 'gzip');

    const saved = bSize - aSize;
    const pct = ((saved / bSize) * 100).toFixed(1);

    console.log('=== RESULT: initial (eagerly loaded) payload ===');
    console.log(`  before : ${fmt(bSize)}  (${fmt(bGzip)} gzip)`);
    console.log(`  after  : ${fmt(aSize)}  (${fmt(aGzip)} gzip)`);
    console.log(`  saved  : ${fmt(saved)}  (${fmt(bGzip - aGzip)} gzip)  = ${pct}% smaller`);
    console.log(
      `\n  Highlighting now ships as ${after.chunks.filter((c) => !c.isEager).length} on-demand chunk(s),`
    );
    console.log('  fetched only when a fenced code block is actually rendered.\n');
  } finally {
    // Always clean up generated sources and build output.
    await rm(TMP_SRC, { recursive: true, force: true });
    await rm(OUT_ROOT, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
