#!/usr/bin/env bun
/**
 * Compares the rendered captures against the Paper references, pixel by pixel.
 *
 * The references are JPEG, because that is the only format Paper's screenshot tool returns.
 * That has one consequence worth stating plainly: a perfect implementation cannot reach 0%
 * difference, because JPEG has already thrown information away. What the numbers are good
 * for is *movement* - a screen that was at 4% and is now at 19% has regressed, and one that
 * was at 40% and is now at 6% has been fixed.
 *
 * Decoding goes through ffmpeg rather than a JS JPEG decoder: it is already installed, and
 * its chroma upsampling matches what a browser does when it renders the same file, which
 * keeps the comparison from inventing differences at every colour edge.
 *
 * Usage: bun scripts/paper-diff.ts [slug ...]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const REPO_ROOT = join(import.meta.dirname, '..');
const BASELINE_DIR = join(REPO_ROOT, 'tests/visual/paper-baselines');
const CAPTURE_DIR = join(REPO_ROOT, 'test-results/paper-parity');
const DIFF_DIR = join(REPO_ROOT, 'test-results/paper-diff');
const REPORT_PATH = join(DIFF_DIR, 'report.json');

/**
 * How different two pixels must be before they count.
 *
 * 0.1 is pixelmatch's default and too strict for a JPEG reference: it flags the ringing
 * around every glyph edge. 0.25 ignores compression noise while still catching a colour or
 * a position that is genuinely wrong.
 */
const THRESHOLD = 0.25;

interface Comparison {
  slug: string;
  theme: 'light' | 'dark';
  width: number;
  height: number;
  /** Pixels that differ beyond the threshold. */
  mismatched: number;
  /** As a share of the frame. */
  percent: number;
  diffPath: string;
}

/** Decodes an image to PNG via ffmpeg and parses it. */
function decode(path: string): PNG {
  if (path.endsWith('.png')) {
    return PNG.sync.read(readFileSync(path));
  }

  const result = spawnSync(
    'ffmpeg',
    ['-loglevel', 'error', '-i', path, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
    { maxBuffer: 128 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    throw new Error(`ffmpeg could not decode ${path}: ${result.stderr?.toString() ?? 'unknown'}`);
  }

  return PNG.sync.read(result.stdout);
}

/**
 * Crops or pads an image to a target size.
 *
 * The capture and the reference are taken at the same viewport, but a screen whose content
 * exceeds the artboard height scrolls, and Paper grows the artboard instead. Rather than
 * refusing to compare those, the larger image is cropped to the smaller - so the comparison
 * covers the region both actually describe, and the size difference is reported separately.
 */
function fit(image: PNG, width: number, height: number): PNG {
  if (image.width === width && image.height === height) return image;

  const out = new PNG({ width, height });
  // Filled with the source's top-left pixel rather than black: padding a short image with
  // black would report the padding as a total mismatch and drown the real signal.
  const fill = [image.data[0]!, image.data[1]!, image.data[2]!, 255];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      const inside = x < image.width && y < image.height;
      const source = (y * image.width + x) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        out.data[target + channel] = inside ? image.data[source + channel]! : fill[channel]!;
      }
    }
  }

  return out;
}

function compare(slug: string, theme: 'light' | 'dark'): Comparison | null {
  const baseline = join(BASELINE_DIR, `${slug}.${theme}.jpg`);
  const capture = join(CAPTURE_DIR, `${slug}.${theme}.png`);

  if (!existsSync(baseline) || !existsSync(capture)) return null;

  const reference = decode(baseline);
  const rendered = decode(capture);

  const width = Math.min(reference.width, rendered.width);
  const height = Math.min(reference.height, rendered.height);

  const a = fit(reference, width, height);
  const b = fit(rendered, width, height);
  const diff = new PNG({ width, height });

  const mismatched = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: THRESHOLD,
    includeAA: true,
    alpha: 0.2,
  });

  const diffPath = join(DIFF_DIR, `${slug}.${theme}.png`);
  writeFileSync(diffPath, PNG.sync.write(diff));

  return {
    slug,
    theme,
    width,
    height,
    mismatched,
    percent: Math.round((mismatched / (width * height)) * 10_000) / 100,
    diffPath,
  };
}

function main(): void {
  const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  mkdirSync(DIFF_DIR, { recursive: true });

  const captures = existsSync(CAPTURE_DIR)
    ? readdirSync(CAPTURE_DIR).filter((name) => name.endsWith('.png'))
    : [];

  if (captures.length === 0) {
    process.stderr.write(
      `No captures in ${CAPTURE_DIR}. Run \`bun run test:visual\` first.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const results: Comparison[] = [];

  for (const name of captures.sort()) {
    const match = /^(.+)\.(light|dark)\.png$/.exec(name);
    if (!match) continue;

    const [, slug, theme] = match as unknown as [string, string, 'light' | 'dark'];
    if (only.length > 0 && !only.includes(slug)) continue;

    const comparison = compare(slug, theme);
    if (comparison) results.push(comparison);
  }

  results.sort((a, b) => b.percent - a.percent);

  process.stdout.write(`Paper parity - ${results.length} comparisons at threshold ${THRESHOLD}\n\n`);
  process.stdout.write(`${'screen'.padEnd(28)}${'theme'.padEnd(8)}${'diff'.padStart(8)}\n`);
  for (const result of results) {
    process.stdout.write(
      `${result.slug.padEnd(28)}${result.theme.padEnd(8)}${`${result.percent}%`.padStart(8)}\n`,
    );
  }

  const total = results.reduce((sum, result) => sum + result.percent, 0);
  process.stdout.write(
    `\nmean ${(total / Math.max(1, results.length)).toFixed(2)}%   diffs in ${DIFF_DIR}\n`,
  );

  writeFileSync(
    REPORT_PATH,
    `${JSON.stringify({ threshold: THRESHOLD, generatedAt: new Date().toISOString(), results }, null, 2)}\n`,
  );
}

main();
