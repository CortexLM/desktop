"""Offline archive/Git admission; no build, application, tests or network execution."""
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

HELPER = Path('/tmp/opencode/mac-37c22c2-review/verify.py')
assert hashlib.sha256(HELPER.read_bytes()).hexdigest() == 'b1dc950239a29d1fbce49df67a1ba6b4dbe4d049a4c6bfc59520e0f6488c9710'
h = runpy.run_path(str(HELPER), run_name='offline_helpers')
ROOT, sha, file_sha, git, blob, load, unique, read_asar = (h[n] for n in ['ROOT', 'sha', 'file_sha', 'git', 'blob', 'load', 'unique', 'read_asar'])
OUT = Path(__file__).parent
PACKAGE = Path('/tmp/opencode/projects-mac-package-8e3fd79')
FROZEN = Path('/tmp/opencode/build-projects-production')
ORIGINAL = ROOT / 'evidence/projects-followup/production'
APP = '8e3fd795b699c8ff07357544421d00f34dc2823c'
PRIOR = '99e3d04a8dab6b51b6cf23bcdae0365624492e0f'
DIRTY_BASE = '0597848cdbdec362e1441b44c67bf74c525feefa'
EXPECTED = {
    'artifact.zip': 'a5a4e90f376c2ec5fab38c879820e8988b72681854c78cb14a10bd7e641cb147',
    'Cortex.zip': '696ab8a1cdf1915068df371bc34ad82e70f5462a70ce5415d4af73d32de5f549',
    'app.asar': '5a92b306afc07184af30404d3d04ae596554ea9800bf31e3a0e3f2fd5c74d9ad',
}
RENDER_PATHS = ['packages/app/src', 'packages/app/public', 'packages/app/index.html', 'packages/app/vite.config.ts',
    'packages/app/package.json', 'packages/i18n/src', 'packages/i18n/locales', 'packages/client/src',
    'packages/schema/src', 'package.json', 'bun.lock', 'tsconfig.json']
EXTRA_PATHS = ['electron-builder.yml', 'packages/client/package.json', 'packages/core/README.md',
    'packages/core/package.json', 'packages/core/src', 'packages/desktop/build.mjs', 'packages/desktop/package.json',
    'packages/desktop/src', 'packages/i18n/package.json', 'packages/protocol/package.json', 'packages/protocol/src',
    'packages/schema/package.json', 'packages/server/package.json', 'packages/server/src', 'skills/summarize/SKILL.md']


def save(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2) + '\n')


def tree(*paths):
    return set(git('ls-tree', '-r', '--name-only', APP, '--', *paths).decode().splitlines())


def frozen_members():
    return {p.relative_to(FROZEN).as_posix(): file_sha(p) for p in (FROZEN / 'packages').rglob('*') if p.is_file()}


def main():
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    prior_asar = Path('/tmp/opencode/mac-99e3d04/app.asar')
    prior_inputs = Path('/tmp/opencode/build-appearance-theme-final/pinned-inputs.json')
    linux_asar = ROOT / 'dist/linux-unpacked/resources/app.asar'
    watched = [*PACKAGE.iterdir(), *[FROZEN / n for n in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json', 'linux-package.json']],
        *[ORIGINAL / n for n in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json', 'linux-package.json', 'build-production.log']],
        ROOT / 'evidence/projects-followup/initial/README.md', ROOT / 'evidence/mac/99e3d04/package.json',
        prior_asar, prior_inputs, linux_asar, HELPER, Path(__file__),
        ROOT / 'vendor/cortex-sdk-0.3.5.tgz', ROOT / 'vendor/cortex-api-types-0.2.0.tgz']
    before = {str(p): file_sha(p) for p in watched}
    assert all(before[str(PACKAGE / name)] == digest for name, digest in EXPECTED.items())
    artifact, package = load(PACKAGE / 'artifact.json'), load(PACKAGE / 'package.json')
    assert artifact['workflow_run']['head_sha'] == package['applicationRevision'] == APP
    assert artifact['id'] == package['artifact'] == 11277575575
    assert artifact['workflow_run']['id'] == package['run'] == 37130209247
    assert artifact['size_in_bytes'] == (PACKAGE / 'artifact.zip').stat().st_size == 144684259
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
    assert frozen_members() == members
    assert all(sha(entries[n]) == digest for n, digest in members.items())
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
        assert archive.read(prefix + 'app.asar') == asar
        assert not any(n.startswith(prefix + 'app.asar.unpacked') for n in names)
        shipped = [n for n in names if n.startswith((prefix + 'locales/', prefix + 'skills/'))]
        assert all('/fixtures/' not in n and not n.endswith('.source.json') for n in shipped)
        files = {n[len(prefix):] for n in shipped if not n.endswith('/')}
        assert files == set(resources) and len(files) == 105
        for name, digest in resources.items():
            source = 'packages/i18n/' + name if name.startswith('locales/') else name
            assert sha(archive.read(prefix + name)) == digest == sha(blob(APP, source)), name
    catalogs = {n.removeprefix('packages/i18n/') for n in tree('packages/i18n/locales')
        if len(n.split('/')) == 5 and n.endswith('.json') and not n.endswith('.source.json')}
    assert set(resources) == catalogs | {'skills/summarize/SKILL.md'}
    locales = dict(sorted(collections.Counter(n.split('/')[1] for n in catalogs).items()))
    assert locales == {n: 13 for n in ['de', 'en', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'zh-Hans']}
    pinned, renderer = load(FROZEN / 'pinned-inputs.json'), load(FROZEN / 'renderer-inputs.json')
    assert pinned['revision'] == renderer['revision'] == APP and not pinned['dirty'] and not renderer['dirty']
    inputs, render_inputs = unique(pinned['inputs']), unique(renderer['files'])
    assert len(inputs) == 515 and len(render_inputs) == renderer['sourceFileCount'] == 473
    assert set(inputs) == tree(*RENDER_PATHS, *EXTRA_PATHS) and set(render_inputs) == tree(*RENDER_PATHS)
    assert all(sha(blob(APP, n)) == digest for n, digest in inputs.items())
    assert all(inputs[n] == digest for n, digest in render_inputs.items())
    fingerprint = sha('\n'.join(f'{n}:{digest}' for n, digest in sorted(render_inputs.items())).encode())
    assert fingerprint == renderer['sourceFingerprint'] == '6070fc3282e019c04a29f6a2a68f36f029c56e7813c4aecd84cba46f071a5bb4'
    for filename in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json']:
        original, rebound = load(ORIGINAL / filename), load(FROZEN / filename)
        assert original['revision'] == DIRTY_BASE and original['dirty'] is True
        assert rebound['revision'] == APP and rebound['dirty'] is False
        assert {k: v for k, v in original.items() if k not in ['revision', 'dirty']} == {k: v for k, v in rebound.items() if k not in ['revision', 'dirty']}
        assert (ORIGINAL / filename).read_bytes() == blob(APP, f'evidence/projects-followup/production/{filename}')
    previous = load(prior_inputs)
    old_inputs = unique(previous['inputs'])
    assert previous['revision'] == PRIOR and set(inputs) == set(old_inputs) | {'packages/core/src/project.ts'}
    assert all(sha(blob(PRIOR, n)) == digest for n, digest in old_inputs.items())
    changed = [n for n in sorted(inputs) if inputs[n] != old_inputs.get(n)]
    changed_rows = []
    for line in git('diff', '--no-ext-diff', '--numstat', PRIOR, APP, '--', *inputs).decode().splitlines():
        added, removed, path = line.split('\t')
        changed_rows.append({'path': path, 'added': int(added), 'removed': int(removed), 'beforeSHA256': old_inputs.get(path), 'afterSHA256': inputs[path]})
    assert [r['path'] for r in changed_rows] == changed
    runtime_changes = [r for r in changed_rows if '/src/' in r['path']]
    assert len(changed_rows) == 15 and len(runtime_changes) == 14
    assert [n for n in changed if '/src/' not in n] == ['packages/core/README.md']
    new_tests = ['packages/server/test/projects.test.ts', 'tests/e2e/projects.spec.ts']
    assert not set(new_tests) & set(inputs) and all(n in tree(n) for n in new_tests)
    desktop = {n for n in members if n.startswith('packages/desktop/dist/')}
    assert desktop == {f'packages/desktop/dist/{n}' for n in ['main.cjs', 'main.cjs.map', 'preload.cjs', 'preload.cjs.map']}
    old_data = prior_asar.read_bytes()
    assert sha(old_data) == load(ROOT / 'evidence/mac/99e3d04/package.json')['asarSHA256']
    old_entries, _ = read_asar(old_data)
    assert entries['package.json'] == old_entries['package.json']
    desktop_comparison = {n: entries[n] == old_entries[n] for n in sorted(desktop)}
    assert all(desktop_comparison[n] == ('/preload.' in n) for n in desktop)
    css = {n for n in members if n.endswith('.css')}
    assert len(css) == 1 and {n for n in old_entries if n.endswith('.css')} == css
    assert all(entries[n] == old_entries[n] for n in css)
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
        archive_pins.append({'path': path, 'version': version, 'sha256': expected})
    assert all(blob(APP, p) == blob(PRIOR, p) for p in ['bun.lock', 'packages/desktop/package.json'])
    maps = []
    for path in sorted(n for n in desktop if n.endswith('.map')):
        data, old = json.loads(entries[path]), json.loads(old_entries[path])
        assert len(data['sources']) == len(data['sourcesContent'])
        old_content = dict(zip(old['sources'], old['sourcesContent']))
        groups = {'workspace': [], 'sdk': [], 'api-types': [], 'synthetic': [], 'otherDependencies': 0}
        for source, content in zip(data['sources'], data['sourcesContent']):
            if source.startswith('<'):
                assert content == old_content[source]
                groups['synthetic'].append(source)
            elif '/node_modules/@cortex/sdk/' in source or '/node_modules/@cortex/api-types/' in source:
                name = 'sdk' if '/node_modules/@cortex/sdk/' in source else 'api-types'
                member = source.split(f'/node_modules/@cortex/{name}/', 1)[1]
                assert content.encode() == archives[name][member]
                groups[name].append({'path': member, 'sha256': sha(content.encode())})
            elif 'node_modules/' not in source:
                member = posixpath.normpath(posixpath.join(posixpath.dirname(path), source))
                assert content.encode() == blob(APP, member)
                groups['workspace'].append({'path': member, 'sha256': sha(content.encode())})
            else:
                assert content == old_content[source]
                groups['otherDependencies'] += 1
        maps.append({'path': path, 'sources': len(data['sources']), **groups})
    assert maps[0]['sources'] == 981 and len(maps[0]['workspace']) == 33
    assert len(maps[0]['sdk']) == len(maps[0]['api-types']) == 16 and maps[0]['otherDependencies'] == 915
    assert maps[0]['synthetic'] == ['<define:import.meta.env>'] and maps[1]['sources'] == len(maps[1]['workspace']) == 1
    index_path = next(n for n in members if n.startswith('packages/app/dist/assets/index-') and n.endswith('.js'))
    index = entries[index_path]
    production_markers = ['Minified React error #', 'bundleType:0,version:`19.3.0`,rendererPackageName:`react-dom`']
    development_markers = ['act(...) is not supported', 'actQueue', '_debugStack', '__DEV__', 'You are calling ReactDOMClient.createRoot()']
    assert all(m.encode() in index for m in production_markers) and all(m.encode() not in index for m in development_markers)
    assert len(index) == 2461373
    linux = load(FROZEN / 'linux-package.json')
    assert linux == load(ORIGINAL / 'linux-package.json') and linux['dirty'] is True and linux['baseRevision'] == DIRTY_BASE
    assert linux['asarSHA256'] == sha(asar) and linux['members'] == len(members) and linux['inputs'] == len(inputs)
    assert linux_asar.read_bytes() == asar
    assert frozen_members() == members and {str(p): file_sha(p) for p in watched} == before
    save('integrity.json', {'beforeSHA256': before, 'afterAllEqual': True, 'asarFiles': integrity, 'resources': resources,
        'zipLinks': resolved_links, 'verifierSHA256': file_sha(Path(__file__)), 'helperSHA256': file_sha(HELPER)})
    save('source-hashes.json', {'maps': maps, 'archives': archive_pins, 'rootPackageMetadata': root_package,
        'rootPackageSHA256': sha(entries['package.json']), 'changedPackageInputs': changed_rows,
        'rendererPaths': RENDER_PATHS, 'additionalPackagePaths': EXTRA_PATHS})
    summary = {'status': 'approved', 'scope': 'Offline package/source admission only; native acceptance remains pending',
        'applicationRevision': APP, 'baselineApplication': PRIOR, 'workflowRunID': artifact['workflow_run']['id'],
        'artifactID': artifact['id'], 'outerBytes': artifact['size_in_bytes'], 'archiveSHA256': EXPECTED,
        'outerCRC': 'passed', 'innerCRC': 'passed', 'innerZipEntries': len(names), 'safeFrameworkSymlinks': len(links),
        'asarFiles': len(entries), 'verifiedIntegrityBlocks': sum(r['verifiedBlocks'] for r in integrity),
        'asarContiguousPayload': True, 'asarLinks': 0, 'asarUnpackedEntries': 0, 'buildMembers': len(members),
        'completeBuildMemberSetMatches': True, 'rootPackageMatchesGit': True,
        'catalogs': len(catalogs), 'localeCounts': locales, 'skills': 1, 'extraLocaleOrSkillFiles': 0,
        'resourceFixturesOrSourceStamps': 0, 'packageInputsMatchingGit': len(inputs),
        'packageInputPathSetIndependentlyEnumerated': True, 'newPackageInput': 'packages/core/src/project.ts',
        'newTestsExcludedFromPackageInputSet': new_tests, 'rendererInputs': len(render_inputs),
        'rendererFingerprintAlgorithm': 'sha256(LF-joined sorted path:sha256, no trailing LF)', 'rendererFingerprint': fingerprint,
        'changedPackageInputs': changed_rows, 'runtimeSourceFilesChanged': len(runtime_changes),
        'runtimeLineDelta': {k: sum(r[k] for r in runtime_changes) for k in ['added', 'removed']},
        'packageDocumentationChange': 'packages/core/README.md',
        'desktopBytesIdenticalToBaseline': desktop_comparison, 'cssIdenticalToBaseline': {n: sha(entries[n]) for n in sorted(css)},
        'mainWorkspaceSourcesMatchingGit': 33, 'preloadWorkspaceSourcesMatchingGit': 1, 'sdkSources': 16, 'apiTypesSources': 16,
        'otherEmbeddedDependencySourcesUnchanged': 915, 'dependencyPinsUnchanged': True,
        'productionRenderer': {'path': index_path, 'bytes': len(index), 'sha256': sha(index),
            'presentMarkers': production_markers, 'absentDevelopmentMarkers': development_markers},
        'linuxAsarBytesIdentical': True, 'originalDirtyReceiptsPreserved': True, 'originalDirtyBase': DIRTY_BASE,
        'earlierDevelopmentBuildResult': '109/116; seven failures retained, not native acceptance',
        'inputArtifactsStableBeforeAfter': True, 'executedBuilds': 0, 'executedApplicationTests': 0,
        'nativeExecution': False, 'networkRequests': 0,
        'startedUTC': started, 'finishedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'verifier': {'path': str(Path(__file__)), 'sha256': file_sha(Path(__file__)), 'helperSHA256': file_sha(HELPER)},
        'detailReceipts': {'integrity.json': file_sha(OUT / 'integrity.json'), 'source-hashes.json': file_sha(OUT / 'source-hashes.json')}}
    save('summary.json', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
