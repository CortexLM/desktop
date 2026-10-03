import hashlib
import json
import os
import re
import socket
import subprocess
import sys
from pathlib import Path

root, revision, expected_zip, expected_asar = Path(sys.argv[1]), *sys.argv[2:]
assert sys.platform == 'darwin'
assert re.fullmatch(r'/tmp/opencode/desktop-terminal-state-(?:projects|memory)-[\w.-]+', str(root))
assert re.fullmatch('[a-f0-9]{40}', revision)
assert all(re.fullmatch('[a-f0-9]{64}', h) for h in [expected_zip, expected_asar])
lease = json.loads((root / 'pre-lease.json').read_text())
assert lease['nativeDark'] in ['true', 'false'] and lease['leaseID']
app = Path('/Applications/Cortex.app')
binary = str(app / 'Contents/MacOS/Cortex')
assert binary not in subprocess.check_output(['ps', '-axo', 'comm='], text=True).splitlines(), 'Quit Cortex before installing'
for port in [9444, 9445, 9456]:
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', port))
archive = root / 'Cortex.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected_zip
staging, backup = root / 'unpacked', root / 'previous-Cortex.app'
assert not staging.exists() and not backup.exists()
subprocess.run(['/usr/bin/ditto', '-xk', str(archive), str(staging)], check=True)
replacement = staging / 'Cortex.app'
assert hashlib.sha256((replacement / 'Contents/Resources/app.asar').read_bytes()).hexdigest() == expected_asar
previous_hash = hashlib.sha256((app / 'Contents/Resources/app.asar').read_bytes()).hexdigest()
os.rename(app, backup)
try:
    os.rename(replacement, app)
except BaseException:
    os.rename(backup, app)
    raise
receipt = {'applicationRevision': revision, 'zipSHA256': expected_zip,
           'installedASAR': hashlib.sha256((app / 'Contents/Resources/app.asar').read_bytes()).hexdigest(),
           'previousASAR': previous_hash, 'backup': str(backup)}
assert receipt['installedASAR'] == expected_asar
(root / 'installed.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt))
