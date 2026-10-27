#!/bin/sh
# Install this skill for Mistral Vibe or a generic agent skills dir.
set -e
D="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:---vibe-global}" in
  --vibe-global) T="$HOME/.vibe/skills";;
  --vibe-project) T="./.vibe/skills";;
  --global) T="$HOME/.agents/skills";;
  *) echo "usage: $0 [--vibe-global|--vibe-project|--global]" >&2; exit 2;;
esac
mkdir -p "$T"; rm -rf "$T/fiction-tool-scout"; cp -r "$D" "$T/fiction-tool-scout"
echo "installed to $T/fiction-tool-scout"
