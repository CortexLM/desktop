"""Verify the immutable capture, retain lossless images and labeled contact sheets."""
import hashlib
import json
import math
import struct
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).resolve().parent
root = Path('/tmp/opencode/live-recovery-final-compare')
provenance = json.loads((root / 'provenance.json').read_text())
rows = json.loads((root / 'report.json').read_text())
sha = lambda b: hashlib.sha256(b).hexdigest()
assert sha((root / 'report.json').read_bytes()) == provenance['reportSha256']
assert len(rows) == len({row['name'] for row in rows}) == 58
assert len(provenance['runs']) == 1
compared = [row for row in rows if 'diffPct' in row]
assert len(compared) == 42
assert sum(len(row['files']) for row in rows) == 142
for row in rows:
    assert row['run'] == provenance['runs'][0]['id'] and row['clock'] == provenance['clock']
    for kind, info in row['files'].items():
        data = (root / info['file']).read_bytes()
        assert sha(data) == info['sha256'] and len(data) == info['bytes'], info['file']
        assert data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', data[16:24]) == (2880, 1800)
    if 'design' in row['files']:
        assert row['files']['design']['sha256'] == row['reference']['sha256']
    else:
        assert row['status'] == 'no-design-shot' and 'diffPct' not in row

revision = '749bc0c035391d72aeafb4b5ce39cc0aa5342830'
assert provenance['application']['revision'] == revision
names = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', revision, '--', *provenance['application']['sourcePaths']], text=True).splitlines()
source = sha('\n'.join(f'{name}:{sha(subprocess.check_output(["git", "show", f"{revision}:{name}"]))}' for name in sorted(names)).encode())
assert len(names) == 473 and source == provenance['application']['sourceFingerprint']
assert source == '9ba9fd691b7f6757aaefdfe242d62e06e5e0b49f29ae039769e6ec025144346b'
current_source = sha('\n'.join(f'{name}:{sha(Path(name).read_bytes())}' for name in sorted(names)).encode())
assert current_source == source
assert sha(subprocess.check_output(['git', 'show', f'{revision}:scripts/compare-shots.mjs'])) == provenance['comparatorSha256']

freeze = Path(provenance['reference']['root'])
names = sorted(p.relative_to(freeze).as_posix() for p in (freeze / 'src').rglob('*') if p.is_file())
freeze_source = sha('\n'.join(f'{name}:{sha((freeze / name).read_bytes())}' for name in names).encode())
assert len(names) == 106 and freeze_source == provenance['reference']['sourceFingerprint']
for key, name in [('freezeSha256', 'freeze.json'), ('manifestSha256', 'shots/manifest.json'), ('registrySha256', 'shots/registry.json'), ('coverageSha256', 'review/cmp/coverage.json'), ('motionIndexSha256', 'public/states/index.json')]:
    assert sha((freeze / name).read_bytes()) == provenance['reference'][key]
manifest = json.loads((freeze / 'shots/manifest.json').read_text())['images']
assert len(manifest) == 410
for name, info in manifest.items():
    assert sha((freeze / 'shots' / name).read_bytes()) == info['sha256']
for row in compared:
    assert row['reference']['sha256'] == manifest[row['reference']['file']]['sha256']

run = provenance['runs'][0]
assert sha('\n'.join(f"{f['url']}:{f['sha256']}" for f in run['build']['files']).encode()) == run['build']['sha256']
def verify_asset(f):
    with urllib.request.urlopen(f['url'], timeout=30) as response:
        data = response.read()
    assert sha(data) == f['sha256'] and len(data) == f['bytes'], f['url']
with ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(verify_asset, run['build']['files']))

for name in ['report.json', 'provenance.json']:
    (out / name).write_bytes((root / name).read_bytes())
(out / 'images').mkdir(exist_ok=True)
jobs = [(row['name'], kind, info) for row in rows for kind, info in row['files'].items()]
def retain_image(job):
    name, kind, info = job
    relative = f'images/{name}.{kind}.webp'
    image = Image.open(root / info['file']).convert('RGBA')
    image.save(out / relative, format='WEBP', lossless=True, method=4, exact=True)
    assert Image.open(out / relative).convert('RGBA').tobytes() == image.tobytes(), relative
    return {'state': name, 'kind': kind, 'file': relative, 'sourcePng': info['file'], 'sourceSha256': info['sha256'], 'sha256': sha((out / relative).read_bytes()), 'bytes': (out / relative).stat().st_size}
with ThreadPoolExecutor(max_workers=4) as pool:
    retained = list(pool.map(retain_image, jobs))

font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
contacts = []
for start in range(0, len(rows), 20):
    batch = rows[start:start + 20]
    sheet = Image.new('RGB', (1600, 278 * math.ceil(len(batch) / 4)), '#dddddd')
    draw = ImageDraw.Draw(sheet)
    for i, row in enumerate(batch):
        x, y = i % 4 * 400, i // 4 * 278
        with Image.open(root / row['files']['app']['file']) as image:
            sheet.paste(image.convert('RGB').resize((400, 250), Image.Resampling.LANCZOS), (x, y))
        label = f"{row['name']} | {str(row['diffPct'])+'%' if 'diffPct' in row else 'REFERENCE GAP'}"
        draw.text((x + 5, y + 253), label, font=font, fill='#111111')
    name = f'contact-{start // 20 + 1:02}.jpg'
    sheet.save(out / name, quality=90, subsampling=0)
    contacts.append({'file': name, 'sha256': sha((out / name).read_bytes()), 'states': [row['name'] for row in batch]})

verification = {
    'revision': revision, 'sourceFileCount': 473, 'sourceFingerprint': source, 'workingTreeSourceMatchesCommit': True,
    'reportSha256': sha((root / 'report.json').read_bytes()), 'provenanceSha256': sha((root / 'provenance.json').read_bytes()),
    'originalImageHashesVerified': 142, 'imageDimensions': [2880, 1800], 'frozenSourceFilesVerified': 106, 'frozenReferenceImageHashesVerified': 410,
    'servedAssetsRefetched': len(run['build']['files']), 'servedAssetFingerprint': run['build']['sha256'],
    'ignoredPreviewApiErrors': len(run['ignoredPreviewApiErrors']), 'meanOfRoundedDiffPct': sum(row['diffPct'] for row in compared) / len(compared),
    'maximumDiffPct': max(row['diffPct'] for row in compared), 'gaps': [row['name'] for row in rows if 'diffPct' not in row],
}
(out / 'verification.json').write_text(json.dumps(verification, indent=2) + '\n')
(out / 'retained.json').write_text(json.dumps({'originalDirectory': str(root), 'counts': {'app': 58, 'design': 42, 'diff': 42}, 'losslessRgbaVerified': True, 'images': retained, 'contactSheets': contacts}, indent=2) + '\n')
html = '<!doctype html><meta charset="utf-8"><title>Cortex scoped comparison 749bc0c</title><style>body{font:14px system-ui}img{max-width:430px}td{vertical-align:top}</style><h1>Cortex scoped frozen comparison — 749bc0c</h1><p>58 renders, 42 comparisons, 16 reference gaps. <a href="README.md">Review and limits</a>.</p><table><tr><th>State</th><th>App</th><th>Frozen reference</th><th>Diff</th></tr>'
for row in rows:
    html += f'<tr><td>{row["name"]}<br>{str(row["diffPct"])+"%" if "diffPct" in row else "REFERENCE GAP"}</td>'
    for kind in ['app', 'design', 'diff']:
        file = f'images/{row["name"]}.{kind}.webp'
        html += f'<td><a href="{file}"><img loading="lazy" src="{file}" alt="{kind}: {row["name"]}"></a></td>' if kind in row['files'] else '<td>No frozen reference</td>'
    html += '</tr>'
(out / 'index.html').write_text(html + '</table>\n')
print(json.dumps({**verification, 'retainedImageBytes': sum(x['bytes'] for x in retained), 'contacts': len(contacts)}, indent=2))
