import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { builderConfig, inventoryArtifacts, validateConfig, verifyArtifacts } from '../../scripts/staging-config.mjs';

const sha = 'a'.repeat(40);
const config = {
  INPUT_SHA: sha,
  CORTEX_STAGING_API_ORIGIN: 'https://staging-api.cortex.foundation',
  PUBLISH_FEED: 'true',
  STAGING_FEED_ENABLED: 'true',
  STAGING_SOFTWARE_BUCKET: 'cortex-software-staging',
  STAGING_WINDOWS_PUBLISHER_NAME: 'Cortex Foundation',
};

function fixture(directory: string, platform: 'linux' | 'win') {
  const names = platform === 'win'
    ? [`Cortex-${sha}-x64.exe`, `Cortex-${sha}-x64.exe.blockmap`, 'latest.yml']
    : [`Cortex-${sha}-x64.AppImage`, `Cortex-${sha}-x64.deb`, 'latest-linux.yml'];
  const files = names.slice(0, 2).map(name => {
    writeFileSync(join(directory, name), name);
    return { url: name, sha512: createHash('sha512').update(name).digest('base64'), size: Buffer.byteLength(name) };
  });
  const manifest = { path: names[0], sha512: files[0].sha512, files: platform === 'win' ? files.slice(0, 1) : files };
  writeFileSync(join(directory, names[2]), JSON.stringify(manifest));
  return { names, manifest };
}

describe('staging publication boundaries', () => {
  it('accepts only explicit staging configuration', () => {
    expect(() => validateConfig(config)).not.toThrow();
    for (const patch of [
      { INPUT_SHA: 'main' },
      { CORTEX_STAGING_API_ORIGIN: '' },
      { CORTEX_STAGING_API_ORIGIN: 'https://api.cortex.foundation' },
      { CORTEX_STAGING_API_ORIGIN: 'https://api.cortex.foundation.' },
      { CORTEX_STAGING_API_ORIGIN: 'http://staging-api.cortex.foundation' },
      { CORTEX_STAGING_API_ORIGIN: 'https://user:password@staging-api.cortex.foundation' },
      { CORTEX_STAGING_API_ORIGIN: 'https://staging-api.cortex.foundation/path' },
      { STAGING_FEED_ENABLED: '' },
      { STAGING_SOFTWARE_BUCKET: '' },
      { STAGING_SOFTWARE_BUCKET: 'cortex-software' },
      { STAGING_SOFTWARE_BUCKET: 'cortex-releases' },
    ]) expect(() => validateConfig({ ...config, ...patch })).toThrow();
    expect(() => validateConfig({ ...config, PUBLISH_FEED: 'false', STAGING_FEED_ENABLED: '' })).not.toThrow();
  });

  it('isolates staging identity and forces publisher-verified Windows signing', () => {
    const production = readFileSync('electron-builder.yml', 'utf8');
    const windows = builderConfig(config, 'win');
    expect(windows).toMatchObject({
      appId: 'foundation.cortex.desktop.staging', productName: 'Cortex Staging', executableName: 'Cortex-staging',
      forceCodeSigning: true,
      publish: { provider: 'generic', url: 'https://software.cortex.foundation/staging', channel: 'latest' },
      win: { target: [{ target: 'nsis', arch: ['x64'] }], verifyUpdateCodeSignature: true, signtoolOptions: { publisherName: config.STAGING_WINDOWS_PUBLISHER_NAME } },
      nsis: { shortcutName: 'Cortex Staging', uninstallDisplayName: 'Cortex Staging' },
    });
    expect(windows.artifactName).toBe(`Cortex-${sha}-x64.\${ext}`);
    expect(builderConfig(config).forceCodeSigning).toBeUndefined();
    expect(readFileSync('electron-builder.yml', 'utf8')).toBe(production);
    for (const name of ['', ' ', ' Cortex Foundation']) {
      expect(() => builderConfig({ ...config, STAGING_WINDOWS_PUBLISHER_NAME: name }, 'win')).toThrow();
    }
  });

  for (const platform of ['linux', 'win'] as const) {
    it(`${platform}: rejects altered, missing, foreign-SHA and path-traversal artifacts`, () => {
      const directory = mkdtempSync(join(tmpdir(), 'cortex-staging-'));
      try {
        const { names } = fixture(directory, platform);
        const inventory = inventoryArtifacts(directory, sha, platform);
        expect(() => verifyArtifacts(directory, sha, platform)).not.toThrow();
        expect(() => verifyArtifacts(directory, 'b'.repeat(40), platform)).toThrow();
        expect(() => verifyArtifacts(directory, sha, platform === 'win' ? 'linux' : 'win')).toThrow();
        writeFileSync(join(directory, names[1]), 'tampered');
        expect(() => verifyArtifacts(directory, sha, platform)).toThrow();
        rmSync(join(directory, names[1]));
        expect(() => verifyArtifacts(directory, sha, platform)).toThrow();
        inventory.files[0].name = '../installer.exe';
        writeFileSync(join(directory, 'inventory.json'), JSON.stringify(inventory));
        expect(() => verifyArtifacts(directory, sha, platform)).toThrow();
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });

    it(`${platform}: refuses manifest redirects, wrong hashes, sizes and extra publication files`, () => {
      const directory = mkdtempSync(join(tmpdir(), 'cortex-staging-'));
      try {
        const { names, manifest } = fixture(directory, platform);
        for (const patch of [
          { path: 'https://example.com/installer.exe' },
          { sha512: 'wrong' },
          { files: [] },
          { files: [{ ...manifest.files[0], url: '../installer.exe' }] },
          { files: [{ ...manifest.files[0], size: 0 }] },
          { files: [{ ...manifest.files[0], sha512: 'wrong' }] },
        ]) {
          writeFileSync(join(directory, names[2]), JSON.stringify({ ...manifest, ...patch }));
          expect(() => inventoryArtifacts(directory, sha, platform)).toThrow();
        }
        writeFileSync(join(directory, names[2]), JSON.stringify(manifest));
        inventoryArtifacts(directory, sha, platform);
        const verify = () => spawnSync(process.execPath, ['scripts/staging-config.mjs', 'verify', directory, platform], {
          env: { ...process.env, INPUT_SHA: sha }, encoding: 'utf8',
        });
        expect(verify().status).toBe(0);
        writeFileSync(join(directory, 'foreign.exe'), 'unapproved');
        expect(verify().status).not.toBe(0);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
