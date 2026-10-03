# Repository authentication locale regression — ready for integration

**PASS: one new registered case, 48 primary states, 32 auxiliary checks of copy,
144 real Tab stops; 39.767 seconds, zero retries.**

## Source delivery

- Only repository file changed: `tests/e2e/remote-auth.spec.ts`.
- Appended **93 lines**, starting at line 409. Existing imports, HTTP fixture,
  helpers and all six pre-existing registered cases remain byte-for-byte unchanged.
- New case: **`Live sign-in copy stays readable across eight locales`**.
- Timeout: **180 seconds**. One app, one distinct `authBackend("locale-layout")`;
  existing launch, bridge, auth, privacy and capture helpers reused.
- Test file SHA-256 at passing run:
  `f6740a98f19f100c04603c7c09b1c2eb0f1d6e7ac40a33d734c6cd7b3bea7600`.
- Source is uncommitted, as instructed; coordinator owns integration/commit.

## Automated acceptance

`en fr es de ja zh-Hans pt-BR ko` × light/dark × three primary states:

1. UI wrong-code refusal: exact localized error, editable retained `000000`,
   all six painted digits, real main `code_sent` status.
2. UI accepted code: exact signed-in heading, session-only description and
   connection-settings button; retained after renderer reload.
3. Real enrollment payload: localized unavailable continuation, another-address
   action and Cancel; retained after renderer reload, `signedIn: false`.

Each locale/theme also triggers the real HTTP send refusal (`auth.sendFailed`)
and existing unavailable-option toast (`auth.optionUnavailable`). Together these
exercise **all seven new `auth.*` keys**; expected copy loads each locale's
`system.json` and `common.json`, including English.

Primary states check text Range rectangles inside actual clipping ancestors and
allocated widths, settled opacity, loaded fonts, real Tab order, enabled state,
complete control bounds and center hit targets. Locale, theme and exact 960×640
viewport are asserted. Known email-step scrolling uses actual UI actionability;
send-error text is scrolled into view. No primary clipping is waived.

The existing private-state guard runs in all 48 primary states. Main uses the
real SDK against the controlled loopback backend; no engine/DOM response stubs,
preview variant, application CSS edit or external authentication request.
Page/console errors, fixture errors and renderer HTTP requests must remain empty.

Artifacts: **eight success PNG attachments**, one dark wrong-code image per
locale, plus `auth-locale-geometry` JSON containing **80 measured states**.
Failure path captures the current screen and retains accumulated measurements.
All eight contact frames inspected; German, French and Japanese additionally
inspected full-size. Copy and focused Cancel are complete and distinct.

## Executed verification

- Only the new Playwright test ran: **1 passed**, 39.767s test / 40.660s total.
- **0 retries, 0 skipped, 0 flaky, 0 unexpected**.
- Scoped ESLint on `tests/e2e/remote-auth.spec.ts`: exit 0.
- Scoped `git diff --check`: exit 0.
- All **90 current and frozen dist members** matched the `7885736` receipt before
  and after both command attempts. No build occurred. Current in-progress main
  source is not represented by this old-dist execution.

Passing command, from the checkout (with `CORTEX_RENDERER_URL` unset):

```sh
NODE_ENV=test \
TMPDIR=/tmp/opencode/auth-locale-ci-regression/run/temp \
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/opencode/auth-locale-ci-regression/run/results.json \
xvfb-run -a -s '-screen 0 1280x900x24' \
  /root/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin/node \
  node_modules/@playwright/test/cli.js test tests/e2e/remote-auth.spec.ts \
  --grep 'Live sign-in copy stays readable across eight locales' \
  --workers=1 --retries=0 --reporter=list,json \
  --output=/tmp/opencode/auth-locale-ci-regression/run/artifacts
```

## Retained evidence

`/tmp/opencode/auth-locale-ci-regression/run/`:

- `results.json`, `run.log`, `exit-code.txt`, `run-command.json`.
- `integrity-before.json`, `integrity-after.json`: all 90 member hashes.
- `summary.json`, `geometry.json`, `contact-dark.jpg`.
- `artifacts/…`: eight original PNGs and their Playwright attachment copies.

Parent directory retains the initial exit-1 **no-tests-selected** attempt. Anchors
in `--grep '^Live … locales$'` did not match Playwright's full title including the
file prefix. Removing those anchors selected exactly one test. No application
ran and no test assertion failed in that initial attempt; source unchanged between
attempts.

No global suite, typecheck, CI, Mac run, build or commit. The test is now discoverable
by the existing E2E suite; coordinator's forthcoming rebuild/CI will exercise the
new main implementation. Prior accepted temporary locale/native receipts remain
separate and untouched.
