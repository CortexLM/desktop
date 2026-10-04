# Long Chat 20px scroll diagnostic

**Proven: font loading triggers Chromium scroll anchoring by exactly 20 CSS px, in both implementations. Persisted scroll is not involved in these fresh-context runs.** The mechanism reproduces the two transcript positions in the historical 1.74% dark comparison. The historical capture's exact font/layout scheduling remains unrecorded; no whole-screen parity or acceptance claim follows.

## Evidence

Six navigations total: **three per side**, fresh contexts throughout. App `http://127.0.0.1:5399/`; frozen preview `http://127.0.0.1:5198/`. Per side: natural dark, natural light, dark with runtime-only `overflow-anchor: none` on the thread and its descendants. No font delay applied. Chromium **153.0.8010.12**; viewport 1440×900, context scale 2, French. Cache disabled through `context.route` and CDP `Network.setCacheDisabled`.

The probe recorded native `scrollTop` assignments, scroll events, font events/network, animation-frame geometry, computed styles, CDP actual fonts and initial/settled/normalized screenshots. Each run first captured the unmodified state, waited for `document.fonts.ready`, image completion and another 1100ms, captured settled state, then explicitly assigned `scrollTop=260` as a diagnostic control. The anchor-disabled runs had only the named runtime CSS override.

| Run | Mount assignment time, ms | Font response end, ms | `loadingdone`, ms | Settled `scrollTop` | “Critères retenus” top, CSS px |
| --- | ---: | ---: | ---: | ---: | ---: |
| App dark, natural | 550.3 | 603.3 | 635.2 | 240 | 129 |
| Frozen dark, natural | 696.4 / 708.8 | 777.4 | 797.2 | 240 | 129 |
| App light, natural | 572.6 | 609.9 | 619.3 | 240 | 129 |
| Frozen light, natural | 769.4 / 784.2 | 839.1 | 862.0 | 240 | 129 |
| App dark, anchoring disabled | 558.0 | 609.8 | 620.1 | 260 | 109 |
| Frozen dark, anchoring disabled | 726.3 / 740.0 | 798.3 | 808.5 | 260 | 109 |

Times are relative to each document's navigation. Frozen dev StrictMode runs the mount effect twice; both writes precede font completion. App production runs it once.

## Causal sequence

1. Both `VLong` implementations assign **260** during the mount layout effect, while Geist is **loading**. Source: app `packages/app/src/screens/chat/states.tsx:326`; frozen `src/screens/lot-chat.tsx:523`.
2. Fallback font metrics make the user bubble **58px** tall: two 20px text lines plus 18px padding. After Geist loads, it fits one line: **38px**. CDP explicitly observed **DejaVu Sans** before completion in the app light and anchor-disabled app runs; settled runs all use **Geist-Regular**. Computed CSS remains `13px / 20px Geist, ui-sans-serif, system-ui, sans-serif`; computed family alone cannot detect fallback.
3. With default `overflow-anchor:auto`, the bubble's 20px shrink causes the browser to adjust **260 to 240**. There is **no JavaScript scroll assignment** between the mount write(s) and the later explicit normalization. `loadingdone` already observes the adjusted 240. Total `scrollHeight` also changes 1387 to 1325 as additional text reflows; the anchor compensation is specifically 20px, not the total height delta.
4. With anchoring disabled before mount, the **same font load and 58-to-38px shrink** occur, but `scrollTop` stays **260**. This intervention distinguishes browser anchoring from an application reset or restored history state.
5. After fonts and entrance motion settle, resetting either implementation to **260** gives identical sampled thread/user/heading/paragraph geometry. The thread begins at `y=130`; “Critères retenus” is at `y=109` and clipped above the viewport. At **240**, it is at `y=129`, visible as in the frozen dark PNG. Subsequent headings differ uniformly by 20px: “Atelier Morel” **244/264**, “Studio Nord” **379/399**, “Expo Plus” **514/534**.

The shared entrance animation temporarily contributes up to 8px translation; it is settled (`translate:0px`) in final observations and does not explain the persistent 20px difference.

### Why waiting longer does not fix the mismatch

`document.fonts.ready` waits for the completed font layout; it does not reapply the earlier `scrollTop=260`. A capture can therefore be fully settled at **240**, while another is settled at **260**. Font availability relative to the mount/first-layout/anchor-selection timing changes the final scroll position. A font-ready assignment has no later fallback-to-Geist shrink to compensate. The historical scripts wait for fonts **after** the screen mounts; neither records or normalizes the resulting thread scroll position.

## Historical 1.74% row: proven versus unresolved

- **Proven mechanism:** font-metric reflow plus scroll anchoring creates the exact 20px displacement without any ported padding, margin or line-height difference. It occurs in dark and light, on app and reference. All natural runs settled at 240; runtime anchor controls stayed at 260.
- **Position correspondence:** historical `chat-states~long-dark.app.png` shows the 260-position composition; historical `.design.png` shows the 240-position composition. New normalized and natural screenshots reproduce those respective heading positions. The light historical pair already shared the visible-heading composition.
- **Persisted scroll excluded for these runs:** each context started with empty localStorage, `history.state=null`, navigation type `navigate`, `pageshow.persisted=false`; no popstate/hashchange, `scrollTo` or `scrollIntoView` calls. Only the mount writes and explicitly logged probe normalization set thread scroll. History length 2 represents the fresh navigation, not a traversal.
- **Historical scheduling unresolved:** no per-frame scroll/font trace exists for the original app image. These six runs do not prove whether its 260 resulted from earlier font availability, anchor-selection/suppression timing, or another scheduling detail. The intervention proves the causal mechanism and matching positions, not the missing historical event sequence. Instrumentation forces layout reads and can affect timing; fresh contexts also differ from the comparator's reused context.
- **Disposition:** classify this dominant outlier as a font/layout-dependent capture scroll-state mismatch. No 20px visual-spacing correction is justified. Any future deterministic capture setup must explicitly specify post-font scroll state for both sides; resetting only the app to 260 would still disagree with the frozen PNG's 240 composition. Preserve the historical comparison and its raw percentage.

## Artifact identity and limits

Preflight HTML initially referenced `/assets/index-lbPUSoJK.js` and `/assets/index-Bn7kT3R0.css`. By the first actual probe, the server had changed. All **three app runs**, including the anchor control, recorded the **same** later assets:

| Asset | SHA-256 |
| --- | --- |
| `/assets/index-Cn6F3kLZ.js` | `d2365f426db34fe276ec2a843f21931ebb6b666f7c02c760aabc810ade330722` |
| `/assets/index-C819_olH.css` | `8eab8f3365c7b6adfdf6a2d45bcb87990327e9d8cd9814c27730b464d71d9a15` |
| `/fonts/Geist-Variable.woff2`, both sides, all runs | `a369fcf5628ea2aa4e1b9e2ec6a5b3624e365bda588e1f0f2f12b564f728fbb8` |

The font hash also matches the historical comparator's served font. Relevant app long-chat source/fixtures/preview code had no diff against `5610ee9` when checked. **The served build is identified by the hashes above, not asserted to be `5610ee9`.** No build was initiated by this diagnostic. Every font response was HTTP 200, not disk-cache or service-worker served; all recorded page/console/asset-body errors were empty.

Initial screenshots are bracketed by before/after DOM samples; CDP screenshot capture is not atomic with font completion, so they cannot all be called pre-font frames. Setter/event telemetry proves the pre-font heights. CDP emitted **1440×900 PNGs** despite the context's scale-2 setting; historical comparator PNGs are **2880×1800**. Images were visually inspected at their native sizes; no replacement pixel score was computed. Equal sampled DOM geometry establishes this diagnosis only, not automated visual parity.

## Files and runnable evidence check

- Probe: `/tmp/opencode/desktop-long-scroll-probe.mjs`.
- Data: `/tmp/opencode/desktop-long-scroll-data/`.
- Six JSON records: `app-dark-natural.json`, `frozen-dark-natural.json`, `app-light-natural.json`, `frozen-light-natural.json`, `app-dark-anchor-off.json`, `frozen-dark-anchor-off.json`.
- Each record has `-initial.png`, `-settled.png`, `-normalized.png` companions; `summary.json` includes their hashes.
- Read-only assertions over saved evidence: `node /tmp/opencode/desktop-long-scroll-data/check.mjs` — **passed**. Checks font/scroll transitions, absence of restoration events, stable assets and equality of sampled geometry at the same scroll position; does not open a browser or assert whole-screen parity.
- Actually inspected: app light natural initial; app dark natural settled/normalized; frozen dark natural settled/normalized; app dark anchor-off settled; historical long-dark app/design PNGs under `/tmp/opencode/desktop-compare-7b388e2d9674/captures/2026-10-02T13-37-48-050Z-4xScRl/`.

Only this report, the external probe and its small data/check artifacts were written. No source/comparator edits, full comparison, Mac access or tests-report writes.
