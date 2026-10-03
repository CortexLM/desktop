# Installed 2956564 — native terminal-state audit

**Scoped PASS; ready for integration.** Six original **960×640** native-window images inspected full-size; all six retained WebPs are **RGBA-exact**. English, light/dark, sidebar shown.

## Run and identity

| Item | Verified receipt |
| --- | --- |
| Application | `2956564fbe31f882014d74ff3a7f920e839fd634` |
| Execution | `2026-10-03T10:02:16.705Z`–`10:03:57.898Z`; **101.193 seconds** |
| Installed ASAR | `de7b30a5eedc416a1e1b35756e268fc7028f70908564e15b3ef4df9ec9c94d6e` |
| Member manifest | `96121d2c1c3c4762c0de6faca1245d41ae2dddba356dfefe988795dadcc775b7`; **90 entries** |
| Main / CoreGraphics window | PID **58393**, window **8608** throughout; foreground; bounds `{X:0,Y:30,Width:960,Height:640}` |
| Isolated root | `/private/tmp/opencode/desktop-terminal-state-2956564` |
| Executed helper | `9f6a819fcd44a26c5b61050a51e0c94c9d87a420b5b32b7a27902ebdcb110949` |
| Original manifest | `b436a093245301992d3871ad3e006c2c885284e6a87d8ba5fb92dc53ada9962e`; **50,376 bytes** |
| Original log | `3b96b40ab0190f4b7032ba52f96414424b4b196a44caacd37c6fdf1dfdaf9a13`; **114 bytes** |

[Manifest](manifest.json) and [log](run.log) retain original bytes. Actual executable, **Node v22.23.3**, arguments and cwd are recorded in the manifest and [invocation](invocation.md), rather than inferred from the runbook.
Before/after installed identities match exactly. [Installation](../installed.json), [binding](../binding.json), [launch](../launch.json) and [90-member manifest](../members.json) agree with the recorded ASAR, revision and canonical root.
All four executed helper hashes match the retained scripts, their [hash receipt](../scripts/hashes.json) and prior [source review](../harness-review.md); the runbook remains its exact preparation version.
The separate [package audit](../package-review.md) supplies **90 build files + root metadata, 105 resources, 514 inputs, 473 renderer inputs**. Its report/summary/integrity/source-hash receipt checks pass. Build-member rows equal both the package receipt and frozen local package receipt; package assets remain at their existing paths.

## Recorded behavior

- **Chat, both themes:** real empty Chat created/deleted through setup IPC; exact `Page not found` / `This link goes nowhere, or the page has moved.` Copy makes no kept-message/retry promise. Empty transcript, editable focused composer, reachable New chat. Actual New chat click reaches Home with a fresh composer. **Zero inference requests during either missing-Chat step.**
- Each deleted Chat has two direct **404/not_found** reads, plus two passive UI parser **404/not_found** observations. Four Code prompts use the real composer. The driver makes **no direct prompt call**; its 57 setup/readback/cleanup calls are retained.
- **UI admission:** four actual **202/messageID** results equal the exact stored user IDs below. The passive `Response.json` wrapper returns real IPC-backed results unchanged; direct setup uses `JSON.parse`. No fake IPC, substituted responses or injected main handler.

| Theme / turn | Actual 202 user ID |
| --- | --- |
| Light / fail | `msg_01a101374316000029d025c003edd864` |
| Light / recover | `msg_01a101377f1a00007e501398c47a337c` |
| Dark / fail | `msg_01a10137f09300007b3990f8005eb00b` |
| Dark / recover | `msg_01a101382d0a00002275e626ab23694d` |

- **Code failure:** completed `provider_auth_failed`, red Failed badge and existing task-stopped banner before/after reload. Exact failed histories and entire measured badge objects survive reload. Each failed vector has **2 messages/1 part**: `[user:text, assistant:[]]`; failed assistants contain **no step-start**.
- **Recovery:** each DOM trace is exactly **Failed, Running, Ready**. Green Ready, removed banner, both users and successful answer visible. The failed pair remains byte-equivalent within each **4-message/6-part** history: `[user:text, assistant:[], user:text, assistant:step-start/reasoning/text/step-finish]`. Across two sessions: **8 unique messages/12 unique parts**, all IDs linked correctly.
- **Reasoning:** exact `Checking <theme> recovery.` stored; Code displays the text answer `Recovered <theme> Code task.` only. No tool/file parts, permission requests or assistant replay. Recovery provider requests contain two separate user messages.
- **Fixture:** exact completed **401,200,401,200** sequence; model, placeholder authorization and working-directory checks true; tools absent. [Backend receipt](../backend-receipt.json) equals the manifest receipt, including run ID/source hash and **zero errors**.

| Theme | Failed RGBA, before = after reload | Recovered Ready RGBA |
| --- | --- | --- |
| Light | `[187,61,65,255]` | `[40,138,61,255]` |
| Dark | `[253,128,133,255]` | `[103,221,122,255]` |

These are recorded canvas-resolved computed text colors, not estimates from theme tokens. Original computed `color`/`background`, class/text and transition samples remain in [checks](checks.json) and the manifest.

## Full-size pixel review

| Capture | Reviewed result |
| --- | --- |
| [Missing Chat — light](images/missing-chat-light.webp) | Truthful complete alert, empty transcript, focused composer, native chrome |
| [Failed Code — light](images/code-failed-light.webp) | Post-reload red Failed, complete banner/first user, accessible composer |
| [Recovered Code — light](images/code-recovered-light.webp) | Green Ready, both users/full answer, failure banner removed |
| [Missing Chat — dark](images/missing-chat-dark.webp) | Same missing-link scope; readable dark alert/chrome |
| [Failed Code — dark](images/code-failed-dark.webp) | Same persisted-failure scope; red badge and banner readable |
| [Recovered Code — dark](images/code-recovered-dark.webp) | Same recovery scope; green badge and complete answer readable |

All six show native traffic lights and unobscured target copy/badges. Required text/control geometry and composer focus/editability/hit tests pass before/after capture. Code's narrow input shows a shortened placeholder; its editable bounds remain visible. Pixel review covers these window states; reasoning is verified in stored records.
Six original PNGs total **398,061 bytes**; WebPs total **124,890 bytes**. [Image map](retained.json) records original absolute paths, PNG/WebP SHA-256, dimensions and decoded RGBA SHA-256. Every RGBA byte matches, including transparent-pixel RGB. Originals remain at `/tmp/opencode/terminal-state-native-2956564/`.
[Full-size image index](index.html) links each retained image. Historical [760c4a0 deleted-Chat images](../../760c4a0/native/README.md) retain their misleading copy and original verdict. Side-by-side inspection confirms corrected alert copy in the same layout; focused-caret/navigation pixels vary between captures. The committed application delta is only the two Chat copy lines and minimal Code persisted-badge derivation described by the package/source reviews.

## Errors, cleanup and scope

**Six check groups/six captures/four UI admissions pass; no run-stage failure.** Zero page errors, console errors, renderer HTTP requests, unexpected dialogs or fixture errors. First native attempt passed as reported by the coordinator; retained log/manifest contain one successful execution.
All **six driver cleanup checks** are true: both owned Code sessions removed, fixture receipt read, provider restored/key removed, appearance restored, initial route restored. Successful DELETE-key/PATCH calls and executed sanitized-result assertions establish provider restoration.
Coordinator [cleanup](../cleanup.json) records helper PIDs **58390/58391** stopped, ordinary installed 2956564 reopened, dark appearance restored. [Port observation](../ports-closed.json), `2026-10-03T10:05:28.135519+00:00`, records **9444/9445/9456/9457/9458 closed**, SSH forwarding closed, lease released. These are retained observations. The coordinator's final whole-desktop Tips notification is external to these CoreGraphics window captures; no notification-absence claim follows.
Acceptance: installed **English, 960×640, two themes**, ordinary missing-link recovery and Code persisted failure/successful follow-up. This batch adds no menu, fullscreen or eight-locale acceptance.
Offline checks: `python3 /tmp/opencode/native-2956564-audit/verify.py`. [SHA256SUMS](SHA256SUMS) binds all retained native files; [checks](checks.json) pins referenced root receipts. Audit writes are confined to this directory and `/tmp/opencode/native-2956564-audit/`; no device, network, app/test/build/CI execution, delegation or commit.
