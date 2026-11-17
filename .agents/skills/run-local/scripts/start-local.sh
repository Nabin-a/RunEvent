#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../../../.." && pwd)"
PORT="${PORT:-5173}"
CHECK_ONLY="${1:-}"

cd "$REPO_ROOT"
echo "==> [RunEvent Local] Project root: $REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed or not in PATH." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is not installed or not in PATH." >&2
  exit 1
fi

echo "==> [RunEvent Local] Runtime detected: Node $(node -v) / npm $(npm -v)"

if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "==> [RunEvent Local] Installing dependencies..."
  npm install
fi

if [ "$CHECK_ONLY" = "--check-only" ]; then
  echo "==> [RunEvent Local] Validating TypeScript and production build..."
  npm run typecheck
  npm run build
  exit 0
fi

echo "==> [RunEvent Local] Starting Vite dev server on port $PORT..."
exec npx vite --port "$PORT"
