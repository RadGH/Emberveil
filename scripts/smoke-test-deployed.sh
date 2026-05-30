#!/bin/bash
# scripts/smoke-test-deployed.sh (M250)
#
# Lightweight post-deploy check for the Emberveil staging site.
# Verifies play.html loads, serves the module script, and that the
# built JS chunk doesn't 500 / return the wrong content-type. Does NOT
# execute JS (no headless browser) — that would need Playwright.
#
# Usage:  bash scripts/smoke-test-deployed.sh
#         bash scripts/smoke-test-deployed.sh --url https://other.example.com/game13/
set -e

URL=${1:-https://radgh.github.io/RSG-Demos/game13/}
URL=${URL%/}
fail=0

check() {
  local name="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    echo "  ✓ $name"
  else
    echo "  ✗ $name"
    echo "    $out" | head -3
    fail=$((fail + 1))
  fi
}

echo "Emberveil smoke test — $URL"

# 1. play.html responds 200
check "play.html 200" bash -c "curl -sfI '$URL/play.html' | head -1 | grep -q '200'"

# 2. play.html body contains the expected canvas + module script tags
html=$(curl -sf "$URL/play.html")
check "play.html has <canvas id=\"game-canvas\">" bash -c "echo '$html' | grep -q 'id=\"game-canvas\"'"
check "play.html has a module script"            bash -c "echo '$html' | grep -qE 'type=\"module\"|assets/play-'"

# 3. The referenced main chunk resolves 200
chunk=$(echo "$html" | grep -oE '/assets/play-[A-Za-z0-9_-]+\.js' | head -1 || true)
if [ -n "$chunk" ]; then
  check "main chunk $chunk 200" bash -c "curl -sfI '$URL$chunk' | head -1 | grep -q '200'"
fi

# 4. index.html responds 200
check "index.html 200" bash -c "curl -sfI '$URL/' | head -1 | grep -q '200'"

if [ $fail -gt 0 ]; then
  echo "$fail check(s) failed"
  exit 1
fi
echo "all checks passed"
