from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent
REPO = Path('/root/.local/share/opencode/worktree/b489da9add1907e124bad2dfd49e8423fbd978b1/goal-desktop-rewrite')
REV = '1076c2584941cf054efffaf709a149b4195bc1c4'
sha = lambda raw: hashlib.sha256(raw).hexdigest()
def run(args, env=None):
    result = subprocess.run(args, capture_output=True, text=True, env=env)
    return {'command':args,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr}
pins = []
for name in ['packages/app/src/kit/styles.css','packages/app/src/screens/system/system.css','tests/e2e/remote-auth.spec.ts','.github/workflows/ci.yml','packages/app/public/fonts/Geist-Variable.woff2','packages/app/public/fonts/GeistMono-Variable.woff2']:
    raw = subprocess.check_output(['git','show',REV+':'+name],cwd=REPO)
    target = ROOT/'source'/name
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(raw)
    pins.append({'path':name,'sha256':sha(raw),'bytes':len(raw)})
samples = []
for locale in ['en','ja','ko','zh-Hans']:
    name=f'packages/i18n/locales/{locale}/system.json'
    raw=subprocess.check_output(['git','show',REV+':'+name],cwd=REPO); catalog=json.loads(raw)
    samples.append({'locale':locale,'heading':catalog['login.checkTitle'],'error':catalog['auth.failed'],'cancel':json.loads(subprocess.check_output(['git','show',REV+f':packages/i18n/locales/{locale}/common.json'],cwd=REPO))['cancel']})
    pins.append({'path':name,'sha256':sha(raw),'bytes':len(raw)})
(ROOT/'samples.json').write_text(json.dumps(samples,indent=2,ensure_ascii=False)+'\n')
paths=sorted(set(subprocess.check_output(['fc-list','-f','%{file}\n']).decode().splitlines()))
inventory=[]
for name in paths:
    file=Path(name)
    inventory.append({'path':name,'realPath':str(file.resolve()),'bytes':file.stat().st_size,'sha256':sha(file.read_bytes())})
(ROOT/'system-font-files.json').write_text(json.dumps(inventory,indent=2)+'\n')
(ROOT/'system-font-patterns.txt').write_text(subprocess.check_output(['fc-list','-f','%{file}\t%{index}\t%{family}\t%{postscriptname}\t%{lang}\n']).decode())
environment={'observedAt':datetime.now(timezone.utc).isoformat(),'osRelease':Path('/etc/os-release').read_text(),'fontconfig':run(['fc-match','--version']),
    'packages':run(['dpkg-query','-W','-f=${Package}\t${Version}\t${Status}\n','fontconfig','fonts-wqy-zenhei','fonts-noto-cjk','fonts-dejavu-core']),
    'matches':{pattern:run(['fc-match','-f','%{family}\t%{style}\t%{file}\n',pattern]) for pattern in ['sans-serif',':lang=ja',':lang=ko',':lang=zh-cn']},
    'inheritedFontEnvironment':{k:os.environ[k] for k in ['FONTCONFIG_FILE','FONTCONFIG_PATH','LANG','LC_ALL'] if k in os.environ}}
(ROOT/'local-environment.json').write_text(json.dumps(environment,indent=2)+'\n')
coverage=[]
for filename in ['Geist-Variable.woff2','GeistMono-Variable.woff2']:
    font=TTFont(ROOT/'source/packages/app/public/fonts'/filename)
    cmap=font.getBestCmap()
    coverage.append({'font':filename,'weightAxes':[{'tag':a.axisTag,'min':a.minValue,'default':a.defaultValue,'max':a.maxValue} for a in font['fvar'].axes],
        'samples':[{'locale':s['locale'],'needed':''.join(sorted(set(s['heading']+s['error']+s['cancel']))),'missing':''.join(sorted({c for c in s['heading']+s['error']+s['cancel'] if ord(c) not in cmap}))} for s in samples]})
(ROOT/'bundled-font-coverage.json').write_text(json.dumps(coverage,indent=2,ensure_ascii=False)+'\n')
configs=[]
for mode, dirs in [('without-cjk',['/usr/share/fonts/truetype/dejavu']),('with-system',['/usr/share/fonts','/usr/local/share/fonts'])]:
    base=ROOT/mode
    for sub in ['cache','home','tmp','profile']:(base/sub).mkdir(parents=True,exist_ok=True)
    xml='<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">\n<fontconfig>\n'
    xml+=''.join(f'  <dir>{d}</dir>\n' for d in dirs)
    xml+=f'  <cachedir>{base}/cache</cachedir>\n'
    xml+='  <alias><family>sans-serif</family><prefer><family>DejaVu Sans</family></prefer></alias>\n'
    xml+='  <alias><family>system-ui</family><prefer><family>DejaVu Sans</family></prefer></alias>\n'
    xml+='  <alias><family>monospace</family><prefer><family>DejaVu Sans Mono</family></prefer></alias>\n'
    xml+='</fontconfig>\n'
    config=base/'fonts.conf'; config.write_text(xml)
    env={**os.environ,'FONTCONFIG_FILE':str(config),'FONTCONFIG_PATH':str(base),'XDG_CACHE_HOME':str(base/'cache'),'HOME':str(base/'home'),'TMPDIR':str(base/'tmp')}
    patterns=run(['fc-list','-f','%{file}\t%{index}\t%{family}\t%{postscriptname}\t%{charset}\n'],env)
    (base/'font-patterns.txt').write_text(patterns['stdout'])
    union=set()
    for line in patterns['stdout'].splitlines():
        for token in line.rsplit('\t',1)[-1].split():
            parts=token.split('-'); start=int(parts[0],16); end=int(parts[-1],16)
            union.update(range(start,end+1))
    checks=[]
    for s in samples:
        need={ord(c) for c in s['heading']+s['error']+s['cancel'] if not c.isspace()}
        missing=sorted(need-union)
        checks.append({'locale':s['locale'],'coverage':not missing,'missingCodepoints':[f'U+{c:04X}' for c in missing]})
    assert [row['coverage'] for row in checks]==([True,False,False,False] if mode=='without-cjk' else [True]*4)
    configs.append({'mode':mode,'config':str(config),'sha256':sha(xml.encode()),'fontDirectories':dirs,'cache':str(base/'cache'),'coverage':checks,'matches':{lang:run(['fc-match','-f','%{family}\t%{file}\n',':lang='+lang],env) for lang in ['ja','ko','zh-cn']}})
(ROOT/'configs.json').write_text(json.dumps(configs,indent=2)+'\n')
(ROOT/'source-pins.json').write_text(json.dumps({'revision':REV,'files':pins},indent=2)+'\n')
log=Path('/tmp/opencode/remote-ci-1076c25/logs/0_E2E (Playwright + Electron, Linux).txt')
text=log.read_text(); selected=[]
for i,line in enumerate(text.splitlines(),1):
    if any(term in line for term in ['OS Version:','node: v','apt-get','xfonts-base','xserver-common','xvfb is already','fontconfig','fonts-']):selected.append({'line':i,'text':line})
(ROOT/'ci-environment.json').write_text(json.dumps({'run':37105137365,'logSHA256':sha(log.read_bytes()),'lines':selected,'fontInventoryInArtifacts':False},indent=2)+'\n')
print(json.dumps({'systemFontFiles':len(inventory),'sampleCoverage':{r['mode']:r['coverage'] for r in configs},'systemCJKFamily':'WenQuanYi Zen Hei; fonts-noto-cjk not installed'},indent=2))
