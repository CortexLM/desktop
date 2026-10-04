# Linux CJK fallback correction

CI `37105137365` passed geometry while Japanese, Korean and Simplified Chinese screenshots
showed missing-glyph boxes. Original images remain in the
[CI audit](../remote-chat-foundation/ci-1076c25/README.md).
Provisioning and sentinel correction are pushed with application `760c4a0`; CI
`37110253688` passes. [Artifact review](../live-state-followup/ci-760c4a0/README.md)
verifies Noto provisioning, actual platform fallback, twelve raster checks per OS and
sixteen full-size locale views. Linux Japanese/Korean/Chinese now render glyphs.

[Controlled diagnosis](diagnosis.md) reproduces missing glyphs by excluding CJK system
fonts, then restores them with the existing system fallback directories. App font bytes,
CSS and strings stay identical. Weights 400 and 500 both reproduce; Latin pixels remain
unchanged. Two isolated captures establish the mechanism. The historical runner lacks a
font inventory, so missing packages versus fontconfig failure remains unresolved.

The renderer relies on system CJK fonts. Linux CI provisioning and a raster-based locale
sentinel are implemented; `document.fonts.check()`, text geometry and positive CDP
glyph counts all pass even when the characters are missing. The package itself and its
CSS/fonts remain separately pinned. The CI inventory records 87 patterns/61 files and
`fonts-noto-cjk` version `1:20230817+repack1-3`; selected Noto charsets cover tested text.
Chinese uses `Noto Sans CJK JP` on this runner; regional glyph-form preference is outside
this coverage. All eight macOS and five Latin Linux images remain pixel-exact to prior CI.

[Implementation checks](implementation.md) pass lint/types, the existing 48-state locale
case and twelve raster weight checks. Executing the exact new helper with isolated
missing/full fallback configurations fails/passes respectively. The local receipt uses
WenQuanYi; CI Noto provisioning belongs to the separate new-run artifact review.
The initial no-test title filter remains retained under `implementation/initial-filter/`;
it is a harness diagnostic, not a failing locale execution.
[Independent review](review.md) approves the bounded sentinel/provisioning change and
verifies the exact helper's negative/positive receipts. New-run Noto/raster/image acceptance
passes its sampled scope; historical missing-font causes remain unisolated.

Readable font/package inventories normalize trailing whitespace; adjacent `.original.gz`
files retain the exact bytes. `readable-retention.json` binds both forms.
