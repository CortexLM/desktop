"""Bounded read-only owner feeds plus exactly two unauthenticated public GETs."""
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
SINCE = '2026-10-03T12:07:00Z'
OLD = json.loads(Path('/tmp/opencode/g1-owner-readback-1200/observations.json').read_bytes())
now = lambda: datetime.now(timezone.utc).isoformat()
sha = lambda data: hashlib.sha256(data).hexdigest()
save = lambda name, value: (OUT / name).write_text(json.dumps(value, indent=2) + '\n')


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
                                     'updated_at': row['updated_at'], 'author': row['user']['login'], 'body': row['body']} for row in rows]})
    else:
        record['error'] = result.stderr.decode(errors='replace')[:1500]
    return record


def public_get(name):
    url = f'https://api.cortex.foundation/v1/{name}'
    started = now()
    record = {'url': url, 'method': 'GET', 'authenticated': False, 'redirectsAllowed': False,
              'attempts': 1, 'observedStartUTC': started}
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
            old = next(row for row in OLD['public_gets'] if row['url'] == url)
            record.update({'status': response.code, 'contentType': response.headers.get('Content-Type'),
                           'responseDate': response.headers.get('Date'), 'bodyBytes': len(body), 'bodyCapped': capped,
                           'bodySHA256': sha(body), 'rawFile': f'public-{name}.body',
                           'priorObservedUTC': old['observed_utc'], 'priorBodySHA256': old['body_sha256'],
                           'sameBodyAs1207': sha(body) == old['body_sha256']})
    except Exception as error:
        record['error'] = f'{type(error).__name__}: {error}'
    record['observedEndUTC'] = now()
    return record


started = now()
with ThreadPoolExecutor(max_workers=4) as pool:
    calls = [pool.submit(comments, 446), pool.submit(comments, 447), pool.submit(public_get, 'instance'), pool.submit(public_get, 'models')]
    results = [call.result() for call in calls]
local = []
paths = [
    '/root/cortex-goals/COORDINATION.md', '/root/cortex-ui/review/ACTIVE-DIRECTION.md', '/root/cortex-ui/DESIGN-REQUESTS.md',
    '/root/cortex-ui/review/code-supplement-integration.md', '/root/cortex-ui/review/code-supplement-accepted.json',
    '/root/cortex-ui/review/bot-supplement-integration.md', '/root/cortex-ui/review/bot-supplement-adoption.json',
]
for name in paths:
    path = Path(name)
    data = path.read_bytes()
    text = data.decode()
    row = {'path': name, 'observedUTC': now(), 'mtimeUTC': datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
           'sha256': sha(data), 'bytes': len(data), 'lines': len(text.splitlines())}
    if path.name == 'COORDINATION.md':
        row['relevantLines'] = [{'line': i, 'text': line} for i, line in enumerate(text.splitlines(), 1)
                                if i >= 340 or '[G2' in line or '[G3 FINAL' in line or 'five' in line.lower()]
    elif path.name == 'DESIGN-REQUESTS.md':
        row['relevantLines'] = [{'line': i, 'text': line} for i, line in enumerate(text.splitlines(), 1) if i >= 92]
    else:
        row['content'] = text
    local.append(row)
save('observations.json', {'startedUTC': started, 'finishedUTC': now(), 'commentCutoffUTC': SINCE,
                         'github': results[:2], 'publicGETs': results[2:], 'localAuthorities': local,
                         'environmentPresenceOnly': {name: bool(os.environ.get(name)) for name in ['CORTEX_REAL_BASE_URL', 'CORTEX_REAL_API_KEY', 'CORTEX_TEST_BACKEND_URL']},
                         'scope': 'Two issue-comment GETs; two unauthenticated deployment GETs; local authority snapshots. No auth, CI query, inference, post or source write.'})
print(json.dumps({'github': results[:2], 'publicGETs': results[2:], 'environmentPresenceOnly': {name: bool(os.environ.get(name)) for name in ['CORTEX_REAL_BASE_URL', 'CORTEX_REAL_API_KEY', 'CORTEX_TEST_BACKEND_URL']}}, indent=2))
