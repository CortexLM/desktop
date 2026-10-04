# Saved Files — independent offline native composite audit

**Bounded composite ACCEPTED:** four passing installed-native views plus a separately attributed
manual original-byte delivery supplement. **Main collector remains FAILED.** No whole-flow green result.
Only supplied source/receipts/images inspected; no app, collector, device, network, CI, build or test execution.

## Exact identity
Application **`d20a012fbb774aa9b348fe1913f85d3476430098`**, CI **37153526225**, artifact **11284474514**.
ASAR **`9eeffe464327d09642b8f7ac27facbbf7d54f3c776d3d507e19083b92c11c893`** matches package admission,
installation and before/after isolated-process receipts. Prior package audit admits **520 inputs / 90 members**;
this review verifies those receipt bindings, not a second deep archive audit.
Collector **`e97be3e31f4e60975ce0d78009b284f7834084f31915079136abdb0fc1c15334`** matches current/archived bytes.
Launcher **`7d4fdba05afe52d09a79e7775f2f1e0c234ab12ec28cda42e45be0474eae339b`**;
backend **`5c8239ef27f8d962b4a1cd5fcfb08e34c8ba4f3871f5242fe1043f73ef90476d`**. Helper pins match runtime receipts.
Installed owner **PID78150 / CoreGraphics9114**, isolated fresh a2 root; Launch Services entry and CDP PID checks
bind source to the native window. Capture helper uses `screencapture -l`, never a page screenshot.
[Source readback](source-readback.json), [package admission](../package-review.json), [input hashes](inputs.jsonl).

## Individually passing native evidence
Four originals independently hash-checked, decoded and compared byte-for-byte in RGBA to their lossless WebPs;
all four inspected full-size. Actual **System light/dark, 960×640, sidebar shown**, traffic lights visible.
**20 geometry targets / 40 pre-post samples / eight native foreground/PID/window/OS samples** agree.
Before/after boxes are identical; filename, toolbar, image region, metadata and Download stay reachable.
Exact saved Chat Open uses Enter in light, pointer in dark, with the provider disabled before each opening.
PNG **120×180 / 393 bytes**, red-blue-red bands; Fit and **150% of Fit**, Tab/Space/+ and ArrowDown exercised.
Both pan records move **(0,0) to (0,−40)**; minimap ratio **2/3**. Image clipping at zoom is intentional;
the focus outline, minimap, filename and metadata remain visible. No new visual blocker in these four states.
One controlled local image turn; **31 explicit collector IPC calls**, zero recorded renderer/backend errors.
These calls are not an inventory of every renderer IPC operation. Backend receipt matches exact fixture/body/model.
[Light Fit](../native/files-fit-light.webp), [light zoom](../native/files-zoom-light.webp),
[dark Fit](../native/files-fit-dark.webp), [dark zoom](../native/files-zoom-dark.webp), [original bindings](originals.json).

## Filename classification and retained negatives
Initial a1 remains **failed**, zero captures, **17.017s flow / 20.655s total**, nine cleanup flags true.
Its Range top63 exceeds own clip top64. Separate diagnostic remains **observed**, **36.883s / 40.280s**,
two native captures/four samples/ten cleanup flags true. Overflow:auto/visible originals are byte-identical:
**`f1152f2820297bf2d0764fbbc0687e39bd063f5e7da0eee55f68209506aeba8f`**; a2 light Fit is also byte-identical.
Four diagnostic samples preserve all 265 layout nodes, text/font/coordinates/scroll/DPR; original style restored.
Padded filename crop `[383,58,551,86]` is exact across diagnostic/light Fit/light zoom; dark Fit/zoom crops also agree.
Complete filename glyphs are visible in both themes. Nominal `visible:false` survives in all eight a2 filename
samples with explicit `measuredFilenameLeading:true`; other containment/hit predicates remain enforced.
Final source differs from reviewed pixel-bound candidate solely by CSS `letterSpacing` `'0px'` to `'normal'`.
This is the observed CSS value, not the Canvas value. No general text/long-name exemption follows.
Earlier Save diagnostic remains failed for its missing-Go-button cancellation assumption; manual Cancel recovery stays separate.
[Pixel review](../scripts/pixel-bound/pixel-review.md), [crop hashes](filename-crops.json), [historical manifests](inputs.jsonl).

## Main failure and manual supplement
a2 **FAILED at `dark:original-download`**, **74.407s flow / 79.048s total**. AppleScript `entire contents of panel`
throws **−1700** before filename/path/Save interaction; cancellation fails identically. Raw stdout/stderr hashes checked.
All four captures preceded this failure; ten other collector cleanup flags pass. `ownedDownloadRemoved:true`
meant **no file existed yet** (`removed:false`), not that the pending native download was canceled.
Post-download **history, session and disabled-provider equality assertions were UNREACHED**; `flow-complete` was unreached.
No end-to-end read-only-history/provider guarantee is credited from earlier source, diagnosis or CI.
Coordinator then completed the already-dispatched Save through guarded native GUI in the same PID/fresh destination.
Retained receipt bytes independently equal the original fixture: **393 bytes**, exact PNG framing/CRCs,
**120×180 RGB8**, every red-blue-red pixel row, original `tEXt` metadata and filename `Cortex native portrait.png`.
SHA-256 **`35d49e647469369311f7f223d9e340034f77a96cceee1f27f5ebff8bbe3174cf`**.
Path/device/inode agree across download and removal receipts. Source Chat deletion preceded this later file readback;
the supplement demonstrates survival of an already-dispatched download, not secure erasure or revocation.
**Manual scope:** filesystem bytes verified; GUI sequence is coordinator-attested. No durable Save-dialog image,
URL/DownloadItem provenance trace or independently replayable GUI sequence is archived. No automated Save/cancel pass inferred.
[Main failure](../native/manifest.json), [manual receipt](../manual-download/receipt.json), [removal](../manual-download/cleanup.json).

## Restoration and scope
Later launcher receipt verifies owned exit in **345ms**, stops helpers **78145/78147**, reopens ordinary Cortex.
Final coordinator receipt: ordinary **PID78497**, exact ASAR, foreground, native dark string **`"true"`** matching pre-lease;
**9444/9445/9456 and 19444/19445 closed**, tunnel stopped, lease **released**. These are bounded archived observations.
Manual deletion reports matching inode2407198/device16777244, exact-byte file removed/absent; regular/single-link
guard is coordinator-attested, not raw stat evidence in this receipt. Prior Activity backup/profile remains retained.
Acceptance covers these English PNG views, manual byte supplement and documented restoration. Other formats,
restart/races/locales/long filenames, automated Save recovery, final history immutability and full-product delivery remain unestablished here.
Offline check: `python3 evidence/mac/d20a012/native-audit/verify.py`; [derived results](results.json), [checksums](SHA256SUMS).
