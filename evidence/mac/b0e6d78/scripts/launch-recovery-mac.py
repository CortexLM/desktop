import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

root = Path(sys.argv[1])
catalog = json.loads((root/'catalog.json').read_text())
env = dict(os.environ, CORTEX_DATA_DIR=str(root/'engine'), CORTEX_LOCALE='en', CORTEX_START_HASH='#/home',
           CORTEX_CATALOG_URL='data:application/json,'+quote(json.dumps(catalog,separators=(',',':'),ensure_ascii=False),safe="~()*!.'-"))
env.pop('CORTEX_RENDERER_URL', None)
env.pop('CORTEX_TEST_PROVIDER_BASEURL', None)
assert not (root/'engine').exists() and not (root/'profile').exists()
subprocess.run(['open','-na','/Applications/Cortex.app','--args','--remote-debugging-port=9444',f'--user-data-dir={root}/profile'],env=env,check=True)
log=(root/'capture.log').open('w')
helper=subprocess.Popen(['/opt/homebrew/bin/python3',str(root/'capture-server.py')],stdout=log,stderr=log,start_new_session=True)
(root/'capture.pid').write_text(str(helper.pid))
print('Launched isolated installed recovery app and native helper')
