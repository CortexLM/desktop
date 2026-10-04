# Native glyph capture predicate — source review

**Bounded approval. The corrected predicate removes a false line-box clipping assumption while retaining viewport and actual overflow-clipping checks. No concrete blocker found in this correction.**

## Geometry and predicate

`/tmp/opencode/code-native-capture-inspection.json` records the heading's element rectangle at y=245.5–277.5 (32px), its text Range at y=244.5–278.5 (34px). H1, `.home` and `main.content` have visible overflow. The nearest clipping ancestor, `.frame`, spans y=44–635; the text fits comfortably inside it and the 640px viewport. A Range extending 1px beyond an unclipped line box is not evidence of clipped text.

`/tmp/opencode/code-viewport-native.mjs:139-148` now requires positive Range dimensions, complete viewport containment, and containment along each clipped axis of the element **and** every ancestor. The element itself remains checked when its overflow actually clips. A truncated/ellipsized header or a tail outside its scrollport still fails those bounds, with the existing 0.5px geometry tolerance. Visible-overflow line boxes correctly cease to be artificial clipping boundaries.

The surrounding `painted` checks remain present (`:128-138,150-153`): visibility, positive element dimensions, full element viewport/ancestor containment, exact opacity/visibility/display, and required control hit targets. Capture checks still run before and after native pixels (`:155-170`). The heading probe still requests text measurement (`:197`); it was not removed.

## Remaining assertions

The script still verifies both diff headers inside their own cards and nonoverlapping (`:235-239`), positive body scroll range plus actual wheel movement to the bottom (`:240-243`), exact tail text and clipping-aware readability (`:244-246`), unchanged header positions during scrolling (`:247`), and copy-control hit targets (`:248-250`). Error/HTTP/dialog rejection and artifact/PID/theme checks remain enforced. This correction does not modify application code or substitute a screenshot/DOM result.

## Failure provenance

- First attempt script SHA-256: `d614d9599310dfc389b61a8dc07825cc981fb39c18735b752b3d6cb886ea1d23`; its manifest records only failure stage/digest.
- Diagnostic script SHA-256: `2b127e99e8a7c15c762c78f89646f56a97d791649269ed63478605f3f720a9e3`; it retains the assertion message. An offline SHA calculation confirms that message hashes to **`5ef0c40eb15c34b03b038bae89e94b4a0c503e4f3bd3b12c83da3ff4269b4be4`**, matching both failure manifests.
- Both attempts reference ASAR `62ddb71be7bcbd25c37a4519f7a0d982b1d93d4fada6d63dfc2e218add65fa8b`, stage `light:preview-departure`, empty captures/session IDs, empty page/console errors. The recovered diagnostic message is the generic predicate timeout; it contains no credential material. These remain failed captures, not app/runtime passes.
- The retained repository script already contains the correction; no prior script revision was available at that path's Git history or the inspected temporary script locations. Therefore an exact old/new byte diff and unchanged-other-lines attestation are unavailable. The old own-line-box criterion is documented in `evidence/mac/ffc118a/README.md:30-36` and the supplied task; current assertions above were independently inspected. Matching failure digests establish identical messages, not identical script bytes or, by themselves, the exact failed subcondition. The recorded geometry supplies the latter diagnosis.

## Reviewed pins / boundary

```text
fc515a3ac85d91ec82e6bc0e9448fe56e8aa43954b9e9182c5c8ca3a6ca8ab6e  /tmp/opencode/code-viewport-native.mjs
fc515a3ac85d91ec82e6bc0e9448fe56e8aa43954b9e9182c5c8ca3a6ca8ab6e  evidence/mac/ffc118a/scripts/code-viewport-native.mjs
8277287606dd4612786c60344635cc0aeac76b2ec6d43f039604672d2fc37d43  /tmp/opencode/code-native-capture-inspection.json
```

Read-only source/retained-evidence review plus offline hashes. No Mac access, runtime/tests, build, CI, source edits or commit. Ongoing run not inspected or duplicated. Only this report written; no delegation.
