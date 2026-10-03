import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
from datetime import datetime, timezone

OUT = Path('/tmp/opencode/desktop-sdk-031-readback')
RELEASE = Path('/root/cortex-goals/releases/sdk-0.3.1-ce05a6040ec0')
SOURCE = Path('/root/.local/share/opencode/worktree/77e7f3a6389915e58f4ac7433a96efadcf1c8c67/goal-sdk')
DESKTOP = Path('/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite')
PIN = 'ce05a6040ec05ac479d23dc2f701c8835a529663'
RUNTIME = '216396b1295e512d4c26d21be720bbae1facc0bf'

def sha(data):
    return hashlib.sha256(data).hexdigest()

def git(spec):
    return subprocess.check_output(['git', '-C', str(SOURCE), 'show', spec])

receipt = json.loads((RELEASE / 'receipt.json').read_text())
assert receipt['source_sha'] == PIN
assert sha((RELEASE / 'receipt.json').read_bytes()) == '0dfaf694aef44d0a9a8130a376eb9c95d69b220b8f4d57eff17fa6cf5f76a5b9'
schema = git(PIN + ':openapi/cortex.openapi.json')
assert sha(schema) == receipt['schema_sha256'] == '93806bd0f31a0499b6bded99a25b319a90cd5afc011b70021ba921ed12107724'
blob = subprocess.check_output(['git', '-C', str(SOURCE), 'rev-parse', PIN + ':openapi/cortex.openapi.json'], text=True).strip()
assert blob == receipt['schema_blob'] == 'd6d46014d1c436b96540529dca2a3005556ae920'
assert schema == git(receipt['schema_source_sha'] + ':openapi/cortex.openapi.json')
(OUT / 'canonical.openapi.json').write_bytes(schema)
checks = []
for check in receipt['checks']:
    assert check['exit_code'] == 0
    path = Path(check['log'])
    assert path.parent == RELEASE
    assert sha(path.read_bytes()) == check['sha256']
    checks.append({'name': check['name'], 'exit_code': 0, 'log_sha256': check['sha256']})
for path, expected in receipt['generated'].items():
    assert sha(git(PIN + ':' + path)) == expected
packages = []
for artifact in receipt['artifacts']:
    path = Path(artifact['path'])
    data = path.read_bytes()
    assert sha(data) == artifact['sha256']
    assert len(data) == artifact['bytes']
    short = 'sdk' if path.name.startswith('cortex-sdk-') else 'api-types'
    target = OUT / 'node_modules' / '@cortex' / short
    source_count = 0
    with tarfile.open(path) as archive:
        for member in archive.getmembers():
            parts = Path(member.name).parts
            assert parts[0] == 'package' and '..' not in parts
            assert not member.issym() and not member.islnk()
            if not member.isfile():
                continue
            relative = Path(*parts[1:])
            content = archive.extractfile(member).read()
            dest = target / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(content)
            if str(relative).startswith('src/'):
                assert content == git(PIN + ':packages/' + short + '/' + str(relative))
                assert content == git(RUNTIME + ':packages/' + short + '/' + str(relative))
                source_count += 1
    package = json.loads((target / 'package.json').read_text())
    assert package['name'] == '@cortex/' + short
    assert package['version'] == ('0.3.1' if short == 'sdk' else '0.2.0')
    if short == 'sdk':
        assert package['peerDependencies'] == {'@cortex/api-types': '0.2.0'}
        assert package['peerDependenciesMeta']['@cortex/api-types']['optional'] is True
    for value in package.get('dependencies', {}).values():
        assert not value.startswith(('file:', 'workspace:', 'link:'))
    packages.append({'file': path.name, 'sha256': sha(data), 'package': package, 'source_files_compared': source_count})
baseline = {}
for filename, expected in {
    'cortex-sdk-0.2.0.tgz': '536f57c026a7a8a1f04f1eb80b3f682f6becd514e789b998fcf28b86de7df9e7',
    'cortex-api-types-0.1.0.tgz': '6e97d4f92c5e098ac989589fc81ca70bed1abc018383994e397c49d61837b134',
}.items():
    actual = sha((DESKTOP / 'vendor' / filename).read_bytes())
    assert actual == expected
    baseline[filename] = actual
negative = json.loads((RELEASE / 'negative-evidence.json').read_text())
for name, expected in negative.items():
    assert sha((RELEASE / name).read_bytes()) == expected
result = {
    'checked_at': datetime.now(timezone.utc).isoformat(),
    'scope': 'Read-only admission: hashes, package metadata, committed source and receipt integrity; no upstream suites/build/native replay',
    'result': 'PASS', 'source': PIN, 'runtime_source': RUNTIME,
    'schema_blob': blob, 'schema_sha256': sha(schema),
    'generated_source_files_compared': len(receipt['generated']),
    'packages': packages, 'owner_checks_hash_verified_not_rerun': checks,
    'preserved_negative_logs': negative,
    'unchanged_desktop_archives': baseline,
}
(OUT / 'admission.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
