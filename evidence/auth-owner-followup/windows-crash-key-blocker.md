# Windows first-profile encryption durability blocker

Source `77ae04eb5cd3da12d1e701468303add6fb970957`, CI `37211430076` fails
Windows restart tests; Linux, macOS and static/unit jobs pass. Windows packaging
and smoke remain unreached. No test skip or timeout change is accepted.

The dark test's before-crash receipt shows identical userData/sessionData paths,
encryption available, but no `Local State` file and no persisted wrapped key.
After restart, that profile has a wrapped key while credential-file SHA-256 remains
`4dd89e82b7dcee1bdaeb8f59519a3df972cd21938e5cedba8916c90e2f108328`.
Earlier stderr evidence at `86b253d` reports native safeStorage decryption failure
before window creation. Hash receipts alone do not contain that error.

Installed Electron is 44.5.1, Chromium 152.0.7977.130. Independent source inspection
found Windows key generation updates an in-memory Local State preference without
an acknowledged disk commit before encryption becomes available. Async encryption
uses that same preference; session.flushStorageData flushes a StoragePartition,
not browser-process Local State. Normal shutdown commits Local State. Neither
API establishes the required crash durability barrier.

Pinned DPAPI source:
https://chromium.googlesource.com/chromium/src/+/152.0.7977.130/components/os_crypt/async/browser/dpapi_key_provider.cc

No product workaround was applied. Plaintext fallback, deleting ciphertext,
delaying the test, replacing abrupt termination with graceful shutdown and ignoring
decryption failure would not fix the admitted durability contract. Resolution needs
a verified runtime correction acknowledging key persistence before use, or a
separately designed durable credential backend. Existing ciphertext is preserved.
This desktop blocker does not block coordinator-owned backend/web delivery.

## Bounded successor and native-option investigation

At the 2026-10-04 investigation, npm latest/44-x-y still resolve to 44.5.1.
Available 45.0.0-alpha.14, commit `07f64ae42bdcaac1d40af3b891acc3b706221399`,
retains the same unacknowledged Local State key initialization and shutdown commit.
Async API removal/change is not a durability fix. No upgrade is justified by this
evidence; this is a bounded source search, not a claim about every future release.

Sources:
- https://registry.npmjs.org/-/package/electron/dist-tags
- https://github.com/electron/electron/blob/07f64ae42bdcaac1d40af3b891acc3b706221399/patches/chromium/revert_oscrypt_remove_sync_backend.patch
- https://chromium.googlesource.com/chromium/src/+/156.0.8077.0/components/os_crypt/async/browser/dpapi_key_provider.cc

Native alternative: direct Windows DPAPI CurrentUser encryption avoids Chromium's
per-profile key. Windows PowerShell/.NET exposes ProtectedData without a native
addon, but introduces a process boundary and enterprise-policy dependency. A
compiled helper avoids that dependency but adds build/signing/packaging obligations.
Credential Manager's 2,560-byte blob ceiling makes it a poorer fit for potentially
larger MCP configuration. The API bridge choice has been explicitly raised before
implementation. Neither proposed backend has Windows crash acceptance yet.

Any migration must retain old ciphertext on decrypt/protect/write failure, avoid
plaintext files/arguments/logs, preserve user ownership/ACLs, and atomically replace
only after successful protection and durable write. Lost legacy keys cannot be
recovered by switching encryption backends; do not claim otherwise.

## Bridge compatibility investigation (no implementation)

The candidate is Windows PowerShell 5.1 (`powershell.exe`) with .NET Framework's
`System.Security.Cryptography.ProtectedData`, not optional PowerShell 7 (`pwsh.exe`).
For a native x64 process the standard system-host location is
`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`; the `v1.0` directory
name does not attest the running PowerShell version. Actual device version, absolute
executable identity/access and language mode still require readback. No PATH search
or executable downloaded at runtime is proposed. No administrator elevation is
required for CurrentUser protection; the logged-on user profile must be loaded.

Enterprise application control/constrained language may prohibit this bridge or
its .NET calls. A denied host/API must fail closed, retaining the old store; no
execution-policy bypass, machine-scope fallback or plaintext storage is acceptable.
Use no profile, noninteractive execution and bounded stdin/stdout if approved;
secret bytes must not appear in arguments, environment, stderr or transcripts.
This is a proposed compatibility contract, not verified Windows execution.

Microsoft host distinction:
https://learn.microsoft.com/en-us/powershell/scripting/windows-powershell/starting-windows-powershell
CurrentUser API/profile requirement:
https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata.protect

### Actual Windows capability readback

Authorized read-only machine-tool probe on 2026-10-04 exited 0:
Windows PowerShell `5.1.26100.33451`, Desktop edition, x64 process,
`FullLanguage`, CLR `4.0.30319.42000`, execution policy `RemoteSigned`.
`C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` exists and the
no-profile/noninteractive host executed successfully. No policy changes, elevation
requests, credential reads, encryption calls or backend implementation occurred.
This establishes host access on that machine/session only, not another user's
policy, a DPAPI crash regression, installer trust or staging connectivity.
