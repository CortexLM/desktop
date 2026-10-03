#!/usr/bin/env python3
"""Offline receipts/pixels check; --local also checks frozen/current/Git sources and ASAR. No app launch."""
from pathlib import Path
from PIL import Image
import argparse, base64, collections, gzip, hashlib, json, os, struct, subprocess

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];FREEZE=Path('/tmp/opencode/build-work-activity')
BASE='906987b94c04c3c4566ecb33394584ff0e93074e';REVISION='9ba8e59fbec8c1f38f93ace25414d4a3489aede3'
FP='a4a815bac24ce5f509f813d06371b8a754908b4b472c3d786f1325dbed53b8df';ASAR='22760335b8eef317c2c325cde1a7d4c09ecb888780226aaeb0e8ae4353a4bf26'
RENDER=['bun.lock','package.json','tsconfig.json','packages/app/src','packages/app/public','packages/app/index.html','packages/app/package.json','packages/app/vite.config.ts','packages/i18n/src','packages/i18n/locales','packages/client/src','packages/schema/src']
PACKAGE=RENDER+['electron-builder.yml','skills/summarize/SKILL.md','packages/core/README.md','packages/desktop/build.mjs']+[f'packages/{p}/src' for p in ['core','desktop','protocol','server']]+[f'packages/{p}/package.json' for p in ['client','core','desktop','i18n','protocol','schema','server']]
def digest(b):return hashlib.sha256(b).hexdigest()
def sha(p):return digest(Path(p).read_bytes())
def load(p):return json.loads(Path(p).read_text())
def paths(base,roots):return sorted(str(f.relative_to(base)) for r in roots for f in ((base/r).rglob('*') if (base/r).is_dir() else [base/r]) if f.is_file())
def specs(ss):
    for s in ss:yield from s.get('specs',[]);yield from specs(s.get('suites',[]))
def attempts(d):return [(s,r) for s in specs(d['suites']) for t in s['tests'] for r in t['results']]
def observations(d,name):return [json.loads(base64.b64decode(a['body'])) for _,r in attempts(d) for a in r.get('attachments',[]) if a['name']==name]
def blob(rev,path):return subprocess.check_output(['git','show',rev+':'+path],cwd=ROOT,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'))

def main(local):
    listed=[]
    for line in (HERE/'SHA256SUMS').read_text().splitlines():
        h,p=line.split('  ',1);assert sha(HERE/p)==h,p;listed.append(p)
    assert sorted(p for p in paths(HERE,['.']) if p!='SHA256SUMS')==sorted(p for p in listed if not p.startswith('../'))
    reports={}
    for run,record in load(HERE/'reports.json').items():
        raw=gzip.decompress((HERE/record['retained']).read_bytes());assert digest(raw)==record['sha256'];d=json.loads(raw);reports[run]=d
        assert len(attempts(d))==record['attempts']
    for run,count in [('full',132),('final-targeted',6),('lifecycle-corrected',2),('race-strengthened',1)]:
        d=reports[run];assert len(attempts(d))==count and d['stats']['expected']==count and not d['errors']
        assert all(d['stats'][k]==0 for k in ['skipped','unexpected','flaky'])
        assert all(t['status']=='expected' and t['expectedStatus']=='passed' and len(t['results'])==1 for s in specs(d['suites']) for t in s['tests'])
        assert all(r['status']=='passed' and r['retry']==0 and not r.get('errors') for _,r in attempts(d))
    assert reports['full']['stats']['duration']==294848.924 and reports['final-targeted']['stats']['duration']==7286.332
    stdout=''.join(x.get('text','') for s,r in attempts(reports['full']) if s['file']=='screens.spec.ts' for x in r['stdout'])
    assert 'rendered 426 screen states'in stdout
    for run,failed in [('baseline',6),('locale-baseline',1),('targeted',2)]:assert sum(r['status']=='failed' for _,r in attempts(reports[run]))==failed
    assert reports['targeted']['stats']['expected']==5
    assert [e['location']['line'] for _,r in attempts(reports['baseline']) for e in r['errors']]==[93,93,131,147,168,182]
    assert all(e['location']['line']==109 for _,r in attempts(reports['targeted']) for e in r.get('errors',[]))
    assert observations(reports['locale-baseline'],'activity-locale-geometry')==[[]]
    for run in ['full','targeted']:
        geometry=observations(reports[run],'activity-locale-geometry')[0];assert len(geometry)==112
        assert len({(r['locale'],r['theme'],r['state']) for r in geometry})==112
        assert sum(len(r['fragments']) for r in geometry)==304
        for r in geometry:
            assert r['visibleInk'] and r['contentWidth']<=r['width']+1 and r['fragments']
            for f in r['fragments']:
                assert f['visible'] and f['ink'];left,top,right,bottom=f['clip']
                assert all(x>=left-.5 and y>=top-.5 and xx<=right+.5 and yy<=bottom+.5 for x,y,xx,yy in f['ink'])
    for run in ['full','final-targeted']:
        calls=observations(reports[run],'activity-refusals')[0]
        assert collections.Counter((c['method'],c.get('status')) for c in calls)=={('GET',200):36,('GET',404):6,('PATCH',200):1}
    for row in load(HERE/'error-observations.json'):
        if row['intentional']:assert row['fields']['errors']==['Native route callback failed','Native route callback failed','Native theme callback failed']
        else:assert not any(row['fields'].values()),row
    pins=load(HERE/'source-pins.json')
    for p in pins:assert digest(gzip.decompress((HERE/p['retained']).read_bytes()))==p['sha256']
    original=gzip.decompress((HERE/'source/behavior-original.ts.gz').read_bytes());full=gzip.decompress((HERE/'source/behavior-full132.ts.gz').read_bytes());final=gzip.decompress((HERE/'source/behavior-final6.ts.gz').read_bytes())
    assert digest(full)=='5740841a75bda4c688f5407122b870bda049698c1b5e80c6746ce55b82ba4af0'
    assert digest(final)=='d98c9205c5dbddfe349a06a4271b4a2a1c135248cf84817705b6d81e11916744'
    assert full.count(b', { useInnerText: true }')==3 and full.replace(b', { useInnerText: true }',b'')==original
    assert b'g.hold === path + url.search'in final and b'heldURL).toBe("/api/sessions?kind=bot")'in final
    assert b'document.querySelector("main .content-top")'in final and b'document.querySelector("main.content")'in full
    images=[json.loads(line) for line in (HERE/'images.jsonl').read_text().splitlines()];assert len(images)==185
    assert len({r['sha256'] for r in images})==len({r['rgbaSHA256'] for r in images})==185
    assert sum(r['retention']=='new lossless WebP' for r in images)==45
    for r in images:
        p=(HERE/r['canonical']).resolve();assert sha(p)==r['retainedSHA256']
        with Image.open(p) as im:assert list(im.size)==r['size'] and digest(im.convert('RGBA').tobytes())==r['rgbaSHA256']
    cases=[json.loads(s) for s in (HERE/'cases.jsonl').read_text().splitlines()]
    for run,n in [('full',181),('final-targeted',4)]:
        expected={(c['id'],a['name'],a['contentType']):a for c in cases if c['run']==run for r in c['results'] for a in r['attachments']}
        observed=set()
        for spec,result in attempts(reports[run]):
            for a in result.get('attachments',[]):
                key=(spec['id'],a['name'],a['contentType']);observed.add(key)
                if 'body' in a:assert digest(base64.b64decode(a['body']))==expected[key]['sha256']
                elif local:assert sha(a['path'])==expected[key]['sha256']
        assert observed==set(expected)
        hashes=[a['sha256'] for c in cases if c['run']==run for r in c['results'] for a in r['attachments'] if a['contentType']=='image/png']
        assert len(set(hashes))==n
        assert collections.Counter(hashes)==collections.Counter(r['sha256'] for r in images for a in r['aliases'] if a['run']==run)
    assert len(load(HERE/'contacts.json'))==16 and all(c['viewed'] for c in load(HERE/'contacts.json'))
    assert collections.Counter(i for c in load(HERE/'contacts.json') for i in c['imageIDs'])==collections.Counter(r['id'] for r in images)
    assert len(load(HERE/'fullsize-targets.json'))==16 and all(t['viewed'] for t in load(HERE/'fullsize-targets.json'))
    for rec in load(HERE/'retention.json'):
        z=HERE/rec['retained'];assert sha(z)==rec['retainedSHA256'] and digest(gzip.decompress(z.read_bytes()))==rec['rawSHA256']
    if local:
        for name,key,roots,count in [('pinned-inputs','inputs',PACKAGE,517),('renderer-inputs','files',RENDER,475),('members','members',['packages/app/dist','packages/desktop/dist'],90)]:
            doc=load(HERE/'../production'/f'{name}.json');rows=doc[key];assert doc['revision']==BASE and doc['dirty'] is True
            rebound=load(FREEZE/f'{name}.json');assert rebound[key]==rows and len(rows)==count
            assert rebound['revision']==REVISION and rebound['dirty'] is False
            expected=sorted(r['path'] for r in rows);assert len(expected)==len(set(expected))
            for base in [ROOT,FREEZE if name=='members' else FREEZE/'source']:
                assert paths(base,roots)==expected,(name,str(base));assert all(sha(base/r['path'])==r['sha256'] for r in rows)
            if name=='pinned-inputs':
                assert paths(FREEZE/'source',['.'])==expected
                assert all(digest(blob(REVISION,r['path']))==r['sha256'] for r in rows)
                tracked=subprocess.check_output(['git','ls-tree','-r','--name-only',REVISION,'--',*PACKAGE],cwd=ROOT).decode().splitlines();assert sorted(tracked)==expected
                changed=subprocess.check_output(['git','diff','--name-only','96df66ce727c42ddf647b2dcb4eeeff04fda4927',REVISION,'--',*PACKAGE],cwd=ROOT).decode().splitlines()
                assert sorted(changed)==sorted(r['path'] for r in load(HERE/'source-change.json')['changedInputs'])
            if name=='renderer-inputs':assert digest('\n'.join(f"{r['path']}:{r['sha256']}" for r in sorted(rows,key=lambda r:r['path'])).encode())==FP
        assert blob(REVISION,'tests/e2e/work-activity.spec.ts')==final==(ROOT/'tests/e2e/work-activity.spec.ts').read_bytes()
        assert digest(blob(REVISION,'tests/e2e/work-activity-localization.spec.ts'))=='bfda7f43480e7f20e8101480950c28c5ea149b0f6f3bedf231d56c3ed7a5e087'
        for r in load(HERE/'source-change.json')['desktopMembersUnchanged']:assert sha(Path('/tmp/opencode/build-memory-final')/r['path'])==r['sha256']
        asar=ROOT/'dist/linux-unpacked/resources/app.asar';assert sha(asar)==ASAR
        with asar.open('rb') as f:
            h=struct.unpack('<4I',f.read(16));tree=json.loads(f.read(h[3]));offset=8+h[1]
            for r in load(FREEZE/'members.json')['members']:
                node=tree
                for segment in r['path'].split('/'):node=node['files'][segment]
                f.seek(offset+int(node['offset']));assert digest(f.read(node['size']))==r['sha256']
        for r in images:
            assert sha(r['originalPath'])==r['sha256']
            with Image.open(r['originalPath']) as im:assert digest(im.convert('RGBA').tobytes())==r['rgbaSHA256']
        for run in ['full','final-targeted']:
            raw=Path('/tmp/opencode/work-activity')/(run+'-artifacts')
            copies={c['path']:r['sha256'] for r in images for c in r['copies'] if c['run']==run}
            assert sorted(copies)==sorted(str(p.relative_to(raw)) for p in raw.rglob('*.png'))
            assert all(sha(raw/p)==h for p,h in copies.items())
        for r in load(HERE/'retention.json'):assert sha(r['raw'])==r['rawSHA256']
    print('PASS: full132/test574; supplemental6/testd98; 426 visits; 112 geometries; 185 RGBA images; negatives retained'+('; 517/475 paths, Git9ba and90 ASAR members verified' if local else ''))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--local',action='store_true');main(parser.parse_args().local)
