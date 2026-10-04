import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

out = Path('/tmp/opencode/desktop-sdk-031-readback')
release = Path('/root/cortex-goals/releases/sdk-0.3.1-ce05a6040ec0')
pin = 'ce05a6040ec05ac479d23dc2f701c8835a529663'
gates = json.loads((release / 'remote-gates.json').read_text())
ci = json.loads((release / 'ci.json').read_text())
codeql = json.loads((release / 'codeql.json').read_text())
assert ci['headSha'] == codeql['headSha'] == gates['source_sha'] == pin
assert ci['conclusion'] == codeql['conclusion'] == 'success'
passed = [job['name'] for job in ci['jobs'] if job['conclusion'] == 'success']
skipped = [job['name'] for job in ci['jobs'] if job['conclusion'] == 'skipped']
assert len(passed) == 11
assert skipped == ['Probe CodeQL CodeBuild x64']
assert all(job['conclusion'] == 'success' for job in codeql['jobs'])
assert hashlib.sha256((release / 'ci-sdk.log').read_bytes()).hexdigest() == gates['ci']['sdk_log_sha256']
pr = json.loads((out / 'pr447-after-0032.json').read_text())
assert pr['headRefOid'] == pin
summary = {
    'checked_at': datetime.now(timezone.utc).isoformat(),
    'result': 'PASS',
    'scope': 'Retained exact-head CI receipts and SDK log hash. No CI replay or additional GitHub request.',
    'ci_run': gates['ci']['run_id'], 'ci_passed': passed, 'ci_skipped': skipped,
    'codeql_run': gates['codeql']['run_id'], 'codeql_passed': [j['name'] for j in codeql['jobs']],
    'pr_snapshot_utc': datetime.fromtimestamp((out / 'pr447-once.json').stat().st_mtime, timezone.utc).isoformat(),
    'pr_state': pr['state'], 'pr_head': pr['headRefOid'],
    'comments_since_cutoff': len(pr['comments']['nodes']),
    'reviews_since_cutoff': len(pr['reviews']['nodes']),
    'coderabbit_review': next(r['url'] for r in pr['reviews']['nodes'] if r['author']['login'] == 'coderabbitai' and 'Actionable comments' in r['body']),
}
(out / 'remote-readback.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
