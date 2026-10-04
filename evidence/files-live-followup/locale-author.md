# Saved-image viewer translations
- Added exactly 19 English-source keys to each of `fr es de ja zh-Hans pt-BR ko`: 133 new values, 290 keys per `files.json`.
- Before editing, all seven files matched HEAD. After editing, all 271 previous key-values per locale (1,897 total) remain unchanged; removing the 19 inserted lines reproduces each original file byte-for-byte.
- Existing files use two-space indentation; preserved their actual formatting. English and Chat catalogs were not edited.
- All eight `files.json` key sets match. Placeholders `{pct}`, `{width}`, `{height}`, `{n}` match English exactly; Fit-relative labels reuse each locale’s existing Fit wording.
- Copy retains saved static PNG/JPEG/WebP scope, inclusive 50 MB / 40 million pixels / 32,768 per-axis limits, draft protection and recovery instructions; no autosave or security-sanitization promise added.
- Verification: before/after JSON+byte assertions passed; `NODE_ENV=test ./node_modules/.bin/vitest run tests/unit/locales.test.ts` passed (9 cases).
- Model-authored translations; independent fluent-speaker review unavailable. No app/native validation, external translation API, network, build, full suite, CI, Mac or commit performed.

| Locale | Final SHA-256 (`packages/i18n/locales/<locale>/files.json`) |
| --- | --- |
| fr | `a7e43787fc346a65b3a9e8a2e80cabf57b0fa736b51c0def7159289288d78962` |
| es | `d4c7f6580100f0fffb3d2f67fdbb06366efa1d5edd7dee239ebf24594db09e93` |
| de | `2e37c0e650253c2ff0e14091dabecacb91e1eb98d822a8afb1e1a2a8df6ba852` |
| ja | `79756a1a8984ad75fa3cb79fa49914b3ba11d67e0dd37a63def19eed1818ebcf` |
| zh-Hans | `ad018efb02e2b53d0c1f4d1b5a91c44237666f8a3e6fbf4be87fe51e893e223b` |
| pt-BR | `6438f7a51a13983d5cc346f1c923aa82df75d8aa927c526aa30684fc3b321adb` |
| ko | `5576da23f6869961d9ec25944f7dfd172bf7ad663ec1d3406bc6b16602f1a5e1` |
