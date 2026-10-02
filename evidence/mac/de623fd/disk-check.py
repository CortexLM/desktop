from pathlib import Path
import json, stat, sqlite3, sys

directory = Path('/tmp/opencode/desktop-mcp-ca08282/engine')
stage = sys.argv[1]
assert stage in ['saved', 'removed']
secrets = [b'private-header-value', b'private-path', b'sk-test-native-mcp-5678']
files = []
for name in ['cortex.db', 'cortex.db-wal', 'credentials.json', 'mcp-credentials.json']:
    path = directory / name
    if not path.exists():
        assert name == 'cortex.db-wal'
        continue
    content = path.read_bytes()
    assert all(secret not in content for secret in secrets), name
    files.append(name)
credentials = json.loads((directory / 'credentials.json').read_text())
mcp = json.loads((directory / 'mcp-credentials.json').read_text())
for name, values in [('credentials.json', credentials), ('mcp-credentials.json', mcp)]:
    assert stat.S_IMODE((directory / name).stat().st_mode) == 0o600
    assert all(value.startswith('e:') for value in values.values())
assert credentials
assert len(mcp) == (1 if stage == 'saved' else 0)
db = sqlite3.connect(f'file:{directory}/cortex.db?mode=ro', uri=True)
records = [json.loads(row[0]) for row in db.execute("SELECT data FROM doc WHERE kind = 'mcp'")]
db.close()
if stage == 'saved':
    assert len(records) == 1
    assert set(records[0]) == {'name', 'type', 'enabled', 'connectionID'}
    assert records[0]['connectionID'] in mcp
else:
    assert not records
result = {'stage': stage, 'filesScanned': files, 'sentinelPlaintextAbsent': True, 'metadataOnly': True,
          'encryptedPrefixes': True, 'mode0600': True, 'mcpCredentialCount': len(mcp)}
(directory.parent / f'disk-{stage}.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
