import hashlib, importlib.util, json, os, pathlib, subprocess, time

root = pathlib.Path('/tmp/opencode/desktop-files-native-d20a012-save-probe-1').resolve(strict=True)
app = pathlib.Path('/Applications/Cortex.app')
asar = pathlib.Path('Contents/Resources/app.asar')
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
old = '22760335b8eef317c2c325cde1a7d4c09ecb888780226aaeb0e8ae4353a4bf26'
new = '9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893'
revision = 'd20a012fbb774aa9b348fe1913f85d3476430098'
assert sha(root / 'Cortex.zip') == '90f74a9796f1c1753885d0c0679ab2aa35130d826485c529794f45c3701f2429'
assert sha(app / asar) == old
unpack, backup = root / 'unpack', root / 'previous-Cortex.app'
assert not unpack.exists() and not backup.exists()
unpack.mkdir()
subprocess.run(['/usr/bin/ditto', '-x', '-k', str(root / 'Cortex.zip'), str(unpack)], check=True, timeout=60)
assert sha(unpack / 'Cortex.app' / asar) == new
subprocess.run(['/usr/bin/osascript', '-e', 'tell application "Cortex" to quit'], check=True, timeout=15)
binary = '/Applications/Cortex.app/Contents/MacOS/Cortex'
for _ in range(50):
    if binary not in subprocess.check_output(['/bin/ps', '-axo', 'comm='], text=True).splitlines(): break
    time.sleep(.1)
else: raise RuntimeError('Prior Cortex did not quit')
app.rename(backup)
try: (unpack / 'Cortex.app').rename(app)
except Exception:
    backup.rename(app)
    raise
assert sha(app / asar) == new and sha(backup / asar) == old
spec = importlib.util.spec_from_file_location('launch_files', root / 'launch-files-native.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
pins = json.loads((root / 'package-members-input.json').read_text())
verified = module.artifact(new, revision, pins)
record = {'applicationRevision': revision, 'zipSHA256': sha(root / 'Cortex.zip'), 'installedASAR': new, 'previousASAR': old, 'backup': str(backup), 'membersVerified': verified['membersVerified']}
with (root / 'installed.json').open('x') as out: json.dump(record, out, indent=2)
print(json.dumps(record))
