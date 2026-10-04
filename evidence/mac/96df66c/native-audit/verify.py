"""Offline retained-evidence checks; never imports collectors or contacts a device."""
import collections
import datetime
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import zlib
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
REPO = BASE.parents[2]
OUT = Path('/tmp/opencode/memory-native-audit')
APP = '96df66ce727c42ddf647b2dcb4eeeff04fda4927'
ASAR = 'b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44'
PINS = {
    'memory-native-corrected.mjs': 'd1eaeea3ae44d0b32fc0903e67c860a0d8c2444b93ab23a0a997f4c1f17c4b8e',
    'terminal-state-native-backend.mjs': 'd22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d',
    'launch-terminal-state-native.py': '4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257',
    'cleanup-terminal-state-native.py': 'c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load(name):
    return json.loads((BASE / name).read_bytes())


def stamp(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))


def geometry(row):
    assert row['visible'] is True and row['hit'] is True and row['opacity'] == 1
    left, top, right, bottom = row['clip']
    assert 0 <= left < right <= 960 and 0 <= top < bottom <= 640
    for x1, y1, x2, y2 in [row['bounds'], *row['ink']]:
        assert x2 > x1 and y2 > y1 and x1 >= left - .5 and y1 >= top - .5 and x2 <= right + .5 and y2 <= bottom + .5


def png_chunks(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    position, names = 8, []
    while position < len(data):
        size = struct.unpack_from('>I', data, position)[0]
        kind, body = data[position + 4:position + 8], data[position + 8:position + 8 + size]
        assert len(body) == size and struct.unpack_from('>I', data, position + 8 + size)[0] == zlib.crc32(kind + body)
        names.append(kind.decode('ascii')); position += size + 12
        if kind == b'IEND':
            assert size == 0 and position == len(data)
            break
    assert names[0] == 'IHDR' and names[-1] == 'IEND' and 'IDAT' in names
    return names


def main():
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    watched = {p.relative_to(BASE).as_posix(): sha(p.read_bytes()) for p in BASE.rglob('*') if p.is_file() and 'native-audit' not in p.relative_to(BASE).parts}
    sum_entries = 0
    for directory in ['', 'native', 'scripts', 'initial-native-probe']:
        manifest = BASE / directory / 'SHA256SUMS'
        if not manifest.exists():
            continue
        for line in manifest.read_text().splitlines():
            digest, name = line.split('  ', 1)
            assert Path(name).is_absolute() is False and '..' not in Path(name).parts
            assert sha((manifest.parent / name).read_bytes()) == digest
            sum_entries += 1
    m = load('native/manifest.json'); package = load('package.json'); review = load('package-review.json'); artifact = load('artifact.json')
    assert m['status'] == 'passed' and m['stage'] == 'flow-complete' and m['errors'] == []
    assert m['revision'] == package['applicationRevision'] == review['applicationRevision'] == artifact['workflow_run']['head_sha'] == APP
    assert m['asar'] == package['asarSHA256'] == review['archiveSHA256']['app.asar'] == ASAR
    assert artifact['id'] == package['artifact'] == review['artifactID'] == 11279989876
    assert artifact['workflow_run']['id'] == package['run'] == review['workflowRunID'] == 37139741944
    assert artifact['digest'] == 'sha256:' + package['outerSHA256'] and review['status'] == 'approved'
    members = load('members.json'); binding = load('binding.json'); installed = load('installed.json'); launch = load('launch.json')
    assert members['revision'] == APP and members['members'] == package['members'] and len(members['members']) == 90
    assert m['membersSHA256'] == binding['membersSHA256'] == sha((BASE / 'members.json').read_bytes())
    assert binding['expectedAsar'] == installed['installedASAR'] == launch['expectedAsar'] == ASAR
    assert binding['revision'] == installed['applicationRevision'] == launch['revision'] == APP and launch['guiLaunch'] is True
    assert installed['zipSHA256'] == package['innerSHA256']
    assert installed['previousASAR'] == 'a6d3c4f59d10b3d3fd16e7309441ebb6aff1dd670e11ff06a57362eca805f422'
    assert installed['backup'] == '/tmp/opencode/desktop-terminal-state-memory-96df66c-a1/previous-Cortex.app'
    assert m['installedBefore'] == m['installedAfter']
    identity = m['installedBefore']
    assert identity['asarSHA256'] == ASAR and identity['revision'] == APP and identity['membersVerified'] == m['memberCount'] == 90
    assert identity['membersSHA256'] == m['membersSHA256'] and identity['processCount'] == 1 and identity['isolated'] is True
    assert identity['root'] == '/private/tmp/opencode/desktop-terminal-state-memory-96df66c-a2' and identity['pid'] == 71055
    assert m['invocation']['argv'][0:5] == ['/tmp/opencode/memory-native-corrected.mjs', '/tmp/opencode/memory-native-96df66c-a2', '/tmp/opencode/desktop-terminal-state-memory-96df66c-a2', ASAR, APP]
    assert m['helperHashes'] == PINS and m['rootHelperHashes'] == {k: v for k, v in PINS.items() if k != 'memory-native-corrected.mjs'}
    for name, digest in PINS.items():
        assert sha((BASE / 'scripts' / name).read_bytes()) == digest
    assert identity['inspectorSHA256'] == PINS['launch-terminal-state-native.py']
    source = (BASE / 'scripts/memory-native-corrected.mjs').read_text()
    original = (BASE / 'scripts/memory-native.mjs').read_bytes()
    assert sha(original) == '370b06ee1628b3e88e17104562da077b22f70da859947baa4990dd555ee44aa9'
    assert source[source.index('  const pins ='):] == original.decode()[original.decode().index('  const pins ='):]
    en = json.loads(subprocess.check_output(['git', 'show', f'{APP}:packages/i18n/locales/en/system.json'], cwd=REPO))
    keys = ['memory.toggle', 'settings.t.privacy.memory', 'memory.offTitle', 'memory.liveOffText', 'memory.livePausedText', 'settings.t.privacy.memoryLiveDesc', 'memory.forget']
    assert all(en[k] in source for k in keys)
    backend = load('backend-receipt.json')
    assert backend == m['backendReceipt'] and all(backend[k] == v for k, v in m['backend'].items())
    assert backend['runID'] == launch['runID'] and backend['pid'] == launch['backendPID'] and backend['root'] == identity['root']
    assert backend['scriptSHA256'] == PINS['terminal-state-native-backend.mjs'] and backend['requests'] == backend['failures'] == []
    assert backend['counts'] == {'catalog': 0, 'health': 2, 'receipt': 2, 'errors': 0}
    start, finish = stamp(m['startedAt']), stamp(m['finishedAt'])
    assert round((finish - start).total_seconds() * 1000) == m['durationMs'] == 68646
    assert m['durationMs'] < m['budget']['flowMs'] == 120000 and (BASE / 'native/manifest.json').stat().st_size <= m['budget']['manifestBytes']
    states = [c for c in m['checks'] if 'memoryEnabled' in c]
    expected_states = [('light:memory', v) for v in [True, False, True, False]] + [('light:privacy', v) for v in [False, True, False]] + [('light:paused-manual-access', False)] + [('dark:memory', v) for v in [False, True, False]] + [('dark:privacy', v) for v in [False, True, False]] + [('dark:paused-manual-access', False)]
    assert [(c['stage'], c['memoryEnabled']) for c in states] == expected_states and all(c['notesAndBotUnchanged'] is True for c in states)
    manual = [c for c in m['checks'] if 'forgetKeyboardFocusAndPointerHit' in c]
    assert len(m['checks']) == 17 and len(states) == 15 and len(manual) == 2
    for c in manual:
        assert c['forgetKeyboardFocusAndPointerHit'] is True and c['geometry']['text'] == en['memory.forget']; geometry(c['geometry'])
    calls = m['calls']; bot = m['bot']; note = m['note']; own = '/api/bots/' + bot['id']; lists = ['/api/' + n for n in ['bots', 'sessions', 'projects', 'providers', 'tasks', 'plugins', 'permissions']]
    assert len(calls) == 70 and len(calls) < 180 and note['botID'] == bot['id'] and note['content'] == 'Keep the blue folder.'
    assert bot['memory'] == bot['routines'] == bot['permission'] == [] and bot['tools'] == {} and bot['model'] == {'providerID': 'native-memory', 'modelID': 'unconfigured'}
    assert bot['time']['created'] == bot['time']['updated'] <= note['time']
    assert [(c['method'], c['route'], c['status']) for c in calls if c['method'] != 'GET'] == [('POST', '/api/bots', 201), ('POST', own + '/memory', 201), ('PUT', '/api/settings', 200), ('DELETE', own, 200)]
    for c in calls:
        assert c['route'] in lists + ['/api/connection', '/api/settings', own, own + '/memory']
        assert c['status'] == (201 if c['method'] == 'POST' else 200)
    for stage in ['fresh-profile', 'flow-complete']:
        for route in lists:
            selected = [c for c in calls if c['stage'] == stage and c['route'] == route and c['method'] == 'GET']
            assert len(selected) == 1 and selected[0]['count'] == 0
    memory_reads = [c for c in calls if c['route'] == own + '/memory' and c['method'] == 'GET']
    assert [c['count'] for c in memory_reads] == [1] * len(states) + [0]
    assert calls[56:59] == [{'stage': 'dark:paused-manual-access', 'route': own + '/memory', 'method': 'GET', 'status': 200, 'count': 0}, {'stage': 'dark:paused-manual-access', 'route': own, 'method': 'GET', 'status': 200}, {'stage': 'dark:paused-manual-access', 'route': '/api/settings', 'method': 'GET', 'status': 200}]
    assert m['pausedForgetAccepted'] is True and m['initialSettings'] == {'memoryEnabled': True} and m['settingsDocumentRetained'] is True
    images = load('native/images.json'); image_by_name = {r['original']: r for r in images}; captures = m['captures']
    order = ['memory-off-light.png', 'privacy-off-light.png', 'memory-off-dark.png', 'privacy-off-dark.png']
    assert [c['file'] for c in captures] == order and set(image_by_name) == set(order) and len(images) == m['capturesRequested'] == m['budget']['captures'] == 4
    assert len(m['nativeChecks']) == 8 and sum(len(c['boxes']) for c in captures) == 20
    pixel_rows = []
    for i, capture in enumerate(captures):
        record = image_by_name[capture['file']]; dark = capture['theme'] == 'dark'
        assert capture['status'] == 'passed' and capture['httpStatus'] == 200 and capture['native'] is True and capture['active'] is True
        assert capture['pid'] == identity['pid'] and capture['id'] == 8973 and capture['bounds'] == {'X': 0, 'Y': 30, 'Width': 960, 'Height': 640} and capture['osDark'] == dark
        pair = m['nativeChecks'][2*i:2*i+2]
        for sample in pair:
            assert sample['appearanceStatus'] == 0 and sample['appearanceStdout'] == ('true\n' if dark else 'false\n') and sample['theme'] == capture['theme']
            assert sample['rows'] == [{k: capture[k] for k in ['id', 'pid', 'active', 'bounds']}]
            assert sample['stage'] == capture['theme'] + ':' + capture['file'].rsplit('-', 1)[0] + ':capture'
        assert start < stamp(pair[0]['measuredAt']) <= stamp(capture['requestedAt']) < stamp(pair[1]['measuredAt']) <= stamp(capture['finishedAt']) < finish
        assert len(capture['boxes']) == 5
        for row in capture['boxes']:
            geometry(row)
        is_memory = capture['file'].startswith('memory')
        expected_texts = [en['memory.offTitle'], en['memory.liveOffText'], en['memory.toggle'], en['memory.livePausedText'], 'Keep the blue folder.this minute'] if is_memory else ['Privacy', 'Privacy', en['settings.t.privacy.memory'], en['settings.t.privacy.memoryLiveDesc'], en['settings.t.privacy.memory']]
        assert [b['text'] for b in capture['boxes']] == expected_texts
        assert capture['focus']['visible'] is True and capture['focus']['name'] == en['memory.toggle' if is_memory else 'settings.t.privacy.memory']
        assert capture['focus']['outline'] == ('rgb(91, 155, 255)' if dark else 'rgb(59, 130, 246)') + ' solid 2px'
        png, webp = BASE / 'native' / record['original'], BASE / 'native' / record['lossless']
        raw, lossless = png.read_bytes(), webp.read_bytes()
        assert sha(raw) == record['sha256'] == capture['sha256'] and sha(lossless) == record['losslessSHA256']
        assert len(raw) == capture['bytes'] <= m['budget']['originalBytes'] and lossless[:4] == b'RIFF' and lossless[8:12] == b'WEBP' and struct.unpack_from('<I', lossless, 4)[0] + 8 == len(lossless)
        chunks = png_chunks(raw)
        with Image.open(png) as original_image:
            original_image.verify()
        with Image.open(png) as original_image, Image.open(webp) as derived_image:
            rgba = original_image.convert('RGBA'); decoded = rgba.tobytes()
            assert list(rgba.size) == list(derived_image.size) == record['pixels'] == capture['pixels'] == [960, 640]
            assert decoded == derived_image.convert('RGBA').tobytes() and sha(decoded) == record['rgbaSHA256']
            gray = rgba.convert('L'); hist = gray.histogram(); unique_colors = len(rgba.getcolors(960 * 640))
            assert unique_colors > 2000 and hist[0] < 960 * 640 * .01 and gray.getextrema() == (0, 255)
            traffic = [list(rgba.getpixel((x, 22))) for x in [27, 50, 73]]
            assert traffic == [[255, 92, 95, 255], [250, 200, 0, 255], [52, 199, 89, 255]]
            bounds = capture['boxes'][2 if is_memory else 4]['bounds']; box = [int(bounds[0])-4, int(bounds[1])-4, int(bounds[2])+4, int(bounds[3])+4]
            blue_pixels = sum(n for n, (r, g, b, a) in rgba.crop(box).getcolors(960*640) if a and b > r + 25 and b > g + 10)
            assert blue_pixels == 252
        pixel_rows.append({'file': capture['file'], 'sha256': sha(raw), 'rgbaSHA256': sha(decoded), 'pixels': [960, 640], 'pngCRCChunks': len(chunks), 'webpRGBAExact': True, 'uniqueColors': unique_colors, 'blackPixels': hist[0], 'blueFocusPixels': blue_pixels, 'trafficLightCentersVerified': True})
    original_bytes = sum(c['bytes'] for c in captures)
    assert original_bytes <= m['budget']['totalBytes']
    assert set(m['cleanup']) == {'settingsValueRestored', 'ownedBotRemoved', 'nativeAppearanceRestored', 'themePreferenceRestored', 'routeRestored', 'controlledListsEmpty', 'zeroInference', 'installedAfter'} and all(v is True for v in m['cleanup'].values())
    cleanup, restored, lease = load('cleanup.json'), load('final-restoration.json'), load('pre-lease.json')
    assert cleanup['applicationRevision'] == lease['applicationRevision'] == APP and cleanup['asarSHA256'] == restored['asarSHA256'] == lease['asarSHA256'] == ASAR
    assert cleanup['helpersStopped'] == [{'file': 'backend.pid', 'pid': launch['backendPID']}, {'file': 'capture.pid', 'pid': launch['capturePID']}]
    assert cleanup['ordinaryLaunchServicesOpen'] is True and cleanup['restoredDarkAppearance'] is True
    assert lease['nativeDark'] == restored['nativeDark'] == restored['preLeaseOSDark'] == m['previous']['nativeDark'] == 'true'
    assert restored['ordinaryPID'] == 71358 and restored['ordinaryPID'] != identity['pid'] and restored['leaseID'] == lease['leaseID']
    assert all(restored[k] is True for k in ['isolatedArgumentsAbsent', 'helpersStopped', 'OSStateRestoredAfterSharedCleanup', 'leaseReleased', 'ordinaryDarkWindowObserved'])
    assert restored['portsClosed'] == {'9444': True, '9445': True, '9456': True} and restored['localPortsClosed'] == {'19444': True, '19445': True}
    initial, initial_summary, diagnostic = load('initial-native-probe/manifest.json'), load('initial-native-probe/summary.json'), load('initial-native-probe/light-diagnostic.json')
    assert initial['status'] == initial_summary['status'] == 'failed' and initial['durationMs'] == initial_summary['durationMs'] == 20330
    assert initial['capturesRequested'] == 0 and initial['captures'] == [] and len(initial['cleanup']) == 8 and all(initial['cleanup'].values())
    assert not initial.get('nativeChecks') and sha((BASE / 'initial-native-probe/driver.mjs').read_bytes()) == sha(original)
    assert diagnostic['native'][0]['osDark'] is True and diagnostic['osascriptDark'] == 'false' and diagnostic['defaultsExit'] == 1 and diagnostic['defaultsStdout'] == ''
    preflight = load('launch-preflight.json')
    assert len(preflight['attempts']) == 2 and all(a['status'] == 'refused' and a['profileCreated'] is False for a in preflight['attempts'])
    assert preflight['applicationRevision'] == APP and preflight['subsequentReadback'] == {'CortexStopped': True, 'engineAndRendererDirectoriesAbsent': True}
    assert (BASE / 'native/run.log').read_text() == 'Memory native: passed; flow-complete; /tmp/opencode/memory-native-96df66c-a2/manifest.json\n'
    assert watched == {n: sha((BASE / n).read_bytes()) for n in watched}
    result = {'status': 'passed', 'scope': 'Bounded installed Memory/Privacy off-state proof; offline evidence audit', 'applicationRevision': APP, 'asarSHA256': ASAR,
        'workflowRunID': 37139741944, 'artifactID': 11279989876, 'collectorSHA256': PINS['memory-native-corrected.mjs'],
        'manifestSHA256': sha((BASE / 'native/manifest.json').read_bytes()), 'memberCount': 90, 'isolatedPID': identity['pid'], 'windowID': 8973,
        'durationMsIncludingDriverCleanup': m['durationMs'], 'lastCaptureFinishedAfterStartMs': round((stamp(captures[-1]['finishedAt']) - start).total_seconds()*1000),
        'exactFlowAndCleanupSplitRecorded': False, 'flowBudgetMs': 120000, 'captures': 4, 'targetRows': 20, 'nativeSamples': 8,
        'stateChecks': len(states), 'pausedForgetChecks': 2, 'explicitIPCLogEntries': len(calls), 'explicitGETs': sum(c['method']=='GET' for c in calls),
        'explicitMutations': 4, 'uiSettingChangesFromPinnedSourceAndStateReadbacks': 9, 'uiSettingsPointerChanges': 1, 'uiSettingsSpaceChanges': 8,
        'uiForgetEnterAccepted': True, 'uiWritesNotInExplicitIPCLog': True, 'botMetadataPreservedUntilOwnedCleanup': True,
        'settingsRestoredTrueDocumentRetained': True, 'driverCleanupChecks': 8, 'rendererErrors': 0, 'inferenceRequests': 0, 'catalogRequests': 0,
        'originalPNGBytes': original_bytes, 'imageChecks': pixel_rows, 'sevenEnglishLabelsMatchGit': True,
        'finalRestoration': {'ordinaryPID': 71358, 'sameASAR': True, 'OSDarkRestored': True, 'isolatedArgsAbsent': True, 'closedPorts': [9444,9445,9456,19444,19445], 'helpersStopped': True, 'leaseReleased': True},
        'negativeEvidence': {'initialDurationMs': 20330, 'initialImages': 0, 'initialCleanupChecks': 8, 'originalFailingConjunctUnknown': True, 'explicitLightDiagnosticSeparate': True, 'launchRefusalsBeforeProfile': 2},
        'checksumEntriesVerified': sum_entries, 'inputFileCount': len(watched), 'inputsStableBeforeAfter': True,
        'imageDecoder': 'Pillow ' + Image.__version__, 'startedUTC': started, 'finishedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'verifierSHA256': sha(Path(__file__).read_bytes()), 'executedNativeActions': 0, 'networkRequests': 0, 'executedApplicationTests': 0,
        'acceptanceLimits': ['No restart persistence', 'No legacy migration', 'No inference/context injection', 'No preview/refusal/race proof', 'No whole-product or full-rewrite acceptance']}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'input-hashes.json').write_text(json.dumps(watched, indent=2) + '\n')
    result['inputHashReceiptSHA256'] = sha((OUT / 'input-hashes.json').read_bytes())
    (OUT / 'summary.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
