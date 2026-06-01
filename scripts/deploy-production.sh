#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${EMBERVEIL_PROD_HOST:-}"
USER="${EMBERVEIL_PROD_USER:-}"
PATH_ON_SERVER="${EMBERVEIL_PROD_PATH:-}"
PORT="${EMBERVEIL_PROD_PORT:-22}"
SSH_KEY="${EMBERVEIL_PROD_SSH_KEY:-}"
BASE_URL="${EMBERVEIL_PROD_BASE_URL:-/}"

if [[ -z "$HOST" || -z "$USER" || -z "$PATH_ON_SERVER" ]]; then
  cat >&2 <<'EOF'
Missing production deploy vars.
Set EMBERVEIL_PROD_HOST, EMBERVEIL_PROD_USER, and EMBERVEIL_PROD_PATH.
Optional: EMBERVEIL_PROD_PORT, EMBERVEIL_PROD_SSH_KEY, EMBERVEIL_PROD_BASE_URL.
EOF
  exit 1
fi

"$ROOT/scripts/build-staging-pages.sh"

RSYNC_SSH=(ssh -p "$PORT")
if [[ -n "$SSH_KEY" ]]; then
  RSYNC_SSH=(ssh -i "$SSH_KEY" -p "$PORT")
fi

rsync -az --delete \
  -e "${RSYNC_SSH[*]}" \
  "$ROOT/dist/" \
  "${USER}@${HOST}:${PATH_ON_SERVER}"

echo "Synced production build to ${USER}@${HOST}:${PATH_ON_SERVER} with base $BASE_URL"
