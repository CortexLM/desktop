from pathlib import Path
import hashlib
import json
import platform
import shutil
import subprocess
import zipfile

base = Path('/tmp/cortex-recovery')
with zipfile.ZipFile(base / 'ci-artifact.zip') as archive:
    archive.extractall(base / 'package')
package = base / 'package/Cortex-0.2.0-arm64-mac.zip'
assert hashlib.sha256(package.read_bytes()).hexdigest() == 'a850b0072173159539735d9274dcdee813fbecc7e0c18a4edbabc1ad66378443'
subprocess.run(['ditto', '-x', '-k', str(package), str(base / 'extracted')], check=True)
app = Path('/Applications/Cortex.app')
previous = base / 'previous-Cortex.app'
assert not previous.exists()
if app.exists():
    shutil.move(str(app), previous)
subprocess.run(['ditto', str(base / 'extracted/Cortex.app'), str(app)], check=True)
subprocess.run(['xattr', '-dr', 'com.apple.quarantine', str(app)], check=False)
res = app / 'Contents/Resources'
locales = res / 'locales'
record = {
    'artifactRevision': 'cc758a69fe9349d17f6a4bf7accd978421035519',
    'ciRun': '37039827971', 'artifactID': '11242356217',
    'zipSha256': hashlib.sha256(package.read_bytes()).hexdigest(),
    'appSha256': hashlib.sha256((res / 'app.asar').read_bytes()).hexdigest(),
    'cleanInstall': True, 'previousAppPreserved': str(previous),
    'locales': sorted(p.name for p in locales.iterdir() if p.is_dir()),
    'catalogCounts': {p.name: len(list(p.glob('*.json'))) for p in locales.iterdir() if p.is_dir()},
    'sourceStamps': len(list(locales.rglob('*.source.json'))),
    'rawFixtures': len(list(locales.rglob('fixtures'))),
    'builtinSkill': (res / 'skills/summarize/SKILL.md').is_file(),
    'os': platform.platform(),
}
assert len(record['locales']) == 8 and all(n == 13 for n in record['catalogCounts'].values())
assert not record['sourceStamps'] and not record['rawFixtures'] and record['builtinSkill']
(base / 'install.json').write_text(json.dumps(record, indent=2) + '\n')
print('Installed exact CI artifact; eight locales and bundled skill verified')
