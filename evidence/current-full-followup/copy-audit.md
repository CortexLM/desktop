# Requirement 6 — desktop copy coverage

- Reviewed pin: `6d965358bb5e02473df6be7e97ecfdb07650c0b8`; tracked sources unchanged through final check. Coordinator capture directory `evidence/mac/f9aca44/full/` appeared untracked during review; untouched.
- Audited application/i18n/audit-script/unit-test paths equal application pin `f9aca44476fcebd0699c09c9e3f7eebcd5151a2a`.
- Method: read-only source/data/hash inspection; no delegation, application execution, tests, builds, CI requests or Mac actions.

## P2 — live Code terminal exposes engine-authored English notices
- Sink: `packages/app/src/screens/code/code.tsx:274` renders completed `bash` output verbatim; `:223` selects those runs.
- Producers: `packages/core/src/tool.ts:177` appends `[exit code ${code}]`; `:45` appends `… [truncated ${s.length - max} characters]` above 50,000 characters.
- Transport: `packages/core/src/session.ts:373-379` persists successful tool returns as `status: "completed"`, including nonzero shell exits. The localized error branch therefore does not replace these notices.
- Repro, source-derived and not executed: choose French, open a live Code session with a folder/tool-capable model, request `exit 7`, approve execution, select Terminal. Expected localized exit notice; source deterministically displays `[exit code 7]` despite empty command output.
- Truncation variant: completed `bash` output longer than 50,000 characters displays the English truncation notice. This finding concerns Cortex-added annotations, not command text, stdout/stderr, filenames or chosen provider names.
- Live reachability: `packages/app/src/screens/code/code.tsx:121-124` selects `SessionLive` outside preview. Existing error masking at `:274` remains correct for `status: "error"`.
- Minimal correction direction: keep process output intact; localize display annotations from structured exit/truncation metadata (`metadata.exit` already exists). Avoid translating arbitrary tool output.
- Coverage gap: `tests/unit/runtime-copy.test.ts:41-42,77-94` renders completed todos plus an error-status shell part; no completed shell part with an exit/truncation annotation.
- Proposed failing regression, not added/run: inside that test after `view.changes`/`view.terminalLabel` initialization, for `locale === "fr"`, use this completed shell fixture and assertion:
```tsx
view.parts = [part("bash", { status: "completed", input: { command: "exit 7" }, output: "\n[exit code 7]", metadata: { exit: 7 }, time: { start: 0, end: 1 } })];
view.terminal = true;
expect(renderToStaticMarkup(React.createElement(CodeSession))).not.toContain("[exit code 7]");
```

## What the zero-finding audit actually covers
- Retained `evidence/live-actions-followup/i18n.log:2`: **63 files / 2267 keys used / 3395 English keys / 0 problems**; audit not rerun. Independent pinned file enumeration confirms 63.
- `scripts/audit-i18n.mjs:12,22` scans renderer/main TS/TSX/MTS only; core producer above is outside roots. `:42-80` follows local constants/maps/branches, not member lookups, imported bindings or general function returns.
- `:101-109` counts/checks only direct literal `t("…")`/`tr("…")` calls. Dynamic keys/imported tables are not counted; selected definition properties receive separate checks (`:92-99`). Counts are not a whole-product localization guarantee.
- `tests/unit/audit-i18n.test.ts:24-75` proves those finite syntactic cases; no cross-module/runtime-output case. `docs/i18n.md:64-70` correctly discloses this limit; `.rules/08-testing.md:9` overstates “every `t()` key”.

## Three difficult paths sampled
- **Tool/error metadata:** `state/tool-label.ts:4-25` (under `packages/app/src`) translates built-in names/todos, masks error titles, preserves extension names/paths/commands as data. Thirteen sampled common/bot keys resolve (including plural fallback); all 36 finite chat error title/body keys resolve. Terminal notice above is the concrete defect.
- **Imported mascot tables:** `mascot/parts.tsx`, `mascot/Mascot.tsx` supply 22/19 sampled keys; `screens/bots/bot.tsx:431-440,453-488` applies `t()` to labels/hints/accessories and finite shape/color/face/symbol keys. All resolve; no raw-key/English defect found in these sinks. Paths relative to `packages/app/src`.
- **Imported Components tables:** `packages/app/src/screens/system/components-data.ts` has 196 sampled catalog keys, all present; `components.tsx:156-161,189,788` translates family/section/motion values. `:813-818` gates the catalog behind preview; documented source filenames remain data.

## Locale/configuration and preview bounds
- Independent pinned JSON inspection: all **8 locales**, **13 namespaces**, **3395 keys per locale**, **7 preview fixture files per locale**; seven targets have **0 missing English keys / 0 placeholder mismatches**. Additional finite Bot/error expansion: **78 keys, 0 missing**.
- Backend owner file `/root/CortexLM-backend/i18n.json:3-6` matches `en` + `fr es de ja zh-Hans pt-BR ko`; SHA-256 `e58e8e6f49593ac3db36e0389ff463f5fa362aaa290f723c646548e14bdf9568`. Read only. `tests/unit/locales.test.ts:14` hardcodes this list rather than reading the backend file.
- Runtime loaders exclude source stamps (`packages/i18n/src/vite.ts:4`, `node.ts:10`); translator falls back to English then raw key (`index.ts:31-38`). Parity establishes presence/placeholders, not translation quality.
- Preview guards inspected: `packages/app/src/preview.tsx:9,59-68`; file viewers `screens/files/index.tsx:9-10`; Components gate above. Bot Studio uses preview state or the live Bot (`screens/bots/bot.tsx:338-344`), not fixture fallback. No source changed.
- `tests/e2e/screens.spec.ts:22,27-33` checks preview initial-state text/selected attributes for raw keys; it does not exercise live completed-shell output or establish eight-locale/hidden-interaction copy coverage.
- No additional P1/P2 vendor/raw-error/raw-key finding established in sampled sinks. Provider/model names in preview fixtures are allowed catalog data. Full frozen/native captures remain coordinator-owned and are not claimed here.

## Source identity
- `packages/core/src/tool.ts` SHA-256: `82580dbf303c22bbd8e1c51ee207a3f58e867feab6fb38fe2b7a790885ebc7e9`.
- `packages/app/src/screens/code/code.tsx` SHA-256: `7d13e6f7cfe7ce124ba4435b5a84a1dee9fb9f2377ba64397ad49ef98fe4dddd`.
- `scripts/audit-i18n.mjs` SHA-256: `7e4ba09a4652f18e2428d392141ea023bfb742277ebab3e3fcab9b13ef7c8a56`.
