# Installed sign-in and Code correction — ffc118a

**Twenty-eight native captures pass:** authentication (6), Code (4), terminal (4),
recovery (12), Work scrolling (2). [Independent review](review.md) verifies all 31 positive/
negative PNG/WebP pairs and inspects all 28 positives full-size. Package verification passes;
whole-product and real-account acceptance remain incomplete.

- Application `ffc118a2e58df66f430f3078e00f6e931dd910cf`, CI `37094538845`, artifact `11263628650`.
- [Download receipt](download.json): GitHub outer ZIP digest verified; inner ZIP
  `4f1932295847bfad10d174e7a607153798d1a59d68cc1dcb460ef37b10b823b1`.
- Installed ASAR `62ddb71be7bcbd25c37a4519f7a0d982b1d93d4fada6d63dfc2e218add65fa8b`;
  [90 embedded build members](package.json) match the source-bound frozen local build.
- [Resource check](resources.json): 104 catalogs across eight locales and summarize skill
  match the pinned Git source; no fixture or source-stamp resource files.
- [Renderer fingerprint](source.json): 473 inputs, `da9e8ed2dc6722fb34f27a64f5071e1fe0e5c1b95cb9cae9b9852fedc371cf0d`.

The app is installed at `/Applications/Cortex.app`, launched through GUI LaunchServices with
isolated engine/profile directories. Controlled loopback fixtures exercise main's actual
SDK and local tools. No real Cloud account, hosted inference or release signing is established.
Historical [b0e6d78 failures](../b0e6d78/README.md) remain unchanged.

## Authentication

[Six native captures](auth/manifest.json), 960×640, both themes: wrong-code retention,
one held verification request, successful sign-in, same-process renderer reload, Account
sign-out, cancellation of a held code and unavailable MFA enrollment. All six full-size
images inspected; headings, copy and buttons stay readable with sidebar shown.
Ten boundary inspections find no auth secrets in public IPC, renderer storage/cookies/DOM
or renderer HTTP. The fixture records two aborted late replies; neither signs in afterward.
Page/console errors, unexpected dialogs and renderer HTTP requests remain zero.

## Capture predicate correction

Two Code attempts stopped before inference while checking the live Code heading. Its
font range is 34px tall, extending 1px above/below a 32px line box whose overflow is visible.
[Measured geometry](code-capture-geometry.json) shows no clipping ancestor cuts the text.
The native helper now tests actual clipping ancestors and viewport bounds. Both original
failure manifests remain; no application change or relaxed error assertion follows.

## Preview departure and asymmetric Code diffs

[Four native captures](code/manifest.json) pass after correcting that predicate, both themes
at 960×640. Real same-document Work Done preview departure opens live Code with no preview
controls or engine-list mutation. Two explicitly approved writes create one short and one
161-line file per theme; exact disk bytes and model replay inputs are verified. Real wheel
input reaches the long tail while both file headers and the short edit remain visible.
All four originals inspected; no page/console errors. The first case starts with an empty
engine; the second correctly retains the earlier proof session.

## French terminal

[Four native captures](terminal/manifest.json), both themes at an actual 1024×685 window:
real approved `bash` commands produce exit 7 and truncated multiline output. Exact stored
output/metadata, preserved lookalike command text, reload and model replay pass. The localized
final omission marker is now visibly inside the scrollable terminal. All four originals
inspected; no page/console errors. This closes the earlier installed terminal-tail failure
for the verified revision and scope.

## Recovery refresh limits

An initial recovery attempt correctly refused the already-used Code engine. A fresh profile
then passed Add/refusal/single-delete checks but detected an actual native confirmation sheet
still present after CDP `dialog.accept()`. Its AX/CG receipt and three captures remain in
`recovery-cdp-dialog-failure/`; the assertion was not waived. Clicking the sheet's native OK
removed it. The helper now uses that native action for expected confirmations, followed by
the same strict AX/CG clearance checks. Fresh-profile [verification](recovery/manifest.json)
passes all twelve recovery captures; both partial-wipe images now show the surviving memory
and refusal toast with no native overlay. Four native OK actions cover the expected wipe
confirmations; AX/CG checks bracket every capture. [Work](work/work-manifest.json) passes
font-ready bottom position and user wheel departure in both themes.

All retained WebPs preserve original decoded RGBA. Helpers and ports 9444/9445/9456/9457/9458
are closed, SSH forwarding stopped, ordinary `ffc118a` app reopened with dark system
appearance, Mac lease released. [Cleanup](cleanup.json), [port check](ports-closed.json).
