#!/usr/bin/env bash
set -euo pipefail

BASE_SHA="${1:-}"
HEAD_SHA="${2:-HEAD}"

if [ -n "$BASE_SHA" ]; then
  RANGE="$BASE_SHA..$HEAD_SHA"
else
  RANGE="HEAD~1..HEAD"
fi

echo "Verifying commit messages in range: $RANGE"

DISALLOWED=$(git log "$RANGE" --format="%H %B" | grep -Ei "co-authored-by:.*(claude|anthropic|antigravity|cursor|copilot|chatgpt|openai|gemini)" || true)
ATTRIBUTION=$(git log "$RANGE" --format="%H %B" | grep -Ei "generated with.*(claude|cursor|antigravity|chatgpt|copilot)" || true)

if [ -n "$DISALLOWED" ] || [ -n "$ATTRIBUTION" ]; then
  echo "ERROR: Disallowed AI attribution or Co-Authored-By trailer found in commit messages:"
  [ -n "$DISALLOWED" ] && echo "$DISALLOWED"
  [ -n "$ATTRIBUTION" ] && echo "$ATTRIBUTION"
  echo ""
  echo "Policy: Conventional commits only. Do not include Co-Authored-By or AI attribution."
  exit 1
fi

echo "Commit messages policy check passed."
