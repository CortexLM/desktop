# Catalogs and loaders

`src/index.ts` defines supported locales, namespace flattening, fallback and
placeholder/plural resolution. `src/vite.ts` loads renderer catalogs;
`src/node.ts` loads main/script catalogs. Both exclude `*.source.json` stamps.
Keep `locales/<locale>/fixtures` separate from runtime namespace catalogs;
preview loading belongs to `../app/src/preview.tsx`.
Read `../../docs/i18n.md` and `../../scripts/translate-locales.mjs` before
regenerating translations; preserve placeholders across locales.

From root, run `bun run audit:i18n` and
`bun run test -- tests/unit/locales.test.ts tests/unit/runtime-copy.test.ts tests/unit/audit-i18n.test.ts`.
These checks do not establish translation quality or CJK glyph rendering.
