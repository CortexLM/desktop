import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parent
sha=lambda raw:hashlib.sha256(raw).hexdigest()
load=lambda name:json.loads((ROOT/name).read_text())
readback=load('readback.json')
assert readback['httpGetCount']==4 and readback['authOrInferenceRequests']==readback['ciQueries']==0
for name,status in [('instance',404),('models',200)]:
    r=load(name+'.receipt.json')
    assert r['method']=='GET' and r['url']=='https://api.cortex.foundation/v1/'+name
    assert int(r['status'].split()[1])==status and r['exitCode']==0 and not r['stderr']
    assert not r['redirectFollowed'] and not r['authenticationSent'] and not r['cookieSent'] and not r['unexpectedSensitiveFieldNames']
    assert r['maxSeconds']==10 and r['maxBytes']==4194304 and r['transfer']['num_redirects']==0 and r['transfer']['time_total']<10
    for key in ['headersOriginal','bodyOriginal','httpOriginal']:
        receipt=r[key];packed=(ROOT/receipt['path']).read_bytes();raw=gzip.decompress(packed)
        assert sha(packed)==receipt['gzipSHA256'] and sha(raw)==receipt['sha256'] and len(raw)==receipt['bytes']
    body=(ROOT/(name+'.body.raw')).read_bytes();headers=(ROOT/(name+'.headers.raw')).read_bytes()
    assert gzip.decompress((ROOT/r['httpOriginal']['path']).read_bytes())==headers+body
    assert json.loads(body)==load(name+'.json')
    assert 'set-cookie' not in r['headers'] and 'location' not in r['headers']
for prefix in ['g2-446','g3-447']:
    summary=load(prefix+'.summary.json');r=load(prefix+'-page-1.receipt.json')
    assert summary['count']==0 and summary['pages']==1 and summary['paginationComplete']
    assert r['commandExit']==0 and r['status'].split()[1]=='200' and r['next'] is None and 'link' not in r['headers']
    raw=gzip.decompress((ROOT/r['original']['path']).read_bytes());assert sha(raw)==r['original']['sha256']
    separator=re.search(br'\r?\n\r?\n',raw);headers,body=raw[:separator.start()],raw[separator.end():]
    assert sha(headers)==r['headersSHA256'] and sha(body)==r['bodySHA256'] and json.loads(body)==[]
models=load('models.json');chat=[m for m in models['items'] if m.get('kind')=='chat']
assert len(models['items'])==3 and models['has_more'] is False and len(chat)==2
assert all(m.get('supports_vision') is False and m.get('supports_reasoning') is True for m in chat)
sources=load('source-receipts.json');prior=json.loads(Path(sources['publicRouteSource']['path']).read_text())
assert sha(Path(sources['publicRouteSource']['path']).read_bytes())==sources['publicRouteSource']['sha256']
assert load('models.receipt.json')['bodyOriginal']['sha256']==next(r['sha256'] for r in prior['responses'] if r['route']=='/v1/models')
design=gzip.decompress((ROOT/sources['design']['original']['path']).read_bytes())
assert sha(design)==sources['design']['sha256'] and len(design.splitlines())==sources['design']['lineCount']==93
assert sha((ROOT/'design-excerpt.md').read_bytes())==sources['design']['excerptSHA256']
report=ROOT.parent/'remote-prerequisites-0945.md';assert len(report.read_text().splitlines())<=40
for p in [report]+[p for p in ROOT.iterdir() if p.suffix in ['.json','.md','.txt','.py']]:
    assert all(line==line.rstrip() for line in p.read_text().splitlines()),p
result={'ok':True,'httpGETs':4,'publicRoutes':2,'commentFeeds':2,'paginationComplete':True,'modelsIdenticalTo0535':True,
    'chatModels':2,'chatVision':{'yes':0,'no':2,'unknown':0},'discovery':'404; version unknown','newOwnerComments':0,
    'namedG1DesignPermissionObserved':False,'rawGzipHashesVerified':True,'reportLines':len(report.read_text().splitlines()),'reportSHA256':sha(report.read_bytes())}
(ROOT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
files=sorted(p for p in ROOT.iterdir() if p.is_file() and p.name!='SHA256SUMS')
(ROOT/'SHA256SUMS').write_text(''.join(f'{sha(p.read_bytes())}  {p.name}\n' for p in files)+f'{sha(report.read_bytes())}  ../remote-prerequisites-0945.md\n')
check=subprocess.run(['sha256sum','-c','SHA256SUMS'],cwd=ROOT,capture_output=True,text=True)
assert check.returncode==0 and check.stdout.count(': OK')==len(files)+1
print(json.dumps(result,indent=2))
