# Design comparison

`node scripts/compare-shots.mjs` — every registered state, French (the design's copy), 1440×900 @2x, pixelmatch threshold 0.15, against `/root/cortex-ui/shots`.

- Renders: **431** (426 registered theme/states plus five click-opened states).
- Reference shots compared: **421**, mean differing pixels **0.04%**, max **0.78%**.
- All 421 comparisons are below 1%. `image-gen` result text now matches the design,
  including “quatre”; both result screenshots differ by **0.00%** after rounding.

## Remaining differences

Older Settings/menu shots have an earlier sidebar (generic bot row and fewer rail icons).
The port uses the reference's current shell consistently; that changes sidebar alignment.
Settings also includes Providers and Connection entries. Animation timing accounts for
small mascot/cursor differences. These are recorded differences, not pixel-identical claims.

## States with no design shot

Settings sections Providers & models, Connection, Bot, Notifications and Privacy have no shot in the design (sections are reached by clicking). Providers & models and Connection have no design at all and were requested in `/root/cortex-ui/DESIGN-REQUESTS.md`:

settings~bot-dark, settings~bot-light, settings~connection-dark, settings~connection-light, settings~notifications-dark, settings~notifications-light, settings~privacy-dark, settings~privacy-light, settings~providers-dark, settings~providers-light

## Files

`report.json` contains every row. Retained `<state>.{app,design,diff}.png` triplets include
differences above 0.5%, the corrected image results and file ask panel. `index.html` shows
the retained triplets side by side; all captures can be regenerated with the script.

Five interaction shots: `home+menu` and `history-menu` in both themes, `file-image+ask`
in light. The remaining 13 PNGs in the design checkout are mascot review boards rather
than registered application screens. They are not claimed as route comparisons.

Space, standalone Scheduled and Plugins & skills remain absent pending designs. This
report cannot establish visual acceptance for missing screens or every micro-transition.
