import hashlib
import json
import os
import signal
import socket
import subprocess
from pathlib import Path

root=Path('/tmp/opencode/desktop-recovery-b0e6d78')
subprocess.run(['osascript','-e','tell application "Cortex" to quit'],check=True)
stopped={}
for name in ['capture','provider']:
    file=root/f'{name}.pid'
    if not file.exists():continue
    pid=int(file.read_text())
    result=subprocess.run(['ps','-p',str(pid),'-o','args='],capture_output=True,text=True)
    expected='capture-server.py' if name=='capture' else 'live-recovery-terminal-provider.mjs'
    if expected in result.stdout:
        os.kill(pid,signal.SIGTERM);stopped[name]=pid
    else:stopped[name]='already absent'
subprocess.run(['osascript','-e','tell application "System Events" to tell appearance preferences to set dark mode to true'],check=True)
env=dict(os.environ)
for key in list(env):
    if key.startswith('CORTEX_'):env.pop(key)
subprocess.run(['open','-na','/Applications/Cortex.app'],env=env,check=True)
result={'applicationRevision':'b0e6d78bdfe5a4cc74aed3fdefb6ecf4001cb874',
        'asarSHA256':hashlib.sha256(Path('/Applications/Cortex.app/Contents/Resources/app.asar').read_bytes()).hexdigest(),
        'helpersStopped':stopped,'ordinaryLaunchServicesOpen':True,'restoredDarkAppearance':True}
(root/'cleanup.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
