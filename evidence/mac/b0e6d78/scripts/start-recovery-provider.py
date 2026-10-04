import subprocess
from pathlib import Path
root = Path('/tmp/opencode/desktop-recovery-b0e6d78')
log = (root / 'terminal-provider.log').open('w')
process = subprocess.Popen(['/opt/homebrew/bin/node', str((root/'live-recovery-terminal-provider.mjs').resolve()),
                            str(root/'project'), str(root/'provider-receipt.json')],
                           stdout=log, stderr=log, start_new_session=True)
(root/'provider.pid').write_text(str(process.pid))
print('Controlled terminal provider started', process.pid)
