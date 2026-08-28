#!/usr/bin/env bash
# Staging checks a Linux box can run without secrets, a display, or a keychain.
#
# Usage:
#   bash scripts/test-staging-local.sh
#   bun run test:staging-local
#
# This script:
#   1. Unit-tests @cortex-ide/cortex-api (HTTP + realtime contract)
#   2. Unit-tests @cortex-ide/app (web hosts, pairing, Code rejects local)
#   3. Typechecks those two packages
#
# Not run here (need extra hardware / secrets):
#   bun run test:e2e          # Electron Playwright. Needs xvfb (the npm script
#                             # already wraps xvfb-run). Also needs a built app
#                             # and Playwright Chromium. Fails as root without
#                             # --no-sandbox (the fixture adds that when uid=0).
#   bun run test:visual       # Paper artboard captures. Needs xvfb.
#   bun run test:e2e:headed   # Needs a real display.
#   Device-flow / keychain    # Needs a human + OS keychain. Not in this repo's
#                             # headless e2e.
#
# Do not set VITE_CORTEX_API_BASE_URL or API keys. The suite stays detached.

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if ! command -v bun >/dev/null 2>&1; then
  echo "error: bun is required (https://bun.sh)" >&2
  exit 1
fi

if [ -n "${VITE_CORTEX_API_BASE_URL:-}" ] || [ -n "${CORTEX_API_BASE_URL:-}" ]; then
  echo "error: unset VITE_CORTEX_API_BASE_URL and CORTEX_API_BASE_URL so this run stays offline." >&2
  exit 1
fi

echo "==> cortex-api unit tests"
CORTEX_ALLOW_TEST_DOUBLES=1 bun run --filter '@cortex-ide/cortex-api' test

echo "==> app unit tests"
CORTEX_ALLOW_TEST_DOUBLES=1 bun run --filter '@cortex-ide/app' test

echo "==> typecheck cortex-api"
bun run --filter '@cortex-ide/cortex-api' typecheck

echo "==> typecheck app"
bun run --filter '@cortex-ide/app' typecheck

echo
echo "staging-local: ok"
echo "Skipped (need xvfb): bun run test:e2e   bun run test:visual"
echo "See docs/staging.md"
