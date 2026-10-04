import hashlib
import json
import os
from pathlib import Path
import subprocess
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parent
sha = lambda raw: hashlib.sha256(raw).hexdigest()
load = lambda name: json.loads((ROOT/name).read_text())
records = load('probe-results.json')
assert len(records)==2 and {r['mode'] for r in records}=={'without-cjk','with-system'}
assert records[0]['fontFaceSHA256']==records[1]['fontFaceSHA256']
assert records[0]['browser']['product']==records[1]['browser']['product']=='Chrome/153.0.8010.12'
for record in records:
    assert not record['requests'] and not record['errors']
    assert sha(Path(record['screenshot']['path']).read_bytes())==record['screenshot']['sha256']
    for row in record['measurements']:
        assert row['weight']=='500' and row['fontSize']=='26px'
        assert row['fontFaceSetCheck'] and row['geometryReadable']
        expected = row['locale']=='en' or record['mode']=='with-system'
        assert all(p['coveragePass']==expected for p in row['weightProbes'])
        if not expected:
            assert all(p['a']['png']==p['b']['png']==p['missing']['png'] for p in row['weightProbes'])
    for item in record['fonts']:
        assert sum(f['glyphCount'] for f in item['fonts'])>0
        if record['mode']=='without-cjk':
            assert all(f['isCustomFont'] and f['familyName']=='Geist' for f in item['fonts'])
        elif item['locale']!='en':
            assert any(not f['isCustomFont'] and f['glyphCount']>0 for f in item['fonts'])
coverage_runs=[]
for config in load('configs.json'):
    base=Path(config['config']).parent
    env={**os.environ,'FONTCONFIG_FILE':config['config'],'FONTCONFIG_PATH':str(base),'XDG_CACHE_HOME':str(base/'cache'),'HOME':str(base/'home'),'TMPDIR':str(base/'tmp')}
    result=subprocess.run(['python3',str(ROOT/'check-coverage.py')],capture_output=True,text=True,env=env)
    assert result.returncode==(1 if config['mode']=='without-cjk' else 0)
    assert not result.stderr
    coverage_runs.append({'mode':config['mode'],'exitCode':result.returncode,'result':json.loads(result.stdout)})
(ROOT/'coverage-check-results.json').write_text(json.dumps(coverage_runs,indent=2)+'\n')
# A derived sheet from the two existing captures, not another browser capture.
left=Image.open(records[0]['screenshot']['path']).convert('RGB')
right=Image.open(records[1]['screenshot']['path']).convert('RGB')
assert left.size==right.size==(960,640)
assert left.crop((64,76,430,220)).tobytes()==right.crop((64,76,430,220)).tobytes()
sheet=Image.new('RGB',(1920,640));sheet.paste(left,(0,0));sheet.paste(right,(960,0));sheet.save(ROOT/'comparison.webp',lossless=True,method=4)
assert Image.open(ROOT/'comparison.webp').convert('RGB').tobytes()==sheet.tobytes()
font_files=[]
for row in load('source-pins.json')['files']:
    path=ROOT/'source'/row['path']
    if path.exists(): assert sha(path.read_bytes())==row['sha256']
    if '/public/fonts/' in row['path']:
        frozen=Path('/tmp/opencode/build-remote-final/packages/app/dist/fonts')/Path(row['path']).name
        assert sha(frozen.read_bytes())==row['sha256']
        font_files.append({'name':path.name,'sha256':row['sha256'],'matchesFrozenBundle':True})
result={'ok':True,'captures':2,'networkRequests':0,'browser':records[0]['browser']['product'],'latinControlPixelIdentical':True,'latinControlBounds':[64,76,430,220],
    'controlledCJKFallbackAbsenceCausesMissingGlyphs':True,'weightsTested':[400,500],'fontFaceSetCheckDetectsFailure':False,'geometryDetectsFailure':False,'positiveCDPGlyphCountDetectsFailure':False,
    'rasterGateByEnvironment':{r['mode']:{m['locale']:all(p['coveragePass'] for p in m['weightProbes']) for m in r['measurements']} for r in records},
    'fontconfigGateExitCodes':{r['mode']:r['exitCode'] for r in coverage_runs},'fontFiles':font_files,
    'historicalCIInstalledFontInventory':'absent','exactCIWholeHeadingPixelReproduction':False,'historicalCIMissingPackageVersusConfiguration':'not directly distinguished',
    'artifactsUnchanged':True,'globalFontInstallOrCacheCommand':False,'workflowEdited':False,'applicationBuildOrElectronLaunch':False}
(ROOT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
