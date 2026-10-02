# Corrected CI — 93c1e78

[Run 37076113707](https://github.com/CortexLM/desktop/actions/runs/37076113707) **passes**:
lint/types, 178 unit tests plus one optional backend skip, zero i18n findings,
61 Electron tests per OS, 426 registered renders per OS, unsigned macOS package/smoke.
The [independent review](review.md) checks all three checkout pins, both reports and eleven images.

Application/E2E/build inputs match `d635fcf`; the only executable correction is the
`ea1c54b` locale test fixture. The current artifact's complete ASAR was extracted from a
24 MiB HTTP range and rehashed: `aa11177040f5fd1e2367fad84575b23e85416bfdd64572e16e1686b0f166ee08`.
All 91 ASAR members match the earlier package, including 90 build members. The current full ZIP,
native executable and resources outside ASAR were not byte-compared.

`receipt.json` retains original input paths; matching JSON metadata/inventories are copied here.
Both E2E reports are retained. `retained-images.json` maps all eleven inspected images to committed
bytes: seven reuse identical images from the failed run, four newer routine images live here.
Complete logs, range bytes and verification scripts remain at the recorded temporary paths.

CI native display capture still fails; window/menu API assertions and renderer smoke pass.
[Installed native proof](../../mac/d635fcf/README.md) remains pinned to the earlier exact package
with the same ASAR. The March Setup Assistant crash is a historical system incident, not Cortex.

The preceding [failed](../ci-d635fcf/README.md) and [cancelled](../ci-ea1c54b/README.md) runs retain
their original outcomes. This receipt covers the committed Code/routine correction, not subsequent
working-tree changes or full product acceptance.
