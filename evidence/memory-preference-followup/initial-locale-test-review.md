# Memory localization test review
- Reviewed `tests/e2e/memory-localization.spec.ts`: 83 lines, SHA-256 `3c28ffa1defa09395e42f5412dba86fa0befb27c5b41dde5d5f2ecf87e554740`; working tree at `74579d574646aff5dbd462247b4fd47a99dd2cdd`.
## Required corrections
1. **Locale initialization blocker — lines 51–53.** Every target keeps `cortex://app/index.html`; changing only its fragment is same-document navigation. Updating localStorage does not update the mounted `I18nProvider` (`packages/app/src/i18n.tsx:6–13`). The first French iteration retains English and fails its `lang` assertion. Add `await page.reload()` immediately after line 52, before assertions. Existing `tests/e2e/remote-auth.spec.ts:487–489` uses precisely this sequence.
2. **Failure evidence omission — lines 39–41.** `observations.push(...)` occurs after the geometry assertions. A failed row therefore never reaches the JSON attached in `finally`. Move that push before assertions so the failing state is retained; no additional probe needed.
## Verified scope
- Read-only Python JSON comparisons passed: all 56 additions exactly match `/tmp/opencode/memory-copy-translations.json`; current English matches the contract; six `system` keys plus one `bots` key per locale; `{name}` preserved once per Bot value.
- All pre-existing keys/values in the 16 catalogs match `f82a648`; no existing copy changed.
- Memory selectors match `projects.tsx:378–389`; System `BotEmpty` renders `.empty > p` (`system/common.tsx:30–32`). Bot settings uses `.empty.travail-empty > p` inside `.pg-panel` (`work/common.tsx:60–62`, `bots/team.tsx:249`).
- Privacy selector matches `MemoryToggle`'s `.li > .grow` plus controlled, aria-labelled switch (`settings.tsx:47–58`). All eight current labels contain neither quote nor backslash; no CSS escaping correction required. Exact switch roles avoid header-name ambiguity.
- Fresh Bot creation validates the supplied name/model shape without catalog lookup (`schema/src/index.ts:516–523`, `core/src/bot.ts:30–35`); no provider or prompt is needed. Settings calls use real IPC; fresh profile has no legacy-false import.
- Intended coverage: 8 locales × 2 themes × 4 states = 64 measurements; all seven new strings asserted; eight dark paused captures. Both themes receive text geometry assertions.
- Geometry measures text ranges against the viewport and overflow-clipping ancestors. After scrolling the last match, every earlier match is still checked; an offscreen header cannot silently pass. Actual simultaneous fit remains an execution question, not an established defect.
- Existing auth coverage already checks CJK glyph rasters at 400/500; this bounded copy test need not duplicate it.
- Review only: no app edits, tests, lint, builds, network or GUI execution. Coordinator owns corrections and integrated execution.
