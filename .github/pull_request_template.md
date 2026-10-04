<!--
Title format: `type: short description` (feat, fix, docs, test, refactor).
Read AGENTS.md and .rules/ before you start. The attestation at the bottom is
required — a reviewer reads it first.
-->

## What changed

<!-- What this PR does, and why. One or two paragraphs. -->

## How to try it

<!--
bun run build && bun run start
(renderer only: bun run dev:api + bun run dev:app, then http://localhost:5299)

Which route (#/<screen-id>), which state, what to click.
-->

## Honest states

<!--
Which empty / loading / error / no-provider / unavailable states this PR adds or
changes, and where they are covered by tests. Write "none" if the PR touches no surface.
-->

## Verification

<!--
What you actually ran, and what you saw. Widths and themes if you changed layout.

bun run lint
bun run typecheck
bun run test
bun run audit:i18n
bun run build && bun run test:e2e
-->

## Risk and rollback

<!-- What could break, and how to undo it. -->

---

## Attestation

Tick a box only if it is true. If a line does not apply, leave it unticked and say
why on the line. Do not delete this block.

- [ ] **Rules read.** I read `AGENTS.md` and the relevant files in `.rules/` before writing code, and this change follows them.
- [ ] **Error copy is product language.** No user-facing string names a vendor, a status code, a stack fragment, or an internal identifier. Failures say which Cortex capability is affected and what the user can do next. (`.rules/02-errors.md`)
- [ ] **Responsive and themed.** Every screen I touched is usable from the 960×640 minimum window up to 1440 and beyond, in both dark and light, using the theme variables rather than raw hex. (`.rules/03-responsive.md`)
- [ ] **Security holds.** No provider key or session material reaches the renderer; no secret is in the diff; the renderer stays sandboxed; local mode works without an account. (`.rules/01-security.md`)
- [ ] **Docs updated in this PR.** `AGENTS.md` is updated if this change touches product surfaces, engine routes, environment/configuration, or error copy; other affected docs under `docs/` are updated too. (`.rules/05-documentation.md`)
- [ ] **I verified this carefully.** I ran the app and the checks above, read my own diff end to end, and did not weaken a test or an assertion to get a green result.
