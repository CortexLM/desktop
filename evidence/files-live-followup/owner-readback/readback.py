"""Single bounded metadata collection, adapted from the Activity owner readback."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.error
import urllib.request

OUT = Path(__file__).resolve().parent
PRIOR = OUT.parents[1] / 'work-activity-followup/owner-readback'
OLD = json.loads((PRIOR / 'observations.json').read_bytes())
SINCE = OLD['finishedUTC'].replace('+00:00', 'Z')
CAP = 1_048_576
now = lambda: datetime.now(timezone.utc).isoformat()
sha = lambda data: hashlib.sha256(data).hexdigest()
secret = lambda key: any(word in key.lower() for word in ('cookie', 'authorization', 'authentication', 'token', 'secret', 'api-key', 'apikey'))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def retain_headers(name, headers):
    ordinary = [[key, value] for key, value in headers if not secret(key)]
    data = (json.dumps(ordinary, indent=2) + '\n').encode()
    filename = name + '.headers.json'
    (OUT / filename).write_bytes(data)
    return {'headersFile': filename, 'headersSHA256': sha(data),
            'headerEncoding': 'JSON ordered name/value pairs; not wire-byte headers',
            'excludedHeaderNames': [key for key, _ in headers if secret(key)]}


def comments(number):
    endpoint = f'repos/CortexLM/backend/issues/{number}/comments'
    command = ['gh', 'api', '--include', '--method', 'GET', endpoint, '-f', f'since={SINCE}', '-f', 'per_page=100']
    record = {'endpoint': endpoint, 'method': 'GET', 'attempts': 1, 'observedStartUTC': now(), 'command': command, 'timeoutSeconds': 40}
    try:
        result = subprocess.run(command, capture_output=True, timeout=40)
        record['exitCode'] = result.returncode
        if result.returncode == 0:
            separator = b'\r\n\r\n' if b'\r\n\r\n' in result.stdout else b'\n\n'
            head, sep, payload = result.stdout.partition(separator)
            assert sep and re.match(rb'HTTP/\S+ \d{3}', head), 'Missing included HTTP status'
            lines = head.decode('iso-8859-1').splitlines()
            record['status'] = int(lines[0].split()[1])
            headers = [line.split(':', 1) for line in lines[1:] if ':' in line]
            record.update(retain_headers(f'pr{number}-comments', [(k, v.strip()) for k, v in headers]))
            body = payload[:CAP]; file = f'pr{number}-comments.json'; (OUT / file).write_bytes(body)
            record.update(rawFile=file, rawSHA256=sha(body), bodyBytes=len(body), bodyCapped=len(payload)>CAP)
            if len(payload) <= CAP:
                rows = json.loads(body); assert isinstance(rows, list)
                old = next(row for row in OLD['github'] if row['endpoint'] == endpoint)
                record.update(count=len(rows), morePagesPossible=len(rows)==100 or any(k.lower()=='link' and 'rel="next"' in v for k,v in headers),
                              priorBodySHA256=old['rawSHA256'], sameBodyAsPrior=sha(body)==old['rawSHA256'],
                              comments=[{key: row[key] for key in ('id','html_url','created_at','updated_at')} | {'author':row['user']['login']} for row in rows])
        else:
            record['error'] = result.stderr.decode(errors='replace')[:1500]
    except Exception as error:
        record['error'] = f'{type(error).__name__}: {error}'
    record['observedEndUTC'] = now()
    return record


def public_get(name):
    url = f'https://api.cortex.foundation/v1/{name}'
    record = {'url':url, 'method':'GET', 'authenticated':False, 'redirectsAllowed':False, 'attempts':1, 'timeoutSeconds':25, 'observedStartUTC':now()}
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.ProxyHandler({}))
    request = urllib.request.Request(url, method='GET', headers={'Accept':'application/json','User-Agent':'Cortex-public-readback'})
    try:
        try:
            response = opener.open(request, timeout=25)
        except urllib.error.HTTPError as response_error:
            response = response_error
        with response:
            data = response.read(CAP + 1); capped, body = len(data)>CAP, data[:CAP]
            file = f'public-{name}.body'; (OUT / file).write_bytes(body)
            record.update(retain_headers('public-'+name, list(response.headers.items())))
            old = next(row for row in OLD['publicGETs'] if row['url']==url)
            record.update(status=response.code, contentType=response.headers.get('Content-Type'), responseDate=response.headers.get('Date'),
                          bodyBytes=len(body), bodyCapped=capped, bodySHA256=sha(body), rawFile=file,
                          priorObservedUTC=old['observedEndUTC'], priorBodySHA256=old['bodySHA256'], sameBodyAsPrior=sha(body)==old['bodySHA256'])
            if not capped:
                current, previous = json.loads(body), json.loads((PRIOR / old['rawFile']).read_bytes())
                record['changedTopLevelFields'] = [key for key in sorted(set(current)|set(previous)) if (key in current,current.get(key))!=(key in previous,previous.get(key))]
                if name=='models' and isinstance(current.get('items'),list):
                    items = current['items']
                    record['models'] = [{key:item.get(key) for key in ('slug','kind','supports_vision','supports_reasoning')} for item in items]
                    record['capabilities'] = {'total':len(items),'chat':sum(m.get('kind')=='chat' for m in items),
                        'reasoningChat':sum(m.get('kind')=='chat' and m.get('supports_reasoning') is True for m in items),
                        'visionChat':sum(m.get('kind')=='chat' and m.get('supports_vision') is True for m in items),
                        'eligibleVisionReasoningChat':sum(m.get('kind')=='chat' and m.get('supports_vision') is True and m.get('supports_reasoning') is True for m in items),
                        'hasMore':current.get('has_more')}
    except Exception as error:
        record['error'] = f'{type(error).__name__}: {error}'
    record['observedEndUTC'] = now()
    return record


assert {p.name for p in OUT.iterdir()} == {'readback.py'}, 'Output must contain only collector; never repeat the four reads'
started = now()
with (OUT/'started.json').open('x') as f:
    json.dump({'startedUTC':started,'purpose':'One-shot marker; errors retained without retries','commentCutoffUTC':SINCE},f)
prior_files = {str(p):sha(p.read_bytes()) for p in PRIOR.iterdir() if p.is_file()}
with ThreadPoolExecutor(max_workers=4) as pool:
    futures = [pool.submit(comments,446),pool.submit(comments,447),pool.submit(public_get,'instance'),pool.submit(public_get,'models')]
    results = [future.result() for future in futures]
network_finished = now()
previous_pins = {row['path']:row for row in OLD['localPins']}
local = []; (OUT/'local').mkdir()
for value, prior in previous_pins.items():
    path = Path(value); row = {'path':value,'observedUTC':now()}
    try:
        data=path.read_bytes(); lines=data.decode().splitlines(); filename='local/'+path.name
        assert not (OUT/filename).exists(), 'Duplicate local snapshot filename'
        (OUT/filename).write_bytes(data)
        row.update(sha256=sha(data),bytes=len(data),lines=len(lines),snapshot=filename,priorSHA256=prior['sha256'],
                   priorObservedUTC=prior['observedUTC'],sameBytesAsPrior=sha(data)==prior['sha256'])
        if path.name=='COORDINATION.md':
            for owner in ('G2','G3'):
                latest=next({'line':i,'text':text} for i,text in reversed(list(enumerate(lines,1))) if f'[{owner}' in text)
                row[f'latest{owner}']=latest
                row[f'latest{owner}TextSameAsPrior']=latest['text']==prior[f'latest{owner}']['text']
            # G1/G4-only churn cannot be promoted into a backend/SDK handoff.
            row['ownerComparisonScope']='Latest explicit G2/G3 text, not total line count or mtime'
        elif path.suffix=='.json':
            doc=json.loads(data); row['document']=doc
            row['prototypeIntegrationAuthorized']=doc.get('prototypeIntegrationAuthorized')
            row['productImportAuthorized']=doc.get('productImportAuthorized')
            row['knownPermissionFieldChanges']=[key for key in ('prototypeIntegrationAuthorized','productImportAuthorized') if doc.get(key)!=prior.get(key)]
            row['wholeJSONSameAsPrior']=row['sameBytesAsPrior']
            row['priorFullJSONAvailable']=row['sameBytesAsPrior']
            if not row['sameBytesAsPrior']: row['deltaLimit']='Prior packet pins whole-document hash and two permission fields only; read current full document for scope, do not invent other old values.'
    except Exception as error:
        row['error']=f'{type(error).__name__}: {error}'
    local.append(row)
review=Path('/root/cortex-ui/review')
cutoff=datetime.fromisoformat(SINCE.replace('Z','+00:00')).timestamp()
changed=[{'name':p.name,'mtimeUTC':datetime.fromtimestamp(p.stat().st_mtime,timezone.utc).isoformat()} for p in review.iterdir() if p.is_file() and p.stat().st_mtime>cutoff]
relevant_names=[p.name for p in review.iterdir() if p.is_file() and re.search(r'remote|handoff|import|adoption|accepted|continuation',p.name,re.I)]
record={'startedUTC':started,'networkFinishedUTC':network_finished,'finishedUTC':now(),'commentCutoffUTC':SINCE,'priorPacket':str(PRIOR),
        'priorFilesSHA256':prior_files,'adaptedCollectorSHA256':sha((PRIOR/'readback.py').read_bytes()),'collectorSHA256':sha(Path(__file__).read_bytes()),
        'requestCounts':{'githubCommentsGET':2,'unauthenticatedPublicGET':2,'total':4,'executions':1},
        'github':results[:2],'publicGETs':results[2:],'localPins':local,
        'reviewMetadataScan':{'directory':str(review),'scope':'Direct filename/mtime inventory only; approval comes from pinned document contents','sinceUTC':SINCE,'changedFiles':changed,'relevantNamedFiles':sorted(relevant_names)},
        'environmentPresenceOnly':{key:key in os.environ for key in ('CORTEX_REAL_BASE_URL','CORTEX_REAL_API_KEY','CORTEX_TEST_BACKEND_URL')},
        'environmentPredicate':'Key presence only; values neither read nor retained',
        'scope':'Exactly two comment GETs and two unauthenticated public GETs; single execution, no retries/pagination/public auth/redirects/inference/account/post/CI/device/build/test. Local authority readback only.'}
assert all(sha(Path(p).read_bytes())==digest for p,digest in prior_files.items()), 'Historical packet changed'
(OUT/'observations.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record,indent=2))
