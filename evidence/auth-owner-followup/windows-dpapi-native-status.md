# Native Windows DPAPI verification

Current implementation uses CurrentUser DPAPI through the absolute Windows
PowerShell 5.1 host; no secret-bearing cmdlet parsing remains. Native probes ran
on the available Windows x64 machine under Node 22.20.0. No real credentials,
global logging-policy changes, signing, feed upload or backend authentication.

- Abrupt writer termination and same-file decryption: PASS, exit 0. Exact bundled
  implementation SHA-256 `8c3f524b8e5a32df056cc8f3e299526e69ac06238cbb0e20a68b92c6b253c475`.
  Initial fixture naturally exited before taskkill; changing its IPC listener to
  remain live corrected that fixture failure. The passing run used taskkill /T /F.
- Per-child module logging/transcription: PASS, exit 0; three children, six positive
  controls, twenty 4103 events, three 4104 events, three transcripts, zero synthetic
  secret matches. Plaintext/base64/decimal representations were checked privately.
  Fixture SHA-256 `4eed0d8ae8084f26373a53364b5918feb036d025187e1d12ab7e1bf366a8c3f2`.
  Raw events/transcripts stay local and are removed by the fixture; receipts expose
  only counts. This bounded check does not certify every enterprise logging product.

Full Electron abrupt-crash/restart and hosted Windows package/smoke remain pending.
Node fixture success is not substituted for those checks. Signed installer/feed
and real staging API acceptance retain their separate operator prerequisites.
