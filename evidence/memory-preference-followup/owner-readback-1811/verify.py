"""Adapted prior offline receipt check; no network, environment reads or writes."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
observed = json.loads((root / 'observations.json').read_bytes())
prior = json.loads((Path(observed['priorPacket']) / 'observations.json').read_bytes())
assert len((root / 'REPORT.md').read_text().splitlines()) <= 40
assert observed['commentCutoffUTC'] == '2026-10-03T16:53:03Z'
assert len(observed['github']) == len(observed['publicGETs']) == 2
for row in observed['github'] + observed['publicGETs']:
    body = (root / row['rawFile']).read_bytes()
    assert hashlib.sha256(body).hexdigest() == row.get('rawSHA256', row.get('bodySHA256'))
    if 'count' in row:
        assert row['exitCode'] == 0 and len(json.loads(body)) == row['count'] == 0
        assert not row['morePagesPossible']
    else:
        assert len(body) == row['bodyBytes'] and row['attempts'] == 1
        assert not row['authenticated'] and not row['redirectsAllowed'] and not row['bodyCapped']
        headers = (root / row['headersFile']).read_bytes()
        assert hashlib.sha256(headers).hexdigest() == row['headersSHA256']
        assert int(dict(json.loads(headers))['Content-Length']) == len(body)
        assert row['sameBodyAs1653'] == (row['bodySHA256'] == row['priorBodySHA256'])
        old = next(item for item in prior['publicGETs'] if item['url'] == row['url'])
        before = json.loads((Path(observed['priorPacket']) / old['rawFile']).read_bytes())
        after = json.loads(body)
        changed = [key for key in sorted(set(before) | set(after)) if (key in before, before.get(key)) != (key in after, after.get(key))]
        assert changed == row['changedTopLevelFields']
        assert changed == (['request_id'] if row['url'].endswith('/instance') else [])
page = json.loads((root / 'public-models.body').read_bytes())
models = next(row for row in observed['publicGETs'] if row['url'].endswith('/models'))
counts = models['capabilities']
assert counts['total'] == len(page['items']) == 3 and counts['hasMore'] == page['has_more'] is False
assert counts['chat'] == counts['reasoningChat'] == sum(m['kind'] == 'chat' and m['supports_reasoning'] for m in page['items']) == 2
assert counts['eligibleVisionReasoningChat'] == sum(m['kind'] == 'chat' and m['supports_vision'] and m['supports_reasoning'] for m in page['items']) == 0
for path, expected in observed['priorFilesSHA256'].items():
    assert hashlib.sha256(Path(path).read_bytes()).hexdigest() == expected
for row in observed['localPins']:
    assert row['sameBytesAs1653'] == (row['sha256'] == row['priorSHA256'])
    if row['path'].endswith('/COORDINATION.md'):
        old = next(item for item in prior['localPins'] if item['path'] == row['path'])
        for owner in ('G2', 'G3'):
            assert row[f'latest{owner}TextSameAs1653'] and row[f'latest{owner}']['text'] == old[f'latest{owner}']['text']
print('PASS: report budget, body/header hashes, semantic delta, model/feed counts, request bounds, owner excerpt equality, both prior packets unchanged')
