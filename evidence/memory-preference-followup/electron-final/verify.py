#!/usr/bin/env python3
"""Offline evidence check. --local also verifies original PNGs, frozen/current/Git inputs and ASAR."""
from pathlib import Path
from PIL import Image
import argparse, base64, collections, gzip, hashlib, json, os, re, struct, subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
FREEZE = Path('/tmp/opencode/build-memory-final')
OLD = Path('/tmp/opencode/build-memory-preference')
REVISION = '96df66ce727c42ddf647b2dcb4eeeff04fda4927'
BASE = '74579d574646aff5dbd462247b4fd47a99dd2cdd'
RENDERER = '64a314be9950c61466f8beec1b1ef50aa7f5b60a7f67d67bc3deff805a5800ef'
ASAR = 'b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44'
RENDER_ROOTS = ['bun.lock','package.json','tsconfig.json','packages/app/src','packages/app/public','packages/app/index.html','packages/app/package.json','packages/app/vite.config.ts','packages/i18n/src','packages/i18n/locales','packages/client/src','packages/schema/src']
PACKAGE_ROOTS = RENDER_ROOTS + ['electron-builder.yml','skills/summarize/SKILL.md','packages/core/README.md','packages/desktop/build.mjs'] + [f'packages/{p}/src' for p in ['core','desktop','protocol','server']] + [f'packages/{p}/package.json' for p in ['client','core','desktop','i18n','protocol','schema','server']]

def digest(data): return hashlib.sha256(data).hexdigest()
def sha(p): return digest(Path(p).read_bytes())
def load(p): return json.loads(Path(p).read_text())
def paths(base, roots):
    return sorted(str(f.relative_to(base)) for r in roots for f in ((base/r).rglob('*') if (base/r).is_dir() else [base/r]) if f.is_file())
def specs(suites):
    for suite in suites:
        yield from suite.get('specs', [])
        yield from specs(suite.get('suites', []))
def attempts(report): return [(s,r) for s in specs(report['suites']) for t in s['tests'] for r in t['results']]
def json_attachments(report, name):
    return [json.loads(base64.b64decode(a['body'])) for _,r in attempts(report) for a in r.get('attachments',[]) if a['name']==name]
def source_pins():
    for pin in load(HERE/'source-pins.json'):
        assert digest(gzip.decompress((HERE/pin['retained']).read_bytes())) == pin['sha256'], pin['path']

def main(local):
    for line in (HERE/'SHA256SUMS').read_text().splitlines():
        h,p=line.split('  ',1); assert sha(HERE/p)==h,p
    report_index=load(HERE/'reports.json'); reports={}
    for run,record in report_index.items():
        raw=gzip.decompress((HERE/record['retained']).read_bytes());assert digest(raw)==record['sha256'];reports[run]=json.loads(raw)
        assert len(attempts(reports[run]))==record['attempts']
    for run,count in [('final-full',125),('boundary-targeted',21),('full',124),('targeted',14)]:
        report=reports[run]; rows=attempts(report)
        assert len(rows)==count and report['stats']['expected']==count and not report['errors']
        assert all(r['status']=='passed' and r['retry']==0 and not r.get('errors') for _,r in rows)
        assert all(report['stats'][k]==0 for k in ['skipped','unexpected','flaky'])
        assert all(t['status']=='expected' and t['expectedStatus']=='passed' and len(t['results'])==1 for s in specs(report['suites']) for t in s['tests'])
    render=''.join(o.get('text','') for s,r in attempts(reports['final-full']) if s['file']=='screens.spec.ts' for o in r['stdout'])
    assert re.search(r'rendered 426 screen states',render)
    assert reports['final-full']['stats']['duration']==293094.633
    assert len(attempts(reports['baseline']))==5 and sum(len(r['errors']) for _,r in attempts(reports['baseline']))==5
    assert len(attempts(reports['navigation-baseline']))==1 and len(attempts(reports['navigation-baseline'])[0][1]['errors'])==2
    old=json_attachments(reports['navigation-baseline'],'cancelled-preview-settings')[0]['evidence']
    assert old[0]['control']==[] and old[1]['control']==[{'checked':'true','disabled':True,'visible':True}]
    for run in ['final-full','boundary-targeted']:
        for phase in json_attachments(reports[run],'cancelled-preview-settings')[0]['evidence']:
            assert phase['control']==[{'checked':str(phase['actual']['memoryEnabled']).lower(),'disabled':False,'visible':True}]
        geometry=json_attachments(reports[run],'memory-locale-geometry')[0]
        assert len(geometry)==64 and len({(r['locale'],r['theme'],r['state']) for r in geometry})==64
        assert sum(len(r['rows']) for r in geometry)==112
        assert all(x['visibleInk'] and x['contentWidth']<=x['width']+1 for r in geometry for x in r['rows'])
        for context in json_attachments(reports[run],'memory-context'):
            a,b,c=context['notes']; enabled,paused,resumed,plain=context['system']
            assert a['content'] in enabled and b['content'] not in enabled
            assert all(n['content'] not in paused and n['content'] not in plain for n in [a,b,c])
            assert 'Violet persona remains.' in paused and '<memory>' not in paused
            assert b['content'] in resumed and c['content'] in resumed and a['content'] not in resumed
    for row in load(HERE/'error-observations.json'):
        if row['intentional']:
            assert row['fields']['errors']==['Native route callback failed','Native route callback failed','Native theme callback failed']
        else: assert not any(row['fields'].values()),row
    images=[json.loads(line) for line in (HERE/'images.jsonl').read_text().splitlines()]
    assert len(images)==173
    reported_hashes={}; observed_hashes={}
    for run in ['final-full','boundary-targeted']:
        reported_hashes[run]=[a['sha256'] for c in map(json.loads,(HERE/'cases.jsonl').read_text().splitlines()) if c['run']==run for r in c['results'] for a in r['attachments'] if a['contentType']=='image/png']
        observed_hashes[run]=[r['sha256'] for r in images for a in r['aliases'] if a['run']==run]
        assert collections.Counter(reported_hashes[run])==collections.Counter(observed_hashes[run])
    assert len(set(reported_hashes['final-full']))==169 and len(set(reported_hashes['boundary-targeted']))==26
    assert len(set(reported_hashes['final-full'])|set(reported_hashes['boundary-targeted']))==173
    for row in images:
        p=(HERE/row['canonical']).resolve();assert sha(p)==row['retainedSHA256']
        with Image.open(p) as image: assert list(image.size)==row['size'] and digest(image.convert('RGBA').tobytes())==row['rgbaSHA256']
    assert all(c['viewed'] for c in load(HERE/'contacts.json'))
    assert len(load(HERE/'fullsize-targets.json'))==12 and all(t['viewed'] for t in load(HERE/'fullsize-targets.json'))
    source_pins()
    if local:
        for name,key,roots,expected_count in [('pinned-inputs','inputs',PACKAGE_ROOTS,516),('renderer-inputs','files',RENDER_ROOTS,474),('members','members',['packages/app/dist','packages/desktop/dist'],90)]:
            original=load(HERE/'../final'/f'{name}.json'); frozen=load(FREEZE/f'{name}.json');rows=original[key]
            assert original['revision']==BASE and original['dirty'] is True
            assert frozen[key]==rows and len(rows)==expected_count
            expected=sorted(r['path'] for r in rows);assert len(expected)==len(set(expected))
            for base in [ROOT,FREEZE if name=='members' else FREEZE/'source']:
                assert paths(base,roots)==expected,(name,str(base),'path-set mismatch')
                assert all(sha(base/r['path'])==r['sha256'] for r in rows),str(base)
            if name=='pinned-inputs':
                assert paths(FREEZE/'source',['.'])==expected
                for r in rows:
                    blob=subprocess.check_output(['git','show',REVISION+':'+r['path']],cwd=ROOT,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'))
                    assert digest(blob)==r['sha256'],r['path']
            if name=='renderer-inputs':assert digest('\n'.join(f"{r['path']}:{r['sha256']}" for r in sorted(rows,key=lambda r:r['path'])).encode())==RENDERER
        old={r['path']:r['sha256'] for r in load(OLD/'pinned-inputs.json')['inputs']};new={r['path']:r['sha256'] for r in load(FREEZE/'pinned-inputs.json')['inputs']}
        assert set(old)==set(new) and [p for p in new if old[p]!=new[p]]==['packages/app/src/state/runtime-settings.ts']
        for r in load(OLD/'pinned-inputs.json')['inputs']: assert sha(OLD/'source'/r['path'])==r['sha256']
        test=(ROOT/'tests/e2e/runtime-settings.spec.ts').read_bytes();assert digest(test)=='a3749931aa28b459844b9c4ab24bb52d8762a079210a379de524416624acffe8'
        assert test==(HERE/'../navigation/runtime-settings.spec.ts').read_bytes() and test.startswith((HERE/'../baseline/runtime-settings.spec.ts').read_bytes())
        for pin in load(HERE/'source-pins.json'):
            assert sha(ROOT/pin['path'])==pin['sha256']
            blob=subprocess.check_output(['git','show',REVISION+':'+pin['path']],cwd=ROOT,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'))
            assert digest(blob)==pin['sha256'],pin['path']
        asar=ROOT/'dist/linux-unpacked/resources/app.asar';assert sha(asar)==ASAR
        with asar.open('rb') as f:
            head=struct.unpack('<4I',f.read(16));tree=json.loads(f.read(head[3]));offset=8+head[1]
            for r in load(FREEZE/'members.json')['members']:
                entry=tree
                for part in r['path'].split('/'):entry=entry['files'][part]
                f.seek(offset+int(entry['offset']));assert digest(f.read(entry['size']))==r['sha256'],r['path']
        for row in images:
            assert sha(row['originalPath'])==row['sha256']
            with Image.open(row['originalPath']) as source:assert digest(source.convert('RGBA').tobytes())==row['rgbaSHA256']
        for run in ['final-full','boundary-targeted']:
            for _,result in attempts(reports[run]):
                for attachment in result.get('attachments',[]):
                    if attachment['contentType']=='image/png':
                        raw=Path(attachment['path']).read_bytes() if 'path' in attachment else base64.b64decode(attachment['body'])
                        assert digest(raw) in reported_hashes[run]
        for record in load(HERE/'retention.json'): assert sha(record['raw'])==record['rawSHA256']
    print('PASS: 125/21 final cases; 426 visits; 173 exact canonical images; original failures retained'+('; 516/474 source paths, 90 ASAR members and Git96 verified' if local else ''))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--local',action='store_true');main(parser.parse_args().local)
