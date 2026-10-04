import collections
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import textwrap

from PIL import Image, ImageDraw, ImageFont

ROOT = Path('/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite')
OUT = Path('/tmp/opencode/recovery-local-e2e-review')
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'contacts').mkdir(exist_ok=True)
(OUT / 'selected').mkdir(exist_ok=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
def save(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

report = ROOT / 'test-results/e2e.json'
log = Path('/tmp/opencode/live-recovery-e2e-final.log')
shutil.copyfile(report, OUT / 'e2e.json')
shutil.copyfile(log, OUT / 'e2e-final.log')
data = json.loads(report.read_text())
cases = []
def walk(suite):
    for spec in suite.get('specs', []):
        for test in spec.get('tests', []):
            cases.append({'file': spec['file'], 'title': spec['title'], 'ok': spec['ok'], 'test': test})
    for nested in suite.get('suites', []):
        walk(nested)
walk(data)
attachments = []
for case in cases:
    for result in case['test']['results']:
        for attachment in result.get('attachments', []):
            attachments.append({'testFile': case['file'], 'testTitle': case['title'], **attachment})
pngs = [a for a in attachments if a['contentType'] == 'image/png']
unique = {}
for attachment in pngs:
    source = Path(attachment['path'])
    digest = sha(source)
    if digest not in unique:
        with Image.open(source) as image:
            dimensions = image.size
        unique[digest] = {'id': len(unique) + 1, 'sha256': digest, 'bytes': source.stat().st_size,
                          'width': dimensions[0], 'height': dimensions[1], 'sources': [], 'attachments': []}
    unique[digest]['sources'].append(str(source))
    unique[digest]['attachments'].append({k: attachment[k] for k in ['name', 'testFile', 'testTitle']})
all_files = []
for source in sorted((ROOT / 'test-results/artifacts').rglob('*.png')):
    digest = sha(source)
    all_files.append({'path': str(source), 'sha256': digest, 'bytes': source.stat().st_size,
                      'uploadedUniqueID': unique.get(digest, {}).get('id')})
images = list(unique.values())
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 16)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
cols, rows, width, height = 3, 4, 480, 366
for start in range(0, len(images), cols * rows):
    chunk = images[start:start + cols * rows]
    sheet = Image.new('RGB', (cols * width, math.ceil(len(chunk) / cols) * height), '#d6d6d6')
    draw = ImageDraw.Draw(sheet)
    for offset, item in enumerate(chunk):
        x, y = (offset % cols) * width, (offset // cols) * height
        image = Image.open(item['sources'][0]).convert('RGB')
        image.thumbnail((width - 12, height - 56), Image.Resampling.LANCZOS)
        sheet.paste(image, (x + (width - image.width) // 2, y + 3))
        label = f"{item['id']:03d} {item['attachments'][0]['name']}"
        draw.text((x + 7, y + height - 51), '\n'.join(textwrap.wrap(label, 54)[:2]), fill='black', font=small)
        draw.text((x + 7, y + height - 19), f"{item['width']}×{item['height']}", fill='black', font=small)
        item['contactSheet'] = f'contacts/sheet-{start // (cols * rows) + 1:02d}.jpg'
        item['contactCell'] = offset + 1
    sheet.save(OUT / chunk[0]['contactSheet'], quality=88, optimize=True)

selected = []
for item in images:
    first = item['attachments'][0]
    if first['testFile'] in ['memory-safety.spec.ts', 'approvals-recovery.spec.ts', 'terminal-copy.spec.ts'] or first['name'].startswith('provider-key-'):
        target = f"selected/{item['id']:03d}-{first['name']}.png"
        shutil.copyfile(item['sources'][0], OUT / target)
        item['retainedOriginal'] = target
        selected.append({'id': item['id'], 'name': first['name'], 'path': target, 'sha256': item['sha256'], 'bytes': item['bytes']})

results = [r for c in cases for r in c['test']['results']]
summary = {'sourceReport': str(report), 'reportSha256': sha(report), 'logSha256': sha(log), 'stats': data['stats'],
    'testCount': len(cases), 'resultCount': len(results), 'passed': sum(r['status'] == 'passed' for r in results),
    'resultStatuses': dict(collections.Counter(r['status'] for r in results)),
    'retryValues': dict(collections.Counter(r['retry'] for r in results)),
    'testErrorCount': sum(len(r.get('errors', [])) for r in results), 'reportErrorCount': len(data.get('errors', [])),
    'stderrItemCount': sum(len(r.get('stderr', [])) for r in results),
    'uploadedAttachmentCount': len(attachments), 'uploadedPngCount': len(pngs), 'uniqueUploadedPngs': len(images),
    'artifactPngFiles': len(all_files), 'artifactUniquePngs': len(set(f['sha256'] for f in all_files)),
    'unmatchedArtifactPngs': [f for f in all_files if not f['uploadedUniqueID']],
    'selectedFullSizeCount': len(selected), 'selectedFullSizeBytes': sum(i['bytes'] for i in selected),
    'screenCase': [c for c in cases if c['file'] == 'screens.spec.ts'],
    'headAtReview': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'pinScope': 'Uncommitted integrated build described by coordinator; full 83-case run predates the last team.tsx forgotten.clear removal. Current source hashes are review-time pins, not reconstructed full-run build pins.',
    'memoryReturnRuns': 'Separate coordinator-owned evidence; not read, copied or merged here.'}
save('summary.json', summary)
save('png-inventory.json', images)
save('artifact-png-files.json', all_files)
save('selected-originals.json', selected)
save('attachments.json', attachments)
save('test-outcomes.json', [{k: c[k] for k in ['file', 'title', 'ok']} | {'status': c['test']['status'], 'results': [{k: r[k] for k in ['status', 'retry', 'duration', 'startTime', 'errors', 'stdout', 'stderr']} for r in c['test']['results']]} for c in cases])
paths = sorted(set(subprocess.check_output(['git', 'diff', '--name-only'], cwd=ROOT, text=True).splitlines()) | {'tests/e2e/' + c['file'] for c in cases})
save('review-time-source-pins.json', [{'path': p, 'sha256': sha(ROOT / p)} for p in paths if (ROOT / p).is_file()])
print(json.dumps({k: v for k, v in summary.items() if k != 'screenCase'}, ensure_ascii=False, indent=2))
print('SELECTED')
for item in selected:
    print(item['path'])
