from pathlib import Path
import hashlib
import json
import subprocess
import sys

root = Path('/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite')
freeze = Path('/tmp/opencode/build-provider-draft-final')
output = Path('/tmp/opencode/appearance-theme-baseline')
manifest = json.loads((freeze / 'members.json').read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
rows = [{**row, 'current': sha(root / row['path']), 'frozen': sha(freeze / row['path'])} for row in manifest['members']]
source = json.loads((freeze / 'pinned-inputs.json').read_text())
inputs = [{**row, 'current': sha(root / row['path'])} for row in source['inputs'] if not row['path'].endswith('.md')]
expected = {row['path'] for row in rows}
actual = {str(path.relative_to(root)) for directory in ['packages/app/dist', 'packages/desktop/dist'] for path in (root / directory).rglob('*') if path.is_file()}
result = {
    'phase': sys.argv[1],
    'documentary_revision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'application_revision': manifest['revision'],
    'all_90_match': len(rows) == 90 and all(row['sha256'] == row['current'] == row['frozen'] for row in rows),
    'extra_dist_members': sorted(actual - expected),
    'application_inputs_match': all(row['sha256'] == row['current'] for row in inputs),
    'application_input_count': len(inputs),
    'application_input_mismatches': [row for row in inputs if row['sha256'] != row['current']],
    'test_sha256': sha(root / 'tests/e2e/appearance-theme.spec.ts'),
    'members': rows,
    'working_tree': subprocess.check_output(['git', 'status', '--short'], cwd=root, text=True),
}
(output / f'{sys.argv[1]}-integrity.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({key: value for key, value in result.items() if key not in ['members', 'working_tree']}, indent=2))
assert result['all_90_match'] and not result['extra_dist_members'] and result['application_inputs_match']
