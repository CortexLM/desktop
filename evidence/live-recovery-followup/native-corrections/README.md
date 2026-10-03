# Native-discovered preview and Code corrections

The installed `b0e6d78` [negative receipts](../../mac/b0e6d78/README.md) reproduce Work
preview departure into live Code and unreachable long terminal output. Separate controlled
Electron regressions reproduce both failures before their corrections.

- Preview lifetime follows App's committed route snapshot. Work's variant/config follow
  the mounted tree; live commit clears preview context. A real held native transition
  preserves the outgoing draft, then verifies empty live engine data and fixture-free Code.
  [Negative handoff](preview-departure/README.md), [independent review](preview-departure/independent-review.md).
- The Code grid right pane accepts a constrained height. Its terminal owns scrolling;
  direct diff children use a two-row grid so each pre scrolls below its visible header.
  Real approved shell/file writes exercise these paths; original output/replay stay unchanged.
  [Negative handoff](terminal-viewport/README.md), [final screenshots](after/contact.jpg).

After one integrated rebuild, [26 targeted Electron cases](final-e2e.log) pass: all six
auth cases, ten Bot safety cases, six navigation cases, two Work font-scroll cases, real
terminal localization/scroll checks and two real-file diff panes. Terminal captures cover
960/1024/1440 × both themes; diff checks cover 960/1440 × both themes with real wheel input.
All ten final Code captures retained; source reviews and original failures remain separate.

The diff source review identifies an additional mixed-size case: proportional flex shrinking
can collapse a short diff's header beside a long one. The equal-length passing case does not
cover it. A real mixed-size negative reproduces a 6.52px card/32px header. A scoped 70px
minimum and parent overflow resolve it; the strengthened three-file test verifies the short
card plus two long bodies. [Final source review](final/source-review.md) approves the closure.
The [final eight-case run](final/targeted.log) passes after rebuilding, including all six auth
cases and both real terminal/diff tests. Final lint/types, package/smoke and [all 90 package
member checks](final/package-linux.json) pass. The initial review/failure remains retained.

Lint/types/i18n pass. Rebuilt Linux [package-member equality](final-package-linux.json) and
[smoke](final-smoke.log) pass. The earlier full auth suite remains 90 cases/426 renders,
before these final preview/Code deltas. Final changed-revision CI/native verification pending.
