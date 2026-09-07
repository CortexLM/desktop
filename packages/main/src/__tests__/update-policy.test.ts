import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_UPDATE_FEED_URL,
  LATEST_CHANNEL_FEED_URL,
  STAGING_UPDATE_FEED_URL,
  resolveUpdateFeedUrl,
  shouldCheckForUpdates,
} from '../update-policy';

const repoRoot = resolve(__dirname, '../../../..');
const builderYml = readFileSync(resolve(repoRoot, 'electron-builder.yml'), 'utf8');
const buildWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/build.yml'), 'utf8');
const rcloneAction = readFileSync(
  resolve(repoRoot, '.github/actions/install-rclone/action.yml'),
  'utf8',
);
const publishAction = readFileSync(
  resolve(repoRoot, '.github/actions/publish-r2-feed/action.yml'),
  'utf8',
);
const stagingWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/staging.yml'), 'utf8');
const publishStaging = readFileSync(
  resolve(repoRoot, '.github/workflows/publish-staging.yml'),
  'utf8',
);

describe('resolveUpdateFeedUrl', () => {
  it('uses the production generic feed', () => {
    expect(resolveUpdateFeedUrl({})).toBe('https://releases.cortex.foundation/');
    expect(DEFAULT_UPDATE_FEED_URL).toBe('https://releases.cortex.foundation/');
  });

  it('names the software.cortex.foundation channel prefixes without baking them into production', () => {
    expect(STAGING_UPDATE_FEED_URL).toBe('https://software.cortex.foundation/staging/');
    expect(LATEST_CHANNEL_FEED_URL).toBe('https://software.cortex.foundation/latest/');
    expect(builderYml).toContain(`url: ${DEFAULT_UPDATE_FEED_URL}`);
    expect(builderYml).not.toContain(`url: ${STAGING_UPDATE_FEED_URL}`);
  });

  it('matches electron-builder.yml so the packaged app and CI publish the same origin', () => {
    expect(builderYml).toContain(`url: ${DEFAULT_UPDATE_FEED_URL}`);
    expect(builderYml).toContain('provider: generic');
    expect(builderYml).not.toMatch(/provider:\s*github/);
    expect(buildWorkflow).toContain('publish-feed');
    expect(buildWorkflow).toContain('releases.cortex.foundation');
    expect(buildWorkflow).toContain('environment: production');
    expect(buildWorkflow).toContain("vars.PRODUCTION_DEPLOY_ENABLED == 'true'");
  });

  it('publishes the production feed to R2 at the bucket root, not AWS S3', () => {
    expect(buildWorkflow).toContain('publish-r2-feed');
    expect(buildWorkflow).toContain("destination: r2:${{ vars.PRODUCTION_RELEASES_BUCKET || 'cortex-releases' }}");
    expect(buildWorkflow).toContain('software.cortex.foundation/latest/');
    expect(buildWorkflow).toContain(
      "destination: r2:${{ vars.PRODUCTION_SOFTWARE_BUCKET || 'cortex-software' }}/latest",
    );
    expect(buildWorkflow).not.toContain("if: ${{ vars.PRODUCTION_SOFTWARE_BUCKET != '' }}");
    expect(builderYml).toMatch(/afterSign:\s*scripts\/notarize\.js/);
    expect(builderYml).not.toMatch(/# afterSign:/);
    expect(buildWorkflow).not.toContain('aws s3');
    expect(buildWorkflow).not.toContain('configure-aws-credentials');
    expect(buildWorkflow).not.toMatch(/provider:\s*github/);
    expect(publishAction).toContain('rclone copy');
    expect(publishAction).not.toContain('rclone sync');
    expect(publishAction).toContain('r2.cloudflarestorage.com');
    expect(rcloneAction).toContain('RCLONE_SHA256');
    expect(rcloneAction).toContain('7d69057e69385f6514a9684c7eaa424d972096b130284bb34dd967c4ed4f9dad');
    expect(rcloneAction).toContain('sha256sum -c --strict');
    expect(rcloneAction).toContain('downloads.rclone.org');
    expect(rcloneAction.indexOf('sha256sum -c --strict')).toBeLessThan(rcloneAction.indexOf('unzip'));
  });

  it('keeps the staging-branch workflow from writing any R2 feed', () => {
    expect(stagingWorkflow).toContain('environment: staging');
    expect(stagingWorkflow).not.toContain('R2_ACCESS_KEY_ID');
    expect(stagingWorkflow).not.toContain('R2_SECRET_ACCESS_KEY');
    expect(stagingWorkflow).not.toContain('r2.cloudflarestorage.com');
    expect(stagingWorkflow).not.toContain('rclone copy');
    expect(stagingWorkflow).not.toContain('publish-r2-feed');
  });

  it('publishes the staging channel from a main SHA, never the production bucket root', () => {
    expect(publishStaging).toContain('workflow_dispatch');
    expect(publishStaging).toContain(STAGING_UPDATE_FEED_URL);
    expect(publishStaging).toContain('/staging');
    expect(publishStaging).toContain('merge-base --is-ancestor');
    expect(publishStaging).toContain('git switch --detach');
    expect(publishStaging).not.toMatch(/ref:\s*\$\{\{\s*needs\.verify-sha\.outputs\.sha/);
    expect(publishStaging).not.toMatch(/ref:\s*\$\{\{\s*github\.event\.inputs\.sha/);
    expect(publishStaging).toContain("environment: staging");
    expect(publishStaging).not.toContain('environment: production');
    expect(publishStaging).toContain("bucket-check: cortex-releases");
    expect(publishStaging).toContain("destination: r2:${{ vars.STAGING_SOFTWARE_BUCKET || 'cortex-software' }}/staging");
    expect(publishStaging).not.toContain("|| 'cortex-releases'");
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
