"""Run through mac-computer's GUI session, which has Screen Recording permission.

Loopback-only native capture helper for capture-connected.mjs. Forward port 9445
over the same SSH connection as CDP; stop this helper after collecting evidence.
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import subprocess
import tempfile


class Capture(BaseHTTPRequestHandler):
    def do_POST(self):
        wid = self.path.removeprefix("/")
        if not wid.isdigit():
            self.send_error(400)
            return
        with tempfile.TemporaryDirectory(prefix="cortex-native-") as directory:
            image = Path(directory) / "window.png"
            result = subprocess.run(["screencapture", "-o", "-x", "-l", wid, str(image)], capture_output=True)
            if result.returncode:
                self.send_error(500, "Native window capture failed")
                return
            data = image.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)


HTTPServer(("127.0.0.1", 9445), Capture).serve_forever()
