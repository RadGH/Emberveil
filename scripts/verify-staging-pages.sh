#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_URL="${1:-https://radgh.github.io/Emberveil}"
BASE_URL="${BASE_URL%/}"

check_url() {
  local url="$1"
  local label="$2"
  if ! curl -fsI "$url" >/dev/null; then
    echo "FAIL: $label -> $url" >&2
    return 1
  fi
  echo "OK:   $label"
}

echo "Checking published HTML pages at $BASE_URL"

while IFS= read -r html; do
  rel="${html#"$ROOT/dist/"}"
  [[ "$rel" == "404.html" ]] && continue
  check_url "$BASE_URL/$rel" "$rel"
done < <(find "$ROOT/dist" -type f -name '*.html' | sort)

node - "$BASE_URL" <<'NODE'
const { chromium } = require('playwright');

const base = process.argv[2].replace(/\/$/, '');
const origin = new URL(base).origin;
const pages = ['/', '/play.html', '/index.html', '/contact.html', '/news/index.html'];

function isSameOrigin(url) {
  try { return new URL(url).origin === origin; } catch { return false; }
}

function makeContext(page) {
  const seen = [];
  page.on('response', (resp) => {
    if (isSameOrigin(resp.url()) && resp.status() >= 400) {
      seen.push(`${resp.status()} ${resp.url()}`);
    }
  });
  page.on('pageerror', (err) => {
    seen.push(`pageerror ${err.message}`);
  });
  page.on('dialog', async (dialog) => {
    await dialog.dismiss();
  });
  return seen;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const path of pages) {
      const page = await browser.newPage({
        viewport: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      });
      const seen = makeContext(page);
      await page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
      const layout = await page.evaluate(() => {
        const body = getComputedStyle(document.body);
        return {
          bodyMargin: body.margin,
          htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
          bodyOverflowX: body.overflowX,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth
        };
      });
      if (path === '/play.html') {
        if (layout.bodyMargin !== '0px') {
          seen.push(`layout body margin is ${layout.bodyMargin}`);
        }
        if (layout.scrollWidth > layout.clientWidth + 1) {
          seen.push(`layout horizontal overflow ${layout.scrollWidth} > ${layout.clientWidth}`);
        }
      }
      if (seen.length) {
        throw new Error(`${path}:\n${seen.map(s => `- ${s}`).join('\n')}`);
      }
      await page.close();
      console.log(`OK:   ${path}`);
    }
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(String(err && err.stack || err));
  process.exit(1);
});
NODE
