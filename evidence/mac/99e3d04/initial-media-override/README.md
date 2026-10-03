# Initial native media-override failure

The 30.995-second run failed before its first capture at `light:system-opposite-os`.
Initial hash selection, selected-card persistence and System selection passed. macOS's
actual dark-mode setting became true, but the renderer media query and resolved theme
remained light. All five cleanup checks passed; zero captures were admitted.

Installed Playwright defaults an unspecified color scheme to `light` even on a CDP
connection (`coreBundle.js:22670`). A single screenshot-free diagnosis cleared the
color-scheme/reduced-motion/forced-colors/contrast overrides using null values, then changed
the actual OS appearance dark/light/dark. All three media-query/theme/System checks passed.
The original appearance, route and absent stored preference were restored.

The corrected collector releases those CDP defaults after connection so it observes OS
preferences. It does not emulate a chosen light/dark value. Application bytes and every
behavior, identity, geometry and cleanup assertion remain unchanged. Original driver,
manifest/log and diagnostic bytes are retained separately from subsequent confirmation.
