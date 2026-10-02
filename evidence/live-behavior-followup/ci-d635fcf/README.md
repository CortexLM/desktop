# Failed checks, passing desktop jobs — d635fcf

[Run 37074187552](https://github.com/CortexLM/desktop/actions/runs/37074187552) remains **failed**.

- Checks: lint/types pass; units 170 pass, eight failures, one optional backend skip.
  The standalone i18n step was skipped after unit failure; the local audit passed separately.
- Linux and macOS: 61/61 Electron cases each, 426 registered state renders, zero retries/flaky/skips.
- macOS: unsigned arm64 package and renderer smoke pass. Runner native `screencapture` fails;
  actual installed native proof is [separate](../../mac/d635fcf/README.md).

`failed-checks.log` retains the exact eight Node 22 `localStorage is not defined` failures.
The real Code composer now renders within the locale test; its older fixture supplied neither
browser preferences nor the actual session/catalog/translator shapes. Production code needs no
change for this test environment.

Test-only `ea1c54b` supplies those fixtures, restores globals after each test, preserves all
eight-locale assertions and keeps the real composer. Node 22 reproduces the eight failures before
the fix, then passes all 24 runtime-copy cases and the full 178-unit suite plus one optional skip.
Node 24 also passes all 24 targeted cases. Logs are retained here.

[Independent historical-run review](review/README.md) verifies checkout/head/tree, both E2E reports,
package hashes and all 90 embedded build members. Eleven inspected renderer PNGs are retained
under `review/images/`. `review/receipt.json` preserves original absolute input paths; matching
JSON inventories/metadata have local copies in `review/`, with both E2E reports. The raw complete
run log and verification script remain at the recorded temporary path; `failed-checks.log` is
the committed failure extract. This receipt establishes the failed run's exact scope, not the
later test correction's CI result.
