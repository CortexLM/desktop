# Saved text — visual-reference/source review
**Ready for bounded rendering; no concrete P2 layout defect identified in this source pass.**
Scope: current `packages/app/src/screens/files/{text.tsx,files.css,index.tsx,media.tsx}` UI composition, kit styles/controls and the two supplied frozen references; lifecycle review remains separately owned.
Reviewed `text.tsx` SHA-256: `7e26ead69a64cbf15d7f6ebbf7bf651980789639480d448e57a9f528d731475d`.
Reviewed `files.css` SHA-256: `247cc3d9e34a01181bf871607cbe5fde28691d177e9d84846b09a39d080cd083`.
Reference directory: `/root/cortex-ui-freezes/2026-10-02-7b388e2d9674/shots/`; both images depict `panier.ts`, 44-line metadata, header/metabar above the rounded source pane.
`file-code~affichage-light.png` SHA-256 `f5cbdd5df0f5fb3f796d41bf425661d38d4925b08d2b70ff8714fbc9ede4a6bb` matches its manifest entry.
`file-code~affichage-dark.png` SHA-256 `ed6a958bdf49be7300b0d15e041e824cbc84f1ad11a2586f400825ed00750263` matches its manifest entry; both entries specify 1440×900 CSS pixels, DPR 2.
Preservation: `media.tsx`, `kit/styles.css` and `kit/ui.tsx` have zero diff against `f2c1bc8`; removing only the new text block makes `files.css` byte-identical to that baseline, including image rules.
Frozen `src/screens/lot-medias.css:4–20,68–83` and current `files.css:267–283,341–356` compare exactly; existing shared frame/code/gutter/preview rules are retained.
`text.tsx:29` invokes the incumbent `CodeScreen` for preview/shot; `index.tsx:29–30` retains display/diff variants and `CodeScreen` retains its variant handling.
Header: existing file-code icon tile, 13px/500 title, 56px minimum row and kit Download button; live filename wraps/scrolls within 3lh, with keyboard focus (`text.tsx:114–118`, CSS:359–360).
Frame: inherited stage padding `0 16px 16px`, 12px gap, 32px-minimum metabar; live pane reuses `--code-bg`, `--ring`, `--r-card` (16px), matching both theme references.
Type/gutter: `--mono` resolves to Geist Mono; source/gutter share 12px/20px and 10px vertical padding. Gutter keeps 48px minimum, 14px right inset, `--t3`; added 12px left padding allows wider line counts to grow.
Bounds: root/body/stage/scrollport supply the relevant zero flex minima; the pane owns both overflow axes. Header and nonshrinking wrapping metabar remain outside it (CSS:358–370).
Source: two `<pre>` elements contain escaped display/gutter strings in one focusable region; `white-space:pre` and nonshrinking pre boxes retain tabs/long lines for horizontal scrolling, with shared vertical scrolling.
Empty: valid zero-line data still renders actions/metadata; empty message sits outside the empty source pre. Empty/blank filenames use the safe download-name fallback (`text.tsx:62,118–133`).
Controls/accessibility: existing labeled `IconBtn` buttons, ready filename Tab stop, labeled region Tab stop, inherited 2px `--blue` focus outline, explicit text selection, nonselectable aria-hidden gutter and inline `role=status` feedback.
Metadata: actual MIME format, UTF-8/BOM, plural line count and original Blob bytes replace fixture language/LF instructions; bytes localize numerically, line digits follow the existing translator's ordinary decimal interpolation.
Live scope correctly excludes fixture Ask/share/diff/minimap, syntax guesses and interpreted Markdown; these omissions do not constitute reference regressions for the authorized plain-text slice.
Actual addition is 14 CSS rules plus a separator, all using new text selectors; preview/source preservation above is static evidence, not pixel equivalence of a new render.
Only this report written. Source/hash/diff inspection and existing-image review only; no app execution, tests, builds, network, devices or CI. Minimum-window clipping, focus pixels and upper-budget scrolling await coordinator captures.
This binding establishes readiness for verification, not live runtime acceptance or broader design approval.
