"""Offline integrity check; Python + installed Pillow. No app launch or network."""
from pathlib import Path
import base64
import gzip
import hashlib
import json
import re
from PIL import Image

ROOT = Path(__file__).resolve().parent
def sha(raw): return hashlib.sha256(raw).hexdigest()
def load(name): return json.loads((ROOT / name).read_bytes())
def walk(suites):
    for suite in suites:
        yield from suite.get('specs', [])
        yield from walk(suite.get('suites', []))

manifest = (ROOT / 'SHA256SUMS').read_text().splitlines()
assert len(manifest) == len({line.split('  ', 1)[1] for line in manifest})
assert {line.split('  ', 1)[1] for line in manifest} == {
    str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name != 'SHA256SUMS'}
for line in manifest:
    digest, name = line.split('  ', 1)
    assert sha((ROOT / name).read_bytes()) == digest, name
for p in ROOT.rglob('*.json'): json.loads(p.read_bytes())
for p in ROOT.rglob('*.jsonl'):
    for line in p.read_text().splitlines(): json.loads(line)

summaries = load('e2e-summary.json')
attachments = 0
for system in ['e2e-linux', 'macos']:
    raw = gzip.decompress((ROOT / f'{system}-report.json.gz').read_bytes())
    assert sha(raw) == summaries[system]['reportSHA256']
    report = json.loads(raw)
    specs = list(walk(report['suites']))
    tests = [t for s in specs for t in s['tests']]
    attempts = [r for t in tests for r in t['results']]
    assert len(tests) == len(attempts) == 116
    assert all(t['status'] == 'expected' for t in tests)
    assert all(r['status'] == 'passed' and not r['errors'] and r['retry'] == 0 for r in attempts)
    assert not report.get('errors')
    rendered = [int(n) for s in specs if s['file'] == 'screens.spec.ts'
        for t in s['tests'] for r in t['results'] for out in r['stdout']
        for n in re.findall(r'rendered (\d+) screen states', out.get('text', ''))]
    assert rendered == [426]
    for result in attempts:
        for a in result['attachments']:
            if a['contentType'] == 'application/json':
                json.loads(base64.b64decode(a['body'], validate=True))
                attachments += 1
assert attachments == 118
images = [json.loads(line) for line in (ROOT / 'images.jsonl').read_text().splitlines()]
assert len(images) == 311 and sum(len(i['copies']) for i in images) == 939
assert len({(i['os'], p) for i in images for p in i['copies']}) == 939
assert sum(i['retention'] == 'CI99 RGBA-exact canonical' for i in images) == 81
assert sum(i['retention'] == 'new lossless WebP' for i in images) == 230
for entry in images:
    p = ROOT / entry['canonical']
    assert sha(p.read_bytes()) == entry['retainedSHA256'], p
    with Image.open(p) as image:
        assert list(image.size) == entry['size']
        assert sha(image.convert('RGBA').tobytes()) == entry['rgbaSHA256'], p
    if 'prior' in entry:
        prior = next(r for r in json.loads((ROOT / entry['prior']['index']).read_bytes()) if r['id'] == entry['prior']['imageID'])
        assert prior['rgbaSHA256'] == entry['rgbaSHA256']
        assert prior['retainedSHA256'] == entry['retainedSHA256']
contacts = load('contacts.json')
assert len(contacts) == 26 and all(c['inspected'] for c in contacts)
assert sorted(i for c in contacts for i in c['images']) == sorted(i['id'] for i in images)
targets = load('fullsize-targets.json')
assert len(targets) == 32 and all(t['inspected'] for t in targets)
assert sum(t['view'].startswith(('project-', 'projects-')) for t in targets) == 16
drift = load('locale-image-drift.json')
assert len(drift) == 16 and all(d['changedPixels'] > 0 and d['contentFromX337RGBAExact'] for d in drift)
test = gzip.decompress((ROOT / 'provenance/projects.spec.ts.gz').read_bytes())
assert len(test.splitlines()) == 363 and sha(test) == load('source-change.json')['projectTestSHA256']
assert load('checkout-binding.json')['headCheckoutTreesEqual'] is None
assert load('smoke-and-crash.json')['nativeDisplayCapture'] == 'failed'
assert load('smoke-and-crash.json')['diagnostics'][0]['simulated'] is True
print('Verified: 232 cases, 852 render visits, 118 JSON attachments, 311 images, 26 contacts, 32 full-size review records.')
