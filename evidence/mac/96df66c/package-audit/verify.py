"""Exact-revision offline package admission; no app, tests, build or network."""
import collections
import datetime
import hashlib
import io
import json
from pathlib import Path
import posixpath
import runpy
import stat
import tarfile
import zipfile

HELPER = Path('/tmp/opencode/projects-mac-package-audit/verify.py')
assert hashlib.sha256(HELPER.read_bytes()).hexdigest() == 'fd4df3995a0a2ba32bc394bec6a94655dbed01412a4e07a17d1e56cf392cc6dc'
h = runpy.run_path(str(HELPER), run_name='offline_helpers')
ROOT, sha, file_sha, git, blob, load, unique, read_asar, RENDER_PATHS, EXTRA_PATHS = (h[n] for n in ['ROOT', 'sha', 'file_sha', 'git', 'blob', 'load', 'unique', 'read_asar', 'RENDER_PATHS', 'EXTRA_PATHS'])
OUT = Path(__file__).parent
PACKAGE = Path('/tmp/opencode/memory-mac-package-96df66c')
FROZEN = Path('/tmp/opencode/build-memory-final')
ORIGINAL = ROOT / 'evidence/memory-preference-followup/final'
APP = '96df66ce727c42ddf647b2dcb4eeeff04fda4927'
PRIOR = 'f82a64800c0fffd6ebaa99e571a8af0fa4307095'
DIRTY = '74579d574646aff5dbd462247b4fd47a99dd2cdd'
EXPECTED = {
    'artifact.zip': '6136183fb69490a7a2d940fb4722c600494c5caee16bebf3c9a309b081ac7aef',
    'Cortex.zip': '5a034bc8f0a6a369a46ec1e37f0297b708f33219c5e2e7a9451bdcf8271d39a0',
    'app.asar': 'b55bda25290eaf90c821c9a79806d2aecdba5a1bb291da71f6b1abc251a16c44',
}


def save(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2) + '\n')


def files_at(root):
    return {p.relative_to(root).as_posix(): file_sha(p) for p in root.rglob('*') if p.is_file()}


def tree(paths):
    return set(git('ls-tree', '-r', '--name-only', APP, '--', *paths).decode().splitlines())


def main():
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    prior_asar = Path('/tmp/opencode/projects-mac-package-f82a648/app.asar')
    prior_pins = Path('/tmp/opencode/build-projects-wrap/pinned-inputs.json')
    linux_asar = ROOT / 'dist/linux-unpacked/resources/app.asar'
    native = Path('/tmp/opencode/memory-native.mjs')
    runbook = Path('/tmp/opencode/memory-native-runbook.md')
    watched = [*PACKAGE.iterdir(), *[FROZEN / n for n in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json', 'linux-package.json']],
        *[ORIGINAL / n for n in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json', 'linux-package.json']],
        prior_asar, prior_pins, linux_asar, native, runbook, HELPER, h['HELPER'], Path(__file__),
        ROOT / 'vendor/cortex-sdk-0.3.5.tgz', ROOT / 'vendor/cortex-api-types-0.2.0.tgz']
    before = {str(p): file_sha(p) for p in watched}
    assert all(before[str(PACKAGE / n)] == digest for n, digest in EXPECTED.items())
    artifact, package = load(PACKAGE / 'artifact.json'), load(PACKAGE / 'package.json')
    assert artifact['workflow_run']['head_sha'] == package['applicationRevision'] == APP
    assert artifact['id'] == package['artifact'] == 11279989876
    assert artifact['workflow_run']['id'] == package['run'] == 37139741944
    assert artifact['size_in_bytes'] == (PACKAGE / 'artifact.zip').stat().st_size == 144690388
    assert artifact['digest'] == 'sha256:' + EXPECTED['artifact.zip']
    assert [package[k] for k in ['outerSHA256', 'innerSHA256', 'asarSHA256']] == list(EXPECTED.values())
    inner, asar = (PACKAGE / 'Cortex.zip').read_bytes(), (PACKAGE / 'app.asar').read_bytes()
    with zipfile.ZipFile(PACKAGE / 'artifact.zip') as archive:
        assert archive.namelist() == ['Cortex-0.2.0-arm64-mac.zip'] and archive.testzip() is None
        assert archive.read(archive.namelist()[0]) == inner
    entries, integrity = read_asar(asar)
    members = unique(package['members'])
    assert len(members) == 90 and set(entries) == set(members) | {'package.json'}
    for path in [PACKAGE / 'members.json', FROZEN / 'members.json']:
        receipt = load(path)
        assert receipt['revision'] == APP and unique(receipt['members']) == members
    frozen_members = {'packages/' + n: d for n, d in files_at(FROZEN / 'packages').items()}
    assert frozen_members == members and all(sha(entries[n]) == digest for n, digest in members.items())
    root_package = json.loads(entries['package.json'])
    assert root_package == {k: v for k, v in json.loads(blob(APP, 'package.json')).items() if k not in ['scripts', 'devDependencies']}
    resources = unique(package['resources'])
    with zipfile.ZipFile(io.BytesIO(inner)) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)) and archive.testzip() is None
        assert all(n.startswith('Cortex.app/') and '..' not in n.split('/') and '\\' not in n for n in names)
        links = {i.filename: archive.read(i).decode() for i in archive.infolist() if stat.S_ISLNK(i.external_attr >> 16)}
        normalized = {n.rstrip('/') for n in names}
        resolved_links = []
        for name, target in links.items():
            assert name.startswith('Cortex.app/Contents/Frameworks/') and not target.startswith('/')
            resolved = posixpath.normpath(posixpath.join(posixpath.dirname(name), target))
            for _ in range(len(links) + 1):
                assert resolved.startswith('Cortex.app/Contents/Frameworks/')
                match = next((link for link in links if resolved == link or resolved.startswith(link + '/')), None)
                if match is None:
                    break
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(match), links[match]) + resolved[len(match):])
            else:
                raise AssertionError('ZIP link cycle')
            assert resolved in normalized
            resolved_links.append({'path': name, 'target': target, 'resolved': resolved})
        prefix = 'Cortex.app/Contents/Resources/'
        assert archive.read(prefix + 'app.asar') == asar and not any(n.startswith(prefix + 'app.asar.unpacked') for n in names)
        shipped = [n for n in names if n.startswith((prefix + 'locales/', prefix + 'skills/'))]
        assert all('/fixtures/' not in n and not n.endswith('.source.json') for n in shipped)
        assert {n[len(prefix):] for n in shipped if not n.endswith('/')} == set(resources) and len(resources) == 105
        for name, digest in resources.items():
            source = 'packages/i18n/' + name if name.startswith('locales/') else name
            assert sha(archive.read(prefix + name)) == digest == sha(blob(APP, source)), name
    catalogs = {n.removeprefix('packages/i18n/') for n in tree(['packages/i18n/locales'])
        if len(n.split('/')) == 5 and n.endswith('.json') and not n.endswith('.source.json')}
    assert set(resources) == catalogs | {'skills/summarize/SKILL.md'}
    locales = dict(sorted(collections.Counter(n.split('/')[1] for n in catalogs).items()))
    assert locales == {n: 13 for n in ['de', 'en', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'zh-Hans']}
    pinned, renderer = load(FROZEN / 'pinned-inputs.json'), load(FROZEN / 'renderer-inputs.json')
    inputs, render_inputs = unique(pinned['inputs']), unique(renderer['files'])
    assert pinned['revision'] == renderer['revision'] == APP and not pinned['dirty'] and not renderer['dirty']
    assert len(inputs) == 516 and len(render_inputs) == renderer['sourceFileCount'] == 474
    assert set(inputs) == tree(RENDER_PATHS + EXTRA_PATHS) and set(render_inputs) == tree(RENDER_PATHS)
    assert all(sha(blob(APP, n)) == digest for n, digest in inputs.items())
    assert files_at(FROZEN / 'source') == inputs and all(inputs[n] == digest for n, digest in render_inputs.items())
    fingerprint = sha('\n'.join(f'{n}:{digest}' for n, digest in sorted(render_inputs.items())).encode())
    assert fingerprint == renderer['sourceFingerprint'] == '64a314be9950c61466f8beec1b1ef50aa7f5b60a7f67d67bc3deff805a5800ef'
    for filename in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json']:
        original, rebound = load(ORIGINAL / filename), load(FROZEN / filename)
        assert original['revision'] == DIRTY and original['dirty'] is True
        assert rebound['revision'] == APP and rebound['dirty'] is False
        assert {k: v for k, v in original.items() if k not in ['revision', 'dirty']} == {k: v for k, v in rebound.items() if k not in ['revision', 'dirty']}
        assert (ORIGINAL / filename).read_bytes() == blob(APP, f'evidence/memory-preference-followup/final/{filename}')
    previous = load(prior_pins)
    old_inputs = unique(previous['inputs'])
    assert previous['revision'] == PRIOR and set(inputs) == set(old_inputs) | {'packages/app/src/state/runtime-settings.ts'}
    assert all(sha(blob(PRIOR, n)) == digest for n, digest in old_inputs.items())
    changed = [n for n in sorted(inputs) if inputs[n] != old_inputs.get(n)]
    changed_rows = []
    for line in git('diff', '--no-ext-diff', '--numstat', PRIOR, APP, '--', *inputs).decode().splitlines():
        added, removed, n = line.split('\t')
        changed_rows.append({'path': n, 'added': int(added), 'removed': int(removed), 'beforeSHA256': old_inputs.get(n), 'afterSHA256': inputs[n]})
    assert [r['path'] for r in changed_rows] == changed and len(changed_rows) == 31
    runtime = [r for r in changed_rows if '/src/' in r['path']]
    catalog_changes = [n for n in changed if n.startswith('packages/i18n/locales/')]
    assert len(runtime) == 14 and len(catalog_changes) == 16 and 'packages/core/README.md' in changed
    added_keys = {}
    for n in catalog_changes:
        old_catalog, catalog = json.loads(blob(PRIOR, n)), json.loads(blob(APP, n))
        assert all(catalog[k] == v for k, v in old_catalog.items())
        added_keys[n] = sorted(set(catalog) - set(old_catalog))
        assert len(added_keys[n]) == (1 if n.endswith('/bots.json') else 6)
    assert sum(map(len, added_keys.values())) == 56
    source_css = [n for n in inputs if n.endswith('.css')]
    assert len(source_css) == 8 and all(inputs[n] == old_inputs[n] for n in source_css)
    old_data = prior_asar.read_bytes()
    assert sha(old_data) == 'a6d3c4f59d10b3d3fd16e7309441ebb6aff1dd670e11ff06a57362eca805f422'
    old, _ = read_asar(old_data)
    assert entries['package.json'] == old['package.json']
    desktop = sorted(n for n in members if n.startswith('packages/desktop/dist/'))
    assert desktop == [f'packages/desktop/dist/{n}' for n in ['main.cjs', 'main.cjs.map', 'preload.cjs', 'preload.cjs.map']]
    desktop_identical = {n: entries[n] == old[n] for n in desktop}
    assert all(desktop_identical[n] == ('/preload.' in n) for n in desktop)
    css = {n for n in entries if n.endswith('.css')}
    assert css == {n for n in old if n.endswith('.css')} and len(css) == 1 and all(entries[n] == old[n] for n in css)
    archives, archive_pins = {}, []
    for name, filename, version, expected in [
        ('sdk', 'cortex-sdk-0.3.5.tgz', '0.3.5', '5c75f212a2669bcd6f5110fe6e5c8862e1ca6eba85a118b350e0ce38694596b8'),
        ('api-types', 'cortex-api-types-0.2.0.tgz', '0.2.0', '3e7359d204246a011706c1f3d6b959dbd2ad6b8512011acdc509316db8802877'),
    ]:
        path = 'vendor/' + filename
        data = (ROOT / path).read_bytes()
        assert sha(data) == expected and data == blob(APP, path) == blob(PRIOR, path)
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
            files = [m for m in archive.getmembers() if m.isfile()]
            archives[name] = {m.name.removeprefix('package/'): archive.extractfile(m).read() for m in files}
            assert len(archives[name]) == len(files)
        assert json.loads(archives[name]['package.json'])['version'] == version
        archive_pins.append({'path': path, 'sha256': expected})
    assert all(blob(APP, n) == blob(PRIOR, n) for n in ['bun.lock', 'packages/desktop/package.json'])
    maps = []
    for path in [n for n in desktop if n.endswith('.map')]:
        data, old_map = json.loads(entries[path]), json.loads(old[path])
        assert len(data['sources']) == len(data['sourcesContent'])
        old_content = dict(zip(old_map['sources'], old_map['sourcesContent']))
        groups = {'workspace': [], 'sdk': 0, 'api-types': 0, 'synthetic': [], 'otherDependencies': 0}
        for source, content in zip(data['sources'], data['sourcesContent']):
            if source.startswith('<'):
                assert content == old_content[source]
                groups['synthetic'].append(source)
            elif '/node_modules/@cortex/sdk/' in source or '/node_modules/@cortex/api-types/' in source:
                name = 'sdk' if '/node_modules/@cortex/sdk/' in source else 'api-types'
                member = source.split(f'/node_modules/@cortex/{name}/', 1)[1]
                assert content.encode() == archives[name][member]
                groups[name] += 1
            elif 'node_modules/' not in source:
                member = posixpath.normpath(posixpath.join(posixpath.dirname(path), source))
                assert content.encode() == blob(APP, member)
                groups['workspace'].append({'path': member, 'sha256': sha(content.encode())})
            else:
                assert content == old_content[source]
                groups['otherDependencies'] += 1
        maps.append({'path': path, 'sources': len(data['sources']), **groups})
    assert maps[0]['sources'] == 981 and len(maps[0]['workspace']) == 33 and maps[0]['sdk'] == maps[0]['api-types'] == 16
    assert maps[0]['otherDependencies'] == 915 and maps[0]['synthetic'] == ['<define:import.meta.env>'] and maps[1]['sources'] == len(maps[1]['workspace']) == 1
    index_path = next(n for n in entries if '/assets/index-' in n and n.endswith('.js'))
    index = entries[index_path]
    production = ['Minified React error #', 'bundleType:0,version:`19.3.0`,rendererPackageName:`react-dom`']
    development = ['act(...) is not supported', 'actQueue', '_debugStack', '__DEV__', 'You are calling ReactDOMClient.createRoot()']
    assert len(index) == 2473064 and all(m.encode() in index for m in production) and all(m.encode() not in index for m in development)
    hook = 'packages/app/src/state/runtime-settings.ts'
    assert inputs[hook] == 'a441e7e520e803c49f1fb5a5755c8e2cb0efed9dcdb4f30ce284a789f44e8c00'
    assert file_sha(native) == '370b06ee1628b3e88e17104562da077b22f70da859947baa4990dd555ee44aa9'
    assert file_sha(runbook) == '4ebb970222711434366b8867a87fc387bcaf66b9da0860a232676e15fe0b31d6'
    en = json.loads(blob(APP, 'packages/i18n/locales/en/system.json'))
    labels = {k: en[k] for k in ['memory.toggle', 'settings.t.privacy.memory', 'memory.offTitle', 'memory.liveOffText', 'memory.livePausedText', 'settings.t.privacy.memoryLiveDesc', 'memory.forget']}
    assert all(value in native.read_text() for value in labels.values())
    linux = load(FROZEN / 'linux-package.json')
    assert linux == load(ORIGINAL / 'linux-package.json') and linux['dirty'] is True and linux['production'] is True and linux['revision'] == DIRTY
    assert linux['asarSHA256'] == sha(asar) and linux['members'] == len(members) and linux['packageInputs'] == len(inputs) and linux['renderer'] == fingerprint
    assert linux_asar.read_bytes() == asar
    assert {'packages/' + n: d for n, d in files_at(FROZEN / 'packages').items()} == members and files_at(FROZEN / 'source') == inputs
    assert {str(p): file_sha(p) for p in watched} == before
    save('integrity.json', {'beforeSHA256': before, 'afterAllEqual': True, 'asarFiles': integrity, 'resources': resources, 'zipLinks': resolved_links})
    save('source-hashes.json', {'maps': maps, 'archives': archive_pins, 'rootPackageMetadata': root_package,
        'rendererPaths': RENDER_PATHS, 'additionalPackagePaths': EXTRA_PATHS, 'changedInputs': changed_rows, 'addedCatalogKeys': added_keys,
        'sourceCSSUnchanged': {n: inputs[n] for n in source_css}, 'nativeLabels': labels})
    summary = {'status': 'approved', 'scope': 'Offline exact-package/source admission for installation; native verification remains separate',
        'applicationRevision': APP, 'baselineApplication': PRIOR, 'workflowRunID': artifact['workflow_run']['id'], 'artifactID': artifact['id'],
        'outerBytes': artifact['size_in_bytes'], 'archiveSHA256': EXPECTED, 'outerCRC': 'passed', 'innerCRC': 'passed',
        'innerZipEntries': len(names), 'safeFrameworkSymlinks': len(links), 'asarFiles': len(entries),
        'verifiedIntegrityBlocks': sum(r['verifiedBlocks'] for r in integrity), 'asarContiguousPayload': True, 'asarLinks': 0, 'asarUnpackedEntries': 0,
        'buildMembers': len(members), 'completeBuildMemberSetMatches': True, 'rootPackageMatchesGit': True, 'rootPackageIdenticalToBaseline': True,
        'catalogs': len(catalogs), 'localeCounts': locales, 'skills': 1, 'extraLocaleOrSkillFiles': 0, 'resourceFixturesOrSourceStamps': 0,
        'packageInputsMatchingGit': len(inputs), 'frozenSourceFilesMatchingGit': len(inputs), 'packageInputPathSetIndependentlyEnumerated': True,
        'rendererInputs': len(render_inputs), 'rendererFingerprintAlgorithm': 'sha256(LF-joined sorted path:sha256, no trailing LF)', 'rendererFingerprint': fingerprint,
        'changedInputs': changed_rows, 'newPackageInput': hook, 'runtimeSourceFilesChanged': len(runtime),
        'runtimeLineDelta': {k: sum(r[k] for r in runtime) for k in ['added', 'removed']}, 'catalogFilesChanged': 16, 'catalogKeysAdded': 56,
        'existingCatalogValuesUnchanged': True, 'packageDocumentationChange': 'packages/core/README.md', 'sourceCSSFilesUnchanged': len(source_css),
        'compiledCSSIdenticalToBaseline': {n: sha(entries[n]) for n in sorted(css)}, 'desktopBytesIdenticalToBaseline': desktop_identical,
        'mainWorkspaceSourcesMatchingGit': 33, 'preloadWorkspaceSourcesMatchingGit': 1, 'sdkSources': 16, 'apiTypesSources': 16,
        'otherEmbeddedDependencySourcesUnchanged': 915, 'dependencyPinsUnchanged': True,
        'productionRenderer': {'path': index_path, 'bytes': len(index), 'sha256': sha(index), 'presentMarkers': production, 'absentDevelopmentMarkers': development},
        'nativePreparation': {'driverSHA256': file_sha(native), 'runbookSHA256': file_sha(runbook), 'finalHookSHA256': inputs[hook],
            'sevenEnglishLabelsMatch': True, 'scope': 'Previously approved source preparation remains applicable; no collector execution'},
        'linuxAsarBytesIdentical': True, 'originalDirtyReceiptsPreserved': True, 'originalDirtyBase': DIRTY, 'inputArtifactsStableBeforeAfter': True,
        'executedBuilds': 0, 'executedApplicationTests': 0, 'nativeExecution': False, 'networkRequests': 0,
        'startedUTC': started, 'finishedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'verifier': {'path': str(Path(__file__)), 'sha256': file_sha(Path(__file__)), 'helperSHA256': file_sha(HELPER), 'asarReaderSHA256': file_sha(h['HELPER'])},
        'detailReceipts': {n: file_sha(OUT / n) for n in ['integrity.json', 'source-hashes.json']}}
    save('summary.json', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
