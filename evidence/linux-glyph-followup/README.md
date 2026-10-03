# Linux CJK fallback correction

CI `37105137365` passed geometry while Japanese, Korean and Simplified Chinese screenshots
showed missing-glyph boxes. Original images remain in the
[CI audit](../remote-chat-foundation/ci-1076c25/README.md).

[Controlled diagnosis](diagnosis.md) reproduces missing glyphs by excluding CJK system
fonts, then restores them with the existing system fallback directories. App font bytes,
CSS and strings stay identical. Weights 400 and 500 both reproduce; Latin pixels remain
unchanged. Two isolated captures establish the mechanism. The historical runner lacks a
font inventory, so missing packages versus fontconfig failure remains unresolved.

The renderer relies on system CJK fonts. Linux CI provisioning and a raster-based locale
sentinel are implemented; `document.fonts.check()`, text geometry and positive CDP
glyph counts all pass even when the characters are missing. The package itself and its
CSS/fonts remain separately pinned. Next-run provisioning, glyph checks and full-size
artifact review are required to establish the correction.

[Implementation checks](implementation.md) pass lint/types, the existing 48-state locale
case and twelve raster weight checks. Executing the exact new helper with isolated
missing/full fallback configurations fails/passes respectively. Linux Noto package
installation remains untested until the new CI run; current local fallback is different.
The initial no-test title filter remains retained under `implementation/initial-filter/`;
it is a harness diagnostic, not a failing locale execution.
[Independent review](review.md) approves the bounded sentinel/provisioning change and
verifies the exact helper's negative/positive receipts. Next-run Noto/raster/image acceptance
remains required.

Readable font/package inventories normalize trailing whitespace; adjacent `.original.gz`
files retain the exact bytes. `readable-retention.json` binds both forms.
