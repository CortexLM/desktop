# Projects UI — bounded source review

**Disposition: approve the reviewed local functionality; no actionable blocker found.** Full rewrite acceptance remains incomplete.
Scope: `packages/app/src/screens/system/projects.tsx`, `packages/app/src/state/live.ts`, Home/LiveChat expected-project integration; navigation/composer dependencies and existing regression source read for context.
Readback HEAD: `0597848cdbdec362e1441b44c67bf74c525feefa`; review binds the working-file hashes below, not an assertion that these changes are committed there.
Baseline: `99e3d04a8dab6b51b6cf23bcdae0365624492e0f`.
## Findings
- **Creation:** `projects.tsx:33–56,139` keeps the dialog identity across query refreshes; synchronous pending ref rejects re-entry. Failed POST retains values; accepted POST closes/navigates only if every captured field still matches. Unmounted owners cannot navigate or emit success/error UI.
- Inputs remain editable during POST; newer text/icon/color remains after its predecessor succeeds. A later explicit Create can create another record; this is preserved input, not a silent overwrite or automatic duplicate submission.
- Name48/instructions4000 limits, installed Base UI radios, existing labels/classes and one selected Tab stop retain the incumbent form contract (`:64–70`). No fabricated live description, cover image, member initials or assigned Bot enters the grid/detail.
- **Read states:** list failure and loading precede empty; both project/session sources have Retry (`:121–138`). Detail distinguishes missing ID/not_found from recoverable reads (`:186–190`); session-read failure does not fabricate a zero-chat count (`:201,207`).
- **Instructions:** `:153–174,191–195,214–218` preserves refused PATCH drafts and newer edits during pending saves; shared pending ref serializes save/delete. Accepted values cover pre-acknowledgement reads; read-start version plus query sequence lets the next fresh read win without comparing timestamps.
- Query failure can temporarily replace the editor with Retry while its component state survives. External record deletion displays Missing; this review does not promise draft recovery after deletion or after leaving the page.
- **Ownership:** ProjectLive is keyed by committed `useNav().params.id` (`:144–146`); callbacks close over that ID and layout-effect ownership. An old query may settle on its unmounted hook instance; it cannot populate the separately keyed current project.
- **Variant/deferred navigation:** `registry.tsx:20–33` still observes current URL `v`, so an outgoing view can reflect pending presentation state. Project identity, mutation targets and drafts use the committed keyed owner; tab changes themselves perform no write. No cross-project mutation or theme-store regression established. Delayed native transition behavior is not independently exercised here.
- **Deletion:** `:176–184` waits for accepted engine deletion before navigation; busy refusal maps existing answering/stop copy and retains the project/editor. Session-list refresh explicitly observes `project.deleted` (`state/live.ts:30–32`), matching atomic detach without synthetic session events.
- **Unsupported surfaces:** files/sharing show unavailable; Rename/Archive report unavailable; live assigned-Bot/member fixtures are absent (`projects.tsx:196–220`). No file persistence, metadata editor or collaboration capability is implied.
- **Home:** `live-chat.tsx:64–91` retains the first created session across prompt refusals, guards synchronous duplicates and late-owner effects, sends `expectedProjectID: projectID ?? null`. Renderer GET-before-prompt checks are unnecessary; engine admission checks the current root synchronously before lookups/message writes (`core/src/session.ts:175–180`).
- **LiveChat:** loaded root membership supplies the expected ID/null (`live-chat.tsx:264–286`); children omit it rather than incorrectly asserting unassigned context. Main resolves inherited root context. Session/project-deletion notifications refresh membership.
- Existing live composer disables input/attachment mutation during submission and clears only on accepted `true` (`model-composer.tsx:80–91,111–127`); Home refusal/departure returns false. No new draft-clear path found.
## Source preservation
- Memory block from `/* ---------- Memory ---------- */` through EOF: byte-identical to `99e3d04`.
- Entire `ProjectPreview()` block: byte-identical; Projects preview-grid markup retained. Shared creation dialog deliberately gains real live submission, Base UI radios and the 4000-character ceiling.
- `packages/app/src/screens/system/system.css`: byte-identical to baseline. This is source preservation, not pixel-equivalence acceptance.
## Verification boundary
- This pass: source/diff inspection and hash/byte comparisons only; wrote this report only. No tests, builds, network, CI queries, Mac access or screenshot inspection.
- Coordinator-supplied outcomes: 252 units pass/one optional skip; lint/types/i18n exit0; three targeted Electron cases pass, including two-restart light/dark cases (~14.9/15.4s) and the race case (~3.5s).
- Original race-test failure remains a negative receipt: one-shot Library GET refusal was consumed by a pending sidebar refresh. Current test holds refusal until explicit restoration/Retry (`tests/e2e/projects.spec.ts:298–317`); source review confirms test scope, not an independently reproduced diagnosis or application fix.
- Eight initial geometry captures were inspected by the coordinator, not this reviewer. Full116-case run, comparator and matching native acceptance remain coordinator-owned; no result inferred while running.
## Reviewed SHA-256
- `packages/app/src/screens/system/projects.tsx`: `e46c23172a22c388e981f4b4b73e7aa8158b76b80ea628d293c82c38ae9ef54b`
- `packages/app/src/state/live.ts`: `7af5441489592dfb8f3a6f9ff6fb5b68f6e9d035b9704933f3df73ca777ec057`
- `packages/app/src/screens/chat/live-chat.tsx`: `c5ea58ac346d4ade23ab7c4c4c0934edb8132e123eec9320f41983ca7c9b16e0`
