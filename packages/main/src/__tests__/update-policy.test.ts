import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DEFAULT_UPDATE_FEED_URL, resolveUpdateFeedUrl, shouldCheckForUpdates } from '../update-policy';

const repoRoot = resolve(__dirname, '../../../..');
const builderYml = readFileSync(resolve(repoRoot, 'electron-builder.yml'), 'utf8');
const buildWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/build.yml'), 'utf8');
const stagingWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/staging.yml'), 'utf8');

describe('resolveUpdateFeedUrl', () => {
  it('uses the production generic feed', () => {
    expect(resolveUpdateFeedUrl({})).toBe('https://releases.cortex.foundation/');
    expect(DEFAULT_UPDATE_FEED_URL).toBe('https://releases.cortex.foundation/');
  });

  it('matches electron-builder.yml so the packaged app and CI publish the same origin', () => {
    expect(builderYml).toContain(`url: ${DEFAULT_UPDATE_FEED_URL}`);
    expect(builderYml).toContain('provider: generic');
    expect(builderYml).not.toMatch(/provider:\s*github/);
    expect(buildWorkflow).toContain('publish-feed');
    expect(buildWorkflow).toContain('releases.cortex.foundation');
    expect(buildWorkflow).toContain('latest.yml');
    expect(buildWorkflow).toContain('environment: production');
    expect(buildWorkflow).toContain("vars.PRODUCTION_DEPLOY_ENABLED == 'true'");
  });

  it('publishes the production feed to R2 at the bucket root, not AWS', () => {
    expect(buildWorkflow).toContain('rclone copy');
    expect(buildWorkflow).toContain('r2.cloudflarestorage.com');
    expect(buildWorkflow).toContain('cortex-releases');
    expect(buildWorkflow).toContain('R2_ACCESS_KEY_ID');
    expect(buildWorkflow).toContain('R2_SECRET_ACCESS_KEY');
    expect(buildWorkflow).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(buildWorkflow).toContain('PRODUCTION_RELEASES_BUCKET');
    expect(buildWorkflow).not.toContain('aws s3');
    expect(buildWorkflow).not.toContain('configure-aws-credentials');
    expect(buildWorkflow).not.toContain('rclone sync');
    expect(buildWorkflow).not.toMatch(/provider:\s*github/);
    expect(buildWorkflow).toContain('RCLONE_SHA256');
    expect(buildWorkflow).toContain('7d69057e69385f6514a9684c7eaa424d972096b130284bb34dd967c4ed4f9dad');
    expect(buildWorkflow).toContain('sha256sum -c --strict');
  });

  it('keeps staging from writing the production R2 feed', () => {
    expect(stagingWorkflow).toContain('environment: staging');
    expect(stagingWorkflow).not.toContain('R2_ACCESS_KEY_ID');
    expect(stagingWorkflow).not.toContain('R2_SECRET_ACCESS_KEY');
    expect(stagingWorkflow).not.toContain('r2.cloudflarestorage.com');
    expect(stagingWorkflow).not.toContain('rclone copy');
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
