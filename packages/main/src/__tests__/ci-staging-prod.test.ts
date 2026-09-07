import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../../..');

const CODEBUILD_LINUX_RUNNER =
  "codebuild-cortex-gha-${{ vars.CODEBUILD_RUNNER_ARCH == 'x64' && 'x64' || 'arm64' }}-${{ github.run_id }}-${{ github.run_attempt }}";

function read(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), 'utf8');
}

const buildWorkflow = read('.github/workflows/build.yml');
const stagingWorkflow = read('.github/workflows/staging.yml');
const publishStaging = read('.github/workflows/publish-staging.yml');
const createScript = read('scripts/create-codebuild-gha-runner.sh');
const terraformMain = read('infra/codebuild-gha/main.tf');
const runbook = read('docs/runbooks/desktop-staging-prod.md');
const monitoring = read('.github/workflows/continuous-monitoring.yml');
const builder = read('electron-builder.yml');

describe('production release gates', () => {
  it('requires a production signing identity and notarization credentials before building', () => {
    const build = buildWorkflow.split('  release:')[0];
    expect(build).toContain('environment: production');
    expect(build).toContain('${MACOS_CERTIFICATE:?');
    expect(build).toContain('${WINDOWS_CERTIFICATE:?');
    expect(build).toContain('${APPLE_APP_SPECIFIC_PASSWORD:?');
    expect(build).toContain('${APPLE_TEAM_ID:?');
    expect(build).toContain('--mac --publish never -c.forceCodeSigning=true');
    expect(build).toContain('--win --x64 --publish never -c.forceCodeSigning=true');
    expect(builder).toContain('notarize: true');
    expect(builder).toContain('verifyUpdateCodeSignature: true');
    expect(builder).not.toContain('entitlements: build/entitlements.mac.plist');
  });

  it('does not swallow build or typecheck failures in monitoring', () => {
    const checks = monitoring.split('      - name: Build check')[1]?.split('      - name: Lint check')[0];
    expect(checks).toContain('bun run build');
    expect(checks).toContain('bun run typecheck');
    expect(checks).not.toContain('continue-on-error');
  });
});

describe('CodeBuild runner labels for long Electron dist', () => {
  it('uses the cortex-gha-arm64 (or x64) label with run_id and run_attempt', () => {
    expect(buildWorkflow).toContain(CODEBUILD_LINUX_RUNNER);
    expect(stagingWorkflow).toContain(CODEBUILD_LINUX_RUNNER);
    expect(publishStaging).toContain(CODEBUILD_LINUX_RUNNER);
  });

  it('does not send Linux electron-builder to ubuntu-latest', () => {
    expect(buildWorkflow).toContain(`runner: ${CODEBUILD_LINUX_RUNNER}`);
    expect(buildWorkflow).not.toMatch(/ubuntu-latest\s*\n\s+platform: linux/);
    expect(stagingWorkflow).toMatch(
      /name: Build web and Electron artifacts\n\s+runs-on: codebuild-cortex-gha-/,
    );
    expect(publishStaging).toMatch(
      /name: Linux Electron dist \(CodeBuild\)\n(?:.*\n)*?\s+runs-on: codebuild-cortex-gha-/,
    );
    expect(createScript).toContain('cortex-gha-arm64');
    expect(createScript).toContain('cortex-gha-x64');
    expect(createScript).toContain('WORKFLOW_JOB_QUEUED');
    expect(createScript).toContain('Do not run aws sso login');
    expect(terraformMain).toContain('cortex-gha-${each.key}');
    expect(terraformMain).toContain('WORKFLOW_JOB_QUEUED');
  });

  it('documents the agent path from main SHA to staging then a prod tag', () => {
    expect(runbook).toContain('gh workflow run publish-staging.yml');
    expect(runbook).toContain('software.cortex.foundation/staging/');
    expect(runbook).toContain('software.cortex.foundation/latest/');
    expect(runbook).toContain('releases.cortex.foundation');
    expect(runbook).toContain('Do not touch CortexLM/cortex');
    expect(runbook).toContain('git tag vX.Y.Z');
  });

  it('does not pass a workflow_dispatch SHA into actions/checkout ref', () => {
    expect(publishStaging).not.toMatch(/ref:\s*\$\{\{\s*needs\.verify-sha\.outputs\.sha/);
    expect(publishStaging).not.toMatch(/ref:\s*\$\{\{\s*github\.event\.inputs\.sha/);
    expect(publishStaging).toContain('git switch --detach');
    const distJob = publishStaging.split('dist-linux:')[1]?.split('publish-feed:')[0] ?? '';
    expect(distJob).not.toContain('environment: staging');
    expect(publishStaging.split('publish-feed:')[1] ?? '').toContain('environment: staging');
  });
});
