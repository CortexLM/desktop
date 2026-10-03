# Prepared terminal-state native harness — independent source review

**Approved for the coordinator's matching-package run. No source-level blocker found.**
Scope: installed English Chat missing-link recovery and Code persisted failure/recovery at 960×640, light/dark; six captures, four UI admissions. Preparation approval only.
Application reviewed: `2956564fbe31f882014d74ff3a7f920e839fd634`; eight inspected application files match committed bytes.

## Reviewed pins

| File | SHA-256 |
| --- | --- |
| `terminal-state-native.mjs` | `9f6a819fcd44a26c5b61050a51e0c94c9d87a420b5b32b7a27902ebdcb110949` |
| `terminal-state-native-backend.mjs` | `d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d` |
| `launch-terminal-state-native.py` | `4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257` |
| `cleanup-terminal-state-native.py` | `c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a` |
| `terminal-state-native-runbook.md` | `45e0cc735357ff92bb346022ad14c12068df6bab560ef6fbbb742f41f90850ba` |
| `packages/app/src/screens/chat/live-chat.tsx` | `c70919bb1dd6167f1bd32c4618a11e59aa79df7a7c5484a9adbf7810b79e0a6e` |
| `packages/app/src/screens/code/code.tsx` | `51c76d03b98da536bc84d8e010a22115ca1df1d215df2723fab9224d0a1db225` |

## Findings

- Read all 194 runbook lines and all four helpers. Launcher/cleanup are byte-identical to the accepted 760c4a0 versions after only root/helper-name substitution; earlier evidence is not reused as a new run result.
- **Real request identity:** driver `63–69` parses the plain IPC wire body's JSON and returns `r.body`; create/get/list consumers therefore receive actual objects/arrays. Production main/preload/API contracts match. Setup uses `JSON.parse`; it cannot satisfy the passive `Response.json` admission records (`79–86`). Each exact 202 tuple must equal its persisted user ID (`195,213`).
- **Missing Chat:** real create/delete precedes route selection (`168–176`). Alert selectors match committed ErrorCard markup/copy; both engine reads must return 404/not_found. Composer selector targets the actual editable input, whose existing placeholder is “Reply to Cortex.” Scoped header “New chat” uniquely invokes `go("home")`; Home heading, removed alert, fresh input and unchanged inference count are checked (`178–182`).
- **Readback timing:** the initial alert proves the session-load failure; direct session/message reads, capture settling and a later empty Code-history read precede the pre-send drain (`175–191`). A late old 404 would fail the exact 202-only comparison, not falsely pass. This does not establish arbitrary IPC scheduling guarantees; no extra delay/handler is needed for the bounded ordinary run.
- **Code selectors/state:** session readiness gates its sole ModelComposer; the closed catalog has exactly one enabled model. `model-option`, thinking switch, Code input and send selectors match the existing implementation. `useQuery` is observed through real reads; no application query state is assigned. Failed/reloaded history equality and badge/banner checks cannot be satisfied by an admission refusal without the required persisted assistant error.
- **Fixture replay:** core `session.ts:459–499` drops the empty failed assistant, retaining separate user messages. Local SDK dependency source `ai/src/prompt/convert-to-language-model-prompt.ts:89–129` merges only tool messages; compatible conversion `:190–214` emits each user separately. Retained `evidence/terminal-state-followup/code-baseline/traces/light.json` also contains the two separate actual recovery-user entries. The backend's exact replay assertion is valid.
- **Working directory/tools:** launcher resolves the Mac root; inspector returns that canonical path, backend uses `realpathSync`, driver creates the Code session with that same string. Core's system suffix is exactly `Working directory: ${session.directory}` (`session.ts:313`). Catalog `tool_call:false` prevents toolset construction; compatible `prepareTools` omits tools/tool_choice. Generic-compatible reasoning adds no enable fields (`llm.ts:55–57`).
- **Closed turn sequence:** fixture requires light401/light200/dark401/dark200, exact model/key/users, no assistant replay, no tools, completed prior request; unexpected calls increment errors/refuse. Driver checks four completed rows, exact order/statuses, four admissions and six captures/check groups (`221–227`). Failure is not converted into fixture success.
- **Status/color:** committed badge uses latest persisted error with busy priority. Driver checks red Failed before/after reload and green Ready after recovery, exact class/text and error-prefix retention. Canvas resolves the CSS color; opaque red/green dominance matches `styles.css:304,307`. Finite animations/fonts settle before equality/color checks (`90–93,123–130`). Recovery observer must start Failed, observe Running, end Ready (`216–217`).
- **Native captures:** supported browser-level `SystemInfo.getProcessInfo` binds CDP to inspected main PID. CoreGraphics binds one foreground 960×640 window; OS screencapture supplies PNGs. Required text/control clipping and composer hit/focus/editability are checked before/after; no browser screenshot substitute or renderer-style override. Full-size image review remains required after execution.
- **Package/cleanup:** launcher checks actual installed ASAR plus exact complete member set, binding and isolated process arguments; driver rechecks identity. `de7b30a5eedc416a1e1b35756e268fc7028f70908564e15b3ef4df9ec9c94d6e` is the retained local package pin, not evidence of the future installed Mac artifact. Driver removes owned sessions/key and restores state; runbook assigns helper/port/tunnel closure and lease release to coordinator after command-verified cleanup.

All reused missing-page/status keys exist in eight locale catalogs; proposed runtime coverage remains English/two themes. No helper execution, syntax rerun, tests, server, build, Mac/SSH/network/CI access or repository mutation performed. Sole output: this review. Await admitted CI artifact and actual installed-package verification before the first Mac run.
