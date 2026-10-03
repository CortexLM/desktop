# Work Activity locale-test source review

Reviewed `tests/e2e/work-activity-localization.spec.ts`: 111 lines, SHA-256 `d1e8ac183f7f67a810b8d817047dfbfe6275b8859a5cbdbcf7b66d4b5874a98c`, at repository HEAD `906987b94c04c3c4566ecb33394584ff0e93074e`.
Compared updated delivery contract and existing engine/fixtures. No unfinished Activity implementation review, execution, build, network, device or repository edits.

## Verdict
Approve the real-engine setup and coverage structure. **One narrow geometry false-pass gap needs correction before claiming all row text is readable.**

## Required correction
- `:39–51` collects every text node's Range rectangles, then intersects clipping bounds only from the row element upward (`:45`). A descendant title/name span with `overflow:hidden` or `text-overflow:ellipsis` can clip text while the full text rectangle still fits inside the wider row. Row scrollWidth and `toContainText` do not detect that case.
- Preserve the text node with its rectangles; compute clipping bounds from **that node.parentElement** through its ancestors to the viewport. Check every nonempty text fragment against those per-node bounds plus the row bounds. Keep the existing whole-row width assertion. No additional framework or app change needed.
- This matters for the explicit long Bot name and 72-character unbroken title; current helper proves row/viewport containment, not absence of descendant clipping.

## Confirmed source coverage
- 8 locales × 2 themes: three empty-state targets plus scope/three populated rows = **112 measurements**; eight dark populated captures. Locale storage + navigation + reload updates the real translator; lang/theme assertions verify selection.
- Single fixture catalog/provider; real Bot creation, session creation/title PATCH, prompt, abort and Bot deletion all pass through existing IPC/API. No DB/model-state stub.
- Provider request 1 returns valid terminal SSE; request 2 returns HTTP 400; request 3 sends headers/text and stays open until real session abort. Final count three detects unexpected retry traffic.
- Persisted assistant role/finite completion/outcome polling waits for real terminal state; HTTP 400 maps to `provider_error` (`packages/core/src/error.ts:27–31`), abort to `aborted` (`session.ts:450–467`). Existing provider config defaults enabled; key save preserves the startup baseURL override (`provider.ts:45–64`).
- Titles are patched before prompts, preventing automatic first-prompt title replacement (`session.ts:194–197`). Private input/answer/failure sentinels remain distinct from displayed metadata; main-content exclusion is meaningful.
- Deleting the second actual Bot retains its failed/aborted sessions (`core/src/bot.ts:44–49`); populated checks exercise neutral unavailable attribution plus the live long-name Bot.
- Native row-button locators use unique fixture titles and assert one match; no duplicate title-bearing toolbar/menu control is introduced by this fixture.
- Reduced motion, scrolling and fonts readiness support deterministic geometry. No source evidence of a timing failure warrants extra sleeps/timeouts.
- Existing cleanup closes Electron, removes its profile, closes provider connections. This review does not claim that cleanup or rendering has executed successfully.

## Proof limits
- This locale test intentionally does not cover active follow-up retention, ID-filter behavior, 40-root limit, navigation, failed-read Retry or process restart; those belong to the separate functional test.
- Its first old-build failure will likely be missing new empty-state copy; that negative alone does not establish all populated regressions. Positive fresh-build results must establish the full matrix.
- No screenshot/glyph inspection or fresh pass claimed. Review again against the final changed helper hash before recording complete readability acceptance.
