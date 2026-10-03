import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

root=Path(sys.argv[1])
assert root.is_dir() and not (root/'engine').exists() and not (root/'profile').exists()
catalog=json.loads((root/'catalog.json').read_text())
env=dict(os.environ,CORTEX_DATA_DIR=str(root/'engine'),CORTEX_LOCALE='en',CORTEX_START_HASH='#/home',
         CORTEX_CATALOG_URL='data:application/json,'+quote(json.dumps(catalog,separators=(',',':'),ensure_ascii=False),safe="~()*!.'-"))
env.pop('CORTEX_RENDERER_URL',None);env.pop('CORTEX_TEST_PROVIDER_BASEURL',None)
subprocess.run(['open','-na','/Applications/Cortex.app','--args','--remote-debugging-port=9444',f'--user-data-dir={root}/profile'],env=env,check=True)
for name in ['live-recovery-terminal-provider','code-viewport-native-backend']:
    script=root/f'{name}.mjs'
    if not script.exists():continue
    receipt=root/f'{name}-receipt.json'
    process=subprocess.Popen(['/opt/homebrew/bin/node',str(script.resolve()),str(root/'project'),str(receipt)],
                             stdout=(root/f'{name}.log').open('w'),stderr=subprocess.STDOUT,start_new_session=True)
    (root/f'{name}.pid').write_text(str(process.pid))
print('Isolated Code/recovery app and controlled providers started')
