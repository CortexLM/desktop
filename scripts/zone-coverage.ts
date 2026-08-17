/**
 * Reads an lcov.info and reports per-zone line/function/branch totals.
 *
 * Exists because the `text` reporter is not a reliable way to read the coverage
 * of a directory: it elides fully-covered groups and truncates long file lists,
 * so an absent row is ambiguous between "100%" and "never instrumented". The
 * lcov records carry LF/LH/FNF/FNH/BRF/BRH per file, which is unambiguous.
 *
 * Usage: bun scripts/zone-coverage.ts <lcov path> <zone substring>...
 */
import { readFileSync } from 'node:fs';

interface Totals {
  lf: number;
  lh: number;
  fnf: number;
  fnh: number;
  brf: number;
  brh: number;
  files: number;
}

const emptyTotals = (): Totals => ({ lf: 0, lh: 0, fnf: 0, fnh: 0, brf: 0, brh: 0, files: 0 });

const pct = (hit: number, found: number): string =>
  found === 0 ? 'n/a' : `${((hit / found) * 100).toFixed(2)}%`;

function main(): void {
  const [lcovPath, ...zones] = process.argv.slice(2);
  if (!lcovPath || zones.length === 0) {
    console.error('usage: bun scripts/zone-coverage.ts <lcov path> <zone substring>...');
    process.exit(2);
  }

  const records = readFileSync(lcovPath, 'utf8').split('end_of_record');
  const perZone = new Map<string, Totals>(zones.map((z) => [z, emptyTotals()]));
  const perFile: Array<{ file: string; lf: number; lh: number }> = [];

  for (const record of records) {
    const sf = /^SF:(.*)$/m.exec(record)?.[1];
    if (!sf) continue;
    const zone = zones.find((z) => sf.includes(z));
    if (!zone) continue;

    const num = (tag: string): number => Number(new RegExp(`^${tag}:(\\d+)$`, 'm').exec(record)?.[1] ?? 0);
    const t = perZone.get(zone)!;
    const lf = num('LF');
    const lh = num('LH');
    t.lf += lf;
    t.lh += lh;
    t.fnf += num('FNF');
    t.fnh += num('FNH');
    t.brf += num('BRF');
    t.brh += num('BRH');
    t.files += 1;
    perFile.push({ file: sf, lf, lh });
  }

  for (const [zone, t] of perZone) {
    console.log(
      `${zone.padEnd(28)} files=${String(t.files).padStart(2)}  ` +
        `lines ${pct(t.lh, t.lf).padStart(7)} (${t.lh}/${t.lf})  ` +
        `funcs ${pct(t.fnh, t.fnf).padStart(7)} (${t.fnh}/${t.fnf})  ` +
        `branches ${pct(t.brh, t.brf).padStart(7)} (${t.brh}/${t.brf})`
    );
  }

  console.log('\nper file:');
  for (const f of perFile.sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(`  ${f.file.padEnd(62)} ${pct(f.lh, f.lf).padStart(7)} (${f.lh}/${f.lf})`);
  }
}

main();
