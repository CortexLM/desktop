import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, lstatSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export function validateConfig(env) {
  assert.match(env.INPUT_SHA ?? '', /^[0-9a-f]{40}$/, 'A full lowercase SHA is required');
  const origin = new URL(env.CORTEX_STAGING_API_ORIGIN);
  assert.equal(origin.protocol, 'https:');
  assert.equal(origin.origin, env.CORTEX_STAGING_API_ORIGIN, 'Use an HTTPS origin without path or credentials');
  assert.notEqual(origin.hostname.replace(/\.$/, ''), 'api.cortex.foundation', 'Production API is forbidden');
  if (env.PUBLISH_FEED === 'true') {
    assert.equal(env.STAGING_FEED_ENABLED, 'true', 'Staging publication must be explicitly enabled');
    // ponytail: one isolated bucket; approve a new exact destination before changing this allowlist.
    assert.equal(env.STAGING_SOFTWARE_BUCKET, 'cortex-software-staging', 'Only the dedicated staging bucket is permitted');
  }
}

function artifactNames(sha, platform) {
  assert.match(sha ?? '', /^[0-9a-f]{40}$/);
  assert.ok(platform === 'linux' || platform === 'win', 'Unsupported staging platform');
  return platform === 'win'
    ? [`Cortex-${sha}-x64.exe`, `Cortex-${sha}-x64.exe.blockmap`, 'latest.yml']
    : [`Cortex-${sha}-x64.AppImage`, `Cortex-${sha}-x64.deb`, 'latest-linux.yml'];
}

export function builderConfig(env, platform = 'linux') {
  validateConfig(env);
  artifactNames(env.INPUT_SHA, platform);
  if (platform === 'win') {
    assert.ok(env.STAGING_WINDOWS_PUBLISHER_NAME?.trim(), 'Expected Windows publisher is required');
    assert.equal(env.STAGING_WINDOWS_PUBLISHER_NAME, env.STAGING_WINDOWS_PUBLISHER_NAME.trim());
  }
  return {
    extends: './electron-builder.yml',
    appId: 'foundation.cortex.desktop.staging',
    productName: 'Cortex Staging',
    executableName: 'Cortex-staging',
    // ponytail: this workflow builds x64 only; add per-target names with another architecture.
    artifactName: `Cortex-${env.INPUT_SHA}-x64.\${ext}`,
    publish: { provider: 'generic', url: 'https://software.cortex.foundation/staging', channel: 'latest' },
    ...(platform === 'win' ? {
      forceCodeSigning: true,
      win: {
        target: [{ target: 'nsis', arch: ['x64'] }],
        verifyUpdateCodeSignature: true,
        signtoolOptions: { publisherName: env.STAGING_WINDOWS_PUBLISHER_NAME },
      },
      nsis: {
        shortcutName: 'Cortex Staging',
        uninstallDisplayName: 'Cortex Staging',
      },
    } : {}),
  };
}

export function verifyArtifacts(directory, sha, platform = 'linux') {
  const names = artifactNames(sha, platform);
  const inventory = JSON.parse(readFileSync(`${directory}/inventory.json`, 'utf8'));
  assert.equal(inventory.sha, sha);
  assert.equal(inventory.platform, platform);
  assert.deepEqual(inventory.files.map(file => file.name).sort(), [...names].sort());
  for (const file of inventory.files) {
    assert.ok(lstatSync(`${directory}/${file.name}`).isFile());
    const bytes = readFileSync(`${directory}/${file.name}`);
    assert.ok(bytes.length > 0);
    assert.equal(createHash('sha512').update(bytes).digest('base64'), file.sha512);
  }
  return inventory;
}

export function inventoryArtifacts(directory, sha, platform = 'linux') {
  const names = artifactNames(sha, platform);
  const files = names.map(name => {
    assert.ok(lstatSync(`${directory}/${name}`).isFile());
    const bytes = readFileSync(`${directory}/${name}`);
    assert.ok(bytes.length > 0);
    return { name, sha512: createHash('sha512').update(bytes).digest('base64') };
  });
  const require = createRequire(import.meta.url);
  const builderRequire = createRequire(require.resolve('electron-builder'));
  const manifest = builderRequire('js-yaml').load(readFileSync(`${directory}/${names[2]}`, 'utf8'));
  assert.equal(manifest.path, names[0]);
  assert.equal(manifest.sha512, files[0].sha512);
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
  if (platform === 'win') assert.deepEqual(manifest.files.map(file => file.url), [names[0]]);
  assert.ok(manifest.files.some(file => file.url === names[0]));
  for (const entry of manifest.files) {
    const file = files.find(file => file.name === entry.url && file.name !== names[2]);
    assert.ok(file, 'Manifest references an unapproved artifact');
    assert.equal(entry.sha512, file.sha512);
    assert.equal(entry.size, lstatSync(`${directory}/${file.name}`).size);
  }
  writeFileSync(`${directory}/inventory.json`, JSON.stringify({ sha, platform, files }, null, 2));
  return verifyArtifacts(directory, sha, platform);
}

const [command, directory, platform = 'linux'] = process.argv.slice(2);
if (command === 'config') {
  writeFileSync('.staging-builder.json', JSON.stringify(builderConfig(process.env, directory ?? 'linux')));
} else if (command === 'inventory') {
  const inventory = inventoryArtifacts(directory, process.env.INPUT_SHA, platform);
  console.log(`Verified installers and manifest: ${inventory.files.map(file => file.name).join(', ')}`);
} else if (command === 'verify') {
  const inventory = verifyArtifacts(directory, process.env.INPUT_SHA, platform);
  assert.deepEqual(readdirSync(directory).sort(), [
    ...inventory.files.map(file => file.name), 'inventory.json',
  ].sort());
  console.log('Verified staging artifact inventory');
}
