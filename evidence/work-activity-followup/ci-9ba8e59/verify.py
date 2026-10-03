"""Offline evidence integrity; Python + installed Pillow. No app/network or writes."""
from pathlib import Path
from collections import Counter
import base64
import gzip
import hashlib
import json
import re
from PIL import Image

ROOT=Path(__file__).resolve().parent
def sha(raw): return hashlib.sha256(raw).hexdigest()
def load(name): return json.loads((ROOT/name).read_bytes())
def rows(name): return [json.loads(line) for line in (ROOT/name).read_text().splitlines()]
def unpack(name): return json.loads(gzip.decompress((ROOT/name).read_bytes()))
def walk(suites):
    for s in suites:
        yield from s.get('specs',[])
        yield from walk(s.get('suites',[]))

manifest=(ROOT/'SHA256SUMS').read_text().splitlines();names=[l.split('  ',1)[1] for l in manifest]
assert len(names)==len(set(names))
assert set(names)=={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='SHA256SUMS'}
for line in manifest:
    digest,name=line.split('  ',1);assert sha((ROOT/name).read_bytes())==digest,name
for p in ROOT.rglob('*.json'):json.loads(p.read_bytes())
for p in ROOT.rglob('*.jsonl'):
    for line in p.read_text().splitlines():json.loads(line)
assert len((ROOT/'README.md').read_text().splitlines())<=90
run=load('metadata/run.json');binding=load('checkout-binding.json');api=load('provenance/coordinator-checkout-commit.json');proof=load('provenance/coordinator-checkout-binding.json')
assert run['headSha']==binding['head']==proof['head'] and run['conclusion']=='success'
assert len(run['jobs'])==3 and all(j['conclusion']=='success' for j in run['jobs'])
assert binding['headCheckoutTreesEqual'] and proof['identicalTree']
assert binding['checkoutTree']==binding['headTree']==api['tree']['sha']==proof['checkoutTree']
header,body=api['verification']['payload'].split('\n\n',1)
raw=(header+'\ngpgsig '+api['verification']['signature'].replace('\n','\n ')+'\n\n'+body).encode()
assert raw==(ROOT/'provenance/checkout-commit.raw').read_bytes()
assert hashlib.sha1(b'commit '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==api['sha']==proof['checkout']==binding['checkout']
head=(ROOT/'provenance/head-commit.raw').read_bytes()
assert hashlib.sha1(b'commit '+str(len(head)).encode()+b'\0'+head).hexdigest()==binding['head']
assert head.startswith(('tree '+binding['headTree']+'\n').encode())
assert [p['sha'] for p in api['parents']]==proof['parents']
assert len({l['job'] for l in binding['checkoutLogLines'] if proof['checkout'] in l['text']})==3
assert sha(gzip.decompress((ROOT/'logs/run.log.gz').read_bytes()))==load('retention.json')['rawLog']['rawSHA256']

json_count=0;embedded={};summary=load('e2e-summary.json')
for system in ['e2e-linux','macos']:
    raw=gzip.decompress((ROOT/(system+'-report.json.gz')).read_bytes());assert sha(raw)==summary[system]['reportSHA256']
    r=json.loads(raw);specs=list(walk(r['suites']));tests=[t for s in specs for t in s['tests']];attempts=[a for t in tests for a in t['results']]
    assert r['config']['metadata']['ci']['commitHash']==binding['checkout']
    assert len(tests)==len(attempts)==132 and all(t['status']=='expected' for t in tests)
    assert all(a['status']=='passed' and a['retry']==0 and not a['errors'] for a in attempts) and not r.get('errors')
    assert [int(n) for s in specs if s['file']=='screens.spec.ts' for t in s['tests'] for a in t['results'] for out in a['stdout'] for n in re.findall(r'rendered (\d+) screen states',out.get('text',''))]==[426]
    assert Counter(s['file'] for s in specs if s['file'].startswith('work-activity'))=={'work-activity.spec.ts':6,'work-activity-localization.spec.ts':1}
    for s in specs:
        for t in s['tests']:
            for result in t['results']:
                for a in result['attachments']:
                    if a['contentType']=='application/json':
                        body=base64.b64decode(a['body'],validate=True);value=json.loads(body);json_count+=1
                        embedded[system,s['title'],a['name']]=(sha(body),value)
assert json_count==132==load('attachment-validation.json')['validJSONAttachments']
for obs in rows('activity-observations.jsonl'):
    assert embedded[obs['os'],obs['title'],obs['name']]==(obs['sha256'],obs['value'])
    if obs['name']=='activity-locale-geometry':
        g=obs['value'];assert len(g)==len({(v['locale'],v['theme'],v['state']) for v in g})==112
        assert sum(len(v['fragments']) for v in g)==304
        for v in g:
            assert v['visibleInk'] and v['contentWidth']<=v['width']+1
            for f in v['fragments']:
                l,t,r,b=f['clip'];assert f['visible'] and f['ink'] and all(x>=l-.5 and y>=t-.5 and xx<=r+.5 and yy<=b+.5 for x,y,xx,yy in f['ink'])
    if obs['name']=='activity-refusals':assert len(obs['value'])==43 and Counter(v['status'] for v in obs['value'])=={200:37,404:6}

images=rows('images.jsonl');members=rows('members.jsonl');member_index={(m['os'],m['path']):m for m in members}
assert len(images)==364 and sum(len(e['copies']) for e in images)==1096
assert len({(tuple(e['size']),e['rgbaSHA256']) for e in images})==364
assert Counter(e['retention'] for e in images)=={'96df66c RGBA-exact canonical':292,'new lossless WebP':72}
prior_cache={}
for e in images:
    p=ROOT/e['canonical'];assert sha(p.read_bytes())==e['retainedSHA256']
    with Image.open(p) as im:assert list(im.size)==e['size'] and sha(im.convert('RGBA').tobytes())==e['rgbaSHA256']
    for copy in e['copies']:assert member_index[e['os'],copy]['sha256']==e['sha256']
    if 'prior' in e:
        prior=e['prior'];index=prior['index'];assert sha((ROOT/index).read_bytes())==prior['indexSHA256']
        if index not in prior_cache:prior_cache[index]={r['id']:r for r in rows(index)}
        old=prior_cache[index][prior['imageID']]
        assert old['rgbaSHA256']==e['rgbaSHA256'] and old['retainedSHA256']==e['retainedSHA256']
for archive in load('downloads.json'):
    assert sum(m['os']==archive['name'] for m in members)==archive['extractedFiles']
    meta=next(a for a in load('metadata/artifacts.json')['artifacts'] if a['id']==archive['artifactID'])
    assert meta['digest']=='sha256:'+archive['sha256'] and meta['size_in_bytes']==archive['bytes']
contacts=load('contacts.json');targets=load('fullsize-targets.json')
assert len(contacts)==32 and all(c['inspected'] and sha((ROOT/c['path']).read_bytes())==c['sha256'] for c in contacts)
assert sorted(i for c in contacts for i in c['images'])==sorted(e['id'] for e in images)
assert len(targets)==24 and all(t['inspected'] for t in targets)
assert Counter(t['os'] for t in targets)=={'e2e-linux':12,'macos':12}
for name in ['locale-image-drift.json','memory-locale-drift.json']:
    assert len(load(name))==16 and all(e['samePNG'] and e['changedPixels']==0 for e in load(name))
inherited=rows('inherited-fullsize-reviews.jsonl');assert Counter(r['kind'] for r in inherited)=={'Memory':22,'Auth':16}
for r in inherited:
    assert sha((ROOT/r['priorReview']).read_bytes())==r['priorReviewSHA256']
    if r['kind']=='Memory':old=next(t for t in load(r['priorReview']) if t['imageID']==r['priorImageID'])
    else:
        assert sha((ROOT/r['ultimateReview']).read_bytes())==r['ultimateReviewSHA256']
        old=next(t for t in load(r['ultimateReview']) if t['imageID']==r['ultimateImageID'])
    assert old['inspected'] and old['rgbaSHA256']==r['rgbaSHA256']
assert len(load('supplemental-review.json')['currentFullsize'])==5

source=load('source-change.json')
for name,lines_count,digest in [('work-activity.spec.ts',211,source['finalBehaviorSHA256']),('work-activity-localization.spec.ts',112,source['finalLocaleSHA256'])]:
    raw=gzip.decompress((ROOT/('provenance/'+name+'.gz')).read_bytes());assert len(raw.splitlines())==lines_count and sha(raw)==digest
original=(ROOT/'../baseline/work-activity.spec.ts').read_bytes();full=(ROOT/'../baseline/initial-full-behavior.spec.ts').read_bytes()
assert sha(original)==source['originalBehaviorSHA256'] and sha(full)==source['localFullBehaviorSHA256']
assert full==original.replace(b'.toHaveText(prior)',b'.toHaveText(prior, { useInnerText: true })').replace(b'.toHaveText(finishedText)',b'.toHaveText(finishedText, { useInnerText: true })')
for ref in rows('external-receipts.jsonl'):assert sha((ROOT/ref['path']).read_bytes())==ref['sha256']
history=rows('historical-results.jsonl')
assert [(r['cases'],r['results'],r['errors']) for r in history]==[(6,{'failed':6},6),(1,{'failed':1},1),(7,{'passed':5,'failed':2},2),(2,{'passed':2},0),(1,{'passed':1},0),(132,{'passed':132},0),(6,{'passed':6},0)]
for r in history:assert sha(gzip.decompress((ROOT/r['path']).read_bytes()))==r['rawSHA256']
renderer=unpack('provenance/renderer-inputs.json.gz');assert len(rows('provenance/input-pins.jsonl'))==517 and len(renderer['files'])==475 and len(unpack('provenance/members.json.gz')['members'])==90
assert sha('\n'.join(e['path']+':'+e['sha256'] for e in renderer['files']).encode())==binding['rendererComparatorFingerprint']
checks=load('checks-summary.json');assert (checks['unitPassed'],checks['unitSkipped'],checks['unitFiles'])==(260,1,24)
assert checks['i18n']==dict(files=67,usedKeys=2279,englishKeys=3419,problems=0)
assert len(rows('new-live-copy.jsonl'))==56
assert load('smoke-and-crash.json')['nativeDisplayCapture']=='failed' and load('smoke-and-crash.json')['diagnostics'][0]['simulated']
print('Verified: 264 cases, 852 render visits, 364 images, 32 contacts, 24 Activity targets, 224 locale measurements; checkout object/tree exact.')
