# Final corrected build — targeted Electron audit

**11/11 passed: seven auth cases, four engine cases.** Zero retries, skips, flaky
results or unexpected failures. Run: **2026-10-03 06:49:49.937 UTC**, **45.850s**,
four workers. This final-build receipt is distinct from the
[initial 97-case run](../electron-initial/README.md); no final 97-case or 426-render
rerun is claimed.

## Source/build binding

[provenance.json](provenance.json) records audit-start/end SHA-256 verification of
all **90 current build members** and **14 final source pins**, against the retained
[build](../integrated/build-final.json) and [source](../integrated/source-final.json).

The build-pinned `main.cjs.map` contains **980 source entries**. Its `sourcesContent`
for all **eight pinned runtime sources** exactly matches the final receipt and
current files: core bus/connection/index/remote-sessions, desktop main/remote-session/
remote-chat, schema index. `main.cjs` names this map. This binds the later source
receipt to embedded source bytes rather than inferring identity from timestamps.

| Artifact | SHA-256 |
| --- | --- |
| Main bundle | `f0fc4522cde726dd8b88dcbb56f4116ba93dc87e1e9e29163502d25e522512c7` |
| Main source map | `831431b289084fa3efb3d4c8fea110356a25e64e7bd2b304fa05efd7b6decc02` |
| Renderer entry JS | `fde16bd59354782c6552821f623a6a42dcb210275c0e2cda1d05ce59535f896d` |
| Auth test source | `7973cd05ffb32367de7afa8254e4d0002bd91a27b64df8fec645b44f24684062` |

Against frozen `7885736`, **172 app inputs, 297 i18n inputs and three client inputs**
remain identical. Relative to the initial integrated schema, removing only
`"transport"` from `RemotePart`'s unsupported-kind enum exactly reproduces the
initial schema hash. CSS and other renderer assets match; entry JS and its HTML
reference differ. Across initial/final builds, **86/90 members** match; changed
members are renderer entry/HTML and main bundle/map. No byte-identical whole-app
claim follows from unchanged UI source.

The coordinator's [final package receipt](../integrated/linux-package-final.json)
has the same 90 member hashes and ASAR
`d34d6d8609045f56851a6004f5c7bb185108cd743732ff8b79d6e3689df7f14c`.
This audit verifies receipt equality, not a new package extraction or launch.

## Locale/runtime evidence

The locale case passed in **38.765s**. Its decoded geometry attachment confirms:

- **48 primary states**: eight locales × light/dark × wrong code, signed in,
  unavailable enrollment.
- **80 measurements** including 16 send-refusal and 16 unavailable-option states;
  all seven new auth keys exercised.
- **384 readable text rows**, valid settled opacities, **144 reachable Tab stops**.
- The entire parsed geometry is **identical to the initial integrated attachment**.
- The unchanged pinned assertions additionally require localized copy, exact
  960×640 viewport, retained editable wrong code, real keyboard focus/enabled
  controls, main auth state and private-state isolation.
- Zero page/console/fixture errors and renderer HTTP requests are enforced by the
  passing locale case's final assertions. No separate error arrays were attached.

The four engine cases cover MCP credential isolation, catalog access through IPC,
a local-provider controlled image/reasoning stream and capability refusal. They
attach no PNGs. They do not call the new private `remoteSessions` service through
Electron UI. Corrected remote lifetime/history/projection behavior is supported
by the separate unit/native-HTTP receipts, not relabeled as public Electron
inference acceptance.

## Full-size image review and reuse

Final artifacts contain **40 PNG files, 20 image attachments, 18 unique PNGs**.
All **18 unique images were inspected full-size**, including all eight locale
captures. Seventeen are 960×640; the signed-in wide capture is 1440×900. Every
image contains rendered UI; no blank capture waiver.

**15/18** match the corresponding initial PNG bytes and decoded RGBA exactly,
including all eight locale images. Three differences were retained and inspected:

| Final image | Difference from initial |
| --- | --- |
| Light wrong-code refusal | 25 pixels, wholly within left shell bounds x=22–56, y=16–153; auth content identical |
| Light signed-in state | Same 25-pixel left-shell difference; auth content identical |
| Canonical-origin sign-in settings | 3,876 pixels within x=617–832, y=383–479: 93 input pixels and 3,783 button pixels; field/action styling differs, content remains readable |

No runtime cause is inferred for those pixel differences. They are not hidden by
a comparison tolerance. The settings test passes its canonical-origin, editable
field and enabled sign-in assertions. All primary auth captures retain complete
copy and separated controls; locale captures show retained digits and focused
Cancel. The email-step capture still clips its decorative top logo, matching the
initial image exactly. Prior FR/DE/JA **6px Cancel clipping and successful Tab
recovery** remain attributed to the
[earlier follow-up](../../sdk-035-admission/auth-locales/README.md#email-step-clipping-follow-up--retained-separately),
not a new failure or a repeated final-build reachability probe.

**17 canonical PNGs already exist in evidence** and are referenced by verified
hash; only the changed settings image requires a
[new file](images/cc2b306fa2973da16f1d8d1ad52e5f5aa72a6941024fa3a160fe4a14282a70db.png).
No duplicate contact sheets or copied raw reports were added.

## Retention

- [summary.json](summary.json): exact result/geometry/image counts and scope.
- [cases.jsonl](cases.jsonl): eleven results and attachment hashes.
- [images.jsonl](images.jsonl): eighteen canonical paths, PNG/RGBA hashes, final
  artifact aliases and exact initial-image differences.
- [provenance.json](provenance.json): source-map binding, start/end hash checks,
  source/build/package receipts and renderer delta.
- [review.json](review.json): explicit full-size review inventory and observations.
- Existing [raw report gzip](../integrated/e2e-final-targeted.json.gz) and
  [raw log gzip](../integrated/e2e-final-targeted.log.gz) round-trip byte-for-byte
  to the supplied inputs. Geometry remains in the original report.
- `SHA256SUMS`: this audit's delivered-file integrity.

Audit-only: no code change, test, build, CI, Mac action or commit. Controlled auth
fixtures, Linux fonts and screenshot review establish no real Cloud account,
native-Mac acceptance or complete remote Chat workflow.
