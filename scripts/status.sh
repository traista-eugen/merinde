#!/usr/bin/env bash
# Posts a commit status for the checked-out commit: our local replacement for CI.
# Usage: scripts/status.sh <context> <success|failure|pending|error> "<description>"
set -euo pipefail

if [ $# -ne 3 ]; then
  echo "usage: $0 <context> <success|failure|pending|error> <description>" >&2
  exit 2
fi

context=$1
state=$2
description=$3
sha=$(git rev-parse HEAD)

# A status on an unpushed commit never shows up on the PR.
if ! git branch -r --contains "$sha" | grep -q .; then
  echo "commit ${sha:0:7} is not pushed yet; push first" >&2
  exit 1
fi

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
gh api "repos/$repo/statuses/$sha" \
  -f state="$state" -f context="$context" -f description="${description:0:140}" >/dev/null
echo "$context=$state on ${sha:0:7}"
