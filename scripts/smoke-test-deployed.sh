#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec "$ROOT/scripts/verify-staging-pages.sh" "${1:-https://radgh.github.io/Emberveil}"
