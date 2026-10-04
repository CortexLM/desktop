"""Offline, two-image review. No application or test execution."""
from collections import Counter
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageChops

ROOT=Path(__file__).resolve().parent
REPO=Path('/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite')
CI=REPO/'evidence/terminal-state-followup/ci-2956564'
HEAD='2956564fbe31f882014d74ff3a7f920e839fd634'
sha=lambda data:hashlib.sha256(data).hexdigest()
load=lambda path:json.loads(path.read_text())
rows=load(CI/'images.json');names=['remote-mfa-unavailable-light','remote-verification-unavailable-light']
images=[];receipts=[]
for name in names:
    row=next(r for r in rows if r['os']=='macos' and any(a['name']==name for a in r['aliases']))
    original=Path(row['originalPath']);canonical=(CI/row['canonical']).resolve()
    assert sha(original.read_bytes())==row['sha256'] and sha(canonical.read_bytes())==row['retainedSHA256']
    im=Image.open(original).convert('RGBA');kept=Image.open(canonical).convert('RGBA')
    assert im.size==kept.size==(960,640) and im.tobytes()==kept.tobytes() and sha(im.tobytes())==row['rgbaSHA256']
    link=ROOT/(name+'.png')
    if not link.exists():link.symlink_to(original)
    im.crop((450,380,842,449)).save(ROOT/(name+'-button.png'))
    images.append(im);receipts.append({'name':name,'original':str(original),'canonical':str(canonical),'pngSHA256':row['sha256'],'rgbaSHA256':row['rgbaSHA256'],'canonicalSHA256':row['retainedSHA256'],'size':list(im.size)})
delta=ImageChops.difference(*images);mask=ImageChops.lighter(ImageChops.lighter(delta.getchannel('R'),delta.getchannel('G')),ImageChops.lighter(delta.getchannel('B'),delta.getchannel('A')))
assert mask.getbbox()==(466,392,826,436) and 960*640-mask.histogram()[0]==15375
mask.crop((450,380,842,449)).save(ROOT/'button-difference.png')
sample=[im.getpixel((500,410)) for im in images]
assert sample==[(234,234,234,255),(255,255,255,255)]
dark=[im.crop((466,392,826,436)).convert('L').point(lambda v:255 if v<100 else 0) for im in images]
text_mask_delta=360*44-ImageChops.difference(*dark).histogram()[0]
assert text_mask_delta==8 and dark[0].getbbox()==dark[1].getbbox()==(118,17,242,26)
cores=[im.crop((466,392,826,436)).convert('L').point(lambda v:255 if v<18 else 0) for im in images]
assert cores[0].tobytes()==cores[1].tobytes() and 360*44-cores[0].histogram()[0]==76
source={
    'tests/e2e/remote-auth.spec.ts':[(9,15),(43,53),(98,106),(200,228)],
    'packages/app/src/screens/system/account.tsx':[(111,116),(204,212)],
    'packages/app/src/kit/styles.css':[(19,26),(58,58),(318,323),(350,350)],
    'packages/app/src/screens/system/system.css':[(185,193)],
    'packages/i18n/locales/en/system.json':[(18,18),(325,325),(335,335)],
    'packages/i18n/locales/en/common.json':[(1,1)],
    'packages/desktop/src/remote-session.ts':[(10,20),(88,103),(166,177)],
}
pins=[]
for path,ranges in source.items():
    raw=subprocess.check_output(['git','show',HEAD+':'+path],cwd=REPO);lines=raw.decode().splitlines()
    filename=path.replace('/','__');(ROOT/(filename+'.gz')).write_bytes(gzip.compress(raw,mtime=0))
    excerpt='\n'.join(f'{i+1}: {line}'.rstrip() for i,line in enumerate(lines) if any(a<=i+1<=b for a,b in ranges))+'\n'
    (ROOT/(filename+'.excerpt.txt')).write_text(excerpt)
    pins.append({'path':path,'sha256':sha(raw),'ranges':ranges,'retained':filename+'.gz','excerpt':filename+'.excerpt.txt'})
test=next(r for r in pins if r['path']=='tests/e2e/remote-auth.spec.ts')
assert test['sha256']=='653016add38f51d766dfec52c205790de4b941c02739a993315c282469b1b0cb'
account=gzip.decompress((ROOT/'packages__app__src__screens__system__account.tsx.gz').read_bytes()).decode()
assert 'auth && auth.status !== "signed_out" ? "unavailable"' in account
assert '<button className="btn secondary big" onClick={() => void submit({ action: "cancel" })}>{t("system.login.otherEmail")}</button>' in account
css=gzip.decompress((ROOT/'packages__app__src__kit__styles.css.gz').read_bytes()).decode()
assert '.btn.secondary:hover { background: var(--hover); }' in css and '--hover: #eaeaea;' in css and '--card: #ffffff;' in css
cases=load(CI/'cases.json');case=next(r for r in cases if r['os']=='macos' and r['title']==rows[next(i for i,r in enumerate(rows) if r['id']=='macos-099')]['aliases'][0]['title'])
assert case['status']=='passed' and case['attempts']==1 and case['retry']==0
prior=REPO/'evidence/live-state-followup/ci-760c4a0'
previous=[next(r for r in load(prior/'images.json') if r['os']=='macos' and any(a['name']==name for a in r['aliases']))['sha256'] for name in names]
assert previous==[receipts[1]['pngSHA256']]*2
result={'observedAt':datetime.now(timezone.utc).isoformat(),'head':HEAD,'images':receipts,'changedPixels':15375,'bounds':[466,392,826,436],
    'samplePoint':[500,410],'sampleRGBA':sample,'darkTextMaskThreshold':100,'darkTextMaskChangedPixels':text_mask_delta,'darkTextMaskBoundsBoth':[118,17,242,26],'textCoreThreshold':18,'textCoreMasksIdentical':True,'textCorePixels':76,'priorMacPNGHashes':previous,
    'sameVisibleText':['Not available yet','This sign-in step isn’t available in Cortex yet. Use another address or cancel.','Use another address','Cancel'],
    'presentation':'Exact background colors match pinned secondary-button hover versus normal rules; no different semantic copy or disabled branch.',
    'trigger':'Unknown: no pointer/:hover/computed-style record retained at these captures; no timing attribution.',
    'case':case,'source':pins,'inputs':[{'path':str(CI/n),'sha256':sha((CI/n).read_bytes())} for n in ['auth-alias-difference.json','images.json','cases.json']]}
(ROOT/'review.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
report=ROOT.parent/'auth-alias-2956564-review.md'
assert len(report.read_text().splitlines())<=35
for p in [report]+[p for p in ROOT.iterdir() if p.suffix in ['.json','.txt','.md','.py']]:
    assert all(line==line.rstrip() for line in p.read_text().splitlines()),p
verification={'ok':True,'fullSizeOriginalsReviewed':2,'sourceFilesPinned':len(pins),'reportLines':len(report.read_text().splitlines()),'reportSHA256':sha(report.read_bytes()),'changedPixels':15375,'textDifferent':False,'pointerTriggerProven':False,'repositoryWrites':False,'applicationOrTestExecution':False}
(ROOT/'verification.json').write_text(json.dumps(verification,indent=2)+'\n')
files=sorted(p for p in ROOT.iterdir() if p.is_file() and p.name!='SHA256SUMS')
(ROOT/'SHA256SUMS').write_text(''.join(f'{sha(p.read_bytes())}  {p.name}\n' for p in files)+f'{sha(report.read_bytes())}  ../auth-alias-2956564-review.md\n')
check=subprocess.run(['sha256sum','-c','SHA256SUMS'],cwd=ROOT,capture_output=True,text=True)
assert check.returncode==0 and check.stdout.count(': OK')==len(files)+1
print(json.dumps({'changedPixels':15375,'bounds':mask.getbbox(),'sampleRGBA':sample,'darkTextMaskChangedPixels':text_mask_delta,'textCoreMasksIdentical':True,'testSHA256':test['sha256'],'matchingCasePassed':True},indent=2))
