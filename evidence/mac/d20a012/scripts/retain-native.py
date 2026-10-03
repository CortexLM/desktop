from pathlib import Path
import hashlib, json, shutil
from PIL import Image

source = Path('/tmp/opencode/files-native-d20a012-a2')
dest = Path('evidence/mac/d20a012/native')
manifest = json.loads((source / 'manifest.json').read_text())
assert manifest['revision'] == 'd20a012fbb774aa9b348fe1913f85d3476430098'
assert manifest['asar'] == '9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893'
dest.mkdir(exist_ok=False)
shutil.copy2(source / 'manifest.json', dest / 'manifest.json')
sha = lambda raw: hashlib.sha256(raw).hexdigest()
images = []
for shot in manifest['captures']:
    original = source / shot['file']
    assert original.parent == source and original.is_file()
    raw = original.read_bytes()
    assert len(raw) == shot['bytes'] and sha(raw) == shot['sha256']
    with Image.open(original) as image:
        image.verify()
    with Image.open(original) as image:
        rgba = image.convert('RGBA')
        pixels = rgba.tobytes()
        retained = dest / (original.stem + '.webp')
        rgba.save(retained, format='WEBP', lossless=True, exact=True, method=6)
    with Image.open(retained) as image:
        assert image.convert('RGBA').tobytes() == pixels and image.size == rgba.size
    images.append({'originalName': original.name, 'originalSHA256': sha(raw), 'originalBytes': len(raw), 'retainedFile': retained.name, 'retainedSHA256': sha(retained.read_bytes()), 'retainedBytes': retained.stat().st_size, 'pixels': list(rgba.size), 'rgbaSHA256': sha(pixels), 'collectorStatus': shot['status'], 'fullSizeInspected': False})
(dest / 'images.json').write_text(json.dumps(images, indent=2) + '\n')
(dest / 'SHA256SUMS').write_text(''.join(f'{sha(p.read_bytes())}  {p.name}\n' for p in sorted(dest.iterdir()) if p.is_file() and p.name != 'SHA256SUMS'))
print(json.dumps({'collectorStatus': manifest['status'], 'retainedImages': len(images), 'scope': 'Byte and RGBA retention only; visual/runtime disposition remains separate'}))
