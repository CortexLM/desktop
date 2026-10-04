# Provider-draft native helper — independent source review
**Source approved; no concrete blocker found. Native execution/pixel acceptance remains pending.**
Reviewed the actual 117-line driver, runbook, three reused helpers and current provider UI/IPC/client/core contracts. No helper imported or executed.
## Stable pins
Before/after readbacks agree; final hash check **2026-10-03 11:01:16 UTC**.
- Driver: `0125e457b2cd05ba2be8aa1344b6c6e5a0c15dbb7efdecab2af32a2add170d30`.
- Runbook: `d38e7fc4850875e8b2ac339c7024da8ed9dde92773f3a3e27a0778ce8c05498b`.
- Backend: `d22fcbe2287a7898452778ea58d665f0742f4a1d4d580ec7c237dc10cfc70d4d`.
- Launcher/inspector: `4aec6651e6178bf890a299551497514f5159342a8f94db8972515c000fc10257`.
- Cleanup: `c46f218f17bcda2ba031fe8f2959f9f8e18dda379a7edcd076b01be0c881c08a`.
- Current `packages/app/src/screens/system/settings.tsx`: `b859cf9785ada768307e77a2546c02b80576b1491187b6ffa944c1673432eed6`.
- English system catalog: `18dff6afda09dc67df5091b5a2440fc1f6b3e1d439230cd9fda6967f6be7b10a`.
The runbook’s `2956564` Settings hash is explicitly baseline-only; future revision/ASAR/members are parameters, not assumed results.
## Contract, observations and actions
Driver **40–58,79–81** matches `api.ts:23–35`, client `:99–112,160–166`, server `:83–87`: real UI mutations parse singular config responses; list arrays are ignored.
`Request.text` retains only method/path and returns its original promise; `Response.json` returns the original parsed value after recording sanitized fields. Direct bridge GET/cleanup uses `JSON.parse`, outside UI counts.
Core `provider.ts:45–77` defaults enabled=true, returns no key, preserves enable across key saves; JSON omits undefined `keyHint/baseURL`. Exact expected fields, hint changes and restored keyless comparisons are correct.
Only explicit placeholder keys are used. Receipts contain method/path, booleans, field names and last-four hints; password value checks stay boolean; diagnostics redact both placeholders. Input screenshot type is asserted `password`.
Settings **221/224/237** has `clearKey=true`, equality-guarded captured-draft clearing, Enable passing `false`; driver **93–100** exercises ordinary successful Save/toggle behavior without refilling B after a toggle.
Each theme requires **PUT A, PATCH false, PATCH true, PUT B**; total **four UI PUTs + four UI PATCHes**, eight accepted action checks. Initial setup is read-only; dark deliberately inherits B/2222, then UI Save A resets 1111.
## Selectors, geometry and capture
Actual selectors resolve Settings nav, sole fake provider, key form/input/Save, saved hint and accessible **Enable** switch (`settings.tsx:193–243`, `ui.tsx:109–110`).
Backend **25–28** supplies one Reasoner. This exact driver **72–75** does **not** fill provider search: `q` remains empty, so the extra matching-model list is absent (`settings.tsx:176–178,206–209`).
Driver **59–90** requires toast expiry, settled fonts/finite animations, shown sidebar, English, matching theme, **960×640** viewport; scrolls the form, then checks label/hint/input/Save/Enable-label/switch together and input/switch hit targets before/after capture.
Disabled Save may be dimmed; input remains editable/focused. Four native PNGs are required. Geometry/pixels remain runtime assertions, not source-proven outcomes.
## Identity, fixture and cleanup
Driver **11–16,25–36,87–102** binds supplied revision/members SHA, installed ASAR/member set, inspector hash, unique browser/main PID and foreground CoreGraphics window; before/after captures retain the same window/PID and OS appearance.
Original launcher **16–58,74–101** verifies isolated root/profile, exact app/desktop members, catalog-only override and GUI `open -na`; capture **60–72** uses native `screencapture`. Provider-draft root matches all original root regexes.
Backend import guard **77–79** is inert on import. Driver **26,31–32,102,110** checks health protocol/platform/root/script/run ID, empty inference requests and zero fixture errors/failures.
Driver **105–112** retains observation, DELETEs key, restores enabled=true and exact keyless config, confirms the intentionally retained metadata row, empty/reset detail, empty engine lists, local connection, OS appearance and initial route.
Original cleanup **11–29** accepts this root and stops only recorded helpers whose command/root match. Runbook **131–140** correctly assigns exit/port/tunnel/ordinary-app/lease verification to coordinator; helper alone does not attest port closure.
## Boundary
Approval covers source compatibility for sequential Enable/Save native proof only; held-response/refusal and replacement-during-pending behavior remain separate Electron evidence.
Only this report written. Offline hash/string/regex assertions passed; syntax check not repeated. No repository/test/build/CI/Mac/SSH/network actions, posts, commits or delegation.
