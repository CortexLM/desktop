# Eight-locale live authentication layout — 7885736

**PASS: 48/48 requested views at 960×640 in real Linux Electron.**
Eight locales × light/dark × wrong code, signed in, unavailable enrollment.
**896 recorded primary checks, 144 real Tab stops, 48 original PNGs.**
Zero captured page/console errors, fixture errors or renderer HTTP requests.

## Artifact binding

- Executed revision: `78857365a509d78af10ebdda5b52348a2e50e961`.
- Existing checkout dist matched `/tmp/opencode/build-7885736/members.json` before
  and after execution: **90/90 members**, 86 renderer plus four desktop.
- Ordered path/hash digest:
  `b2c2f54529a76ac43549136a496c7b24865fe722f8889ca9b42fed9e340c8dcb`.
- Launched `packages/desktop/dist/main.cjs` using the existing Playwright dependency
  and the repository fixture's launch pattern. Renderer loaded `cortex://app`.
  The frozen directory lacks launch-root package metadata.
- All eight `system.json` and `common.json` catalogs plus auth renderer TSX/CSS
  matched frozen input pins. Current `remote-session.ts` differs from that pin;
  its newer source was **not built or executed**. The receipt identifies built
  7885736 behavior, not the current worktree's evolving main source.
- Electron **44.5.1**, Chromium **152.0.7977.130**, embedded Node **24.21.0**;
  harness Node **22.23.3**. Xvfb **1280×900×24**.
- Main sweep: **2026-10-03 05:45:26.107–05:47:05.645 UTC**, exit **0**.
  One isolated app/profile for the sweep. App and controlled HTTP fixture closed.

## Live state construction

Ephemeral `127.0.0.1` HTTP fixture follows `tests/e2e/remote-auth.spec.ts` and the
prepared native backend payloads. Main's real SDK, credential handling, schema
validation, engine and IPC process every response. No engine response replacement,
DOM copy replacement, CSS injection, preview state or animation override.

1. Real bridge selects the fixture's self-host origin. A supplied trailing slash
   canonicalizes to the origin; attempted `signedIn: true` stays false.
2. UI sends email and submits `000000`. Controlled HTTP 401 produces the real
   localized failure; all six digits remain in the editable input and painted cells.
3. UI submits `123456`; real SDK session response produces signed-in state.
   Renderer reload retains that main-process state.
4. Bridge logs out and sends email for `mfa@example.test`; UI submits `123456`.
   Real enrollment payload produces the unavailable continuation. Renderer reload
   retains status `mfa_enrollment`, with `signedIn: false`.

Fixture totals: **48 email requests**, including **16 controlled send refusals**;
**48 code requests**: 16 wrong-code refusals, 16 sessions, 16 enrollment continuations.
No discovery/logout network requests were needed. All fresh auth requests were
credential-free. Only counts and sanitized auth DTOs are retained; no raw HTTP
request/response logs, cookie values, token values or continuation secrets.

Renderer HTML/storage/cookies, IndexedDB, caches and auth response headers were
checked in memory for fixture-private values. All inspections passed; renderer
cookie stores stayed empty and no `Set-Cookie` crossed IPC. Fixture-only accounts
establish no real Cloud authentication acceptance.

## Coverage and results

Each table cell covers **both themes**.

| Locale | Wrong code | Signed in | Enrollment unavailable |
| --- | --- | --- | --- |
| en | 2/2 | 2/2 | 2/2 |
| fr | 2/2 | 2/2 | 2/2 |
| es | 2/2 | 2/2 | 2/2 |
| de | 2/2 | 2/2 | 2/2 |
| ja | 2/2 | 2/2 | 2/2 |
| zh-Hans | 2/2 | 2/2 | 2/2 |
| pt-BR | 2/2 | 2/2 | 2/2 |
| ko | 2/2 | 2/2 | 2/2 |

Primary captures cover five new keys: `auth.failed`, `auth.signedIn`,
`auth.sessionOnly`, `auth.settings`, `auth.continuationUnavailable`.
Sixteen auxiliary locale/theme pairs exercise the remaining keys:
`auth.sendFailed` through a real controlled 429 and `auth.optionUnavailable`
through the existing provider-option button/toast. **96 additional recorded checks**
cover those two texts and actual glyph fonts. Auxiliary measurements are retained;
they are not additional primary PNGs or whole-email-screen acceptance.

### Geometry and keyboard

- Native window **and content bounds**, renderer viewport, `.window`, all PNGs:
  **960×640**, one window, sidebar shown.
- Real locale preference + reload; exact `html.lang`, theme, localized catalog
  headings/body/button labels. Browser language list recorded separately.
- Loaded fonts and completed finite animations; full-opacity primary copy and
  ancestors. Actual CDP glyph fonts queried on text-bearing elements.
- Text-node Range rectangles cover complete headings, body, refusal, OTP text and
  buttons. Real clipping ancestors, allocated widths, text/control clearance and
  control/control separation checked. Unclipped line-box height is not a glyph bound.
- **Zero initial primary text/control clips. No wheel recovery needed.** Every
  primary text remains visible after keyboard traversal. Final control bottom is
  at most **549.5px**, safely above the 640px viewport edge.
- Tab from Help reaches every login input/button in visible order. All **144**
  primary stops are enabled, fully visible, correctly labeled and center-hittable.
  OTP's intentionally transparent native input is checked through its visible
  six-cell presentation, editable retained value and keyboard/hit behavior.
- Large action buttons measure **44px** high; text actions, including Cancel,
  measure **16px**. Exact text and bounds per state/locale are in `summary.json`.

| Locale | Continue | Connection settings | Cancel |
| --- | --- | --- | --- |
| en | Continue | Open connection settings | Cancel |
| fr | Continuer | Ouvrir les réglages de connexion | Annuler |
| es | Continuar | Abrir la configuración de conexión | Cancelar |
| de | Weiter | Verbindungseinstellungen öffnen | Abbrechen |
| ja | 続ける | 接続設定を開く | キャンセル |
| zh-Hans | 继续 | 打开连接设置 | 取消 |
| pt-BR | Continuar | Abrir configurações de conexão | Cancelar |
| ko | 계속 | 연결 설정 열기 | 취소 |

Latin locales use **Geist / Geist Mono**. Japanese, Simplified Chinese and Korean
also use **WenQuanYi Zen Hei** on this Linux host. Font availability/layout is not
native Mac glyph acceptance or translation-semantic review.

## Email-step clipping follow-up — retained separately

Auxiliary initial measurements retain the known clipped decorative top logo.
French, German and Japanese also initially place Cancel at **y=625–641**, extending
**6px** below the scroll container's **y=635** edge. This is recorded, not treated
as initially unclipped.

`email-reachability.mjs` opens a separate isolated app after the main sweep closes.
Six locale/theme cases retain initial and focused captures. Real Tab traverses all
nine controls, naturally scrolls the center **6px**, puts Cancel at **y=619–635**,
then Enter returns Home. **6/6 pass, 54 Tab stops**, zero page/console errors or
renderer HTTP requests; all 90 dist members match before/after. No synthetic scroll,
CSS correction or clicked-provider network request. Initial clipping remains a
bounded email-screen observation; it is not an unreachable-control finding.

## Visual inspection

- All **48 primary contact frames** inspected across six contact sheets.
- **18 primary PNGs** inspected at full 960×640: wrong-code light/dark for
  `de fr pt-BR ja zh-Hans ko` (12); three long-copy signed-in views (de dark,
  fr light, pt-BR dark); three CJK unavailable views (ja light, zh-Hans dark,
  ko light). Exact files in `review.json`.
- Corrected states show complete copy, distinct actions, retained wrong code and
  readable CJK glyphs. No primary layout defect found in this scoped check.
- All **12 email-follow-up contact frames** inspected; French/light initial and
  Cancel-focused PNGs additionally inspected full-size. No claim that all 48
  primary PNGs were reviewed individually at full size.

## Evidence files and retained negative

- `manifest.json`: primary/auxiliary geometry, expectations, fonts, keyboard,
  sanitized auth state, fixture counts, errors and before/after integrity.
- `summary.json`: compact counts, exact control text/bounds, fonts, follow-up result.
- `screens/auth-<locale>-<theme>-<state>.png`: **48 original PNGs**, SHA-256 in manifest.
- `contact-<state>-<theme>.jpg`: six primary review sheets.
- `review.json`: explicit image-review inventory and observations.
- `check.mjs`, `run.log`, `exit-code.txt`: exact main harness and exit **0**.
- `email-reachability/`: separate manifest, 12 PNGs, two contact sheets, log, exit **0**.
- `launcher-attempt/`: retained exit **1** before any app/backend execution.
  Xvfb could not create its temp directory because the isolated `TMPDIR` parent did
  not exist. Creating that directory fixed launch; no test predicate or application
  source changed. No application assertion failed during either executed run.

Both scripts use existing installed dependencies. No repository edits, build, CI,
Mac operation, commit or delegation. Prepared native/Approvals receipts untouched.
This result is scoped Linux auth-layout/runtime evidence; full-app eight-locale,
native typography, translation semantics and real remote-inference acceptance remain
separate.
