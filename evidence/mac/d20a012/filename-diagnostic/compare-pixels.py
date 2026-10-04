import hashlib, json, math, sys
from pathlib import Path
from PIL import Image, ImageChops

root = Path(sys.argv[1])
manifest = json.loads((root / 'manifest.json').read_text())
assert len(manifest['captures']) == 2
shots = manifest['captures']
images = []
for shot in shots:
    path = root / shot['file']
    assert path.parent == root and hashlib.sha256(path.read_bytes()).hexdigest() == shot['sha256']
    images.append(Image.open(path).convert('RGBA'))
assert images[0].size == images[1].size
boxes = [shot['boxes'][0]['bounds'] for shot in shots]
assert boxes[0] == boxes[1], 'Filename coordinates changed; no valid glyph comparison'
scale = images[0].width / 960
assert scale >= 1 and images[0].height / 640 == scale
l, t, r, b = boxes[0]
crop = [math.floor((l - 6) * scale), math.floor((t - 6) * scale), math.ceil((r + 6) * scale), math.ceil((b + 6) * scale)]
assert crop[0] >= 0 and crop[1] >= 0 and crop[2] <= images[0].width and crop[3] <= images[0].height
clips = [image.crop(crop) for image in images]
diff = ImageChops.difference(*clips)
changed = sum(any(pixel) for pixel in diff.getdata())
for i, image in enumerate(clips): image.save(root / f'filename-crop-{i}.png')
diff.save(root / 'filename-difference.png')
record = {'scope': 'Exact native pixels around the normal filename; unchanged coordinates required; no general typography or long-name acceptance', 'crop': crop, 'scale': scale, 'changedPixels': changed, 'rgbaEqual': clips[0].tobytes() == clips[1].tobytes(), 'sourceImages': [{ 'file': shot['file'], 'sha256': shot['sha256']} for shot in shots], 'filenameBoxes': boxes}
(root / 'pixel-comparison.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record))
