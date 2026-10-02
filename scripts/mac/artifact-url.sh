#!/usr/bin/env bash
# Prints a short-lived signed download URL for a workflow artifact (used to install a CI build on the remote Mac).
# Usage: scripts/mac/artifact-url.sh <run-id> <artifact-name>
set -euo pipefail
id=$(gh api "repos/CortexLM/desktop/actions/runs/$1/artifacts" --jq ".artifacts[] | select(.name==\"$2\") | .id")
curl -s -o /dev/null -w "%{redirect_url}" -H "Authorization: Bearer $(gh auth token)" "https://api.github.com/repos/CortexLM/desktop/actions/artifacts/$id/zip"
