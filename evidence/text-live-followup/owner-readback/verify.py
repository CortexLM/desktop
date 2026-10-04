"""Offline receipt verification, adapted from the prior reader; never reruns collection."""
from pathlib import Path
from datetime import datetime
import hashlib
import json

ROOT = Path(__file__).resolve().parent
load = lambda path: json.loads(path.read_bytes())
sha = lambda data: hashlib.sha256(data).hexdigest()
record = load(ROOT/'observations.json'); prior_root = Path(record['priorPacket']); prior = load(prior_root/'observations.json')
assert len((ROOT/'REPORT.md').read_text().splitlines()) <= 30
assert record['commentCutoffUTC'] == prior['finishedUTC'].replace('+00:00','Z') == '2026-10-03T21:28:51.051482Z'
assert record['requestCounts'] == {'githubCommentsGET':2,'unauthenticatedPublicGET':2,'total':4,'executions':1}
assert len(record['github']) == len(record['publicGETs']) == 2
assert load(ROOT/'started.json')['startedUTC'] == record['startedUTC']
assert record['collectorSHA256'] == sha((ROOT/'readback.py').read_bytes())
assert record['adaptedCollectorSHA256'] == sha((prior_root/'readback.py').read_bytes())
for path, digest in record['priorFilesSHA256'].items(): assert sha(Path(path).read_bytes()) == digest
for row in record['github'] + record['publicGETs']:
    assert 'error' not in row and row['attempts'] == 1 and row['method'] == 'GET' and not row['bodyCapped']
    body = (ROOT/row['rawFile']).read_bytes(); digest = row.get('bodySHA256',row.get('rawSHA256'))
    assert sha(body) == digest and len(body) == row['bodyBytes'] <= 1_048_576
    headers = (ROOT/row['headersFile']).read_bytes(); assert sha(headers) == row['headersSHA256']
    assert all(not any(word in key.lower() for word in ('cookie','authorization','authentication','token','secret','api-key','apikey')) for key,_ in json.loads(headers))
    assert datetime.fromisoformat(record['startedUTC']) <= datetime.fromisoformat(row['observedStartUTC']) <= datetime.fromisoformat(row['observedEndUTC']) <= datetime.fromisoformat(record['networkFinishedUTC'])
for row, number in zip(record['github'],[446,447]):
    assert row['endpoint'] == f'repos/CortexLM/backend/issues/{number}/comments'
    assert row['status'] == 200 and row['exitCode'] == 0 and row['timeoutSeconds'] == 40
    body = load(ROOT/row['rawFile']); assert row['count'] == len(body) == (4 if number == 446 else 0)
    assert not row['morePagesPossible']
    assert all(datetime.fromisoformat(r['updated_at']) >= datetime.fromisoformat(record['commentCutoffUTC']) for r in body)
    assert row['comments'] == [{key:r[key] for key in ('id','html_url','created_at','updated_at')} | {'author':r['user']['login']} for r in body]
    assert row['command'] == ['gh','api','--include','--method','GET',row['endpoint'],'-f','since='+record['commentCutoffUTC'],'-f','per_page=100']
    old = next(r for r in prior['github'] if r['endpoint']==row['endpoint'])
    assert row['priorBodySHA256'] == old['rawSHA256'] and row['sameBodyAsPrior'] == (row['rawSHA256']==old['rawSHA256'])
for row, name in zip(record['publicGETs'],['instance','models']):
    assert row['url'] == 'https://api.cortex.foundation/v1/'+name and row['timeoutSeconds'] == 25 and not row['authenticated'] and not row['redirectsAllowed']
    old = next(r for r in prior['publicGETs'] if r['url']==row['url'])
    before,after = load(prior_root/old['rawFile']),load(ROOT/row['rawFile'])
    fields = [key for key in sorted(set(before)|set(after)) if (key in before,before.get(key))!=(key in after,after.get(key))]
    assert fields == row['changedTopLevelFields'] == (['request_id'] if name=='instance' else [])
    assert row['priorBodySHA256'] == old['bodySHA256'] and row['sameBodyAsPrior'] == (row['bodySHA256']==old['bodySHA256'])
    assert row['status'] == (404 if name=='instance' else 200)
models=load(ROOT/'public-models.body')['items']
assert record['publicGETs'][1]['models'] == [{k:r.get(k) for k in ('slug','kind','supports_vision','supports_reasoning')} for r in models]
assert len(models)==3 and sum(r['kind']=='chat' for r in models)==2 and all(not r['supports_vision'] for r in models)
assert record['publicGETs'][1]['capabilities'] == {'total':3,'chat':2,'reasoningChat':2,'visionChat':0,'eligibleVisionReasoningChat':0,'hasMore':False}
assert len(record['localPins']) == 9 and sum(r['sameBytesAsPrior'] for r in record['localPins']) == 8
old_pins = {r['path']:r for r in prior['localPins']}
for row in record['localPins']:
    assert 'error' not in row
    data = (ROOT/row['snapshot']).read_bytes(); old = old_pins[row['path']]
    previous = (prior_root/old['snapshot']).read_bytes(); assert sha(previous)==old['sha256']
    assert sha(data) == row['sha256'] and len(data) == row['bytes'] and len(data.decode().splitlines()) == row['lines']
    assert row['priorSHA256'] == old['sha256'] and row['sameBytesAsPrior'] == (sha(data)==old['sha256'])
    if row['path'].endswith('COORDINATION.md'):
        for owner in ['G2','G3']:
            latest = next({'line':n,'text':line} for n,line in reversed(list(enumerate(data.decode().splitlines(),1))) if f'[{owner}' in line)
            assert row['latest'+owner] == latest
            assert row['latest'+owner+'TextSameAsPrior'] == (latest['text']==old['latest'+owner]['text']) == (owner=='G3')
        assert row['latestG2']['line']==570 and '5bb7ff550acec822466853c248bd9bcebe8089a6' in row['latestG2']['text']
    if row['path'].endswith('.json'):
        doc = json.loads(data); old_doc=json.loads(previous)
        assert doc == old_doc == row['document'] and row['wholeJSONSameAsPrior'] and row['knownPermissionFieldChanges'] == row['changedTopLevelFields'] == []
        assert doc['prototypeIntegrationAuthorized'] is True and doc['productImportAuthorized'] is False and doc['wholeProductAccepted'] is False
assert record['reviewMetadataScan']['newRelevantNamedFiles'] == []
assert record['environmentPresenceOnly'] == dict.fromkeys(['CORTEX_REAL_BASE_URL','CORTEX_REAL_API_KEY','CORTEX_TEST_BACKEND_URL'],False)
assert datetime.fromisoformat(record['networkFinishedUTC'])<=datetime.fromisoformat(record['finishedUTC'])
print(json.dumps({'status':'passed','reportLines':len((ROOT/'REPORT.md').read_text().splitlines()),'calls':4,'executionCount':1,'localPins':9,'unchangedLocalPins':8,'priorPacketFilesUnchanged':len(record['priorFilesSHA256']),'newG2Delivery':'5bb7ff550acec822466853c248bd9bcebe8089a6','newG3Delivery':False,'reportSHA256':sha((ROOT/'REPORT.md').read_bytes()),'observationsSHA256':sha((ROOT/'observations.json').read_bytes())},indent=2))
