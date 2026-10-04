# Narrow-window and native-menu follow-up

Clean-installed `b56d2ad` from the successful macOS job in
[run 36961769955](https://github.com/CortexLM/desktop/actions/runs/36961769955).
That run's Linux responsive integration failed separately on an initial blank preview;
this Mac evidence is not a green overall CI claim.

- Forty native screenshots: Code review/diff, Canvas and Work task states, both themes.
  `manifest.json` records the installed asar hash; WebP pixels match the original PNGs.
- `contact-1.jpg` / `contact-2.jpg` inspected: suggestions no longer clipped by shrinking
  cards; Canvas footer and selection bar fit; Work Take over/Pin/Close controls fit.
  Split source now scrolls horizontally. These checks cover the reported defects only.
- `Go-*.webp`: missing-design destinations disabled. `View-*.webp`: one AppKit fullscreen
  command. Clicking **Enter Full Screen** produced `AXFullScreen=true`; leaving it restored
  the normal window. Native menu renders were inspected in both appearances.
- Native Help → Design Gallery opened `#/gallery`; native Go → Chat returned to the
  home composer. Verified on the installed package, not only through Electron test APIs.
- `install.json`: eight raw locale directories; zero source stamps; zero raw preview
  fixtures; builtin summarize skill exists. Installation moved the old app aside first.

The full 426-state baseline remains revision-pinned in the parent directory. Native
captures use the remote Mac's 1024×768 desktop; window images include native chrome.
