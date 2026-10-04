# Installed transcript and Bot ownership checks — prepared, unexecuted

Scripts: `live-state-native.mjs`, `live-state-native-backend.mjs`,
`launch-live-state-native.py` beside this file. Syntax checks only completed:
Node 22 `--check` for both JavaScript files; Python `compile()` without execution
or bytecode. No Mac/SSH, test, build, CI or repository writes performed.
Initial Chat-only helpers/runbook are preserved byte-for-byte with SHA-256 hashes
under `/tmp/opencode/live-state-native-initial/`. They were syntax-checked only;
neither the original nor extended preparation is runtime proof.

## Preconditions

1. Wait for the coordinator-selected revision containing **both** the transcript
   fix and Bot route-ownership fix to pass CI and produce its package. Install its
   matching arm64 app at `/Applications/Cortex.app`. Supply the package's actual
   ASAR SHA-256, full application revision and frozen member manifest; no pin is
   hardcoded here. The manifest is JSON `{ "revision": "<40 hex>", "members":
   [{ "path": "packages/app/dist/…", "sha256": "<64 hex>" }, …] }`, covering the
   complete app/desktop dist set inside **that Mac ASAR**. Expected count is the
   manifest's count, not an assumed historical 90. A Linux main bundle hash is not
   an acceptable substitute for a differing Mac package member.
2. Acquire the Mac lease, inspect its screen, quit prior Cortex through the GUI.
   Ports 9444, 9445, 9456 must be free; stale helper owners must be identified before
   stopping them. Fresh root must match `/tmp/opencode/desktop-live-state-…`.
   No existing `engine`, `renderer`, binding or receipt is permitted there.
3. Mac tools: `/opt/homebrew/bin/node` (22+), `/usr/bin/python3`, Swift, AppleScript,
   screen-capture/Accessibility permissions. Local checkout has Playwright installed.
   SSH alias `mac-live` and unused local tunnel ports 19444/19445 are required.

## Future commands — coordinator executes

Substitute exact values before running. `REVISION` names the fixed application
revision, not a later documentary commit. `MEMBERS` is the frozen Mac-package JSON.

```sh
REVISION='<40-hex-fixed-application-revision>'
ASAR_SHA256='<64-hex-installed-app.asar-sha256>'
MEMBERS='/absolute/path/to/new-mac-package-members.json'
RUN_ROOT="/tmp/opencode/desktop-live-state-${REVISION}"
OUTPUT="/tmp/opencode/live-state-native-${REVISION}"
LEASE_ID='<coordinator-session-id>'
ssh mac-live mac-lease acquire "$LEASE_ID"
```

After the required screenshot/GUI quit and artifact installation, stage only the
new helpers and supplied pins. If this directory already exists, select a new
suffix rather than reuse its engine/profile.

```sh
ssh mac-live "mkdir '$RUN_ROOT'"
scp /tmp/opencode/live-state-native-backend.mjs /tmp/opencode/launch-live-state-native.py "mac-live:$RUN_ROOT/"
scp "$MEMBERS" "mac-live:$RUN_ROOT/package-members-input.json"
```

In the Mac's authorized GUI terminal/session, set the same `RUN_ROOT`,
`ASAR_SHA256`, `REVISION` values, then launch. This also gives the child capture
helper the established Screen Recording context:

```sh
/usr/bin/python3 "$RUN_ROOT/launch-live-state-native.py" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$RUN_ROOT/package-members-input.json"
```

The launcher verifies the ASAR and every manifest member without extracting or
rewriting the package, starts the owned loopback backend/capture helper, then uses
`open -na /Applications/Cortex.app --args …` in the GUI session. Environment:
`CORTEX_DATA_DIR=<root>/engine`, isolated `--user-data-dir=<root>/renderer`,
`CORTEX_LOCALE=en`, `CORTEX_START_HASH=#/home`,
`CORTEX_CATALOG_URL=http://127.0.0.1:9456/catalog`. Renderer override and
`CORTEX_TEST_PROVIDER_BASEURL` are removed. Packaged provider configuration uses
the actual `/api/providers/fake` PATCH and write-only key PUT.

In a separate local terminal, keep this foreground tunnel open:

```sh
ssh -N -o ExitOnForwardFailure=yes -L 19444:127.0.0.1:9444 -L 19445:127.0.0.1:9445 mac-live
```

From the checkout with installed Playwright dependencies:

```sh
/root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  /tmp/opencode/live-state-native.mjs "$OUTPUT" "$RUN_ROOT" \
  "$ASAR_SHA256" "$REVISION" "$MEMBERS"
```

## Assertions/captures

- Installed ASAR/member hashes, exact isolated engine/profile, English locale,
  sole installed main PID and its CDP browser PID are checked. AppleScript sets
  native appearance/window size; CoreGraphics verifies foreground window/PID and
  960×640 bounds. No unsupported CDP `Browser.getWindow*` call is used.
- Both themes use a fresh real local Chat, two real composer submissions, the
  only catalog model `fake/reasoner`, and the explicit dummy key
  `sk-test-live-state`. The thinking switch is checked through UI.
- Chat prompts are deliberately short, unique fixture sentinels:
  `Cortex native <light|dark> <older|newer>.`; responses/reasoning similarly encode
   theme and turn. Fixture rejects unexpected ordering, an eleventh inference request,
  wrong model/key/user history and incorrect older assistant replay. Compatible
  providers have no enabling reasoning request field; the receipt explicitly
  records absent option fields and `reasoning_content` then `content` output.
- Exact four-message engine snapshot, unique message/part IDs, complete user,
  assistant and reasoning text are checked. Each reasoning panel is opened and
  measured, then collapsed using its UI control so the entire two-turn transcript
  fits one native minimum-window capture. The compact capture preserves both
  reasoning summaries; full reasoning strings remain in the verified engine
  snapshot/receipt. No CSS or zoom is changed.
- Renderer reload and actual Home/Back navigation must preserve exact engine
  history and rendered text. Composer focus, fonts, finite animations, control
  hit target and viewport/actual clipping ancestors settle before capture.
- Real bridge DELETE occurs while mounted. A DOM observer requires the six
  message/reasoning nodes to clear without restoration. Messages GET returns 404;
  reload must retain empty transcript and show a real error surface. No exact
  English not-found copy is assumed. Deletion capture includes native chrome.

### Bot ownership extension

After the four Chat requests/captures, each theme creates real Alpha/Beta Bots
through the existing API with `fake/reasoner`. Bot creation uses normal schema
defaults; no invented `agent` field. Alpha starts with no session. Its first
composer submission creates its session and sets the selected-session state.
Beta then receives one saved turn through real `createSession` and prompt routes
while Alpha remains mounted. Actual Beta roster-button navigation is required,
with matching Bot route ID, title and unchanged document time origin.

Before Beta's UI send, its saved user/answer must replace Alpha. The Bot DOM
observer rejects any Alpha user/answer under Beta's title. Beta's second composer
submission must persist into its **existing** Beta session. Exact engine checks
require Alpha's full two-message snapshot unchanged, Beta's original pair
unchanged plus its new pair, and exactly one session under each owning Bot.
Both owners' text/reasoning/model/session IDs and full DOM user/answer lists are
checked. This also fails an implementation that merely hides the stale text but
still writes Beta's request to Alpha.

Bot sentinels add a literal owner:
`Cortex native <light|dark> <Alpha|Beta> <first|older|newer>.`
The fixture uses a closed ten-step list, not a general scenario dispatcher:

```text
light chat older, light chat newer, dark chat older, dark chat newer,
light Alpha first, light Beta older, light Beta newer,
dark Alpha first, dark Beta older, dark Beta newer
```

Receipts include validated `scenario`, `owner`, `turn` and expected user/assistant
replay history. Only the two Beta saved turns use bridge prompt setup; all other
eight turns use the real composer. The backend refuses Alpha history in any Beta
request and permits at most ten completions total.

Bot conversation selectors are `.bot-cols .thread-inner .msg-user/.msg-bot`.
An ordinary mouse wheel centers Beta's latest pair above the page's bottom fade;
native capture measures the fixed Beta title, latest user/answer, and focused
composer. Full ownership history is proved by exact DOM/engine assertions, **not**
by claiming every Bot activity/routine section fits in one 960×640 image. Bot
reasoning is verified in stored parts/fixture output; this surface renders text
only. No CSS/zoom changes or forced all-section capture are introduced.

Expected captures: `transcript-light.png`, `deleted-light.png`,
`transcript-dark.png`, `deleted-dark.png`, `bot-beta-owner-light.png`,
`bot-beta-owner-dark.png` — **six** total. Each is OS `screencapture` output,
not a browser screenshot. PNG size/hash, native window/PID, theme and measured
geometry go into `manifest.json`; exact histories, observed deletion counts,
state-request status codes, Bot owner DOM observations, before/after histories,
and fixture receipt are retained. Failure stage plus redacted message/stack are
saved alongside the digest; the dummy key/Bearer values and nonloopback network
URLs are redacted. Backend failures retain a bounded check-stage diagnostic and
stack frames only, excluding assertion value dumps/raw bodies; partial receipts
are fetched during failure cleanup too. All captured
page/console/dialog errors and renderer HTTP requests must be zero. Frame/image
inspection remains required after execution.

The fixture makes no outgoing requests. It serves only `/catalog`, `/health`,
`/receipt`, `/v1/chat/completions`; unexpected routes fail and increment errors.
Receipt records only validated sentinels and booleans, never authorization bytes,
arbitrary system prompts, raw request bodies or credential-store contents. App
provider routes intentionally exercise main's credential storage with the dummy
key; cleanup removes it. There is no real account or nonfixture provider setup.

## Cleanup and retained artifacts

The driver stops its DOM observer, discovers sessions only under its recorded
created Bot IDs, aborts/deletes owned sessions, deletes the four created Bots,
removes the dummy key, restores prior provider enabled/baseURL settings and native
appearance, and returns to the initial route. Provider metadata may remain as a
keyless default row in this disposable engine; the script does not claim exact
database rollback. Failures in cleanup make the manifest fail.

The driver exits only its local CDP client. It never closes the installed app or
shared services. Coordinator retains the manifest, six captures, and Mac
`launch.json`, `binding.json`, `expected-members.json`, `backend-receipt.json`,
helper logs and PID files. Quit Cortex normally, then inspect **each recorded PID's
command** against this run root before sending SIGTERM to the two owned helpers:

```sh
ssh mac-live "cat '$RUN_ROOT/backend.pid' '$RUN_ROOT/capture.pid'"
ssh mac-live "/bin/ps -p '<backend-pid>,<capture-pid>' -o pid=,command="
ssh mac-live "/bin/kill -TERM '<verified-backend-pid>' '<verified-capture-pid>'"
```

Close the foreground tunnel, take the final Mac screenshot, release the lease:

```sh
ssh mac-live mac-lease release "$LEASE_ID"
```

Use a new root/output for any retry; do not merge failed attempt manifests.

## Scope

Prepared, **unexecuted**. This checks ordinary installed local transcript behavior,
Bot route/session ownership and native chrome. It installs no IPC handlers and
holds no reads. Exact late-RPC overwrite/deletion and Bot held-list race coverage
belongs to the separately owned Electron regressions. Their CI results and the
new package provenance remain separate coordinator receipts. English light/dark
only; no repeat locale sweep or application-source fix is part of this preparation.
