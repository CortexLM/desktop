"""Offline retained Activity proof checks; no collector import or device access."""
import datetime
import hashlib
import json
from pathlib import Path
import re
import runpy
import struct
import subprocess
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
REPO = BASE.parents[2]
RAW = Path('/tmp/opencode/activity-native-9ba8e59-a1')
OUT = Path('/tmp/opencode/activity-native-audit')
APP = '9ba8e59fbec8c1f38f93ace25414d4a3489aede3'
ASAR = '22760335b8eef317c2c325cde1a7d4c09ecb888780226aaeb0e8ae4353a4bf26'
HELPER = BASE.parent / '96df66c/native-audit/verify.py'
assert hashlib.sha256(HELPER.read_bytes()).hexdigest() == 'fc7d7ecf93476612364e577a4b00dc733b6e1c7e65c3ab91815431bcbf02dfd6'
h = runpy.run_path(str(HELPER), run_name='offline_helpers')
sha, stamp, png_chunks = (h[n] for n in ['sha', 'stamp', 'png_chunks'])
PINS = {
    'activity-native.mjs': '82b24a9417597ab6c9ba6f0754b36b1fa2ef7dc723118e03037e3cc642f04ac5',
    'terminal-state-native-backend.mjs': 'd22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d',
    'launch-terminal-state-native.py': '4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257',
    'cleanup-terminal-state-native.py': 'c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a',
}


def load(name):
    return json.loads((BASE / name).read_bytes())


def blob(name):
    return subprocess.check_output(['git', 'show', f'{APP}:{name}'], cwd=REPO)


def fits(bounds, clip):
    x1, y1, x2, y2 = bounds; l, t, r, b = clip
    assert 0 <= l < r <= 960 and 0 <= t < b <= 640
    assert x2 > x1 and y2 > y1 and x1 >= l - .5 and y1 >= t - .5 and x2 <= r + .5 and y2 <= b + .5


def geometry(row):
    assert row['visible'] is True and row['hit'] is True and 0 < len(row['ink']) <= 40
    fits(row['bounds'], row['clip'])
    for ink in row['ink']:
        assert ink['visible'] is True
        fits(ink['bounds'], ink['clip'])


def main():
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    watched = [p for p in BASE.rglob('*') if p.is_file() and 'native-audit' not in p.relative_to(BASE).parts] + list(RAW.iterdir()) + [HELPER]
    before = {str(p): sha(p.read_bytes()) for p in watched}
    checksum_entries = 0
    for directory in ['', 'native', 'scripts']:
        sums = BASE / directory / 'SHA256SUMS'
        for line in sums.read_text().splitlines():
            digest, name = line.split('  ', 1)
            assert not Path(name).is_absolute() and '..' not in Path(name).parts and sha((sums.parent / name).read_bytes()) == digest
            checksum_entries += 1
    m, package, review, artifact = (load(n) for n in ['native/manifest.json', 'package.json', 'package-review.json', 'artifact.json'])
    assert (BASE / 'native/manifest.json').read_bytes() == (RAW / 'manifest.json').read_bytes()
    assert m['status'] == 'passed' and m['stage'] == 'flow-complete' and m['errors'] == []
    assert m['revision'] == package['applicationRevision'] == review['applicationRevision'] == artifact['workflow_run']['head_sha'] == APP
    assert m['asar'] == package['asarSHA256'] == review['archiveSHA256']['app.asar'] == ASAR and review['status'] == 'approved'
    assert package['artifact'] == artifact['id'] == review['artifactID'] == 11282756070 and package['run'] == artifact['workflow_run']['id'] == review['workflowRunID'] == 37145831654
    assert review['packageInputsMatchingGit'] == 517 and review['rendererInputs'] == 475
    assert artifact['digest'] == 'sha256:' + package['outerSHA256']
    members, binding, installed, launch = (load(n) for n in ['expected-members.json', 'binding.json', 'installed.json', 'launch.json'])
    assert members['revision'] == APP and members['members'] == package['members'] and len(members['members']) == 90
    assert binding['membersSHA256'] == m['membersSHA256'] == sha((BASE / 'expected-members.json').read_bytes())
    assert binding['expectedAsar'] == installed['installedASAR'] == launch['expectedAsar'] == ASAR
    assert binding['revision'] == installed['applicationRevision'] == launch['revision'] == APP and launch['guiLaunch'] is True
    assert installed['zipSHA256'] == package['innerSHA256'] and installed['previousASAR'] == 'b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44'
    assert installed['backup'] == '/tmp/opencode/desktop-terminal-state-activity-9ba8e59-a1/previous-Cortex.app'
    identity = m['installedBefore']; assert identity == m['installedAfter']
    assert identity['asarSHA256'] == ASAR and identity['revision'] == APP and identity['membersVerified'] == m['memberCount'] == 90
    assert identity['membersSHA256'] == m['membersSHA256'] and identity['processCount'] == 1 and identity['isolated'] is True
    assert identity['pid'] == 73169 and identity['root'] == '/private/tmp/opencode/desktop-terminal-state-activity-9ba8e59-a1'
    assert m['invocation']['argv'] == ['/tmp/opencode/activity-native.mjs', str(RAW), '/tmp/opencode/desktop-terminal-state-activity-9ba8e59-a1', ASAR, APP, '/tmp/opencode/build-work-activity/members.json']
    assert m['helperHashes'] == PINS and m['rootHelperHashes'] == {k: v for k, v in PINS.items() if k != 'activity-native.mjs'}
    for n, digest in PINS.items():
        assert sha((BASE / 'scripts' / n).read_bytes()) == digest
    assert identity['inspectorSHA256'] == PINS['launch-terminal-state-native.py']
    source = (BASE / 'scripts/activity-native.mjs').read_text()
    en = json.loads(blob('packages/i18n/locales/en/work.json'))
    assert all(en[k] in source for k in ['act.recentScope', 'act.recentEmptyTitle', 'act.recentEmptyText', 'act.completed', 'act.failed', 'act.type.all', 'act.type.errors', 'act.clear', 'act.export'])
    assert 'Give ${bot.name} an instruction' in source and en['task.composer'] == 'Give {name} an instruction'
    source_pins = {n: sha(blob(n)) for n in ['packages/app/src/screens/work/activity.tsx', 'packages/app/src/screens/work/home.tsx', 'packages/app/src/screens/bots/mascot-io.ts', 'packages/app/src/mascot/Mascot.tsx']}
    assert source_pins['packages/app/src/screens/work/activity.tsx'] == 'ac08eb0411325df215cce7bcb16dae8b47f562621fd7ea87b1b74d59dc09d904'
    backend = load('backend-receipt.json'); assert backend == m['backendReceipt'] and all(backend[k] == v for k, v in m['backend'].items())
    assert backend['pid'] == launch['backendPID'] == 73166 and backend['runID'] == launch['runID'] and backend['root'] == identity['root']
    assert backend['scriptSHA256'] == PINS['terminal-state-native-backend.mjs'] and backend['failures'] == []
    assert backend['counts'] == {'catalog': 1, 'health': 2, 'receipt': 3, 'errors': 0}
    expected_requests = []
    for theme, turn in [('light', 'fail'), ('light', 'recover'), ('dark', 'fail')]:
        row = {'theme': theme, 'turn': turn, 'userTexts': [f'Cortex {theme} Code {t}.' for t in (['fail', 'recover'] if turn == 'recover' else ['fail'])],
            'replayAnswers': [], 'modelExact': True, 'authorizationExact': True, 'workingDirectoryExact': True, 'toolsAbsent': True, 'reasoningOptionFields': [],
            'httpStatus': 200 if turn == 'recover' else 401, 'outputFields': ['reasoning_content', 'content'] if turn == 'recover' else [], 'completed': True}
        if turn == 'recover': row.update(reasoningText='Checking light recovery.', answerText='Recovered light Code task.')
        expected_requests.append(row)
    assert backend['requests'] == expected_requests
    start, finish = stamp(m['startedAt']), stamp(m['finishedAt'])
    assert round((finish-start).total_seconds()*1000) == m['durationMs'] == 78716 and m['flowDurationMs'] == 75516 < m['budget']['flowMs'] == 120000
    assert (BASE / 'native/manifest.json').stat().st_size < m['budget']['manifestBytes']
    bot, sessions, checks, calls = m['bot'], m['sessions'], m['checks'], m['calls']
    assert len(sessions) == 2 and len(checks) == 6 and checks[0] == {'stage': 'fresh-profile', 'initialEmpty': True}
    assert bot['name'] == 'Native Activity Bot' and bot['tools'] == {} and bot['memory'] == bot['routines'] == bot['permission'] == []
    assert bot['mascot'] == {'shape': 'pebble', 'color': 'meadow', 'eyes': 'round', 'mouth': 'smile', 'accessories': []}
    assert bot['model'] == {'providerID': 'fake', 'modelID': 'reasoner'}
    ids = [s['id'] for s in sessions]; assert len(set(ids)) == 2
    for i, session in enumerate(sessions):
        assert session['kind'] == 'bot' and session['botID'] == bot['id'] and 'parentID' not in session and 'projectID' not in session
        assert session['directory'] == identity['root'] and session['agent'] == 'build' and session['model'] == bot['model']
        assert session['title'] == ['Native completed turn', 'Native failed turn'][i]
    for c, stage, slot, outcome in zip(checks[1:4], ['fixture:light:fail', 'fixture:light:recover', 'fixture:dark:fail'], [0, 0, 1], ['Failed', 'Completed', 'Failed']):
        assert c['stage'] == stage and c['sessionID'] == ids[slot] and c['outcome'] == outcome
        assert c['completed'] >= sessions[slot]['time']['created'] and re.fullmatch('[a-f0-9]{64}', c['historySHA256']) and c['messageID'].startswith('msg_')
    assert checks[1]['completed'] < checks[2]['completed'] < checks[3]['completed']
    for c, theme in zip(checks[4:], ['light', 'dark']):
        assert c == {'stage': theme + ':exact-links', 'botFilterKeyboard': True, 'errorsSpace': True, 'failedRowEnter': ids[1], 'completedRowPointer': ids[0]}
    assert len(calls) == 48 and len(calls) < m['budget']['ipcCalls'] == 180
    own = '/api/bots/' + bot['id']; session_routes = ['/api/sessions/' + n for n in ids]
    expected_writes = [('PATCH', '/api/providers/fake', 200), ('PUT', '/api/providers/fake/key', 200), ('POST', '/api/bots', 201), ('POST', own + '/sessions', 201),
        ('POST', session_routes[0] + '/prompt', 202), ('POST', session_routes[0] + '/prompt', 202), ('POST', own + '/sessions', 201), ('POST', session_routes[1] + '/prompt', 202),
        ('DELETE', session_routes[0], 200), ('DELETE', session_routes[1], 200), ('DELETE', own, 200), ('DELETE', '/api/providers/fake/key', 200), ('PATCH', '/api/providers/fake', 200)]
    assert [(c['method'], c['route'], c['status']) for c in calls if c['method'] != 'GET'] == expected_writes
    lists = ['/api/' + n for n in ['bots', 'sessions', 'projects', 'providers', 'tasks', 'plugins', 'permissions']]
    for stage in ['fresh-profile', 'flow-complete']:
        for route in lists:
            selected = [c for c in calls if c['stage'] == stage and c['route'] == route and c['method'] == 'GET']
            assert len(selected) == 1 and selected[0]['count'] == (1 if stage == 'flow-complete' and route == '/api/providers' else 0)
    read_only = [c for c in calls if c['stage'] == 'read-only-feed']
    assert [(c['method'], c['route'], c['status']) for c in read_only] == [('GET', r, 200) for r in [session_routes[0] + '/messages', session_routes[1] + '/messages', own, '/api/sessions', '/api/providers/fake']]
    assert [c.get('count') for c in read_only[:2]] == [4, 2]
    mascot = blob('packages/app/src/mascot/Mascot.tsx').decode(); adapter = blob('packages/app/src/screens/bots/mascot-io.ts').decode()
    palette = mascot.split('export const COLORS = [', 1)[1].split('] as const;', 1)[0]
    assert 'meadow' not in palette and 'color: "#8448FF"' in mascot and 'eyes: "commas"' in mascot
    assert 'const EYES: Eyes[] = ["commas", "dots", "ovals", "pixels"]' in adapter and '?? DEFAULT_MASCOT.color' in adapter
    images = load('native/images.json'); captures = m['captures']; order = ['activity-all-light.png', 'activity-errors-light.png', 'activity-all-dark.png', 'activity-errors-dark.png']
    assert [c['file'] for c in captures] == [r['originalName'] for r in images] == order and len(captures) == m['capturesRequested'] == m['budget']['captures'] == 4
    assert len(m['nativeChecks']) == m['budget']['nativeSamples'] == 8
    image_rows = []
    for i, (capture, receipt) in enumerate(zip(captures, images)):
        dark, filtered = capture['theme'] == 'dark', 'errors' in capture['file']
        assert capture['native'] is True and capture['active'] is True and capture['status'] == 'passed' and capture['httpStatus'] == 200
        assert capture['pid'] == identity['pid'] and capture['id'] == 9006 and capture['bounds'] == {'X': 0, 'Y': 30, 'Width': 960, 'Height': 640} and capture['osDark'] == dark
        pair = m['nativeChecks'][2*i:2*i+2]
        for sample, point in zip(pair, ['before', 'after']):
            assert sample['appearanceStatus'] == 0 and sample['appearanceStdout'] == ('true\n' if dark else 'false\n') and sample['point'] == point and sample['theme'] == capture['theme']
            assert sample['rows'] == [{k: capture[k] for k in ['id', 'pid', 'active', 'bounds']}]
            assert sample['stage'] == capture['theme'] + ':' + capture['file'].rsplit('-', 1)[0] + ':capture'
        assert start < stamp(pair[0]['measuredAt']) <= stamp(capture['requestedAt']) < stamp(pair[1]['measuredAt']) <= stamp(capture['finishedAt']) < finish
        assert len(capture['boxes']) == len(capture['afterBoxes']) == 5 and capture['boxes'] == capture['afterBoxes']
        for row in capture['boxes'] + capture['afterBoxes']: geometry(row)
        texts = [row['text'] for row in capture['boxes']]
        assert texts[:3] == [en['act.recentScope'], bot['name'], en['act.type.all']]
        if filtered: assert texts[3] == en['act.type.errors']
        rows = texts[4:] if filtered else texts[3:]
        for row, slot, outcome in zip(rows, [1] if filtered else [1, 0], ['Failed'] if filtered else ['Failed', 'Completed']):
            prefix = bot['name'] + ' · ' + sessions[slot]['title'] + outcome
            assert row.startswith(prefix) and re.fullmatch(r'\d{2}:\d{2} [AP]M', row.removeprefix(prefix))
        assert capture['focus']['visible'] is True and capture['focus']['outline'] == ('rgb(91, 155, 255)' if dark else 'rgb(59, 130, 246)') + ' solid 2px'
        raw_path, webp_path = RAW / receipt['originalName'], BASE / 'native' / receipt['retainedFile']
        raw, webp = raw_path.read_bytes(), webp_path.read_bytes()
        assert sha(raw) == receipt['originalSHA256'] == capture['sha256'] and len(raw) == receipt['originalBytes'] == capture['bytes']
        assert sha(webp) == receipt['retainedSHA256'] and len(webp) == receipt['retainedBytes'] and webp[:4] == b'RIFF' and webp[8:12] == b'WEBP' and struct.unpack_from('<I', webp, 4)[0]+8 == len(webp)
        assert len(raw) <= m['budget']['originalBytes']; chunks = png_chunks(raw)
        with Image.open(raw_path) as image: image.verify()
        with Image.open(raw_path) as original, Image.open(webp_path) as retained:
            rgba, lossless = original.convert('RGBA'), retained.convert('RGBA'); pixels = rgba.tobytes()
            assert list(rgba.size) == list(lossless.size) == receipt['pixels'] == capture['pixels'] == [960, 640]
            assert pixels == lossless.tobytes() and sha(pixels) == receipt['rgbaSHA256']
            gray = rgba.convert('L'); histogram = gray.histogram(); colors = len(rgba.getcolors(960*640))
            assert colors > 2000 and histogram[0] < 960*640*.01 and gray.getextrema() == (0, 255)
            assert [list(rgba.getpixel((x,22))) for x in [27,50,73]] == [[255,92,95,255],[250,200,0,255],[52,199,89,255]]
            bounds = capture['boxes'][3 if filtered else 2]['bounds']; crop = rgba.crop([int(bounds[0])-4,int(bounds[1])-4,int(bounds[2])+4,int(bounds[3])+4])
            blue = sum(n for n,(r,g,b,a) in crop.getcolors(960*640) if a and b>r+25 and b>g+10)
            assert blue == (388 if filtered else 316)
            alpha = list(rgba.getchannel('A').getextrema()); assert alpha == [0,255]
        image_rows.append({'file': receipt['originalName'], 'originalSHA256': sha(raw), 'retainedSHA256': sha(webp), 'rgbaSHA256': sha(pixels), 'pngCRCChunks':len(chunks), 'webpRGBAExact':True, 'uniqueColors':colors, 'blackPixels':histogram[0], 'blueFocusPixels':blue, 'alphaExtrema':alpha, 'trafficLightCentersVerified':True})
    original_bytes, retained_bytes = sum(r['originalBytes'] for r in images), sum(r['retainedBytes'] for r in images)
    assert original_bytes == 280136 <= m['budget']['totalBytes'] and retained_bytes == 94882
    assert len(m['cleanup']) == 11 and all(v is True for v in m['cleanup'].values()) and m['providerDocumentRetained'] is True
    assert set(m['cleanup']) == {'sessionRemoved:'+ids[0], 'sessionRemoved:'+ids[1], 'ownedBotRemoved', 'fixtureKeyRemoved', 'providerValuesRestored', 'nativeAppearanceRestored', 'themePreferenceRestored', 'routeRestored', 'controlledListsRestored', 'controlledInferenceOnly', 'installedAfter'}
    cleanup, restoration, lease = (load(n) for n in ['cleanup.json','final-restoration.json','pre-lease.json'])
    assert cleanup['applicationRevision'] == APP and cleanup['asarSHA256'] == restoration['installedASAR'] == ASAR and lease['beforeASAR'] == installed['previousASAR']
    assert cleanup['helpersStopped'] == [{'file':'backend.pid','pid':launch['backendPID']},{'file':'capture.pid','pid':launch['capturePID']}]
    assert cleanup['ordinaryLaunchServicesOpen'] is True and cleanup['restoredDarkAppearance'] is True
    assert restoration['nativeDark'] == lease['nativeDark'] == m['previous']['nativeDark'] == 'true' and restoration['preLeaseDarkRestored'] is True
    assert restoration['ordinaryPID'] == 73344 != identity['pid'] and restoration['ordinaryArgumentsVerified'] is True and restoration['foreground'] is True
    assert restoration['macPortsClosed'] == [9444,9445,9456] and restoration['localPortsClosed'] == [19444,19445] and restoration['tunnelPIDStopped'] == 3806877 and restoration['leaseRelease'] == 'released'
    assert (BASE/'native.log').read_text() == 'Activity native: passed; flow-complete; /tmp/opencode/activity-native-9ba8e59-a1/manifest.json\n'
    assert {str(p):sha(p.read_bytes()) for p in watched} == before
    result = {'status':'passed','scope':'Bounded installed Activity All/Errors, filters and exact Work links; offline proof audit','applicationRevision':APP,'asarSHA256':ASAR,
        'workflowRunID':37145831654,'artifactID':11282756070,'collectorSHA256':PINS['activity-native.mjs'],'manifestSHA256':sha((BASE/'native/manifest.json').read_bytes()),
        'memberCount':90,'isolatedPID':identity['pid'],'windowID':9006,'flowDurationMs':m['flowDurationMs'],'totalDurationMs':m['durationMs'],'cleanupDurationMs':m['durationMs']-m['flowDurationMs'],
        'captures':4,'targets':20,'geometryMeasurements':40,'nativeSamples':8,'checkEntries':6,'initialEmptyChecks':1,'historyOutcomeChecks':3,'navigationThemeChecks':2,
        'explicitIPCLogEntries':len(calls),'explicitGETs':sum(c['method']=='GET' for c in calls),'explicitMutations':len(expected_writes),'controlledBots':1,'rootSessions':2,'promptAdmissionsViaIPC':3,
        'backendOutcomes':[401,200,401],'fixtureCatalogReads':1,'driverCleanupChecks':11,'rendererErrors':0,'backendErrors':0,'readOnlyHistoriesRecheckedByPinnedCollector':True,
        'rawHistoriesRetained':False,'historyReceiptScope':'Collector checks and digests retained; full histories remain unarchived','originalPNGBytes':original_bytes,'retainedWebPBytes':retained_bytes,
        'imageChecks':image_rows,'sourcePins':source_pins,'mascotScope':{'fixtureColor':'meadow','fixtureEyes':'round','unsupportedColorAndEyesUseFallback':True,'fallbackColor':'#8448FF','fallbackEyes':'commas','customAppearanceAcceptance':False,'assignedNamesAndExactSessionLinks':True},
        'providerCleanup':{'fixtureKeyRemoved':True,'baseURLCleared':True,'enabled':True,'hasKey':False,'sanitizedDocumentRetained':True,'otherGuardedListsEmpty':True},
        'finalRestoration':{'ordinaryPID':73344,'sameASAR':True,'originalOSDarkRestored':True,'isolatedArgsAbsent':True,'helpersStopped':True,'closedPorts':[9444,9445,9456,19444,19445],'tunnelPIDStopped':3806877,'leaseReleased':True},
        'checksumEntriesVerified':checksum_entries,'inputFilesStable':len(watched),'inputArtifactsStableBeforeAfter':True,'imageDecoder':'Pillow '+Image.__version__,
        'startedUTC':started,'finishedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'verifierSHA256':sha(Path(__file__).read_bytes()),'pngReaderSHA256':sha(HELPER.read_bytes()),
        'executedNativeActions':0,'networkRequests':0,'executedApplicationTests':0,'acceptanceLimits':['No user-composer send','No distinct custom mascot fidelity','No restart/interruption/in-progress retention','No duplicate/missing Bot or race/40-root proof','No other locales/1440x900/preview parity','No whole-product or full-rewrite acceptance']}
    OUT.mkdir(parents=True,exist_ok=True); (OUT/'input-hashes.json').write_text(json.dumps(before,indent=2)+'\n')
    result['inputHashReceiptSHA256'] = sha((OUT/'input-hashes.json').read_bytes())
    (OUT/'summary.json').write_text(json.dumps(result,indent=2)+'\n'); print(json.dumps(result,indent=2))


if __name__ == '__main__':
    main()
