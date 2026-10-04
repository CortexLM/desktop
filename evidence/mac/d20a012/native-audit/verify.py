"""Offline native-composite receipt/byte verification. No collector imports, app, device or network."""
from pathlib import Path
from collections import Counter
import base64, datetime, hashlib, json, re, struct, zlib
from PIL import Image

ROOT=Path(__file__).resolve().parent
E=ROOT.parent
REV='d20a012fbb774aa9b348fe1913f85d3476430098'
ASAR='9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893'
DRIVER='e97be3e31f4e60975ce0d78009b284f7834084f31915079136abdb0fc1c15334'
LAUNCHER='7d4fdba05afe52d09a79e7775f2f1e0c234ab12ec28cda42e45be0474eae339b'
BACKEND='5c8239ef27f8d962b4a1cd5fcfb08e34c8ba4f3871f5242fe1043f73ef90476d'
def sha(b): return hashlib.sha256(b).hexdigest()
def load(n): return json.loads((E/n).read_bytes())
def stamp(s): return datetime.datetime.fromisoformat(s.replace('Z','+00:00'))
def pixels(p):
    with Image.open(p) as im:return im.convert('RGBA')
def fits(box,clip): return box[2]>box[0] and box[3]>box[1] and all([box[0]>=clip[0]-.5,box[1]>=clip[1]-.5,box[2]<=clip[2]+.5,box[3]<=clip[3]+.5])

def verify():
    m=load('native/manifest.json');old=load('initial-native/manifest.json');diag=load('filename-diagnostic/manifest.json');save=load('save-diagnostic/manifest.json')
    source=(E/'scripts/pixel-bound/files-native-final.mjs').read_bytes();prior=(E/'scripts/pixel-bound/files-native.mjs').read_bytes();binding=load('scripts/pixel-bound/final-binding.json')
    assert sha(source)==binding['finalSHA256']==DRIVER and sha(prior)==binding['priorSHA256']
    assert source==prior.replace(b"style.letterSpacing === '0px'",b"style.letterSpacing === 'normal'") and prior.count(b"style.letterSpacing === '0px'")==1
    assert m['helperHashes']=={'files-native.mjs':DRIVER,'launch-files-native.py':LAUNCHER,'files-native-backend.mjs':BACKEND}
    for n,h in [('launch-files-native.py',LAUNCHER),('files-native-backend.mjs',BACKEND)]:
        assert sha((E/'scripts/pixel-bound'/n).read_bytes())==m['rootHelperHashes'][n]==h
    assert sha((E/'scripts/corrected/files-native.mjs').read_bytes())==old['helperHashes']['files-native.mjs']=='9548b41317d5afd545dc086bf8b3ac463b3d477ade19a1075855202ffb05e009'
    assert sha((E/'filename-diagnostic/collector.mjs').read_bytes())==diag['helperHashes']['files-name-diagnostic.mjs']=='dc10c6bd12a89aa2b59bef403d8ead5a810c6388047042d77114f670d7dd1cdf'
    assert b'noDefaults: true' in source and b"cdp.send('SystemInfo.getProcessInfo')" in source
    assert b'setSavePath' not in source and b'.screenshot(' not in source
    launcher=(E/'scripts/pixel-bound/launch-files-native.py').read_text()
    assert "'/usr/sbin/screencapture', '-x', '-o', '-l'" in launcher and "'/usr/bin/open', '-na'" in launcher
    package=load('package-review.json');artifact=load('package/artifact.json');members=load('package/members.json');installed=load('installed.json');launch=load('native/launch.json')
    assert package['status']=='approved-for-installation' and package['workflowRunID']==artifact['workflow_run']['id']==37153526225
    assert package['artifactID']==artifact['id']==11284474514 and artifact['workflow_run']['head_sha']==REV
    assert package['archiveSHA256']['app.asar']==installed['installedASAR']==m['asar']==ASAR
    assert artifact['digest']=='sha256:'+package['archiveSHA256']['artifact.zip']
    assert package['inputs']['package']==520 and package['inputs']['renderer']==478 and len(members['members'])==90
    assert sha((E/'package/members.json').read_bytes())==m['membersSHA256']==load('native/binding.json')['membersSHA256']
    assert m['revision']==members['revision']==REV and m['installedBefore']==m['installedAfter']
    owner=m['installedBefore'];assert owner['pid']==78150 and owner['membersVerified']==90 and owner['asarSHA256']==ASAR
    assert owner['revision']==REV and owner['processCount']==1 and owner['isolated'] and owner['inspectorSHA256']==LAUNCHER
    assert launch=={'backendPID':78145,'capturePID':78147,'runID':m['backend']['runID'],'expectedAsar':ASAR,'revision':REV,'guiLaunch':True}
    assert m['status']=='failed' and m['stage']==m['failure']['stage']=='dark:original-download'
    assert m['flowDurationMs']==74407 and m['durationMs']==79048 and not m['errors'] and not m.get('cleanupIncomplete')
    assert (stamp(m['finishedAt'])-stamp(m['startedAt'])).total_seconds()*1000==m['durationMs']
    assert m['capturesRequested']==len(m['captures'])==4 and len(m['nativeChecks'])==8
    image_rows=load('native/images.json');assert len(image_rows)==4
    geometry=ink_exceptions=0;image_checks=[]
    for i,(c,e) in enumerate(zip(m['captures'],image_rows)):
        assert c['status']==e['collectorStatus']=='passed' and c['native'] and c['httpStatus']==200
        assert c['pid']==78150 and c['id']==9114 and c['active'] and c['pixels']==e['pixels']==[960,640]
        assert c['bounds']=={'X':0,'Y':30,'Width':960,'Height':640} and c['osDark']==(c['theme']=='dark')
        assert c['file']==e['originalName'] and c['sha256']==e['originalSHA256'] and c['bytes']==e['originalBytes']
        p=E/'native'/e['retainedFile'];im=pixels(p)
        assert p.stat().st_size==e['retainedBytes'] and sha(p.read_bytes())==e['retainedSHA256'] and list(im.size)==e['pixels']
        assert sha(im.tobytes())==e['rgbaSHA256']
        assert c['boxes']==c['afterBoxes'] and len(c['boxes'])==5 and c['focus']['visible'] and 'solid 2px' in c['focus']['outline']
        for boxes in [c['boxes'],c['afterBoxes']]:
            for j,g in enumerate(boxes):
                assert g['visible'] and g['hit'] and fits(g['bounds'],g['clip']);geometry+=1
                for ink in g['ink']:
                    if ink['visible']:assert fits(ink['bounds'],ink['clip']) and not ink['measuredFilenameLeading']
                    else:
                        assert j==0 and g['text']=='Cortex native portrait.png' and g['bounds']==[389,64,544.96875,80]
                        assert ink=={'bounds':[389,63,544.96875,80],'clip':[389,64,545,80],'visible':False,'measuredFilenameLeading':True}
                        ink_exceptions+=1
        s=c['imageSample'];zoom='zoom' in c['file']
        assert s=={'dimensions':[120,180],'complete':True,'protocol':'blob:','scale':'1.5' if zoom else '1','translate':'0px -40px' if zoom else '0px','rgba':[[216,76,55,255],[33,116,176,255],[216,76,55,255]]}
        for point,n in zip(['before','after'],m['nativeChecks'][i*2:i*2+2]):
            assert n['point']==point and n['theme']==c['theme'] and n['appearanceStatus']==0
            assert n['appearanceStdout']==('true\n' if c['osDark'] else 'false\n')
            assert n['rows']==[{k:c[k] for k in ['id','pid','bounds','active']}]
        before,after=m['nativeChecks'][i*2:i*2+2]
        assert stamp(before['measuredAt'])<=stamp(c['requestedAt'])<=stamp(after['measuredAt'])<=stamp(c['finishedAt'])<stamp(m['cleanupStartedAt'])
        image_checks.append(dict(file=c['file'],originalSHA256=c['sha256'],rgbaSHA256=e['rgbaSHA256'],geometryTargets=5,prePostMeasurements=10,passedCapture=True))
    assert geometry==40 and ink_exceptions==8
    pans=[r for r in m['checks'] if isinstance(r.get('keyboardPan'),dict)];opens=[r for r in m['checks'] if r.get('exactTuple')]
    assert len(pans)==len(opens)==2 and [r['theme'] for r in pans]==['light','dark']
    for r in pans:assert r['keyboardPan']=={'before':{'raw':'0px','x':0,'y':0},'after':{'raw':'0px -40px','x':0,'y':-40},'displacement':{'x':0,'y':-40}}
    assert [r['open'] for r in opens]==['Enter','pointer'] and all(r['zoomInOutFit'] and r['keyboardPan'] and r['minimapRatio']==2/3 for r in opens)
    assert m['previous']=={'stored':None,'pref':'system','theme':'dark','nativeDark':'true','hash':'#/home'}
    calls=m['calls'];assert len(calls)==31 and all(r['state']=='returned' and r['status'] in [200,201,202] for r in calls)
    assert Counter(r['method'] for r in calls)=={'GET':23,'PATCH':3,'PUT':1,'POST':2,'DELETE':2}
    assert not any(r['stage'] in ['read-only-viewer','flow-complete'] for r in calls)
    sid=m['savedImage']['sessionID'];assert sid==m['session']['id']
    assert [r['count'] for r in calls if r['route']==f'/api/sessions/{sid}/messages']==[2]
    assert len([r for r in calls if r['method']=='POST' and r['route']==f'/api/sessions/{sid}/prompt'])==1
    assert all(any(r['stage']==theme+':open-saved-image' and r['route']=='/api/providers/fake' and r['method']=='GET' for r in calls) for theme in ['light','dark'])
    assert Counter(v is True for v in m['cleanup'].values())=={True:10,False:1} and isinstance(m['cleanup']['ownedSaveSheetCancelled'],dict)
    backend=load('native/backend-receipt.json');assert backend==m['backendReceipt'] and backend['counts']['inference']==1 and backend['counts']['errors']==0 and not backend['failures']
    assert backend['pid']==launch['backendPID'] and backend['runID']==launch['runID'] and backend['root']==owner['root']
    assert len(backend['requests'])==1 and all(backend['requests'][0][k] for k in ['modelExact','authorizationExact','messagesExact','toolsAbsent','completed'])
    for key in ['nativeSave','cancelSample']:
        result=m['download'][key];assert result['status']==1 and result['timedOut'] is False
        for stream in ['stdout','stderr']:
            record=result[stream];raw=base64.b64decode(record['base64'],validate=True)
            assert not record['truncated'] and len(raw)==record['bytes'] and sha(raw)==record['sha256']
        assert b'(-1700)' in base64.b64decode(result['stderr']['base64'])
    assert base64.b64decode(m['download']['nativeSave']['stderr']['base64'])==(E/'native/save-automation-error.txt').read_bytes()
    assert 'result' not in m['download'] and m['download']['requested'] and m['download']['removal']['absent'] and m['download']['removal']['removed'] is False

    assert old['status']=='failed' and old['capturesRequested']==0 and not old['captures'] and len(old['cleanup'])==9 and all(v is True for v in old['cleanup'].values())
    assert old['flowDurationMs']==17017 and old['durationMs']==20655
    assert diag['status']=='observed' and diag['diagnosticOnly'] and diag['flowDurationMs']==36883 and diag['durationMs']==40280
    assert len(diag['nameSamples'])==4 and len(diag['captures'])==2 and len(diag['nativeChecks'])==4
    assert len(diag['cleanup'])==10 and all(v is True for v in diag['cleanup'].values()) and diag['nameRestored']==diag['originalNameOverflow']
    baseline=diag['nameSamples'][0];layout=diag['baselineLayout'];assert len(layout)==265
    assert sha(json.dumps(layout,separators=(',',':'),ensure_ascii=False).encode())==baseline['layoutSHA256']
    for i,n in enumerate(diag['nameSamples']):
        assert n['owner'] and n['text']=='Cortex native portrait.png' and n['layoutSHA256']==baseline['layoutSHA256'] and n['layoutNodes']==265
        assert n['computed']['font']=='500 13px / 16px Geist, ui-sans-serif, system-ui, sans-serif' and n['computed']['letter-spacing']=='normal'
        for key in ['bounds','ranges','offset','client','scroll','viewport','canvas']:assert n[key]==baseline[key]
        overflow='auto' if i<2 else 'visible'
        assert n['computed']=={**baseline['computed'],'overflow':overflow,'overflow-x':overflow,'overflow-y':overflow}
        assert n['clipChain']==[{**r,'overflowX':overflow,'overflowY':overflow} if j==0 else r for j,r in enumerate(baseline['clipChain'])]
    diagnostic=pixels(E/'filename-diagnostic/filename-native.webp');light=pixels(E/'native/files-fit-light.webp')
    assert diagnostic.tobytes()==light.tobytes() and diagnostic.size==light.size
    assert len({c['sha256'] for c in diag['captures']})==1 and diag['captures'][0]['sha256']==m['captures'][0]['sha256']=='f1152f2820297bf2d0764fbbc0687e39bd063f5e7da0eee55f68209506aeba8f'
    crop=load('filename-diagnostic/pixel-comparison.json')['crop'];assert crop==[383,58,551,86]
    assert sha(light.crop(crop).tobytes())=='5678c18549382854ec76779985db701cfc67e6727f2d27aba7ccfb8c7d80d95a'
    assert save['status']=='failed' and save['flowMs']==14398 and save['durationMs']==19609 and sum(v is True for v in save['cleanup'].values())==7
    assert load('save-diagnostic/interpretation.json')['coordinatorModalCancellationCompleted']

    manual=load('manual-download/receipt.json');removed=load('manual-download/cleanup.json');raw=base64.b64decode(manual['rawBase64'],validate=True)
    helper=(E/'scripts/pixel-bound/files-native-backend.mjs').read_text();fixture=base64.b64decode(re.search(r"export const png = '([^']+)'",helper)[1],validate=True)
    assert raw==fixture and len(raw)==manual['bytes']==m['fixture']['bytes']==393
    assert sha(raw)==manual['sha256']==m['savedImage']['fileSHA256']==m['fixture']['sha256']=='35d49e647469369311f7f223d9e340034f77a96cceee1f27f5ebff8bbe3174cf'
    assert manual['collectorStatusUnchanged']=='failed' and manual['path']==removed['path']==m['download']['path']==owner['root']+'/native-download/Cortex native portrait.png'
    assert manual['inode']==removed['inode']==2407198 and manual['device']==removed['device']==16777244
    assert removed['sha256']==sha(raw) and removed['bytes']==393 and removed['removed'] and removed['absent']
    assert stamp(manual['observedUTC'])>stamp(m['finishedAt']) and any(r['route']==f'/api/sessions/{sid}' and r['method']=='DELETE' for r in calls)
    assert raw[:8]==b'\x89PNG\r\n\x1a\n';chunks=[];at=8
    while at<len(raw):
        size=struct.unpack_from('>I',raw,at)[0];kind=raw[at+4:at+8];data=raw[at+8:at+8+size];end=at+8+size
        assert end+4<=len(raw) and zlib.crc32(kind+data)==struct.unpack_from('>I',raw,end)[0]
        chunks.append((kind,data));at=end+4
    assert at==len(raw) and [t for t,_ in chunks]==[b'IHDR',b'tEXt',b'IDAT',b'IEND']
    assert struct.unpack('>IIBBBBB',chunks[0][1])==(120,180,8,2,0,0,0)
    assert chunks[1][1]==b'Description\0Cortex native two-color portrait' and not chunks[3][1]
    scan=zlib.decompress(chunks[2][1]);assert len(scan)==64980
    assert scan==b''.join(b'\0'+bytes(m['fixture']['rgb'][y//60])*120 for y in range(180))
    cleanup=load('native/cleanup.json');final=load('final-restoration.json');pre=load('pre-lease.json')
    assert cleanup['status']=='passed' and cleanup['ownedBeforeQuit']==owner and cleanup['initialCortexPIDs']==[78150]
    assert cleanup['ownedExitMs']==345 and cleanup['appDisposition']=='owned-exit-confirmed' and not cleanup['remainingCortexPIDs'] and cleanup['ordinaryLaunchServicesOpen']
    assert cleanup['helpersStopped']==[{'file':'backend.pid','pid':78145},{'file':'capture.pid','pid':78147}]
    assert final['ordinaryPID']==78497 and final['ordinaryArgs']=='/Applications/Cortex.app/Contents/MacOS/Cortex' and final['foreground']
    assert final['nativeDark']==pre['nativeDark']=='true' and final['preLeaseDarkRestored'] and final['installedASAR']==ASAR
    assert final['macPortsClosed']==[9444,9445,9456] and final['localPortsClosed']==[19444,19445] and final['tunnelPIDStopped']==594393 and final['leaseRelease']=='released'
    return dict(verdict='bounded composite accepted',application=REV,collectorStatus='failed',capturePasses=4,geometryTargets=20,prePostMeasurements=geometry,nativeSamples=8,
        explicitIPCCalls=31,controlledInference=1,rendererErrors=0,backendErrors=0,cleanupPasses=10,cleanupFailures=['ownedSaveSheetCancelled'],flowMs=74407,totalMs=79048,
        originalDownloadBytes=393,manualSupplement='source/receipt/byte-bound; no durable Save GUI capture or download URL',unreached=['read-only-viewer history/session/provider equality','flow-complete'],images=image_checks)

if __name__=='__main__':
    entries=(ROOT/'SHA256SUMS').read_text().splitlines();names=[line.split('  ',1)[1] for line in entries]
    assert len(names)==len(set(names)) and set(names)=={str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.is_file() and p.name!='SHA256SUMS'}
    for line in entries:
        digest,name=line.split('  ',1);assert sha((ROOT/name).read_bytes())==digest,name
    for line in (ROOT/'inputs.jsonl').read_text().splitlines():
        r=json.loads(line);p=ROOT/r['path'];assert p.stat().st_size==r['bytes'] and sha(p.read_bytes())==r['sha256'],r['path']
    result=verify();assert result==json.loads((ROOT/'results.json').read_bytes())
    for row in json.loads((ROOT/'filename-crops.json').read_bytes())['crops']:
        assert sha(pixels(ROOT/row['source']).crop(row['crop']).tobytes())==row['rgbaSHA256']
    assert len((ROOT/'README.md').read_text().splitlines())<=75
    print('Verified bounded composite: 4 passing native captures, 40 geometry samples, 8 native samples, 393 exact manual bytes. Collector FAILED; post-download equality unreached.')
