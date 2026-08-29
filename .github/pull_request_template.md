<!--
Title format: `type: short description` (feat, fix, docs, test, refactor).
Read AGENTS.md and .rules/ before you start. The attestation at the bottom is
required — a reviewer reads it first.
-->

## What changed

<!-- What this PR does, and why. One or two paragraphs. -->

## How to try it

<!--
Desktop and web, since both hosts run the same renderer.

Desktop:  bun run build && bun run start
Web:      bun run --filter @cortex-ide/app dev

Which route, which state, what to click.
-->

## Honest states

<!--
Which empty / loading / error / signed-out states this PR adds or changes, and
where they are covered by tests. Write "none" if the PR touches no surface.
-->

## Verification

<!--
What you actually ran, and what you saw. Widths and themes if you changed layout.

bun run typecheck
npx eslint packages
bun run test
bun run test:discovery
-->

## Risk and rollback

<!-- What could break, and how to undo it. -->

---

## Attestation

Tick a box only if it is true. If a line does not apply, leave it unticked and say
why on the line. Do not delete this block.

- [ ] **Rules read.** I read `AGENTS.md` and the relevant files in `.rules/` before writing code, and this change follows them.
- [ ] **Error copy is product language.** No user-facing string names a vendor, a status code, a stack fragment, or an internal identifier. Failures say which Cortex capability is affected and what the user can do next. (`.rules/02-errors.md`)
- [ ] **Responsive and themed.** Every screen I touched is usable at 390, 768 and 1440 CSS pixels, in both dark and light, using tokens rather than raw hex. (`.rules/03-responsive.md`)
- [ ] **Security holds.** No token, key, or session material reaches the renderer; no secret is in the diff or in `.env.example`; guest and signed-in paths both behave, with gated surfaces shown and locked rather than hidden. (`.rules/01-security.md`)
- [ ] **Docs updated in this PR.** `AGENTS.md` is updated if this change touches product surfaces, routes, environment/configuration, or error copy; other affected docs are updated too. (`.rules/05-documentation.md`)
- [ ] **I verified this carefully.** I ran the app and the checks above, read my own diff end to end, and did not weaken a test or an assertion to get a green result.
