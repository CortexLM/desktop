"""Linux fontconfig coverage gate; uses existing fontconfig and Python stdlib."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
samples = json.loads((ROOT/'samples.json').read_text())
charsets = subprocess.check_output(['fc-list', '--format=%{charset}\n'], text=True)
available = set()
for token in charsets.split():
    span = token.split('-')
    available.update(range(int(span[0], 16), int(span[-1], 16)+1))
rows = []
for sample in samples:
    required = {ord(c) for key in ['heading', 'error', 'cancel'] for c in sample[key] if not c.isspace()}
    missing = sorted(required-available)
    rows.append({'locale': sample['locale'], 'covered': not missing, 'missingCodepoints': [f'U+{c:04X}' for c in missing]})
result = {'fontconfigFile': os.environ.get('FONTCONFIG_FILE'), 'coverage': rows}
print(json.dumps(result, indent=2))
sys.exit(0 if all(row['covered'] for row in rows) else 1)
