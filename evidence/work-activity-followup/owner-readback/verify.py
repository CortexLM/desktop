"""Offline receipt verification only; no network, environment reads or writes."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
record = json.loads((root / 'observations.json').read_bytes())
prior_root = Path(record['priorPacket'])
prior = json.loads((prior_root / 'observations.json').read_bytes())
digest = lambda data: hashlib.sha256(data).hexdigest()
assert len((root / 'REPORT.md').read_text().splitlines()) <= 35
assert record['commentCutoffUTC'] == '2026-10-03T18:11:13Z'
assert len(record['github']) == len(record['publicGETs']) == 2
for item in record['github']:
    body = (root / item['rawFile']).read_bytes()
    assert digest(body) == item['rawSHA256'] and json.loads(body) == []
    assert item['count'] == 0 and item['exitCode'] == 0 and not item['morePagesPossible']
    assert item['attempts'] == 1 and item['method'] == 'GET'
    assert 'per_page=100' in item['command'] and '--paginate' not in item['command']
for item in record['publicGETs']:
    body = (root / item['rawFile']).read_bytes()
    headers = (root / item['headersFile']).read_bytes()
    assert digest(body) == item['bodySHA256'] and len(body) == item['bodyBytes'] <= 1_048_576
    assert digest(headers) == item['headersSHA256']
    assert not item['bodyCapped'] and not item['authenticated'] and not item['redirectsAllowed'] and item['attempts'] == 1
    assert all(not any(word in key.lower() for word in ('cookie', 'authorization', 'authentication', 'token', 'secret', 'api-key', 'apikey')) for key, _ in json.loads(headers))
    old = next(row for row in prior['publicGETs'] if row['url'] == item['url'])
    before, after = json.loads((prior_root / old['rawFile']).read_bytes()), json.loads(body)
    changed = [key for key in sorted(set(before) | set(after)) if (key in before, before.get(key)) != (key in after, after.get(key))]
    assert changed == item['changedTopLevelFields'] == (['request_id'] if item['url'].endswith('/instance') else [])
    assert item['sameBodyAs1811'] == (digest(body) == old['bodySHA256'])
    assert item['status'] == (404 if item['url'].endswith('/instance') else 200)
models = next(row for row in record['publicGETs'] if row['url'].endswith('/models'))
assert models['capabilities'] == {'total': 3, 'chat': 2, 'reasoningChat': 2, 'visionChat': 0, 'eligibleVisionReasoningChat': 0, 'hasMore': False}
for path, expected in record['priorFilesSHA256'].items():
    assert digest(Path(path).read_bytes()) == expected
for item in record['localPins']:
    assert 'error' not in item
    if item['priorSHA256']:
        assert item['sameBytesAsPrior'] == (item['sha256'] == item['priorSHA256'])
    if item['path'].endswith('COORDINATION.md'):
        assert item['latestG2TextSameAs1811'] and item['latestG3TextSameAs1811']
    if 'productImportAuthorized' in item:
        assert item['prototypeIntegrationAuthorized'] is True and item['productImportAuthorized'] is False
assert record['reviewMetadataScan']['changedFiles'] == []
assert record['environmentPresenceOnly'] == dict.fromkeys(('CORTEX_REAL_BASE_URL', 'CORTEX_REAL_API_KEY', 'CORTEX_TEST_BACKEND_URL'), False)
print('PASS: report limit, four-read receipt, body/header hashes, semantic deltas, owner/adoption pins, prior packet unchanged')
