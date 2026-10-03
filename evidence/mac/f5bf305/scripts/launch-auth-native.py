import os
import subprocess
import sys
from pathlib import Path

root=Path(sys.argv[1])
assert root.is_dir() and not (root/'engine').exists() and not (root/'renderer').exists()
backend=subprocess.Popen(['/opt/homebrew/bin/node',str((root/'remote-auth-native-backend.mjs').resolve()),str(root),str(root/'backend-receipt.json')],
                         stdout=(root/'backend.log').open('w'),stderr=subprocess.STDOUT,start_new_session=True)
(root/'backend.pid').write_text(str(backend.pid))
env=dict(os.environ,CORTEX_DATA_DIR=str(root/'engine'),CORTEX_LOCALE='en',CORTEX_START_HASH='#/home',CORTEX_CATALOG_URL='http://127.0.0.1:9457/catalog')
env.pop('CORTEX_RENDERER_URL',None);env.pop('CORTEX_TEST_PROVIDER_BASEURL',None)
subprocess.run(['open','-na','/Applications/Cortex.app','--args','--remote-debugging-port=9444',f'--user-data-dir={root}/renderer'],env=env,check=True)
helper=subprocess.Popen(['/opt/homebrew/bin/python3',str(root/'capture-server.py')],stdout=(root/'capture.log').open('w'),stderr=subprocess.STDOUT,start_new_session=True)
(root/'capture.pid').write_text(str(helper.pid))
print('Isolated installed auth app and helpers started')
