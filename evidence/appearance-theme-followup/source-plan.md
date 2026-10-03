# Appearance theme — minimum source proposal

**Approve this source plan after the assigned negative reproduction; no runtime acceptance claimed.** HEAD `6642d46467304cbe1181d0963d51c085ec09a0c4`; seven inspected application files equal frozen `37c22c2` bytes.

| Severity | Location | Before | Proposed after | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `packages/app/src/screens/system/settings.tsx:82–89` | Three independently tabbable ARIA radios, no arrow handlers | Installed Base UI controlled RadioGroup | Composite keyboard contract |
| MEDIUM | `packages/app/src/screens/system/settings.tsx:78`; `common.tsx:63–64` | Mount-only preference derived from storage/resolved DOM | Read Shell's actual preference through existing context | Rail updates/hash overrides must agree with selected radio |

## Exact production footprint: three files
1. `packages/app/src/shell/nav.tsx:2,5–6`: `import type { ThemePref } from "../App"`; add required `themePref: ThemePref` to `Nav`, `themePref: "system"` to its existing default object.
2. `packages/app/src/shell/shell.tsx:86`: provider value becomes `{ go, route, mode, params, themePref: pref }`. Existing preference resolution, persistence, transitions and dispatcher listener remain authoritative.
3. `packages/app/src/screens/system/settings.tsx:3,12,15,78,82–89`: import existing `Radio`/`RadioGroup`; remove local `Pref` alias and `currentThemePref` import; replace local state with `const { themePref: pref } = useNav();`.

```tsx
<RadioGroup className="pg-themes" value={pref} onValueChange={setTheme} aria-label={t("system.theme.label")}>
  {(["system", "light", "dark"] as const).map((x) => (
    <Radio.Root key={x} value={x} nativeButton render={<button />} className="pg-theme"
      data-on={pref === x || undefined} tabIndex={pref === x ? 0 : -1}>
      <span className="pg-prev" data-v={x}><i /><b /></span>
      <span className="pg-theme-l"><span className="radio" />{t(`system.theme.${x}`)}</span>
    </Radio.Root>
  ))}
</RadioGroup>
```

## Installed dependency findings
- `@base-ui/react` is **1.8.0**. Local `docs/react/components/radio.md:249–264`, `radio/root/RadioRoot.d.ts:51` explicitly support **`nativeButton render={<button />}`**; omitting `nativeButton` is incorrect.
- `RadioRoot.mjs:109–118,143–178` supplies radio semantics, Space activation, checked state and real hidden-input change dispatch. Enter is deliberately suppressed.
- `radio-group/RadioGroup.mjs:199–217` plus `internals/composite/root/useCompositeRoot.mjs:14–22,173–214` supply all four arrows, wrap and focus movement. **Home/End are disabled**; do not claim rail's additional shortcuts for these cards.
- **Keep the explicit checked-based `tabIndex` above:** `useCompositeRoot.mjs:47–75` initializes from checked state only; later external `value` changes do not synchronize its highlighted index. `useCompositeItem.mjs:21–23` restores that internal index on focus. This one prop keeps the Tab entry on the rail-selected card without custom keyboard logic or remounting.
- Group stays a div; each visible card stays a button. Hidden input is sibling, `aria-hidden`, `tabIndex=-1`; with no `name`, installed `visuallyHidden.mjs:11–15` uses **fixed**, not absolute, 1×1 positioning. It consumes no grid cell.
- Existing `kit/styles.css:51,54,456–471` button reset, focus ring, grid, preview spans and `data-on` selectors remain applicable. No CSS, icon, copy or dependency edit is needed by this proposal; rendered equality remains unverified.

## Ownership and lifetime
- Only Shell provides `NavCtx`; repository grep finds no manual test providers. Its default is an object, not null: required `themePref` avoids another fallback source. The App import is type-only, erased under existing `verbatimModuleSyntax`; no new runtime import cycle.
- Live Settings main is unkeyed; panel key is section (`shell.tsx:120`, `settings.tsx:58`). Preview main follows `hash.entryKey`; existing theme path uses `replaceState`, existing App listener reads it. Add no `key={pref}`; preview focus continuity requires runtime evidence.
- `setTheme` remains `common.tsx:62`'s existing dispatcher; no extra listener, theme context, store, synchronization effect or application observer. Provider already creates its value inline; no memoization change needed.
- Onboarding (`account.tsx:31,54–58`) has the analogous local snapshot/ARIA pattern, but no assigned runtime case: keep it outside this Settings correction. Its use keeps `currentThemePref` exported.
- Coordinator's behavior documentation should scope Settings arrows separately from rail Home/End; `AGENTS.md` and `docs/testing.md` accompany the eventual verified change.

Checks performed: source/dependency/type/CSS/lifetime inspection, provider/consumer grep, seven frozen-source byte comparisons. Not verified: Electron behavior, screen-reader announcements, focus contrast, geometry or preview continuity. No production/test/build/Mac/network/CI execution or edits; sole write is this report. **Approve — source proposal only.**
