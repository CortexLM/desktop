#!/usr/bin/env python3
"""Offline evidence verifier; --local also reads original artifacts, frozen/current/Git inputs and ASAR. No app launch."""
from pathlib import Path
from PIL import Image
import argparse, base64, collections, gzip, hashlib, json, os, re, struct, subprocess, zipfile

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];FREEZE=Path('/tmp/opencode/build-files-corrected');RAW=Path('/tmp/opencode/files-live')
BASE='d390cce590600cf5896fa19acf0ddd44d7057e2c';REVISION='d20a012fbb774aa9b348fe1913f85d3476430098';PRIOR='9ba8e59fbec8c1f38f93ace25414d4a3489aede3'
FP='087587293bfb7c2ccf85176cece73982ae75db48318e1c381270caa5196a0d73';ASAR='9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893';TEST='a7bd52dbc4577825bbaf2b50fff0de17801faa521ca98c6369c37b53e0f1e498'
RENDER=['bun.lock','package.json','tsconfig.json','packages/app/src','packages/app/public','packages/app/index.html','packages/app/package.json','packages/app/vite.config.ts','packages/i18n/src','packages/i18n/locales','packages/client/src','packages/schema/src']
PACKAGE=RENDER+['electron-builder.yml','skills/summarize/SKILL.md','packages/core/README.md','packages/desktop/build.mjs']+[f'packages/{p}/src' for p in ['core','desktop','protocol','server']]+[f'packages/{p}/package.json' for p in ['client','core','desktop','i18n','protocol','schema','server']]
def digest(b):return hashlib.sha256(b).hexdigest()
def sha(p):return digest(Path(p).read_bytes())
def load(p):return json.loads(Path(p).read_text())
def paths(base,roots):return sorted(str(f.relative_to(base)) for r in roots for f in ((base/r).rglob('*') if (base/r).is_dir() else [base/r]) if f.is_file())
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'))
def specs(ss):
    for s in ss:yield from s.get('specs',[]);yield from specs(s.get('suites',[]))
def attempts(d):return [(s,r) for s in specs(d['suites']) for t in s['tests'] for r in t['results']]
def main(local):
    sealed=[]
    for line in (HERE/'SHA256SUMS').read_text().splitlines():
        h,p=line.split('  ',1);assert sha(HERE/p)==h,p;sealed.append(p)
    assert sorted(p for p in paths(HERE,['.']) if p!='SHA256SUMS')==sorted(p for p in sealed if not p.startswith('../'))
    reports={};records=load(HERE/'reports.json');cases=[json.loads(s) for s in (HERE/'cases.jsonl').read_text().splitlines()]
    for run,rec in records.items():
        raw=gzip.decompress((HERE/rec['retained']).read_bytes());assert digest(raw)==rec['sha256'];d=json.loads(raw);reports[run]=d
        assert d['stats']==rec['stats'] and len(attempts(d))==rec['attempts'];assert not d['errors']
        cs=[c for c in cases if c['run']==run];assert len(cs)==rec['cases']
        for c,(s,r) in zip(cs,attempts(d)):
            assert (c['id'],c['file'],c['line'],c['title'])==(s['id'],s['file'],s['line'],s['title'])
            assert len(c['results'])==1 and c['results'][0]['errors']==r.get('errors',[]) and r['retry']==0
            assert c['results'][0]['status']==r['status']
    for run,count in [('full',143),('corrected-targeted',11)]:
        d=reports[run];assert d['stats']['expected']==count and all(d['stats'][k]==0 for k in ['unexpected','skipped','flaky'])
        assert len(attempts(d))==count and all(r['status']=='passed' and not r.get('errors') and not r['stderr'] for _,r in attempts(d))
        assert all(t['status']=='expected' and t['expectedStatus']=='passed' for s in specs(d['suites']) for t in s['tests'])
    assert abs(reports['full']['stats']['duration']-303294.426)<1e-6 and reports['corrected-targeted']['stats']['duration']==17183.195
    stdout=''.join(o.get('text','') for s,r in attempts(reports['full']) if s['file']=='screens.spec.ts' for o in r['stdout']);assert 'rendered 426 screen states'in stdout
    assert [(s['id'],s['line'],s['title']) for s in specs(reports['full']['suites']) if s['file']=='files-live.spec.ts']==[(s['id'],s['line'],s['title']) for s in specs(reports['corrected-targeted']['suites'])]
    for run,passed,failed,lines in [('baseline',0,8,[155,155,203,218,99,133,258,287]),('initial-targeted',6,2,[210,275]),('rename-before',0,1,[307]),('viewer-before',0,2,[325,362])]:
        d=reports[run];assert d['stats']['expected']==passed and d['stats']['unexpected']==failed
        assert [e['location']['line'] for _,r in attempts(d) for e in r.get('errors',[])]==lines
    for row in load(HERE/'error-observations.json'):
        if row['intentional']:
            assert row['fields']['errors']==['Native route callback failed','Native route callback failed','Native theme callback failed']
            assert len(row['fields']['unhandled'])==3
        else:assert not any(row['fields'].values()),row
    pins=load(HERE/'source-pins.json')
    for p in pins:assert digest(gzip.decompress((HERE/p['retained']).read_bytes()))==p['sha256']
    original,rename,viewer,final=[gzip.decompress((HERE/'source'/name).read_bytes()) for name in ['files-original8.ts.gz','files-rename9.ts.gz','files-viewer11.ts.gz','files-final11.ts.gz']]
    assert digest(final)==TEST and rename.startswith(original) and viewer.startswith(rename)
    assert final.splitlines(keepends=True)[290:]==viewer.splitlines(keepends=True)[290:]
    tracepins=load(HERE/'trace-source-binding.json')['traces'];assert len(tracepins)==13
    for row in tracepins:
        p=HERE/row['retained'];assert sha(p)==row['sha256']
        with zipfile.ZipFile(p) as z:
            for s in row['embeddedSources']:assert digest(z.read(s['member']))==s['sha256']
        assert any(s['sha256']==digest({'baseline':original,'initial-targeted':original,'rename-before':rename,'viewer-before':viewer}[row['run']]) for s in row['embeddedSources'])
    images=[json.loads(s) for s in (HERE/'images.jsonl').read_text().splitlines()];assert len(images)==216
    assert len({r['sha256'] for r in images})==len({r['rgbaSHA256'] for r in images})==216
    assert sum(r['retention']=='new lossless WebP' for r in images)==73
    for r in images:
        p=(HERE/r['canonical']).resolve();assert sha(p)==r['retainedSHA256']
        with Image.open(p) as im:assert list(im.size)==r['size'] and digest(im.convert('RGBA').tobytes())==r['rgbaSHA256']
    byrun={}
    for run,n in [('full',195),('corrected-targeted',14),('initial-targeted',14),('baseline',8),('rename-before',1),('viewer-before',2)]:
        hs=[a['sha256'] for c in cases if c['run']==run for r in c['results'] for a in r['attachments'] if a['contentType']=='image/png'];assert len(set(hs))==n;byrun[run]=set(hs)
        assert collections.Counter(hs)==collections.Counter(r['sha256'] for r in images for a in r['aliases'] if a['run']==run)
    assert byrun['corrected-targeted']<=byrun['full'] and len(set.union(*byrun.values())-byrun['full'])==21
    contacts=load(HERE/'contacts.json');assert len(contacts)==18 and all(c['viewed'] for c in contacts)
    assert collections.Counter(i for c in contacts for i in c['imageIDs'])==collections.Counter(r['id'] for r in images)
    targets=load(HERE/'fullsize-targets.json');assert len(targets)==27 and sum(t['run']=='full' for t in targets)==14 and all(t['viewed'] for t in targets)
    for r in load(HERE/'retention.json'):
        p=HERE/r['retained'];assert sha(p)==r['retainedSHA256'];b=p.read_bytes();assert digest(gzip.decompress(b) if r.get('gzip',True) else b)==r['rawSHA256']
    for o in load(HERE/'json-observations.json'):
        attached=[a for s,r in attempts(reports[o['run']]) if s['file']==o['file'] for a in r.get('attachments',[]) if a['contentType']=='application/json' and a['name']==o['name']]
        assert any(digest(base64.b64decode(a['body']))==o['sha256'] and json.loads(base64.b64decode(a['body']))==o['value'] for a in attached)
    probe=load(HERE/'../corrupt-fixture-probe.json');assert len(probe['fixtures'])==6 and not probe['observedRendererHttpRequests']
    fixture=next(r for r in probe['fixtures'] if r['name']=='webp-header-only');assert fixture['preflight']=={'ok':True,'dimensions':[240,120],'bytesIdentical':True}
    assert fixture['native']['decoded'] is False and fixture['native']['dimensions']==[0,0] and fixture['native']['error']['name']=='EncodingError'
    assert fixture['sha256']==digest(base64.b64decode('UklGRhYAAABXRUJQVlA4IAoAAAAQCgCdASrwAHgA'))
    assert sum(r['native']['decoded'] for r in probe['fixtures'])==5
    png=load(HERE/'../png-decode-probe.json');assert len(png)==4 and all(r['decoded'] for r in png)
    log=lambda n:re.sub(r'\x1b\[[0-9;]*m','',gzip.decompress((HERE/'../checks'/f'{n}.log.gz').read_bytes()).decode())
    assert re.search(r'Tests\s+278 passed\s+\|\s+1 skipped',log('units')) and '18 passed'in log('raster-corrected')
    assert '69 files, 2288 keys used, 3438 keys in en, 0 problem(s)'in log('i18n') and 'SMOKE OK'in log('smoke')
    if local:
        for name,key,roots,count in [('pinned-inputs','inputs',PACKAGE,520),('renderer-inputs','files',RENDER,478),('members','members',['packages/app/dist','packages/desktop/dist'],90)]:
            doc=load(HERE/'../production'/f'{name}.json');rebound=load(FREEZE/f'{name}.json');rows=doc[key];expected=sorted(r['path'] for r in rows)
            assert doc['revision']==BASE and doc['dirty'] is True and rebound[key]==rows and rebound['revision']==REVISION and rebound['dirty'] is False
            assert len(expected)==len(set(expected))==count
            for root in [ROOT,FREEZE if name=='members' else FREEZE/'source']:
                assert paths(root,roots)==expected and all(sha(root/r['path'])==r['sha256'] for r in rows)
            if name=='pinned-inputs':
                assert paths(FREEZE/'source',['.'])==expected and sorted(git('ls-tree','-r','--name-only',REVISION,'--',*PACKAGE).decode().splitlines())==expected
                assert all(digest(git('show',REVISION+':'+r['path']))==r['sha256'] for r in rows)
                assert sorted(git('diff','--name-only',PRIOR,REVISION,'--',*PACKAGE).decode().splitlines())==sorted(r['path'] for r in load(HERE/'source-change.json')['changedInputs'])
            if name=='renderer-inputs':assert digest('\n'.join(f"{r['path']}:{r['sha256']}" for r in sorted(rows,key=lambda r:r['path'])).encode())==FP
        assert git('show',REVISION+':tests/e2e/files-live.spec.ts')==final==(ROOT/'tests/e2e/files-live.spec.ts').read_bytes()==(FREEZE/'files-live.spec.ts').read_bytes()
        for rec in load(HERE/'historical-binding.json')['initialManifests']:
            name=Path(rec['manifest']).stem;key={'pinned-inputs':'inputs','renderer-inputs':'files','members':'members'}[name];rows=load(HERE/rec['manifest'])[key];root=Path('/tmp/opencode/build-files-initial');roots=['packages/app/dist','packages/desktop/dist'] if name=='members' else PACKAGE if name=='pinned-inputs' else RENDER
            if name!='members':root=root/'source'
            assert paths(root,roots)==sorted(r['path'] for r in rows) and all(sha(root/r['path'])==r['sha256'] for r in rows)
        for r in load(HERE/'source-change.json')['desktopMembersUnchanged']:assert sha(Path('/tmp/opencode/build-work-activity')/r['path'])==r['sha256']
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
        for run in reports:
            root=RAW/(run+'-artifacts');copies={c['path']:r['sha256'] for r in images for c in r['copies'] if c['run']==run}
            assert sorted(copies)==sorted(str(p.relative_to(root)) for p in root.rglob('*.png'));assert all(sha(root/p)==h for p,h in copies.items())
        for r in load(HERE/'retention.json'):assert sha(r['raw'])==r['rawSHA256']
        for r in load(HERE/'attachment-index.json'):
            if 'originalPath'in r:assert sha(r['originalPath'])==r['sha256']
    print('PASS:143+11 cases/testa7bd;426 visits;195 candidate+21 historical RGBA frames;27 full-size reviews;13 failure traces'+(';520/478 paths,Gitd20 and90 ASAR members verified' if local else ''))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--local',action='store_true');main(parser.parse_args().local)
