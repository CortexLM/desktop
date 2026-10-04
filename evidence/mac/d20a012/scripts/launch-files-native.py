"""Prepared only; fork of f82a648 launcher. Files names/root plus owned cleanup; identity guards retained."""
import hashlib, json, os, re, signal, socket, struct, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from http.server import BaseHTTPRequestHandler, HTTPServer

APP = Path('/Applications/Cortex.app')
ASAR = APP / 'Contents/Resources/app.asar'
BINARY = str(APP / 'Contents/MacOS/Cortex')
sha = lambda b: hashlib.sha256(b).hexdigest()

def directory(value):
    root = Path(value).resolve(strict=True)
    assert re.fullmatch(r'/(?:private/)?tmp/opencode/desktop-files-native-[\w.-]+', str(root))
    return root

def artifact(expected, revision, members):
    assert re.fullmatch('[a-f0-9]{64}', expected) and re.fullmatch('[a-f0-9]{40}', revision)
    assert not any(revision.startswith(pin) for pin in ['9ba8e59', 'd390cce', '96df66c', 'f82a648'])
    assert members['revision'] == revision and len(members['members']) >= 4
    data = ASAR.read_bytes()
    assert sha(data) == expected, 'Installed ASAR differs from supplied package'
    assert struct.unpack_from('<I', data)[0] == 4
    header_size = struct.unpack_from('<I', data, 4)[0]
    length = struct.unpack_from('<I', data, 12)[0]
    header = json.loads(data[16:16 + length]); start = 8 + header_size
    files = {}
    def walk(node, prefix=''):
        for name, child in node.get('files', {}).items():
            path = prefix + name
            if 'files' in child: walk(child, path + '/')
            elif path.startswith(('packages/app/dist/', 'packages/desktop/dist/')): files[path] = child
    walk(header)
    pins = {row['path']: row['sha256'] for row in members['members']}
    assert len(pins) == len(members['members']) and set(pins) == set(files)
    assert {'packages/desktop/dist/main.cjs', 'packages/desktop/dist/preload.cjs', 'packages/app/dist/index.html'} <= set(pins)
    for path, expected_hash in pins.items():
        entry = files[path]; assert not entry.get('unpacked') and not entry.get('link')
        offset, size = start + int(entry['offset']), int(entry['size'])
        assert size >= 0 and offset >= start and offset + size <= len(data)
        assert sha(data[offset:offset + size]) == expected_hash, path
    return {'asarSHA256': expected, 'revision': revision, 'membersVerified': len(pins)}

def inspect(root, expected, revision):
    pin_bytes = (root / 'expected-members.json').read_bytes()
    binding = json.loads((root / 'binding.json').read_text())
    assert binding == {'expectedAsar': expected, 'revision': revision, 'membersSHA256': sha(pin_bytes)}
    result = artifact(expected, revision, json.loads(pin_bytes))
    pids = [int(row.split(None, 1)[0]) for row in subprocess.check_output(['/bin/ps', '-axo', 'pid=,comm='], text=True).splitlines() if row.strip().split(None, 1)[-1] == BINARY]
    assert len(pids) == 1
    command = subprocess.check_output(['/bin/ps', 'eww', '-p', str(pids[0]), '-o', 'command='], text=True)
    def value(name):
        match = re.search(r'(?:^|\s)' + re.escape(name) + r'=(\S+)', command)
        return match.group(1) if match else ''
    assert Path(value('CORTEX_DATA_DIR')).resolve() == root / 'engine'
    assert Path(value('--user-data-dir')).resolve() == root / 'renderer'
    assert value('CORTEX_CATALOG_URL') == 'http://127.0.0.1:9456/catalog'
    assert value('CORTEX_LOCALE') == 'en' and value('--remote-debugging-port') == '9444'
    assert not value('CORTEX_RENDERER_URL') and not value('CORTEX_TEST_PROVIDER_BASEURL')
    return {**result, 'pid': pids[0], 'processCount': 1, 'isolated': True, 'root': str(root), 'inspectorSHA256': sha(Path(__file__).read_bytes()), 'membersSHA256': sha(pin_bytes)}

def capture_server(root):
    class Capture(BaseHTTPRequestHandler):
        def do_POST(self):
            if not re.fullmatch(r'/[1-9][0-9]*', self.path): return self.send_error(400)
            fd, filename = tempfile.mkstemp(suffix='.png', dir=root); os.close(fd)
            try:
                subprocess.run(['/usr/sbin/screencapture', '-x', '-o', '-l', self.path[1:], filename], check=True, timeout=10, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                image = Path(filename).read_bytes(); assert image.startswith(b'\x89PNG\r\n\x1a\n')
                self.send_response(200); self.send_header('Content-Type', 'image/png'); self.send_header('Content-Length', str(len(image))); self.end_headers(); self.wfile.write(image)
            except Exception: self.send_error(500)
            finally: Path(filename).unlink(missing_ok=True)
        def log_message(self, *_): pass
    HTTPServer(('127.0.0.1', 9445), Capture).serve_forever()

def launch(root, expected, revision, members_path):
    assert not any((root / p).exists() for p in ['engine', 'renderer', 'binding.json', 'expected-members.json', 'backend-receipt.json', 'launch.json'])
    pins = Path(members_path).read_bytes(); artifact(expected, revision, json.loads(pins))
    assert BINARY not in subprocess.check_output(['/bin/ps', '-axo', 'comm='], text=True).splitlines(), 'Coordinator must quit prior Cortex first'
    for port in [9444, 9445, 9456]:
        with socket.socket() as probe: probe.bind(('127.0.0.1', port))
    (root / 'expected-members.json').write_bytes(pins)
    (root / 'binding.json').write_text(json.dumps({'expectedAsar': expected, 'revision': revision, 'membersSHA256': sha(pins)}) + '\n')
    children = []
    try:
        with (root / 'backend.log').open('x') as log:
            backend = subprocess.Popen(['/opt/homebrew/bin/node', str(root / 'files-native-backend.mjs'), str(root)], stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        children.append(backend); (root / 'backend.pid').write_text(str(backend.pid))
        for _ in range(100):
            assert backend.poll() is None
            try:
                with urllib.request.urlopen('http://127.0.0.1:9456/health', timeout=1) as response: health = json.load(response)
                break
            except OSError: time.sleep(0.05)
        else: raise RuntimeError('Fixture readiness timed out')
        assert health['pid'] == backend.pid and Path(health['root']).resolve() == root
        with (root / 'capture.log').open('x') as log:
            capture = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--capture', str(root)], stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        children.append(capture); (root / 'capture.pid').write_text(str(capture.pid))
        env = dict(os.environ, CORTEX_DATA_DIR=str(root / 'engine'), CORTEX_LOCALE='en', CORTEX_START_HASH='#/home', CORTEX_CATALOG_URL='http://127.0.0.1:9456/catalog')
        for name in ['CORTEX_RENDERER_URL', 'CORTEX_TEST_PROVIDER_BASEURL']: env.pop(name, None)
        subprocess.run(['/usr/bin/open', '-na', str(APP), '--args', '--remote-debugging-port=9444', f'--user-data-dir={root}/renderer'], env=env, check=True)
        (root / 'launch.json').write_text(json.dumps({'backendPID': backend.pid, 'capturePID': capture.pid, 'runID': health['runID'], 'expectedAsar': expected, 'revision': revision, 'guiLaunch': True}) + '\n')
    except Exception:
        for child in children:
            if child.poll() is None: child.terminate()
        raise

def cleanup(root, revision):
    binding = json.loads((root / 'binding.json').read_text())
    assert binding['revision'] == revision and re.fullmatch('[a-f0-9]{40}', revision)
    assert sha(ASAR.read_bytes()) == binding['expectedAsar']
    subprocess.run(['/usr/bin/osascript', '-e', 'tell application "Cortex" to quit'], check=True, timeout=15)
    stopped = []
    for name, expected in [('backend.pid', 'files-native-backend.mjs'), ('capture.pid', 'launch-files-native.py --capture')]:
        pid = int((root / name).read_text())
        command = subprocess.run(['/bin/ps', '-p', str(pid), '-o', 'args='], capture_output=True, text=True).stdout
        if command:
            assert expected in command and str(root) in command
            os.kill(pid, signal.SIGTERM); stopped.append({'file': name, 'pid': pid})
    subprocess.run(['/usr/bin/osascript', '-e', 'tell application "System Events" to tell appearance preferences to set dark mode to true'], check=True, timeout=10)
    env = {key: value for key, value in os.environ.items() if not key.startswith('CORTEX_')}
    subprocess.run(['/usr/bin/open', '-na', str(APP)], env=env, check=True)
    result = {'applicationRevision': revision, 'asarSHA256': sha(ASAR.read_bytes()), 'helpersStopped': stopped, 'ordinaryLaunchServicesOpen': True, 'forcedDarkBeforePreLeaseRestoration': True}
    with (root / 'cleanup.json').open('x') as file: file.write(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))

if __name__ == '__main__':
    assert sys.platform == 'darwin', 'Run only on the coordinator-leased Mac'
    if sys.argv[1] == '--capture': capture_server(directory(sys.argv[2]))
    elif sys.argv[1] == '--inspect': print(json.dumps(inspect(directory(sys.argv[2]), sys.argv[3], sys.argv[4])))
    elif sys.argv[1] == '--cleanup': cleanup(directory(sys.argv[2]), sys.argv[3])
    else:
        assert len(sys.argv) == 5, 'Usage: launch-files-native.py <fresh-run-root> <expected-asar-sha256> <revision> <new-package-members.json>'
        launch(directory(sys.argv[1]), *sys.argv[2:])
