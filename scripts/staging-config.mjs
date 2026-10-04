import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

export function verifyArtifacts(directory, sha) {
  const inventory = JSON.parse(readFileSync(`${directory}/inventory.json`, 'utf8'));
  assert.equal(inventory.sha, sha);
  assert.deepEqual(inventory.files.map(file => file.name).sort(), [
    `Cortex-${sha}-x64.AppImage`, `Cortex-${sha}-x64.deb`, 'latest-linux.yml',
  ].sort());
  for (const file of inventory.files) {
    const bytes = readFileSync(`${directory}/${file.name}`);
    assert.ok(bytes.length > 0);
    assert.equal(createHash('sha512').update(bytes).digest('base64'), file.sha512);
  }
  return inventory;
}

const [command, directory] = process.argv.slice(2);
if (command === 'config') {
  validateConfig(process.env);
  writeFileSync('.staging-builder.json', JSON.stringify({
    extends: './electron-builder.yml',
    // ponytail: this workflow builds x64 only; add per-target names with another architecture.
    artifactName: `Cortex-${process.env.INPUT_SHA}-x64.\${ext}`,
    publish: { provider: 'generic', url: 'https://software.cortex.foundation/staging/', channel: 'latest' },
  }));
} else if (command === 'inventory') {
  const sha = process.env.INPUT_SHA;
  assert.match(sha ?? '', /^[0-9a-f]{40}$/);
  const names = [`Cortex-${sha}-x64.AppImage`, `Cortex-${sha}-x64.deb`, 'latest-linux.yml'];
  const files = names.map(name => {
    const bytes = readFileSync(`${directory}/${name}`);
    assert.ok(statSync(`${directory}/${name}`).isFile() && bytes.length > 0);
    return { name, sha512: createHash('sha512').update(bytes).digest('base64') };
  });
  const require = createRequire(import.meta.url);
  const builderRequire = createRequire(require.resolve('electron-builder'));
  const manifest = builderRequire('js-yaml').load(readFileSync(`${directory}/latest-linux.yml`, 'utf8'));
  assert.equal(manifest.path, names[0]);
  assert.equal(manifest.sha512, files[0].sha512);
  assert.ok(manifest.files.length > 0);
  for (const entry of manifest.files) {
    const file = files.find(file => file.name === entry.url && file.name !== 'latest-linux.yml');
    assert.ok(file, 'Manifest references an unapproved artifact');
    assert.equal(entry.sha512, file.sha512);
  }
  writeFileSync(`${directory}/inventory.json`, JSON.stringify({ sha, files }, null, 2));
  verifyArtifacts(directory, sha);
  console.log(`Verified installers and manifest: ${names.join(', ')}`);
} else if (command === 'verify') {
  const inventory = verifyArtifacts(directory, process.env.INPUT_SHA);
  assert.deepEqual(readdirSync(directory).sort(), [
    ...inventory.files.map(file => file.name), 'inventory.json',
  ].sort());
  console.log('Verified staging artifact inventory');
}
