import hashlib
import json
import os
import re
import signal
import socket
import subprocess
import sys
from pathlib import Path

root, revision = Path(sys.argv[1]).resolve(strict=True), sys.argv[2]
assert re.fullmatch(r'/(?:private/)?tmp/opencode/desktop-terminal-state-[\w.-]+', str(root))
assert re.fullmatch('[a-f0-9]{40}', revision)
subprocess.run(['osascript', '-e', 'tell application "Cortex" to quit'], check=True)
stopped = []
for name, expected in [('backend.pid', 'terminal-state-native-backend.mjs'), ('capture.pid', 'launch-terminal-state-native.py --capture')]:
    pid = int((root / name).read_text())
    command = subprocess.run(['ps', '-p', str(pid), '-o', 'args='], capture_output=True, text=True).stdout
    if command:
        assert expected in command and str(root) in command
        os.kill(pid, signal.SIGTERM)
        stopped.append({'file': name, 'pid': pid})
subprocess.run(['osascript', '-e', 'tell application "System Events" to tell appearance preferences to set dark mode to true'], check=True)
env = {key: value for key, value in os.environ.items() if not key.startswith('CORTEX_')}
subprocess.run(['open', '-na', '/Applications/Cortex.app'], env=env, check=True)
result = {'applicationRevision': revision, 'asarSHA256': hashlib.sha256(Path('/Applications/Cortex.app/Contents/Resources/app.asar').read_bytes()).hexdigest(),
          'helpersStopped': stopped, 'ordinaryLaunchServicesOpen': True, 'restoredDarkAppearance': True}
(root / 'cleanup.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
