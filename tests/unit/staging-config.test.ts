import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateConfig, verifyArtifacts } from '../../scripts/staging-config.mjs';

const sha = 'a'.repeat(40);
const config = {
  INPUT_SHA: sha,
  CORTEX_STAGING_API_ORIGIN: 'https://staging-api.cortex.foundation',
  PUBLISH_FEED: 'true',
  STAGING_FEED_ENABLED: 'true',
  STAGING_SOFTWARE_BUCKET: 'cortex-software-staging',
};

describe('staging publication boundaries', () => {
  it('accepts only explicit staging configuration', () => {
    expect(() => validateConfig(config)).not.toThrow();
    for (const patch of [
      { INPUT_SHA: 'main' },
      { CORTEX_STAGING_API_ORIGIN: '' },
      { CORTEX_STAGING_API_ORIGIN: 'https://api.cortex.foundation' },
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

  it('rejects altered, missing, foreign-SHA and path-traversal artifacts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'cortex-staging-'));
    try {
      const files = [`Cortex-${sha}-x64.AppImage`, `Cortex-${sha}-x64.deb`, 'latest-linux.yml'].map(name => {
        writeFileSync(join(directory, name), name);
        return { name, sha512: createHash('sha512').update(name).digest('base64') };
      });
      const inventory = { sha, files };
      const save = () => writeFileSync(join(directory, 'inventory.json'), JSON.stringify(inventory));
      save();
      expect(() => verifyArtifacts(directory, sha)).not.toThrow();
      expect(() => verifyArtifacts(directory, 'b'.repeat(40))).toThrow();
      writeFileSync(join(directory, files[0].name), 'tampered');
      expect(() => verifyArtifacts(directory, sha)).toThrow();
      rmSync(join(directory, files[0].name));
      expect(() => verifyArtifacts(directory, sha)).toThrow();
      files[0].name = '../installer.AppImage';
      save();
      expect(() => verifyArtifacts(directory, sha)).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
