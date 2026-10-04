# Work Activity — source copy review
Source: `/tmp/opencode/g1-work-activity-delivery.md:45–57`; terminology checked against all eight `locales/<locale>/work.json` catalogs and existing Memory translations of “turns”.
Delivery: `/tmp/opencode/g1-work-activity-translations.json`; shape `locale → act.* → string`, for the `work` namespace (`work.act.*` at lookup).
All seven proposed English strings are retained exactly; no English replacement silently applied.

| Severity | Location | Before | Suggested after | Why |
| --- | --- | --- | --- | --- |
| LOW | Contract:46, `work.act.recentScope` | The latest finished turn from each of up to 40 recently updated Bot conversations. | The latest finished Bot turn from each of up to 40 recently updated conversations. | Makes the assistant-only unit explicit; proposed clarification only. |

- “Completed” describes the recorded assistant turn, never fulfilled work, task success or current running state. Translations avoid “Succeeded”/“All handled”; French/Spanish/Portuguese feminine labels agree with the localized response noun.
- Localized response/answer terminology follows existing Memory copy. “Ended” scope includes failed/interrupted outcomes; it promises neither successful content nor a completed conversation.
- Every scope string retains **up to 40** and **updated**, not created or recently completed. Renaming can change subset membership; row timestamps remain assistant completion times.
- “Here”/“these recent conversations” limit empty copy to the same root-conversation subset and active filters. Keep the scope text visible; this is not an assertion about all history.
- Missing Bot is unavailable, never asserted deleted. A failed Bot-list read still needs the existing error/Retry state.
- Existing `act.type.errors` (“Errors”) remains unchanged and includes interruptions by contract; `act.interrupted` does not imply a system fault, resumable pause or current stop action.
- Bot capitalization/spacing follows nearby Activity copy; no new tooltip, extra key or status category. Short outcome labels retained; minimum-width layout was not measured.
- Verification: JSON parse, eight locales × seven nonempty strings = **56**, exact key parity and English-source equality passed; each scope retains numeric **40**. No application tests or runtime checks.
- Review is source-based semantic/grammar assessment, not native-speaker certification. Only these two delivery files written.

**Approve** for this source-copy scope; optional English clarification above remains coordinator-owned.
