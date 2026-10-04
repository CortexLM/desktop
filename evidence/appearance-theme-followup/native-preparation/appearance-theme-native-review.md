# Appearance theme native helper — independent source review
**Source approved; no concrete blocker found. Native execution and two-image acceptance remain pending.**
Reviewed actual 93-line driver, 124-line runbook, three original helpers, current Settings/Shell/context, CSS and installed Base UI implementation. No helper imported/executed.
Stable before/after hashes verified **2026-10-03 12:42:29 UTC**.
- Driver: `230f312d902a00facc696264617629d94c20103fcdde164fadf67654d545daed`.
- Runbook: `43227bf56fc8169846d2e427a84e2003281d93490f15298b168b3d604594a81f`.
- Backend: `d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d`.
- Launcher/inspector: `4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257`.
- Cleanup: `c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a`.
- Settings: `4f0b4f911195eb7e5a12dc22ff9e940f0cd67190ce9eb44ae7c99d6054c80461`; nav: `876682aef675ef9e0b1c5a3a59a49b00acbb1da84a7897f0dc17efa287579315`.
- Shell: `880240350484738971849dbabdfe591cd90471afc08fa0ffca02ef6f78a6ae67`. Both inspected CSS files equal Git `37c22c2` bytes.
## State, controls and assertions
- Driver **38–55** matches Shell's hash initialization/storage semantics: hash Light overrides selected preference without writing storage; clicking already-selected Light exercises Settings `85`'s explicit persistence handler.
- **43–52** selects three visible native-button ARIA radios, not Base UI's sibling hidden inputs. Installed `RadioRoot.mjs:148–178,206–220` confirms three `type=radio`, `aria-hidden=true`, `tabIndex=-1` inputs; main/rail names and ordering match actual source.
- Main `Appearance` reads Shell's `pref` via `NavCtx`; rail calls the same Shell setter. Owner-handle identity checks ensure the group survives preference/OS changes instead of remounting to conceal stale state.
- **63–70** uses real pointer actions, rail hover/click, Shift+Tab/Tab, all four arrows with wrap, then Space on explicitly unchecked focused Dark. Installed composite defaults both axes/loop; RadioGroup disables Home/End, correctly excluded here.
- **22,48,63** changes actual native appearance, asserts its readback, polls real media-query/document resolution while System remains selected/stored. Capture's explicit theme equals the separately asserted OS appearance.
- Runtime behavior uses no injected theme event, handler replacement or media emulation. Existing `cortex-theme` dispatch appears solely in cleanup **85**. Native reduced-motion preference is neither overridden nor separately tested.
- Storage assertions verify accepted preference writes; this native driver makes no post-action reload/relaunch persistence claim. The initial reload occurs before interactions.
## Geometry, identity and capture
- **56–60,74** checks seven targets: three cards, three label spans, English button; positive whole bounds, range rectangles, opacity and hit tests before/after capture. Only input self-clipping is exempted; every actual target is non-input, retaining own-overflow checks.
- CSS `51,54,458–471` supplies borderless buttons, visible focus outline, cards/previews/labels; no source-level input-border contradiction found. Runtime geometry remains asserted, not source-proven.
- **45,72–78** settles fonts/finite animations, requires English/shown sidebar/960×640, keyboard-focused selected card and `:focus-visible`. Actual outline/shadow values retained; visible ring quality belongs to the two full-image review.
- **10–15,25–35,76–80** binds supplied revision/ASAR/member digest, original inspector, unique installed/CDP PID and foreground CoreGraphics window. Inspector checks complete member-set equality; admitted count is dynamic, not a hardcoded future package/test count.
- PNG signature/scale, window ID/PID, native appearance and target geometry checked around capture; final installed identity equals initial. Exactly two captures required; no prior revision/ASAR assumed.
## Fixture, cleanup and scope
- **40–41,80,87–88** reads seven engine routes only; requires empty lists and local/signed-out connection. Catalog fixture receipt requires zero inference requests/errors/failures. Renderer HTTP monitoring starts after attachment; no whole-process startup-network claim.
- Original backend import guard is inert; fresh appearance root satisfies all three helper regexes. Launcher requires prior Cortex quit, fresh engine/profile, free ports and GUI `open -na`; inspector rejects dev-renderer/provider overrides.
- **83–89** restores OS appearance, original preference, originally absent storage, initial route and exact original state; rechecks empty engine/fixture. Any cleanup or observed page/console/HTTP/dialog error fails the run.
- **93** exits the CDP client process; coordinator retains app/helper/tunnel/port/ordinary-app/lease cleanup per runbook **103–119**. No claim that the driver alone closes remote ports.
- Future package admission, execution and native pixel acceptance remain coordinator-owned. Local 113-case/CI acceptance was not independently re-audited in this source review.
Only this report written. Offline stable-hash, CSS-byte, root-regex and source assertions passed; no syntax recheck, tests/build/CI/Mac/network/commit/delegation actions.
