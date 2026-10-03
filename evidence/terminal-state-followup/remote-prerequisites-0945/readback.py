from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent
ORIGIN = 'https://api.cortex.foundation'
SINCE = '2026-10-03T08:55:46Z'
LIMIT = 4 * 1024 * 1024
sha = lambda raw: hashlib.sha256(raw).hexdigest()
now = lambda: datetime.now(timezone.utc).isoformat()
def save(name, value): (ROOT/name).write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')
def normalize(raw): return '\n'.join(line.rstrip() for line in raw.decode('utf-8-sig').splitlines())+'\n'
def packed(name, raw):
    target = ROOT/(name+'.gz'); target.write_bytes(gzip.compress(raw, mtime=0))
    return {'path':target.name,'bytes':len(raw),'sha256':sha(raw),'gzipSHA256':sha(target.read_bytes())}
def parse_headers(raw):
    text = raw.decode('iso-8859-1').replace('\r\n','\n')
    blocks = [b for b in text.split('\n\n') if b.strip().startswith('HTTP/')]
    block = blocks[-1]
    lines = block.splitlines(); fields = {}
    for line in lines[1:]:
        if ':' in line:
            k,v = line.split(':',1); fields[k.lower()] = v.strip()
    return lines[0], fields

def public(name, route):
    header = ROOT/(name+'.headers.raw'); body = ROOT/(name+'.body.raw')
    assert not header.exists() and not body.exists(), 'One-shot receipt already exists'
    command = ['curl','--disable','--silent','--show-error','--request','GET','--proto','=https',
        '--connect-timeout','5','--max-time','10','--max-filesize',str(LIMIT),'--max-redirs','0',
        '--header','Accept: application/json','--header','Accept-Encoding: identity',
        '--dump-header',str(header),'--output',str(body),'--write-out','%{json}',ORIGIN+route]
    start = now(); result = subprocess.run(command,capture_output=True,timeout=12); finish=now()
    raw_headers=header.read_bytes() if header.exists() else b'';raw_body=body.read_bytes() if body.exists() else b''
    assert len(raw_body)<=LIMIT
    status,fields=parse_headers(raw_headers) if raw_headers else ('',{})
    data = None
    try: data=json.loads(raw_body)
    except (ValueError,UnicodeError): pass
    # These public metadata responses must never be presented as authentication/session proof.
    def secret_fields(v):
        if isinstance(v,dict):return [k for k,val in v.items() if k.lower() in ['access_token','refresh_token','session_token','password','secret']] + [x for val in v.values() for x in secret_fields(val)]
        if isinstance(v,list):return [x for val in v for x in secret_fields(val)]
        return []
    unexpected=secret_fields(data)
    receipt={'url':ORIGIN+route,'route':route,'method':'GET','startedAt':start,'finishedAt':finish,
        'exitCode':result.returncode,'stderr':result.stderr.decode(),'status':status,'headers':fields,
        'redirectFollowed':False,'authenticationSent':False,'cookieSent':False,'maxBytes':LIMIT,'maxSeconds':10,
        'headersOriginal':packed(name+'.headers',raw_headers),'bodyOriginal':packed(name+'.body',raw_body),
        'httpOriginal':packed(name+'.http',raw_headers+raw_body),'transfer':json.loads(result.stdout) if result.stdout else {},'unexpectedSensitiveFieldNames':unexpected}
    (ROOT/(name+'.headers.txt')).write_text(normalize(raw_headers))
    if data is not None and not unexpected:save(name+'.json',data)
    save(name+'.receipt.json',receipt)
    return receipt

def comments(issue):
    prefix=f'g{2 if issue==446 else 3}-{issue}'
    endpoint=f'repos/CortexLM/backend/issues/{issue}/comments?since=2026-10-03T08%3A55%3A46Z&per_page=100'
    pages=[];all_comments=[];seen=set()
    while endpoint:
        assert endpoint not in seen;seen.add(endpoint);name=f'{prefix}-page-{len(pages)+1}'
        assert not (ROOT/(name+'.receipt.json')).exists(), 'One-shot receipt already exists'
        start=now();result=subprocess.run(['gh','api','--method','GET','--include',endpoint],capture_output=True,timeout=10);finish=now()
        raw=result.stdout;assert len(raw)<=LIMIT
        boundary=re.search(br'\r?\n\r?\n',raw)
        assert boundary,(result.returncode,result.stderr.decode())
        headers,body=raw[:boundary.start()],raw[boundary.end():]
        status,fields=parse_headers(headers);data=json.loads(body)
        assert result.returncode==0 and status.split()[1]=='200' and isinstance(data,list)
        (ROOT/(name+'.headers.txt')).write_text(normalize(headers));save(name+'.json',data)
        original=packed(name+'.http',raw)
        link=fields.get('link');next_link=next((m.group(1) for m in re.finditer(r'<([^>]+)>;\s*rel="next"',link or '')),None)
        receipt={'endpoint':endpoint,'method':'GET','startedAt':start,'finishedAt':finish,'status':status,'headers':fields,
            'commandExit':result.returncode,'stderr':result.stderr.decode(),'count':len(data),'next':next_link,'original':original,
            'bodySHA256':sha(body),'headersSHA256':sha(headers)}
        save(name+'.receipt.json',receipt);pages.append(receipt);all_comments.extend(data)
        if next_link:
            parsed=urlparse(next_link);query=parse_qs(parsed.query)
            assert parsed.scheme=='https' and parsed.netloc=='api.github.com' and parsed.path==f'/repos/CortexLM/backend/issues/{issue}/comments'
            assert query.get('since')==[SINCE] and query.get('per_page')==['100'] and query.get('page',[None])[0] is not None
            endpoint=parsed.path.lstrip('/')+'?'+parsed.query
        else:endpoint=None
    assert len(all_comments)==len({c['id'] for c in all_comments})
    save(prefix+'.comments.json',all_comments)
    readable=[]
    for c in all_comments:
        readable += [f"## {c['id']} — {c['user']['login']}",c['html_url'],f"Created {c['created_at']}; updated {c['updated_at']}",'',c['body'],'']
    (ROOT/(prefix+'.comments.md')).write_text('\n'.join(line.rstrip() for line in '\n'.join(readable).splitlines())+'\n')
    summary={'issue':issue,'since':SINCE,'pages':len(pages),'count':len(all_comments),'paginationComplete':True,
        'comments':[{'id':c['id'],'author':c['user']['login'],'createdAt':c['created_at'],'updatedAt':c['updated_at'],'url':c['html_url'],'bodySHA256':sha(c['body'].encode())} for c in all_comments],
        'receipts':[f'{prefix}-page-{i+1}.receipt.json' for i in range(len(pages))]}
    save(prefix+'.summary.json',summary);return summary

baseline=Path('/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite/evidence/sdk-035-admission/public-cloud-readback.json')
prior=json.loads(baseline.read_text());assert [r['route'] for r in prior['responses']]==['/v1/instance','/v1/models']
design=Path('/root/cortex-ui/DESIGN-REQUESTS.md');raw=design.read_bytes();lines=raw.decode().splitlines()
ranges=[(44,49),(61,64),(71,74),(84,len(lines))]
excerpt='\n'.join(f'{i+1}: {line}'.rstrip() for i,line in enumerate(lines) if any(a<=i+1<=b for a,b in ranges))+'\n'
(ROOT/'design-excerpt.md').write_text(excerpt)
save('source-receipts.json',{'observedAt':now(),'publicRouteSource':{'path':str(baseline),'sha256':sha(baseline.read_bytes()),'observedAt':prior['observedAt']},
    'design':{'path':str(design),'sha256':sha(raw),'bytes':len(raw),'lineCount':len(lines),'excerptRanges':ranges,'excerptSHA256':sha(excerpt.encode()),'original':packed('design-original.md',raw)}})
with ThreadPoolExecutor(max_workers=4) as pool:
    work=[pool.submit(public,'instance','/v1/instance'),pool.submit(public,'models','/v1/models'),pool.submit(comments,446),pool.submit(comments,447)]
    results=[f.result() for f in work]
save('readback.json',{'finishedAt':now(),'public':results[:2],'comments':results[2:],'httpGetCount':2+sum(r['pages'] for r in results[2:]),'authOrInferenceRequests':0,'ciQueries':0})
print(json.dumps({'public':[{'route':r['route'],'status':r['status'],'exitCode':r['exitCode'],'date':r['headers'].get('date'),'bytes':r['bodyOriginal']['bytes'],'bodySHA256':r['bodyOriginal']['sha256']} for r in results[:2]],'comments':results[2:],'designLines':len(lines)},indent=2))
