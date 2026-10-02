#!/usr/bin/env bash
# Prints a short-lived signed download URL for a workflow artifact (used to install a CI build on the remote Mac).
# Usage: scripts/mac/artifact-url.sh <run-id> <artifact-name>
set -euo pipefail
id=$(gh api "repos/CortexLM/desktop/actions/runs/$1/artifacts" --jq ".artifacts[] | select(.name==\"$2\") | .id")
gh api -i "repos/CortexLM/desktop/actions/artifacts/$id/zip" 2>/dev/null | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r'
