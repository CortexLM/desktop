"""One bounded metadata read; adapted from g1-owner-readback-1805/readback.py."""
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
PRIOR = Path('/tmp/opencode/g1-owner-readback-1805')
OLD = json.loads((PRIOR / 'observations.json').read_bytes())
EARLIER = json.loads(Path('/tmp/opencode/g1-owner-readback-1650/observations.json').read_bytes())
SINCE = '2026-10-03T18:11:13Z'
CAP = 1_048_576
now = lambda: datetime.now(timezone.utc).isoformat()
sha = lambda data: hashlib.sha256(data).hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def comments(number):
    endpoint = f'repos/CortexLM/backend/issues/{number}/comments'
    command = ['gh', 'api', '--method', 'GET', endpoint, '-f', f'since={SINCE}', '-f', 'per_page=100']
    record = {'endpoint': endpoint, 'method': 'GET', 'attempts': 1, 'observedStartUTC': now(), 'command': command}
    try:
        result = subprocess.run(command, capture_output=True, timeout=40)
        record['exitCode'] = result.returncode
        if result.returncode == 0:
            rows = json.loads(result.stdout)
            assert isinstance(rows, list)
            file = f'pr{number}-comments.json'
            (OUT / file).write_bytes(result.stdout)
            record.update(rawFile=file, rawSHA256=sha(result.stdout), count=len(rows), morePagesPossible=len(rows) == 100,
                          comments=[{key: row[key] for key in ('id', 'html_url', 'created_at', 'updated_at')} | {'author': row['user']['login']} for row in rows])
        else:
            record['error'] = result.stderr.decode(errors='replace')[:1500]
    except Exception as error:
        record['error'] = f'{type(error).__name__}: {error}'
    record['observedEndUTC'] = now()
    return record


def public_get(name):
    url = f'https://api.cortex.foundation/v1/{name}'
    record = {'url': url, 'method': 'GET', 'authenticated': False, 'redirectsAllowed': False, 'attempts': 1, 'observedStartUTC': now()}
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.ProxyHandler({}))
    request = urllib.request.Request(url, method='GET', headers={'Accept': 'application/json', 'User-Agent': 'Cortex-public-readback'})
    try:
        try:
            response = opener.open(request, timeout=25)
        except urllib.error.HTTPError as response_error:
            response = response_error
        with response:
            data = response.read(CAP + 1)
            capped, body = len(data) > CAP, data[:CAP]
            file = f'public-{name}.body'
            (OUT / file).write_bytes(body)
            # Keep ordinary response metadata; omit all potentially credential-bearing names.
            secret = lambda key: any(word in key.lower() for word in ('cookie', 'authorization', 'authentication', 'token', 'secret', 'api-key', 'apikey'))
            headers = [[key, value] for key, value in response.headers.items() if not secret(key)]
            header_bytes = (json.dumps(headers, indent=2) + '\n').encode()
            header_file = f'public-{name}.headers.json'
            (OUT / header_file).write_bytes(header_bytes)
            old = next(row for row in OLD['publicGETs'] if row['url'] == url)
            record.update(status=response.code, contentType=response.headers.get('Content-Type'), responseDate=response.headers.get('Date'),
                          headersFile=header_file, headersSHA256=sha(header_bytes), headerEncoding='JSON ordered name/value pairs; not wire-byte headers',
                          excludedHeaderNames=[key for key in response.headers.keys() if secret(key)], bodyBytes=len(body), bodyCapped=capped,
                          bodySHA256=sha(body), rawFile=file, priorObservedUTC=old['observedEndUTC'], priorBodySHA256=old['bodySHA256'], sameBodyAs1811=sha(body) == old['bodySHA256'])
            if not capped:
                current, previous = json.loads(body), json.loads((PRIOR / old['rawFile']).read_bytes())
                record['changedTopLevelFields'] = [key for key in sorted(set(current) | set(previous)) if (key in current, current.get(key)) != (key in previous, previous.get(key))]
                if name == 'models' and isinstance(current.get('items'), list):
                    items = current['items']
                    record['models'] = [{key: item.get(key) for key in ('slug', 'kind', 'supports_vision', 'supports_reasoning')} for item in items]
                    record['capabilities'] = {'total': len(items), 'chat': sum(m.get('kind') == 'chat' for m in items),
                        'reasoningChat': sum(m.get('kind') == 'chat' and m.get('supports_reasoning') is True for m in items),
                        'visionChat': sum(m.get('kind') == 'chat' and m.get('supports_vision') is True for m in items),
                        'eligibleVisionReasoningChat': sum(m.get('kind') == 'chat' and m.get('supports_vision') is True and m.get('supports_reasoning') is True for m in items),
                        'hasMore': current.get('has_more')}
    except Exception as error:
        record['error'] = f'{type(error).__name__}: {error}'
    record['observedEndUTC'] = now()
    return record


assert {p.name for p in OUT.iterdir()} == {'readback.py'}, 'Output must contain only this collector; never repeat the four reads'
started = now()
with (OUT / 'started.json').open('x') as f:
    json.dump({'startedUTC': started, 'purpose': 'One-shot marker; errors are retained without retries'}, f)
prior_files = {str(p): sha(p.read_bytes()) for p in PRIOR.iterdir() if p.is_file()}
with ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(comments, 446), pool.submit(comments, 447), pool.submit(public_get, 'instance'), pool.submit(public_get, 'models')]
    results = [future.result() for future in futures]
previous_pins = {row['path']: row for row in EARLIER['localPins'] + OLD['localPins']}
paths = [row['path'] for row in OLD['localPins']] + [
    '/var/tmp/opencode/product-design-reuse-map-20261003/REPORT.md',
    '/root/cortex-ui/review/code-supplement-integration.md',
    '/root/cortex-ui/review/bot-supplement-integration.md',
    '/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/vendor/README.md',
]
local = []
for value in paths:
    path = Path(value)
    row = {'path': value, 'observedUTC': now()}
    try:
        data = path.read_bytes()
        lines = data.decode().splitlines()
        prior = previous_pins.get(value)
        row.update(sha256=sha(data), bytes=len(data), lines=len(lines), mtimeUTC=datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
                   priorSHA256=prior['sha256'] if prior else None, priorObservedUTC=prior['observedUTC'] if prior else None,
                   sameBytesAsPrior=sha(data) == prior['sha256'] if prior else None)
        if path.name == 'COORDINATION.md':
            for owner in ('G1', 'G2', 'G3'):
                latest = next({'line': i, 'text': text} for i, text in reversed(list(enumerate(lines, 1))) if f'[{owner}' in text)
                row[f'latest{owner}'] = latest
                row[f'latest{owner}TextSameAs1811'] = latest['text'] == prior[f'latest{owner}']['text']
        elif path.suffix == '.json':
            doc = json.loads(data)
            row.update(prototypeIntegrationAuthorized=doc.get('prototypeIntegrationAuthorized'), productImportAuthorized=doc.get('productImportAuthorized'))
        elif path.name == 'DESIGN-REQUESTS.md' and not row['sameBytesAsPrior']:
            row['newTail'] = [{'line': i, 'text': text} for i, text in enumerate(lines, 1) if i > prior['lines']]
    except Exception as error:
        row['error'] = f'{type(error).__name__}: {error}'
    local.append(row)
changed = [{'name': p.name, 'mtimeUTC': datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat()} for p in Path('/root/cortex-ui/review').iterdir()
           if p.is_file() and p.stat().st_mtime > datetime.fromisoformat(SINCE.replace('Z', '+00:00')).timestamp()]
record = {'startedUTC': started, 'finishedUTC': now(), 'commentCutoffUTC': SINCE, 'priorPacket': str(PRIOR), 'priorFilesSHA256': prior_files,
          'github': results[:2], 'publicGETs': results[2:], 'localPins': local,
          'reviewMetadataScan': {'directory': '/root/cortex-ui/review', 'scope': 'Direct file mtimes only', 'sinceUTC': SINCE, 'changedFiles': changed},
          'environmentPresenceOnly': {key: key in os.environ for key in ('CORTEX_REAL_BASE_URL', 'CORTEX_REAL_API_KEY', 'CORTEX_TEST_BACKEND_URL')},
          'environmentPredicate': 'Key presence only; values neither read nor retained',
          'scope': 'Exactly two issue-comment GETs and two unauthenticated public GETs. No retries, pagination, account/auth/inference, source modification, CI/device/runtime query or post.'}
(OUT / 'observations.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record, indent=2))
