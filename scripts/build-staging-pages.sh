#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${EMBERVEIL_STAGING_BASE_URL:-${VITE_BASE:-./}}"

cd "$ROOT"
VITE_BASE="$BASE_URL" npm run build
