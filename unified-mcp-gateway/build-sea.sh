#!/bin/bash
# Build Unified MCP Gateway as a single .exe using Node SEA (Linux/macOS cross-compile not supported — Windows only)
# Requires: Node.js >= 20, postject (npm install -g postject)

set -e
cd "$(dirname "$0")"

echo "[1/4] Generating SEA blob..."
node --experimental-sea-config sea-config.json

echo "[2/4] Copying node.exe to gateway.exe..."
node -e "require('fs').copyFileSync(process.execPath, 'gateway.exe')"

echo "[3/4] Injecting SEA blob into gateway.exe..."
npx postject gateway.exe NODE_SEA_BLOB sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

echo "[4/4] Cleaning up..."
rm -f sea-prep.blob

echo ""
echo "Build complete: gateway.exe"
ls -lh gateway.exe
