"""Adapted from the 14:47 collector: one bounded read, no retries."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.request

OUT = Path(__file__).parent
PRIOR = Path('/tmp/opencode/g1-owner-readback-1435')
SINCE = '2026-10-03T14:47:00Z'
OLD = json.loads((PRIOR / 'observations.json').read_bytes())
PINS = json.loads((PRIOR / 'pins.json').read_bytes())
now = lambda: datetime.now(timezone.utc).isoformat()
sha = lambda data: hashlib.sha256(data).hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def comments(number):
    started = now()
    endpoint = f'repos/CortexLM/backend/issues/{number}/comments'
    command = ['gh', 'api', '--method', 'GET', endpoint, '-f', f'since={SINCE}', '-f', 'per_page=100']
    result = subprocess.run(command, capture_output=True, timeout=40)
    record = {'endpoint': endpoint, 'url': f'https://github.com/CortexLM/backend/pull/{number}',
              'observedStartUTC': started, 'observedEndUTC': now(), 'command': command, 'exitCode': result.returncode}
    if result.returncode == 0:
        rows = json.loads(result.stdout)
        assert isinstance(rows, list)
        (OUT / f'pr{number}-comments.json').write_bytes(result.stdout)
        record.update({'rawFile': f'pr{number}-comments.json', 'rawSHA256': sha(result.stdout), 'count': len(rows),
                       'morePagesPossible': len(rows) == 100,
                       'comments': [{'id': row['id'], 'html_url': row['html_url'], 'created_at': row['created_at'],
                                     'updated_at': row['updated_at'], 'author': row['user']['login']} for row in rows]})
    else:
        record['error'] = result.stderr.decode(errors='replace')[:1500]
    return record


def public_get(name):
    url = f'https://api.cortex.foundation/v1/{name}'
    record = {'url': url, 'method': 'GET', 'authenticated': False, 'redirectsAllowed': False,
              'attempts': 1, 'observedStartUTC': now()}
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.ProxyHandler({}))
    request = urllib.request.Request(url, method='GET', headers={'Accept': 'application/json', 'User-Agent': 'Cortex-public-readback'})
    try:
        try:
            response = opener.open(request, timeout=25)
        except urllib.error.HTTPError as response_error:
            response = response_error
        with response:
            body = response.read(1_048_577)
            capped = len(body) > 1_048_576
            body = body[:1_048_576]
            (OUT / f'public-{name}.body').write_bytes(body)
            old = next(row for row in OLD['publicGETs'] if row['url'] == url)
            excluded = {'set-cookie', 'authorization', 'proxy-authorization', 'authentication-info', 'proxy-authentication-info'}
            record.update({'status': response.code,
                           'responseHeaders': [[key, value] for key, value in response.headers.items() if key.lower() not in excluded],
                           'excludedHeaderNames': [key for key in response.headers.keys() if key.lower() in excluded],
                           'bodyBytes': len(body), 'bodyCapped': capped, 'bodySHA256': sha(body), 'rawFile': f'public-{name}.body',
                           'priorObservedUTC': old['observedEndUTC'], 'priorBodySHA256': old['bodySHA256'],
                           'sameBodyAs1447': sha(body) == old['bodySHA256']})
            if not capped:
                current, previous = json.loads(body), json.loads((PRIOR / old['rawFile']).read_bytes())
                record['changedTopLevelFields'] = [key for key in sorted(set(current) | set(previous)) if current.get(key) != previous.get(key)]
                if name == 'models' and isinstance(current.get('items'), list):
                    items = current['items']
                    record['models'] = [{key: item.get(key) for key in ('slug', 'kind', 'supports_vision', 'supports_reasoning')} for item in items]
                    record['capabilities'] = {'total': len(items), 'chat': sum(m.get('kind') == 'chat' for m in items),
                        'visionChat': sum(m.get('kind') == 'chat' and m.get('supports_vision') is True for m in items),
                        'reasoningChat': sum(m.get('kind') == 'chat' and m.get('supports_reasoning') is True for m in items),
                        'eligibleVisionReasoningChat': sum(m.get('kind') == 'chat' and m.get('supports_vision') is True and m.get('supports_reasoning') is True for m in items),
                        'hasMore': current.get('has_more')}
    except Exception as error:
        record['error'] = f'{type(error).__name__}: {error}'
    record['observedEndUTC'] = now()
    return record


assert not (OUT / 'observations.json').exists(), 'Retain this packet; do not repeat its network reads'
started = now()
with ThreadPoolExecutor(max_workers=4) as pool:
    calls = [pool.submit(comments, 446), pool.submit(comments, 447), pool.submit(public_get, 'instance'), pool.submit(public_get, 'models')]
    results = [call.result() for call in calls]
local = []
for old in PINS['localPinsAt145124UTC']:
    path = Path(old['path'])
    data = path.read_bytes()
    lines = data.decode().splitlines()
    row = {'path': str(path.resolve()), 'observedUTC': now(), 'mtimeUTC': datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
           'sha256': sha(data), 'priorSHA256': old['sha256'], 'sameBytesAsPrior': sha(data) == old['sha256'], 'bytes': len(data), 'lines': len(lines)}
    if path.name == 'COORDINATION.md':
        for owner in ('G1', 'G2', 'G3'):
            row[f'latest{owner}'] = next({'line': i, 'text': line} for i, line in reversed(list(enumerate(lines, 1))) if f'[{owner}' in line)
    elif path.name == 'DESIGN-REQUESTS.md':
        row['newTail'] = [{'line': i, 'text': line} for i, line in enumerate(lines, 1) if i > old['lines']]
    elif path.suffix == '.json':
        value = json.loads(data)
        row['prototypeIntegrationAuthorized'] = value.get('prototypeIntegrationAuthorized')
        row['productImportAuthorized'] = value.get('productImportAuthorized')
    local.append(row)
record = {'startedUTC': started, 'finishedUTC': now(), 'commentCutoffUTC': SINCE,
          'priorPacket': str(PRIOR), 'github': results[:2], 'publicGETs': results[2:], 'localPins': local,
          'environmentPresenceOnly': {name: name in os.environ for name in ['CORTEX_REAL_BASE_URL', 'CORTEX_REAL_API_KEY', 'CORTEX_TEST_BACKEND_URL']},
          'environmentPredicate': 'name in os.environ; no values read or retained',
          'scope': 'Two issue-comment GETs; two unauthenticated public GETs; local document hashes. No auth, inference, CI/native query, post or source write.'}
(OUT / 'observations.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
