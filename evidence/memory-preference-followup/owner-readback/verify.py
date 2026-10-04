"""Offline receipt check; no network, environment reads or writes."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
observed = json.loads((root / 'observations.json').read_bytes())
comparison = json.loads((root / 'comparison.json').read_bytes())
assert len((root / 'REPORT.md').read_text().splitlines()) <= 45
assert observed['commentCutoffUTC'] == '2026-10-03T14:47:00Z'
assert len(observed['github']) == len(observed['publicGETs']) == 2
for row in observed['github'] + observed['publicGETs']:
    body = (root / row['rawFile']).read_bytes()
    assert hashlib.sha256(body).hexdigest() == row.get('rawSHA256', row.get('bodySHA256'))
    if 'count' in row:
        assert len(json.loads(body)) == row['count'] == 0
    else:
        assert len(body) == row['bodyBytes'] and row['attempts'] == 1
        assert not row['authenticated'] and not row['redirectsAllowed']
        assert row['sameBodyAs1447'] == (row['bodySHA256'] == row['priorBodySHA256'])
page = json.loads((root / 'public-models.body').read_bytes())
assert sum(m['kind'] == 'chat' and m['supports_vision'] and m['supports_reasoning'] for m in page['items']) == 0
for name, expected in comparison['priorPacketSHA256'].items():
    assert hashlib.sha256((Path(comparison['priorPacket']) / name).read_bytes()).hexdigest() == expected
print('PASS: report budget, raw hashes/counts, request bounds, capability count, prior packet hashes')
