#!/usr/bin/env bun
/**
 * Measures where content sits in the Paper reference versus the rendered capture.
 *
 * The pixel diff says *how much* differs; this says *where*. A screen whose content is
 * correct but sits 35px too high reports a large diff for a reason that no amount of
 * staring at a red overlay makes obvious, whereas "your content box starts 35px above the
 * reference" is directly actionable.
 *
 * It works by finding the bounding box of everything that is not the page background, per
 * image, and reporting the delta. Background is taken from the top-left corner rather than
 * assumed white, so it works in both themes without being told which one it is looking at.
 *
 * Usage: bun scripts/paper-align.ts [slug ...]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PNG } from 'pngjs';

const REPO_ROOT = join(import.meta.dirname, '..');
const BASELINE_DIR = join(REPO_ROOT, 'tests/visual/paper-baselines');
const CAPTURE_DIR = join(REPO_ROOT, 'test-results/paper-parity');

/**
 * How far a pixel must be from the background to count as content.
 *
 * 18 per channel: enough to ignore JPEG mottling in a flat area, low enough to catch a
 * hairline border, which in this design is a 6-value step from its surface.
 */
const CONTENT_THRESHOLD = 18;

interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

function decode(path: string): PNG {
  if (path.endsWith('.png')) return PNG.sync.read(readFileSync(path));

  const result = spawnSync(
    'ffmpeg',
    ['-loglevel', 'error', '-i', path, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'],
    { maxBuffer: 128 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error(`ffmpeg could not decode ${path}`);
  return PNG.sync.read(result.stdout);
}

/**
 * The window chrome the artboards draw but the app does not.
 *
 * Every Paper screen has the three macOS traffic lights painted into its top-left corner.
 * The real app never renders those - on macOS the OS draws them over the frame, and there is
 * no window chrome at all in a browser capture - so they are decoration in the reference and
 * absent from the capture. Left in, they pin the reference's content box to (16,16) on every
 * screen and make every measurement read as a couple of hundred pixels of offset.
 */
const CHROME_REGION = { right: 84, bottom: 48 };

/**
 * The bounding box of everything that is not the page background.
 *
 * `ignoreLeft` skips the sidebar: it is identical on every screen, so including it would pin
 * every content box to the sidebar's own edge and hide the thing being measured.
 */
function contentBox(image: PNG, ignoreLeft = 0): Box | null {
  const background = [image.data[0]!, image.data[1]!, image.data[2]!];
  let top = Number.POSITIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = ignoreLeft; x < image.width; x += 1) {
      if (x < CHROME_REGION.right && y < CHROME_REGION.bottom) continue;

      const offset = (y * image.width + x) * 4;
      const differs =
        Math.abs(image.data[offset]! - background[0]!) > CONTENT_THRESHOLD ||
        Math.abs(image.data[offset + 1]! - background[1]!) > CONTENT_THRESHOLD ||
        Math.abs(image.data[offset + 2]! - background[2]!) > CONTENT_THRESHOLD;

      if (!differs) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  return right < 0 ? null : { top, left, right, bottom };
}

/** Screens drawn without a sidebar, where nothing should be excluded from the measurement. */
const BARE_SCREENS = new Set([
  'auth-sign-in',
  'auth-device-code',
  'auth-connect-github',
  'auth-workspace-setup',
  'session-detail-focus',
]);

function describe(box: Box | null): string {
  if (!box) return 'empty';
  return `${box.left},${box.top} → ${box.right},${box.bottom} (${box.right - box.left + 1}×${box.bottom - box.top + 1})`;
}

/** Content-pixel count per row, ignoring the sidebar and the window chrome. */
function rowProfile(image: PNG, ignoreLeft: number): number[] {
  const background = [image.data[0]!, image.data[1]!, image.data[2]!];
  const profile = new Array<number>(image.height).fill(0);

  for (let y = 0; y < image.height; y += 1) {
    let count = 0;
    for (let x = ignoreLeft; x < image.width; x += 1) {
      if (x < CHROME_REGION.right && y < CHROME_REGION.bottom) continue;

      const offset = (y * image.width + x) * 4;
      if (
        Math.abs(image.data[offset]! - background[0]!) > CONTENT_THRESHOLD ||
        Math.abs(image.data[offset + 1]! - background[1]!) > CONTENT_THRESHOLD ||
        Math.abs(image.data[offset + 2]! - background[2]!) > CONTENT_THRESHOLD
      ) {
        count += 1;
      }
    }
    profile[y] = count;
  }

  return profile;
}

/**
 * The vertical shift that best aligns two row profiles.
 *
 * Cross-correlation rather than a bounding-box delta. A bounding box is decided by a single
 * outlying pixel - one stray element, or a decoration the app does not draw, moves it by
 * hundreds of pixels and the number becomes noise. A profile is decided by where the content
 * actually is, so the answer survives a screen whose content is not identical, which is the
 * normal case while data is still being wired.
 *
 * Returns null when neither image has enough content to correlate.
 */
function bestVerticalShift(reference: number[], rendered: number[], range = 220): number | null {
  const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
  if (total(reference) < 500 || total(rendered) < 500) return null;

  let bestShift = 0;
  let bestScore = -1;

  for (let shift = -range; shift <= range; shift += 1) {
    let score = 0;
    for (let y = 0; y < reference.length; y += 1) {
      const source = y + shift;
      if (source < 0 || source >= rendered.length) continue;
      // Multiplied rather than differenced: a product rewards rows that are busy in both,
      // which is what alignment means, and ignores rows that are empty in one.
      score += Math.min(reference[y]!, rendered[source]!);
    }

    if (score > bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }

  return bestShift;
}

function main(): void {
  const only = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

  if (!existsSync(CAPTURE_DIR)) {
    process.stderr.write(`No captures in ${CAPTURE_DIR}. Run \`bun run test:visual\` first.\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `${'screen'.padEnd(24)}${'theme'.padEnd(7)}${'shift'.padStart(7)}${'Δtop'.padStart(6)}` +
      `${'Δleft'.padStart(7)}${'Δcentre'.padStart(9)}  reference → rendered\n`,
  );
  process.stdout.write(
    'shift: pixels to move the rendered content down. Δcentre: the one that matters on a ' +
      'centred layout.\n\n',
  );

  for (const name of readdirSync(CAPTURE_DIR).sort()) {
    const match = /^(.+)\.(light|dark)\.png$/.exec(name);
    if (!match) continue;

    const [, slug, theme] = match;
    if (only.length > 0 && !only.includes(slug!)) continue;

    const baselinePath = join(BASELINE_DIR, `${slug}.${theme}.jpg`);
    if (!existsSync(baselinePath)) continue;

    // Sidebar width plus its border. Excluded on screens that have one so the measurement
    // describes the main pane rather than the chrome.
    const ignoreLeft = BARE_SCREENS.has(slug!) ? 0 : 241;

    const referenceImage = decode(baselinePath);
    const renderedImage = decode(join(CAPTURE_DIR, name));

    const reference = contentBox(referenceImage, ignoreLeft);
    const rendered = contentBox(renderedImage, ignoreLeft);

    const shift = bestVerticalShift(
      rowProfile(referenceImage, ignoreLeft),
      rowProfile(renderedImage, ignoreLeft),
    );

    // A negative shift means the rendered content sits lower than the reference and needs to
    // come up; positive means it needs to go down.
    const shiftLabel = shift === null ? '-' : String(-shift);
    const deltaTop = reference && rendered ? String(rendered.top - reference.top) : '-';
    const deltaLeft = reference && rendered ? String(rendered.left - reference.left) : '-';

    /*
     * Centre delta, which is the number that matters on a centred layout.
     *
     * A card whose content grew taller starts higher and ends lower while remaining perfectly
     * centred - so Δtop reads as a large offset and says nothing useful. Comparing centres
     * separates "positioned wrongly" from "contains a different amount", and only the first
     * is a layout bug.
     */
    const centreDelta =
      reference && rendered
        ? String(
            Math.round((rendered.top + rendered.bottom) / 2) -
              Math.round((reference.top + reference.bottom) / 2),
          )
        : '-';

    process.stdout.write(
      `${slug!.padEnd(24)}${theme!.padEnd(7)}${shiftLabel.padStart(7)}${deltaTop.padStart(6)}` +
        `${deltaLeft.padStart(7)}${centreDelta.padStart(9)}  ${describe(reference)} → ${describe(rendered)}\n`,
    );
  }
}

main();
