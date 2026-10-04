# Draft PR update: remote Chat and retained drafts

Prepared locally; not posted. Existing PR: https://github.com/CortexLM/desktop/pull/36.
This draft describes the resumption increment, not all inherited changes on that PR.

## What changed

Connect remote Chat through main-owned authentication, discovery, image upload,
admission, replay and bounded history. Separate remote process lists from local
conversations and projects. Preserve draft text, attachments and one-off choices
through refusals, canceled navigation and explicit fresh-chat recovery.

Implement the saved Send with Enter preference and authorized email/MFA continuation
forms. Invalidate obsolete authentication callbacks at deferred departure without
canceling still-authorized main requests.

## How to try it

Build with `NODE_ENV=production bun run build`, then `bun run start`.
Local Home works without an account. Configure a supported remote connection in
Settings, sign in, open Home, explicitly select a discovered model and send.
Existing local/project conversations remain local. Remote options expose one-off
selection; Detach stops delivery, not remote processing. Resume replays the original
request. Historical image restrictions offer a new Chat retaining the draft.

## Honest states

Signed-out, unavailable discovery/model, unknown image support, admission refusal,
uncertain delivery, expired replay and limited history remain explicit. Remote
records and authentication are process-local. Arbitrary departure does not persist
remote drafts. History is not a complete account transcript.

## Verification

Latest local build: 195 Electron cases pass in 18.7 minutes. Unit run: 316 pass,
one optional skip. Types, lint, i18n and build pass; Linux package reports SMOKE OK.
English captures cover 960x640 and 1280x900 in both themes; 16 minimum-window
locale/theme captures were inspected. Ownership and deferred-auth gate corrections
are approved within their recorded scope.

No matching new CI or installed-Mac acceptance is claimed. The Mac remains shared;
saved-text native Download remains unverified. No eligible real image/reasoning
backend is available, as confirmed by the user. See `local-handoff.md` and
`remote-renderer-status.md` for exact evidence and retained negative attempts.

## Risk and rollback

Remote route ownership and asynchronous authentication are the principal regression
risks. Keep local/project dispatch separate. Any rollback must target the eventual
published increment; do not reset the shared working tree or inherited evidence.

## Attestation

- [ ] **Rules read.** Final publication review must reconcile the entire PR, including inherited changes; this draft is narrower.
- [ ] **Error copy is product language.** Scoped tests pass; the entire unpublished diff still needs publication review.
- [ ] **Responsive and themed.** Scoped sizes/themes pass, not exhaustive acceptance of every touched screen at all required sizes.
- [ ] **Security holds.** Scoped boundary tests pass; no whole-PR attestation is inferred from this draft.
- [ ] **Docs updated in this PR.** Local docs are updated but not committed or pushed into the PR.
- [ ] **I verified this carefully.** Local checks and gate reviews are recorded; complete PR diff review and external acceptance remain open.
