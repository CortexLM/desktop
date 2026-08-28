import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_UPDATE_FEED_URL, resolveUpdateFeedUrl, shouldCheckForUpdates } from '../update-policy';

const repoRoot = resolve(__dirname, '../../../..');
const builderYml = readFileSync(resolve(repoRoot, 'electron-builder.yml'), 'utf8');
const buildWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/build.yml'), 'utf8');

describe('resolveUpdateFeedUrl', () => {
  it('uses the production generic feed', () => {
    expect(resolveUpdateFeedUrl({})).toBe('https://releases.cortex.foundation/');
    expect(DEFAULT_UPDATE_FEED_URL).toBe('https://releases.cortex.foundation/');
  });

  it('matches electron-builder.yml so the packaged app and CI publish the same origin', () => {
    expect(builderYml).toContain(`url: ${DEFAULT_UPDATE_FEED_URL}`);
    expect(builderYml).toContain('provider: generic');
    expect(buildWorkflow).toContain('publish-feed');
    expect(buildWorkflow).toContain('releases.cortex.foundation');
    expect(buildWorkflow).toContain('latest.yml');
    expect(buildWorkflow).toContain('PRODUCTION_RELEASES_BUCKET');
  });

  it('accepts CORTEX_UPDATE_FEED_URL as a local-feed override', () => {
    expect(resolveUpdateFeedUrl({ CORTEX_UPDATE_FEED_URL: 'http://127.0.0.1:4780/' })).toBe(
      'http://127.0.0.1:4780/',
    );
  });

  it('ignores a blank override rather than inventing a second channel', () => {
    expect(resolveUpdateFeedUrl({ CORTEX_UPDATE_FEED_URL: '   ' })).toBe(DEFAULT_UPDATE_FEED_URL);
  });
});

describe('shouldCheckForUpdates', () => {
  it('skips development and unpackaged Electron', () => {
    expect(shouldCheckForUpdates({ NODE_ENV: 'development' }, true)).toBe(false);
    expect(shouldCheckForUpdates({ NODE_ENV: 'production' }, false)).toBe(false);
  });

  it('checks a packaged production build', () => {
    expect(shouldCheckForUpdates({ NODE_ENV: 'production' }, true)).toBe(true);
  });

  it('allows an explicit test-feed check', () => {
    expect(shouldCheckForUpdates({ NODE_ENV: 'development', CORTEX_FORCE_UPDATE_CHECK: '1' }, false)).toBe(
      true,
    );
  });
});
