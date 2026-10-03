import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

root = Path.cwd()
base = Path('/tmp/opencode/bot-owner-regression')
out = base / sys.argv[1]
out.mkdir(parents=True, exist_ok=False)
(out / 'temp').mkdir()
pin = root / 'evidence/live-state-followup/integrated/source-build-initial.json'
inputs = root / 'evidence/live-state-followup/integrated/renderer-inputs-initial.json'
frozen = json.loads(pin.read_text())
renderer = json.loads(inputs.read_text())
node = '/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node'
command = ['xvfb-run', '-a', '-s', '-screen 0 1280x900x24', node,
           'node_modules/@playwright/test/cli.js', 'test', 'tests/e2e/bot-owner.spec.ts',
           '--workers=1', '--retries=0', '--reporter=list,json', f'--output={out}/artifacts']
env = dict(os.environ, NODE_ENV='test', TMPDIR=str(out / 'temp'), PLAYWRIGHT_JSON_OUTPUT_FILE=str(out / 'results.json'))
env.pop('CORTEX_RENDERER_URL', None)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

sources = ['packages/app/src/state/live.ts', 'packages/app/src/screens/bots/bot.tsx',
           'packages/desktop/src/remote-chat.ts', 'packages/desktop/src/remote-session.ts',
           'tests/e2e/live-state.spec.ts', 'tests/e2e/bot-owner.spec.ts']

def integrity(stage):
    members = [{**m, 'actualSHA256': sha(root / m['path'])} for m in frozen['members']]
    actual = {str(p.relative_to(root)) for directory in ['packages/app/dist', 'packages/desktop/dist']
              for p in (root / directory).rglob('*') if p.is_file()}
    expected = {m['path'] for m in members}
    inputs_match = all(sha(root / m['path']) == m['sha256'] for m in renderer['inputs'])
    result = {'members': members, 'allMatch': actual == expected and all(m['sha256'] == m['actualSHA256'] for m in members),
              'unlisted': sorted(actual - expected), 'missing': sorted(expected - actual), 'rendererInputsMatch': inputs_match,
              'rendererSourceFingerprint': renderer['sourceFingerprint'], 'sourceSHA256': {p: sha(root / p) for p in sources}}
    (out / f'integrity-{stage}.json').write_text(json.dumps(result, indent=2) + '\n')
    assert result['allMatch'] and inputs_match, f'Correction-build fingerprint mismatch: {stage}'
    return result

before = integrity('before')
for source in sources:
    dest = out / 'source' / source
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / source, dest)
shutil.copyfile(pin, out / pin.name)
shutil.copyfile(inputs, out / inputs.name)
record = {'command': command, 'cwd': str(root), 'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
          'nodeVersion': subprocess.check_output([node, '--version'], text=True).strip(), 'NODE_ENV': 'test',
          'TMPDIR': env['TMPDIR'], 'CORTEX_RENDERER_URL': 'unset', 'sourceSHA256': before['sourceSHA256']}
(out / 'run-command.json').write_text(json.dumps(record, indent=2) + '\n')
start = time.monotonic()
with (out / 'run.log').open('w') as log:
    run = subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=300)
(out / 'exit-code.txt').write_text(str(run.returncode) + '\n')
after = integrity('after')
receipt = {'exitCode': run.returncode, 'seconds': round(time.monotonic() - start, 3), 'distMembers': len(after['members']),
           'distAndSourcesUnchanged': before == after, 'output': str(out)}
(out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
sys.exit(run.returncode)
