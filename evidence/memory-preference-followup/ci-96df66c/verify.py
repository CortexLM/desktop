"""Offline evidence checks only; Python + installed Pillow. No app, tests, network or writes."""
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

manifest=(ROOT/'SHA256SUMS').read_text().splitlines()
names=[line.split('  ',1)[1] for line in manifest]
assert len(names)==len(set(names))
assert set(names)=={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='SHA256SUMS'}
for line in manifest:
    digest,name=line.split('  ',1)
    assert sha((ROOT/name).read_bytes())==digest,name
for p in ROOT.rglob('*.json'):json.loads(p.read_bytes())
for p in ROOT.rglob('*.jsonl'):
    for line in p.read_text().splitlines():json.loads(line)
assert len((ROOT/'README.md').read_text().splitlines())<=95
run=load('metadata/run.json');binding=load('checkout-binding.json');proof=load('provenance/coordinator-checkout-binding.json')
assert run['headSha']==binding['head']==proof['head'] and run['conclusion']=='success'
assert len(run['jobs'])==3 and all(j['conclusion']=='success' for j in run['jobs'])
assert binding['headCheckoutTreesEqual'] and proof['identicalTree']
assert binding['checkoutTree']==binding['headTree']==proof['checkoutTree']==proof['headTree']
assert binding['checkout']==proof['checkout'] and sha((ROOT/'provenance/coordinator-checkout-binding.json').read_bytes())==binding['coordinatorReceiptSHA256']
raw_log=gzip.decompress((ROOT/'logs/run.log.gz').read_bytes())
assert sha(raw_log)==load('retention.json')['rawLog']['rawSHA256']
assert len({r['job'] for r in binding['checkoutLogLines'] if proof['checkout'] in r['text']})==3

summary=load('e2e-summary.json');json_count=0;embedded={}
for system in ['e2e-linux','macos']:
    raw=gzip.decompress((ROOT/(system+'-report.json.gz')).read_bytes())
    assert sha(raw)==summary[system]['reportSHA256']
    report=json.loads(raw);specs=list(walk(report['suites']));tests=[t for s in specs for t in s['tests']];attempts=[a for t in tests for a in t['results']]
    assert report['config']['metadata']['ci']['commitHash']==proof['checkout']
    assert len(tests)==len(attempts)==125 and all(t['status']=='expected' for t in tests)
    assert all(a['status']=='passed' and a['retry']==0 and not a['errors'] for a in attempts) and not report.get('errors')
    assert [int(n) for s in specs if s['file']=='screens.spec.ts' for t in s['tests'] for a in t['results'] for out in a['stdout'] for n in re.findall(r'rendered (\d+) screen states',out.get('text',''))]==[426]
    for s in specs:
        for t in s['tests']:
            for result in t['results']:
                for a in result['attachments']:
                    if a['contentType']=='application/json':
                        body=base64.b64decode(a['body'],validate=True);value=json.loads(body);json_count+=1
                        embedded[system,s['title'],a['name']]=(sha(body),value)
    geometry=next(v for (os,_,name),(_,v) in embedded.items() if os==system and name=='memory-locale-geometry')
    assert len(geometry)==len({(v['locale'],v['theme'],v['state']) for v in geometry})==64
    text=[t for v in geometry for t in v['rows']]
    assert len(text)==112 and all(t['visibleInk'] and t['contentWidth']<=t['width']+1 for t in text)
assert json_count==128==load('attachment-validation.json')['validJSONAttachments']
for obs in rows('memory-observations.jsonl'):
    assert embedded[obs['os'],obs['title'],obs['name']]==(obs['sha256'],obs['value'])
    if obs['name']=='cancelled-preview-settings':
        for e in obs['value']['evidence']:assert e['control']==[dict(checked=str(e['actual']['memoryEnabled']).lower(),disabled=False,visible=True)]
    if obs['name']=='memory-context':
        s=obs['value']['system'];a,b,m=[n['content'] for n in obs['value']['notes']]
        assert len(s)==4 and a in s[0] and b not in s[0] and 'Amber persona remains.' in s[0]
        assert not any(n in s[1] for n in [a,b,m]) and 'Violet persona remains.' in s[1]
        assert b in s[2] and m in s[2] and a not in s[2] and not any(n in s[3] for n in [a,b,m])

images=rows('images.jsonl');members=rows('members.jsonl');member_index={(m['os'],m['path']):m for m in members}
assert len(images)==339 and sum(len(e['copies']) for e in images)==1023
assert len({(tuple(e['size']),e['rgbaSHA256']) for e in images})==339
assert Counter(e['retention'] for e in images)=={'f82a648 RGBA-exact canonical':254,'local targeted RGBA-exact canonical':9,'new lossless WebP':76}
for e in images:
    p=ROOT/e['canonical'];assert sha(p.read_bytes())==e['retainedSHA256']
    with Image.open(p) as im:assert list(im.size)==e['size'] and sha(im.convert('RGBA').tobytes())==e['rgbaSHA256']
    for copy in e['copies']:assert member_index[e['os'],copy]['sha256']==e['sha256']
    if 'prior' in e:
        prior=e['prior'];index=ROOT/prior['index'];assert sha(index.read_bytes())==prior['indexSHA256']
        if index.suffix=='.json':
            old=json.loads(index.read_bytes())[int(prior['imageID'].rsplit('-',1)[1])]
            assert old['originalSHA256']==e['sha256'] and old['sha256']==e['retainedSHA256']
        else:
            old=next(r for r in rows(prior['index']) if r['id']==prior['imageID'])
            assert old['retainedSHA256']==e['retainedSHA256']
        assert old['rgbaSHA256']==e['rgbaSHA256']
for archive in load('downloads.json'):
    assert sum(m['os']==archive['name'] for m in members)==archive['extractedFiles']
    meta=next(a for a in load('metadata/artifacts.json')['artifacts'] if a['id']==archive['artifactID'])
    assert meta['digest']=='sha256:'+archive['sha256'] and meta['size_in_bytes']==archive['bytes']
contacts=load('contacts.json');targets=load('fullsize-targets.json')
assert len(contacts)==30 and all(c['inspected'] and sha((ROOT/c['path']).read_bytes())==c['sha256'] for c in contacts)
assert sorted(i for c in contacts for i in c['images'])==sorted(e['id'] for e in images)
assert len(targets)==24 and all(t['inspected'] for t in targets)
assert Counter(t['os'] for t in targets)=={'e2e-linux':12,'macos':12}
assert len(load('supplemental-fullsize-review.json')['currentViews'])==11
assert len(load('locale-image-drift.json'))==16 and all(e['samePNG'] and e['changedPixels']==0 for e in load('locale-image-drift.json'))
for e in load('auth-locale-review-inheritance.json')['records']:
    for field in ['priorInheritance','ultimateReview']:assert sha((ROOT/e[field]).read_bytes())==e[field+'SHA256']
    old=next(t for t in load(e['ultimateReview']) if t['imageID']==e['ultimateImageID'])
    assert old['inspected'] and old['sha256']==e['sha256'] and old['rgbaSHA256']==e['rgbaSHA256']

test=gzip.decompress((ROOT/'provenance/runtime-settings.spec.ts.gz').read_bytes())
assert len(test.splitlines())==278 and sha(test)=='a3749931aa28b459844b9c4ab24bb52d8762a079210a379de524416624acffe8'
assert test==(ROOT/'../navigation/runtime-settings.spec.ts').read_bytes()
assert b''.join(test.splitlines(keepends=True)[:218])==(ROOT/'../baseline/runtime-settings.spec.ts').read_bytes()
for ref in rows('external-receipts.jsonl'):assert sha((ROOT/ref['path']).read_bytes())==ref['sha256']
history=rows('historical-results.jsonl')
assert [(r['cases'],r['results'],r['errors']) for r in history]==[(5,{'failed':5},5),(14,{'passed':14},0),(124,{'passed':124},0),(1,{'failed':1},2),(21,{'passed':21},0),(125,{'passed':125},0)]
for r in history:assert sha(gzip.decompress((ROOT/r['path']).read_bytes()))==r['rawSHA256']
pins=rows('provenance/input-pins.jsonl');renderer=unpack('provenance/renderer-inputs.json.gz');build=unpack('provenance/members.json.gz')
assert len(pins)==516 and len(renderer['files'])==474 and len(build['members'])==90
assert sha('\n'.join(e['path']+':'+e['sha256'] for e in renderer['files']).encode())==binding['rendererComparatorFingerprint']
checks=load('checks-summary.json');assert (checks['unitPassed'],checks['unitSkipped'],checks['unitFiles'])==(260,1,24)
assert checks['i18n']==dict(files=66,usedKeys=2277,englishKeys=3412,problems=0)
assert len(rows('new-live-copy.jsonl'))==56
assert load('smoke-and-crash.json')['nativeDisplayCapture']=='failed' and load('smoke-and-crash.json')['diagnostics'][0]['simulated']
print('Verified: 250 cases, 852 render visits, 339 images, 30 contacts, 24 Memory targets, 128 locale states; exact coordinator checkout tree binding.')
