#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NODE_BIN="${NODE_BIN:-node}"

if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
  if [ -x "/Users/arturmanukan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]; then
    NODE_BIN="/Users/arturmanukan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
  else
    echo "Node.js not found. Install Node.js or set NODE_BIN=/path/to/node." >&2
    exit 1
  fi
fi

"$NODE_BIN" build-pages.js

if command -v wrangler >/dev/null 2>&1; then
  exec wrangler deploy
fi

if [ -x "./node_modules/.bin/wrangler" ]; then
  exec ./node_modules/.bin/wrangler deploy
fi

CACHED_WRANGLER="$(find "$HOME/.npm/_npx" -path "*/node_modules/.bin/wrangler" 2>/dev/null | head -1 || true)"
if [ -n "$CACHED_WRANGLER" ] && [ -x "$CACHED_WRANGLER" ]; then
  exec "$CACHED_WRANGLER" deploy
fi

echo "Wrangler not found." >&2
echo "Install it once, authorize Cloudflare, then run this script again:" >&2
echo "  npm install -g wrangler" >&2
echo "  wrangler login" >&2
echo "  scripts/deploy-cloudflare.sh" >&2
exit 1
