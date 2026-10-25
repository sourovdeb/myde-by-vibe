#!/usr/bin/env bash
# Set GitHub repo secrets for sourovdeb/myde-by-vibe from a KEY=VALUE env file.
# Usage: ./tools/set_github_secrets.sh <path-to-secrets.env> [bookmarks.html] [passwords.csv]
# Requires: gh CLI authenticated as a user with repo admin (secrets:write).
# Nothing in this file contains secret values.
set -euo pipefail

REPO="sourovdeb/myde-by-vibe"
ENV_FILE="${1:?Usage: set_github_secrets.sh <secrets.env> [bookmarks.html] [passwords.csv]}"
BOOKMARKS="${2:-}"
PASSWORDS="${3:-}"

gh auth status >/dev/null

# Simple KEY=VALUE lines (no multiline values in this file format)
while IFS='=' read -r key value; do
  case "$key" in ''|\#*) continue;; esac
  gh secret set "$key" --repo "$REPO" --body "$value"
  echo "set $key"
done < "$ENV_FILE"

split_and_set() {
  local name="$1" file="$2"
  local encoded
  encoded=$(gzip -9 < "$file" | base64 -w0)
  local total=${#encoded} part=$(( (total + 2) / 3 ))
  if [ "$total" -le 48000 ]; then
    gh secret set "$name" --repo "$REPO" --body "$encoded"
    echo "set $name (${total} bytes encoded)"
  else
    gh secret set "${name}_PART1" --repo "$REPO" --body "${encoded:0:part}"
    gh secret set "${name}_PART2" --repo "$REPO" --body "${encoded:part:part}"
    gh secret set "${name}_PART3" --repo "$REPO" --body "${encoded:$((2*part))}"
    echo "set ${name}_PART1..3 (${total} bytes encoded, ${part} per part)"
  fi
}

[ -n "$BOOKMARKS" ] && split_and_set BOOKMARKS_HTML "$BOOKMARKS"
[ -n "$PASSWORDS" ] && split_and_set CHROME_PASSWORDS_CSV "$PASSWORDS"

echo "Done. Verify with: gh secret list --repo $REPO"
