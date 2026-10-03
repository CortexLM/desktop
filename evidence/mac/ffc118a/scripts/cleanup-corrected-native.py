import hashlib
import json
import os
import signal
import subprocess
import sys
from pathlib import Path

revision=sys.argv[1]
roots=[Path(name) for name in sys.argv[2:]]
subprocess.run(['osascript','-e','tell application "Cortex" to quit'],check=True)
stopped=[]
for root in roots:
    for file in root.glob('*.pid'):
        pid=int(file.read_text())
        command=subprocess.run(['ps','-p',str(pid),'-o','args='],capture_output=True,text=True).stdout
        allowed=['capture-server.py','remote-auth-native-backend.mjs','live-recovery-terminal-provider.mjs','code-viewport-native-backend.mjs']
        if any(name in command for name in allowed):
            os.kill(pid,signal.SIGTERM)
            stopped.append({'file':str(file),'pid':pid})
subprocess.run(['osascript','-e','tell application "System Events" to tell appearance preferences to set dark mode to true'],check=True)
env={key:value for key,value in os.environ.items() if not key.startswith('CORTEX_')}
subprocess.run(['open','-na','/Applications/Cortex.app'],env=env,check=True)
result={'applicationRevision':revision,'asarSHA256':hashlib.sha256(Path('/Applications/Cortex.app/Contents/Resources/app.asar').read_bytes()).hexdigest(),
        'helpersStopped':stopped,'ordinaryLaunchServicesOpen':True,'restoredDarkAppearance':True}
(roots[0]/'cleanup.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
