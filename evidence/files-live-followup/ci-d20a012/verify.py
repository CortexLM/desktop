"""Offline receipt verifier; Python, installed Pillow/numpy and local Git. No app/network/writes."""
from pathlib import Path
from collections import Counter
import base64, gzip, hashlib, json, re, subprocess
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parent
def sha(raw): return hashlib.sha256(raw).hexdigest()
def load(name): return json.loads((ROOT/name).read_bytes())
def rows(name): return [json.loads(line) for line in (ROOT/name).read_text().splitlines()]
def unpack(name): return json.loads(gzip.decompress((ROOT/name).read_bytes()))
def pixels(name):
    with Image.open(ROOT/name) as im: return im.convert('RGBA')
def walk(suites):
    for s in suites:
        yield from s.get('specs',[])
        yield from walk(s.get('suites',[]))
def git(*a): return subprocess.run(['git',*a],cwd=ROOT,check=True,capture_output=True).stdout

manifest=(ROOT/'SHA256SUMS').read_text().splitlines();names=[line.split('  ',1)[1] for line in manifest]
assert len(names)==len(set(names)) and set(names)=={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='SHA256SUMS'}
for line in manifest:
    digest,name=line.split('  ',1);assert sha((ROOT/name).read_bytes())==digest,name
for p in ROOT.rglob('*.json'):json.loads(p.read_bytes())
for p in ROOT.rglob('*.jsonl'):
    for line in p.read_text().splitlines():json.loads(line)
assert len((ROOT/'README.md').read_text().splitlines())<=90
run=load('metadata/run.json'); binding=load('checkout-binding.json'); source=load('source-binding.json')
api=load('provenance/supplied-checkout-commit.json'); head_api=load('provenance/supplied-head-commit.json'); proof=load('provenance/supplied-checkout-binding.json')
assert run['headSha']==binding['head']==source['application']==proof['head']==head_api['sha']=='d20a012fbb774aa9b348fe1913f85d3476430098'
assert run['conclusion']=='success' and len(run['jobs'])==3 and all(j['conclusion']=='success' for j in run['jobs'])
assert binding['headCheckoutTreesEqual'] and source['headCheckoutTreesEqual'] and proof['identicalTree']
assert binding['headTree']==binding['checkoutTree']==source['tree']==proof['checkoutTree']==proof['headTree']==api['tree']['sha']==head_api['tree']['sha']=='b17a4b9a71398b511253044a159ef0ebb558d4ef'
header,body=api['verification']['payload'].split('\n\n',1)
raw=(header+'\ngpgsig '+api['verification']['signature'].replace('\n','\n ')+'\n\n'+body).encode()
assert raw==(ROOT/'provenance/checkout-commit.raw').read_bytes()
assert hashlib.sha1(b'commit '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==api['sha']==proof['checkout']==binding['checkout']=='72b43406c8092c54c1683f8d0c53bed2e24b5923'
head=(ROOT/'provenance/head-commit.raw').read_bytes()
assert hashlib.sha1(b'commit '+str(len(head)).encode()+b'\0'+head).hexdigest()==binding['head']
assert head.startswith(('tree '+binding['headTree']+'\n').encode()) and [p['sha'] for p in api['parents']]==proof['parents']
assert len({r['job'] for r in binding['checkoutLogLines'] if binding['checkout'] in r['text']})==3
assert not load('provenance/local-checkout-probe.json')['checkoutObjectAvailable']
ret=load('retention.json'); rawlog=gzip.decompress((ROOT/'logs/run.log.gz').read_bytes())
assert sha(rawlog)==ret['rawLog']['rawSHA256']==load('checks-summary.json')['sourceLogSHA256']

embedded={};json_count=0;summary=load('e2e-summary.json');files_cases=[]
for system in ['e2e-linux','macos']:
    raw=gzip.decompress((ROOT/(system+'-report.json.gz')).read_bytes());assert sha(raw)==summary[system]['reportSHA256']
    report=json.loads(raw);specs=list(walk(report['suites']));tests=[t for s in specs for t in s['tests']];attempts=[a for t in tests for a in t['results']]
    assert report['config']['metadata']['ci']['commitHash']==binding['checkout']
    assert len(tests)==len(attempts)==143 and all(t['status']=='expected' for t in tests)
    assert not report.get('errors') and not any(report['stats'][k] for k in ['skipped','unexpected','flaky'])
    assert all(a['status']=='passed' and a['retry']==0 and not a['errors'] for a in attempts)
    assert [int(n) for s in specs if s['file']=='screens.spec.ts' for t in s['tests'] for a in t['results'] for out in a['stdout'] for n in re.findall(r'rendered (\d+) screen states',out.get('text',''))]==[426]
    files=[s for s in specs if s['file']=='files-live.spec.ts'];assert len(files)==11
    assert Counter(s['line'] for s in files)=={148:2,188:1,214:1,226:1,238:1,256:1,281:1,292:1,314:1,345:1}
    files_cases.extend((system,s['title'],s['line']) for s in files)
    for s in specs:
        for t in s['tests']:
            for result in t['results']:
                for a in result['attachments']:
                    if a['contentType']=='application/json':
                        raw=base64.b64decode(a['body'],validate=True);embedded[system,s['title'],a['name']]=(sha(raw),json.loads(raw));json_count+=1
assert json_count==132==load('attachment-validation.json')['validJSONAttachments']
assert set(files_cases)=={(r['os'],r['title'],r['line']) for r in rows('files-cases.jsonl')}
for obs in rows('structured-observations.jsonl'):
    assert embedded[obs['os'],obs['title'],obs['name']]==(obs['sha256'],obs['value'])
    if obs['name']=='activity-locale-geometry':
        g=obs['value'];assert len(g)==112 and sum(len(v['fragments']) for v in g)==304
        for v in g:
            assert v['visibleInk'] and v['contentWidth']<=v['width']+1
            for f in v['fragments']:
                l,t,r,b=f['clip'];assert f['visible'] and f['ink'] and all(x>=l-.5 and y>=t-.5 and xx<=r+.5 and yy<=b+.5 for x,y,xx,yy in f['ink'])

images=rows('images.jsonl');members=rows('members.jsonl');member_index={(m['os'],m['path']):m for m in members};image_map={r['id']:r for r in images}
assert len(images)==len({(tuple(r['size']),r['rgbaSHA256']) for r in images})==391
assert sum(len(r['copies']) for r in images)==1179 and Counter(r['os'] for r in images)=={'e2e-linux':195,'macos':196}
assert Counter(r['retention'] for r in images)=={'9ba8e59 RGBA-exact canonical':290,'new lossless WebP':101}
prior_cache={}
for e in images:
    p=ROOT/e['canonical'];assert sha(p.read_bytes())==e['retainedSHA256']
    im=pixels(e['canonical']);assert list(im.size)==e['size'] and sha(im.tobytes())==e['rgbaSHA256']
    for name in e['copies']:assert member_index[e['os'],name]['sha256']==e['sha256']
    if 'prior' in e:
        prior=e['prior'];index=prior['index'];assert sha((ROOT/index).read_bytes())==prior['indexSHA256']
        if index not in prior_cache:prior_cache[index]={r['id']:r for r in rows(index)}
        old=prior_cache[index][prior['imageID']];assert old['rgbaSHA256']==e['rgbaSHA256'] and old['retainedSHA256']==e['retainedSHA256']
for archive in load('downloads.json'):
    assert sum(m['os']==archive['name'] for m in members)==archive['extractedFiles']
    meta=next(a for a in load('metadata/artifacts.json')['artifacts'] if a['id']==archive['artifactID'])
    assert meta['digest']=='sha256:'+archive['sha256'] and meta['size_in_bytes']==archive['bytes']
diffs=rows('prior-image-comparisons.jsonl');assert len(diffs)==374
for d in diffs:
    current=pixels(image_map[d['imageID']]['canonical']);prior=pixels(d['priorCanonical'])
    assert current.size==prior.size and sha(prior.tobytes())==d['priorRGBA_SHA256']
    changed=np.any(np.asarray(current)!=np.asarray(prior),axis=2);yy,xx=np.where(changed)
    bounds=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)] if len(xx) else None
    assert int(changed.sum())==d['changedPixels'] and bounds==d['bounds']
assert sum(d['changedPixels']>0 for d in diffs)==74
contacts=load('contacts.json');targets=load('fullsize-targets.json')
assert len(contacts)==34 and all(c['inspected'] and sha((ROOT/c['path']).read_bytes())==c['sha256'] for c in contacts)
assert sorted(i for c in contacts for i in c['images'])==sorted(image_map)
assert len(targets)==103 and all(t['inspected'] and t['rgbaSHA256']==image_map[t['imageID']]['rgbaSHA256'] for t in targets)
assert Counter(t['kind'] for t in targets)=={'primary Files':28,'supplemental drift':74,'supplemental smoke':1}
assert all(d['imageID'] in {t['imageID'] for t in targets} for d in diffs if d['changedPixels'])
for name in ['locale-image-drift.json','memory-locale-drift.json']:assert len(load(name))==16 and all(e['samePNG'] and not e['changedPixels'] for e in load(name))
activity=load('activity-locale-drift.json');assert len(activity)==16 and sum(e['changedPixels'] for e in activity)==7827
for e in activity:assert 387<=e['changedPixels']<=543 and e['bounds'][0]>=850 and e['bounds'][2]<=908

change=load('source-change.json'); test=gzip.decompress((ROOT/'provenance/files-live.spec.ts.gz').read_bytes())
assert len(test.splitlines())==373 and sha(test)==change['finalTestSHA256']=='a7bd52dbc4577825bbaf2b50fff0de17801faa521ca98c6369c37b53e0f1e498'
assert sha(git('show',binding['head']+':tests/e2e/files-live.spec.ts'))==sha(test)
inputs=unpack('provenance/pinned-inputs.json.gz');renderer=unpack('provenance/renderer-inputs.json.gz');build=unpack('provenance/members.json.gz')
assert len(inputs['inputs'])==520 and len(renderer['files'])==478 and len(build['members'])==90
for e in inputs['inputs']:assert sha(git('show',binding['head']+':'+e['path']))==e['sha256']
assert sha('\n'.join(e['path']+':'+e['sha256'] for e in renderer['files']).encode())==binding['rendererComparatorFingerprint']
for n,key in [('pinned-inputs.json','inputs'),('renderer-inputs.json','files'),('members.json','members')]:
    old=unpack('provenance/original-dirty-'+n+'.gz');now=unpack('provenance/'+n+'.gz')
    assert old['dirty'] and old['revision']==source['originalDirtyBase'] and old[key]==now[key]
for ref in rows('external-receipts.jsonl'):assert sha((ROOT/ref['path']).read_bytes())==ref['sha256']
history=rows('historical-results.jsonl');assert [(r['cases'],r['results']) for r in history]==[(8,{'failed':8}),(8,{'passed':6,'failed':2}),(1,{'failed':1}),(2,{'failed':2}),(11,{'passed':11}),(143,{'passed':143})]
for r in history:assert sha(gzip.decompress((ROOT/r['path']).read_bytes()))==r['rawSHA256']
checks=load('checks-summary.json');assert (checks['unitPassed'],checks['unitSkipped'],checks['unitFiles'])==(278,1,25)
assert checks['i18n']==dict(files=69,usedKeys=2288,englishKeys=3438,problems=0) and len(rows('new-live-copy.jsonl'))==152
smoke=load('smoke-and-crash.json');assert smoke['nativeDisplayCapture']=='failed' and not smoke['nativeDisplayFile'] and b'could not create image from display' in rawlog and b'SMOKE OK' in rawlog
for d in smoke['diagnostics']:assert sha(gzip.decompress((ROOT/d['retained']).read_bytes()))==d['rawSHA256']
assert load('diagnostic-comparison.json')['allComparedByteExact'] and not load('audit.json')['fullGoalComplete']
print('Verified: 286 CI cases, 852 render visits, 391 images, 34 contacts, 28 Files + 74 drift + 1 smoke full-size views; exact checkout/tree and 520 inputs.')
