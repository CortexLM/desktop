# Code supplement — canonical integration

2026-10-03. Four reviewed files added byte-for-byte to the desktop/mobile prototypes. Both builds passed. Base UI1.8.0, shared kit, registry and application shell retained. Exact hashes and build logs: `/tmp/opencode/cortex-ui-code-integration-20261003/REPORT.md`.

## Browser result

`node check-code-supplement.mjs` passed12theme/viewport cases: Chromium desktop1440×900,390×844,768×1024,1440×600; mobile/touch WebKit390×844,844×390; both themes. Verified Escape focus return, retained task/keep draft after local refusal, local-only receipts, worklog expansion, unique route registration, gallery navigation and Components discovery. Mobile catalogue's existing Base UI drawer returns focus to its trigger. Primary actions remain visible, center-hittable, at least44×44; no horizontal page overflow.

Final record: `/tmp/opencode/cortex-ui-code-browser-20261003/verified-check.json`. Initial HTML, JS, CSS and used Geist font responses match canonical build bytes. Four integration PNGs were inspected: desktop and mobile, light/dark. Controls and text remain legible; lower optional fields use the existing inner scroll region. These four positions do not establish full-page/matrix coverage. Four imported modules retain their approved hashes; the mechanical detector returned no findings. Desktop lint reports11warnings/0errors, mobile0warnings/0errors, with different existing rule configurations.

Eight exact served resources were archived under`/tmp/opencode/cortex-ui-code-browser-20261003/served-artifacts/` before later canonical builds;`served-artifacts.json` binds the archived bytes. The original live`dist/` paths can subsequently change without transferring these images to a new build.

- Desktop registry at this build:118routes,694declared variants,709effective states.
- Mobile registry at this build:104routes,886declared variants,890effective states.
- Each platform adds`g4-code-home`(5variants) and`g4-code-session`(10variants).
- Code screenshot calls77–80; cumulative80/134,54remaining. No further captures assigned here.

## Preserved harness failures

Five browser-check attempts, four screenshots total. Initial attempt completed desktop checks then waited for a zero-height mobile wrapper. Second completed mobile screen/gallery checks then used an ambiguous catalogue selector. Third completed all business checks but its asynchronous response collector lost bodies during navigation. Fourth rejected the four correctly bound initial resources because the harness expected an unused fifth font. Final attempt uses the visible composer, unique catalogue ID and synchronous first-document response binding;12cases pass, no console/page errors, no further screenshots. Original negative JSON records remain intact; application source never changed during these harness corrections.

The two earlier scoped seven-criterion10/10 reviews remain in`code-supplement-accepted.json`. This integration confirms their exact modules in the canonical prototypes; physical iPhone, native application and product backend acceptance remain separate.

## Open

- Desktop: `http://127.0.0.1:5199/#/g4-code-home?v=options&theme=light`
- Mobile: `http://127.0.0.1:5299/#/g4-code-home?v=options&theme=dark`
- Both routes are discoverable through`#/gallery` and`#/components`.

Reproduce the current integration check without screenshots:

```sh
DESKTOP_BASE=http://127.0.0.1:5181/ IOS_BASE=http://127.0.0.1:5281/ node check-code-supplement.mjs
```
