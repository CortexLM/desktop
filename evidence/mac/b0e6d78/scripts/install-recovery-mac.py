import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

root, expected, revision = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
archive = root / 'Cortex.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
unpack = root / 'unpacked'
assert not unpack.exists()
subprocess.run(['ditto', '-x', '-k', str(archive), str(unpack)], check=True)
source = unpack / 'Cortex.app'
assert source.is_dir()
target = Path('/Applications/Cortex.app')
backup = Path('/Applications/Cortex-before-recovery.app')
assert not backup.exists()
subprocess.run(['osascript', '-e', 'tell application "Cortex" to quit'], check=True)
if target.exists(): target.rename(backup)
try:
    subprocess.run(['ditto', str(source), str(target)], check=True)
except Exception:
    if target.exists(): shutil.rmtree(target)
    if backup.exists(): backup.rename(target)
    raise
subprocess.run(['xattr', '-dr', 'com.apple.quarantine', str(target)], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
asar = target / 'Contents/Resources/app.asar'
receipt = {'applicationRevision': revision, 'zipSHA256': expected,
           'installedASAR': hashlib.sha256(asar.read_bytes()).hexdigest(), 'backup': str(backup)}
(root / 'installed.json').write_text(json.dumps(receipt, indent=2)+'\n')
print(json.dumps(receipt))
