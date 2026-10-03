"""Offline evidence integrity only; Python + installed Pillow, no app/network."""
from pathlib import Path
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
def walk(suites):
    for s in suites:
        yield from s.get('specs',[])
        yield from walk(s.get('suites',[]))

manifest=(ROOT/'SHA256SUMS').read_text().splitlines()
assert len(manifest)==len({line.split('  ',1)[1] for line in manifest})
assert {line.split('  ',1)[1] for line in manifest}=={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='SHA256SUMS'}
for line in manifest:
    digest,name=line.split('  ',1)
    assert sha((ROOT/name).read_bytes())==digest,name
for p in ROOT.rglob('*.json'):json.loads(p.read_bytes())
for p in ROOT.rglob('*.jsonl'):
    for line in p.read_text().splitlines():json.loads(line)
summary=load('e2e-summary.json');attachments=0
for system in ['e2e-linux','macos']:
    raw=gzip.decompress((ROOT/(system+'-report.json.gz')).read_bytes())
    assert sha(raw)==summary[system]['reportSHA256']
    report=json.loads(raw);specs=list(walk(report['suites']))
    tests=[t for s in specs for t in s['tests']];attempts=[a for t in tests for a in t['results']]
    assert len(tests)==len(attempts)==118 and all(t['status']=='expected' for t in tests)
    assert all(a['status']=='passed' and a['retry']==0 and not a['errors'] for a in attempts)
    assert not report.get('errors')
    rendered=[int(n) for s in specs if s['file']=='screens.spec.ts' for t in s['tests'] for a in t['results'] for out in a['stdout'] for n in re.findall(r'rendered (\d+) screen states',out.get('text',''))]
    assert rendered==[426]
    for attempt in attempts:
        for a in attempt['attachments']:
            if a['contentType']=='application/json':json.loads(base64.b64decode(a['body'],validate=True));attachments+=1
assert attachments==118
images=rows('images.jsonl')
assert len(images)==316 and sum(len(i['copies']) for i in images)==952
assert len({(i['os'],p) for i in images for p in i['copies']})==952
assert len({(tuple(i['size']),i['rgbaSHA256']) for i in images})==316
assert sum(i['retention']=='8e3fd79 RGBA-exact canonical' for i in images)==264
assert sum(i['retention']=='new lossless WebP' for i in images)==52
prior_cache={}
for e in images:
    p=ROOT/e['canonical'];assert sha(p.read_bytes())==e['retainedSHA256']
    with Image.open(p) as im:
        assert list(im.size)==e['size'] and sha(im.convert('RGBA').tobytes())==e['rgbaSHA256']
    if 'prior' in e:
        name=e['prior']['index']
        if name not in prior_cache:prior_cache[name]={r['id']:r for r in rows(name)}
        old=prior_cache[name][e['prior']['imageID']]
        assert old['rgbaSHA256']==e['rgbaSHA256'] and old['retainedSHA256']==e['retainedSHA256']
contacts=load('contacts.json');targets=load('fullsize-targets.json')
assert len(contacts)==28 and all(c['inspected'] for c in contacts)
assert sorted(i for c in contacts for i in c['images'])==sorted(e['id'] for e in images)
assert len(targets)==20 and all(t['inspected'] for t in targets)
assert sum(t['view'].startswith('project-long-input') for t in targets)==4
locale=load('locale-image-drift.json')
assert len(locale)==16 and all(d['samePNG'] and d['changedPixels']==0 for d in locale)
for r in load('locale-review-inheritance.json')['records']:
    assert sha((ROOT/r['priorReview']).read_bytes())==r['priorReviewSHA256']
    old=next(t for t in load(r['priorReview']) if t['imageID']==r['priorImageID'])
    assert old['inspected'] and old['rgbaSHA256']==r['rgbaSHA256']
source=gzip.decompress((ROOT/'provenance/projects.spec.ts.gz').read_bytes())
assert len(source.splitlines())==406 and sha(source)==load('source-change.json')['testSHA256']
assert source==(ROOT/'../wrapping/initial/projects.spec.ts').read_bytes()
negatives=rows('negative-results.jsonl')
assert [(n['passed'],n['failed'],n['errorCount']) for n in negatives]==[(0,2,8),(3,2,2)]
for n in negatives:
    raw=(ROOT/n['path']).read_bytes();assert sha(raw)==n['gzipSHA256'] and sha(gzip.decompress(raw))==n['rawSHA256']
binding=load('checkout-binding.json');api_raw=(ROOT/'provenance/checkout-commit.json').read_bytes();api=json.loads(api_raw)
assert sha(api_raw)==binding['apiResponseSHA256']
raw=(ROOT/'provenance/checkout-commit.raw').read_bytes()
assert hashlib.sha1(b'commit '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==binding['checkout']==api['sha']
assert raw.startswith(('tree '+binding['headTree']+'\n').encode())
assert binding['headCheckoutTreesEqual'] and binding['headTree']==api['tree']['sha']
assert load('smoke-and-crash.json')['nativeDisplayCapture']=='failed'
assert load('smoke-and-crash.json')['diagnostics'][0]['simulated']
print('Verified: 236 cases, 852 render visits, 316 images, 28 contacts, 20 Projects targets, 16 exact locale inheritances; checkout tree exact.')
