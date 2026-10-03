"""Offline correction package admission; no builds, application tests or network."""
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
PACKAGE = Path('/tmp/opencode/projects-mac-package-f82a648')
FROZEN = Path('/tmp/opencode/build-projects-wrap')
ORIGINAL = ROOT / 'evidence/projects-followup/wrapping/final'
APP = 'f82a64800c0fffd6ebaa99e571a8af0fa4307095'
PRIOR = '8e3fd795b699c8ff07357544421d00f34dc2823c'
EXPECTED = {
    'artifact.zip': '59ce110f29a436c1f8369231975d5477b28ffa9427d65b2702d04fe2ee150141',
    'Cortex.zip': '0ee37b1a202c7b900310ea7ad1b0b67ef68d58b0709c9581398679677af9e3fa',
    'app.asar': 'a6d3c4f59d10b3d3fd16e7309441ebb6aff1dd670e11ff06a57362eca805f422',
}


def save(name, data):
    (OUT / name).write_text(json.dumps(data, indent=2) + '\n')


def frozen_members():
    return {p.relative_to(FROZEN).as_posix(): file_sha(p) for p in (FROZEN / 'packages').rglob('*') if p.is_file()}


def main():
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    prior_asar = Path('/tmp/opencode/projects-mac-package-8e3fd79/app.asar')
    prior_inputs = Path('/tmp/opencode/build-projects-production/pinned-inputs.json')
    linux_asar = ROOT / 'dist/linux-unpacked/resources/app.asar'
    watched = [*PACKAGE.iterdir(), *[FROZEN / n for n in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json', 'linux-package.json']],
        *[ORIGINAL / n for n in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json', 'linux-package.json']],
        prior_asar, prior_inputs, linux_asar, HELPER, h['HELPER'], Path(__file__),
        ROOT / 'vendor/cortex-sdk-0.3.5.tgz', ROOT / 'vendor/cortex-api-types-0.2.0.tgz']
    before = {str(p): file_sha(p) for p in watched}
    assert all(before[str(PACKAGE / n)] == digest for n, digest in EXPECTED.items())
    artifact, package = load(PACKAGE / 'artifact.json'), load(PACKAGE / 'package.json')
    assert artifact['workflow_run']['head_sha'] == package['applicationRevision'] == APP
    assert artifact['id'] == package['artifact'] == 11277523097
    assert artifact['workflow_run']['id'] == package['run'] == 37132419774
    assert artifact['size_in_bytes'] == (PACKAGE / 'artifact.zip').stat().st_size == 144684376
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
    assert frozen_members() == members and all(sha(entries[n]) == digest for n, digest in members.items())
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
        assert {n[len(prefix):] for n in shipped if not n.endswith('/')} == set(resources) and len(resources) == 105
        for name, digest in resources.items():
            source = 'packages/i18n/' + name if name.startswith('locales/') else name
            assert sha(archive.read(prefix + name)) == digest == sha(blob(APP, source)), name
    tree = lambda paths: set(git('ls-tree', '-r', '--name-only', APP, '--', *paths).decode().splitlines())
    catalogs = {n.removeprefix('packages/i18n/') for n in tree(['packages/i18n/locales'])
        if len(n.split('/')) == 5 and n.endswith('.json') and not n.endswith('.source.json')}
    assert set(resources) == catalogs | {'skills/summarize/SKILL.md'}
    locales = dict(sorted(collections.Counter(n.split('/')[1] for n in catalogs).items()))
    assert locales == {n: 13 for n in ['de', 'en', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'zh-Hans']}
    pinned, renderer = load(FROZEN / 'pinned-inputs.json'), load(FROZEN / 'renderer-inputs.json')
    inputs, render_inputs = unique(pinned['inputs']), unique(renderer['files'])
    assert pinned['revision'] == renderer['revision'] == APP and not pinned['dirty'] and not renderer['dirty']
    assert len(inputs) == 515 and len(render_inputs) == renderer['sourceFileCount'] == 473
    assert set(inputs) == tree(RENDER_PATHS + EXTRA_PATHS) and set(render_inputs) == tree(RENDER_PATHS)
    assert all(sha(blob(APP, n)) == digest for n, digest in inputs.items())
    assert all(inputs[n] == digest for n, digest in render_inputs.items())
    fingerprint = sha('\n'.join(f'{n}:{digest}' for n, digest in sorted(render_inputs.items())).encode())
    assert fingerprint == renderer['sourceFingerprint'] == '2230ff6f2deeee6b9d2b7eff21e96f152c193e15dfa824080721b3d1853d4464'
    for filename in ['members.json', 'pinned-inputs.json', 'renderer-inputs.json']:
        original, rebound = load(ORIGINAL / filename), load(FROZEN / filename)
        assert original['revision'] == PRIOR and original['dirty'] is True
        assert rebound['revision'] == APP and rebound['dirty'] is False
        assert {k: v for k, v in original.items() if k not in ['revision', 'dirty']} == {k: v for k, v in rebound.items() if k not in ['revision', 'dirty']}
        assert (ORIGINAL / filename).read_bytes() == blob(APP, f'evidence/projects-followup/wrapping/final/{filename}')
    previous = load(prior_inputs)
    old_inputs = unique(previous['inputs'])
    assert previous['revision'] == PRIOR and set(inputs) == set(old_inputs)
    assert all(sha(blob(PRIOR, n)) == digest for n, digest in old_inputs.items())
    changed = [n for n in sorted(inputs) if inputs[n] != old_inputs[n]]
    assert changed == ['packages/app/src/kit/styles.css', 'packages/app/src/screens/system/system.css']
    assert git('diff', '--no-ext-diff', '--numstat', PRIOR, APP, '--', *inputs).decode().splitlines() == ['2\t2\t' + changed[0], '2\t0\t' + changed[1]]
    old_data = prior_asar.read_bytes()
    assert sha(old_data) == '5a92b306afc07184af30404d3d04ae596554ea9800bf31e3a0e3f2fd5c74d9ad'
    old, _ = read_asar(old_data)
    assert entries['package.json'] == old['package.json']
    desktop = sorted(n for n in members if n.startswith('packages/desktop/dist/'))
    assert desktop == [f'packages/desktop/dist/{n}' for n in ['main.cjs', 'main.cjs.map', 'preload.cjs', 'preload.cjs.map']]
    assert all(entries[n] == old[n] for n in desktop)
    current_assets, prior_assets = {}, {}
    for ext in ['css', 'js']:
        current_assets[ext] = next(n for n in entries if '/assets/index-' in n and n.endswith('.' + ext))
        prior_assets[ext] = next(n for n in old if '/assets/index-' in n and n.endswith('.' + ext))
    assert set(entries) - set(old) == set(current_assets.values()) and set(old) - set(entries) == set(prior_assets.values())
    assert [n for n in sorted(set(old) & set(entries)) if old[n] != entries[n]] == ['packages/app/dist/index.html']
    assert old[prior_assets['js']] == entries[current_assets['js']]
    expected_html = old['packages/app/dist/index.html']
    for ext in ['css', 'js']:
        expected_html = expected_html.replace(Path(prior_assets[ext]).name.encode(), Path(current_assets[ext]).name.encode())
    assert entries['packages/app/dist/index.html'] == expected_html
    old_css, new_css = old[prior_assets['css']].decode(), entries[current_assets['css']].decode()
    replacements = {
        '.toast .t-body{flex:1;font-size:12px}': '.toast .t-body{overflow-wrap:anywhere;flex:1;min-width:0;font-size:12px}',
        '.card .body2{padding:10px 14px 14px}': '.card .body2{overflow-wrap:anywhere;padding:10px 14px 14px}',
    }
    additions = ['.systeme-pbody h3,.systeme-phead h1,.systeme-instr{overflow-wrap:anywhere}',
        '.systeme-preview>span:last-child{overflow-wrap:anywhere;flex:1;min-width:0}']
    reduced = new_css
    for before_rule, after_rule in replacements.items():
        assert reduced.count(after_rule) == old_css.count(before_rule) == 1
        reduced = reduced.replace(after_rule, before_rule)
    for rule in additions:
        assert reduced.count(rule) == 1
        reduced = reduced.replace(rule, '')
    assert reduced == old_css
    index = entries[current_assets['js']]
    production = ['Minified React error #', 'bundleType:0,version:`19.3.0`,rendererPackageName:`react-dom`']
    development = ['act(...) is not supported', 'actQueue', '_debugStack', '__DEV__', 'You are calling ReactDOMClient.createRoot()']
    assert len(index) == 2461373 and all(m.encode() in index for m in production) and all(m.encode() not in index for m in development)
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
    maps = []
    for path in [n for n in desktop if n.endswith('.map')]:
        data = json.loads(entries[path])
        assert len(data['sources']) == len(data['sourcesContent'])
        groups = {'workspace': [], 'sdk': 0, 'api-types': 0, 'synthetic': [], 'otherDependencies': 0}
        for source, content in zip(data['sources'], data['sourcesContent']):
            if source.startswith('<'):
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
                groups['otherDependencies'] += 1
        maps.append({'path': path, 'sources': len(data['sources']), **groups})
    assert maps[0]['sources'] == 981 and len(maps[0]['workspace']) == 33 and maps[0]['sdk'] == maps[0]['api-types'] == 16
    assert maps[0]['otherDependencies'] == 915 and maps[0]['synthetic'] == ['<define:import.meta.env>']
    assert maps[1]['sources'] == len(maps[1]['workspace']) == 1
    linux = load(FROZEN / 'linux-package.json')
    assert linux == load(ORIGINAL / 'linux-package.json') and linux['dirty'] is True and linux['production'] is True
    assert linux['asarSHA256'] == sha(asar) and linux['members'] == len(members) and linux['inputs'] == len(inputs)
    assert linux_asar.read_bytes() == asar
    assert frozen_members() == members and {str(p): file_sha(p) for p in watched} == before
    save('integrity.json', {'beforeSHA256': before, 'afterAllEqual': True, 'asarFiles': integrity, 'resources': resources, 'zipLinks': resolved_links})
    save('source-hashes.json', {'maps': maps, 'archives': archive_pins, 'rootPackageMetadata': root_package,
        'rendererPaths': RENDER_PATHS, 'additionalPackagePaths': EXTRA_PATHS,
        'changedInputs': [{'path': n, 'beforeSHA256': old_inputs[n], 'afterSHA256': inputs[n]} for n in changed]})
    summary = {'status': 'approved', 'scope': 'Offline package/source admission for installation; native verification remains separate',
        'applicationRevision': APP, 'baselineApplication': PRIOR, 'workflowRunID': artifact['workflow_run']['id'],
        'artifactID': artifact['id'], 'outerBytes': artifact['size_in_bytes'], 'archiveSHA256': EXPECTED,
        'outerCRC': 'passed', 'innerCRC': 'passed', 'innerZipEntries': len(names), 'safeFrameworkSymlinks': len(links),
        'asarFiles': len(entries), 'verifiedIntegrityBlocks': sum(r['verifiedBlocks'] for r in integrity),
        'asarContiguousPayload': True, 'asarLinks': 0, 'asarUnpackedEntries': 0, 'buildMembers': len(members),
        'completeBuildMemberSetMatches': True, 'rootPackageMatchesGit': True, 'rootPackageIdenticalToBaseline': True,
        'catalogs': len(catalogs), 'localeCounts': locales, 'skills': 1, 'extraLocaleOrSkillFiles': 0, 'resourceFixturesOrSourceStamps': 0,
        'packageInputsMatchingGit': len(inputs), 'packageInputPathSetIndependentlyEnumerated': True,
        'rendererInputs': len(render_inputs), 'rendererFingerprintAlgorithm': 'sha256(LF-joined sorted path:sha256, no trailing LF)',
        'rendererFingerprint': fingerprint, 'changedInputs': [{'path': n, 'beforeSHA256': old_inputs[n], 'afterSHA256': inputs[n],
            'added': 2, 'removed': 2 if n == changed[0] else 0} for n in changed],
        'sourceLineDelta': {'added': 4, 'removed': 2}, 'desktopMembersIdenticalToBaseline': {n: sha(entries[n]) for n in desktop},
        'mainWorkspaceSourcesMatchingGit': 33, 'preloadWorkspaceSourcesMatchingGit': 1, 'sdkSources': 16, 'apiTypesSources': 16,
        'otherEmbeddedDependencySourcesUnchanged': 915, 'dependencyPinsUnchanged': True,
        'rendererDelta': {'previousAssets': prior_assets, 'currentAssets': current_assets, 'renamedJSBytesIdentical': True,
            'htmlChangesOnlyTwoAssetReferences': True, 'otherASARMembersIdentical': 88,
            'cssBeforeBytes': len(old[prior_assets['css']]), 'cssAfterBytes': len(entries[current_assets['css']]),
            'cssSHA256': sha(entries[current_assets['css']]), 'exactCSSReplacements': replacements, 'exactCSSAdditions': additions},
        'productionRenderer': {'path': current_assets['js'], 'bytes': len(index), 'sha256': sha(index),
            'presentMarkers': production, 'absentDevelopmentMarkers': development},
        'linuxAsarBytesIdentical': True, 'originalDirtyReceiptsPreserved': True, 'originalDirtyBase': PRIOR,
        'inputArtifactsStableBeforeAfter': True, 'executedBuilds': 0, 'executedApplicationTests': 0,
        'nativeExecution': False, 'networkRequests': 0, 'earlierNegativeEvidence': '8e3fd79 archive and wrapping failures retain their original scope',
        'startedUTC': started, 'finishedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'verifier': {'path': str(Path(__file__)), 'sha256': file_sha(Path(__file__)), 'helperSHA256': file_sha(HELPER), 'asarReaderSHA256': file_sha(h['HELPER'])},
        'detailReceipts': {n: file_sha(OUT / n) for n in ['integrity.json', 'source-hashes.json']}}
    save('summary.json', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
