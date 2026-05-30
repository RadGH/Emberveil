#!/usr/bin/env node
/**
 * redirect-assets-to-spritecook.cjs (M236) — one-shot sync tool.
 *
 * public/assets/assets.json is the /assets/ gallery manifest. Over time the
 * game migrated hero/companion/enemy portraits from /images/sprites/ and
 * /images/portraits/ to /images/spritecook/, but assets.json still pointed
 * at the old paths so the gallery showed outdated art.
 *
 * This walks every entry whose `file` starts with "../images/sprites/" or
 * "../images/portraits/" and checks if a same-named file exists under
 * /images/spritecook/. If yes, updates the `file` path. Backups previous
 * value to `_legacyFile` for forensics.
 *
 * Idempotent. Run any time new sprites land in spritecook/.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'public/assets/assets.json');
const SC_DIR = path.join(ROOT, 'public/images/spritecook');

const data = JSON.parse(fs.readFileSync(ASSETS, 'utf8'));
// The real entry list lives under data.images (keys "0","1",...). data.assets
// was empty in the checked-in file.
const list = Array.isArray(data) ? data
  : Array.isArray(data.assets) && data.assets.length ? data.assets
  : (data.images ? Object.values(data.images) : []);
let migrated = 0;

for (const entry of list) {
  if (!entry?.file) continue;
  const f = entry.file;
  if (!f.startsWith('../images/sprites/') && !f.startsWith('../images/portraits/')) continue;
  const basename = path.basename(f);
  // Try the exact basename first (e.g. necromancer_east.png), then try a
  // "_portrait" rename for bare class portraits (e.g. necromancer.png →
  // necromancer_portrait.png which is how spritecook stores them).
  const candidates = [basename];
  if (f.startsWith('../images/portraits/') && !/_[a-z]+\.png$/.test(basename)) {
    candidates.push(basename.replace(/\.png$/, '_portrait.png'));
  }
  let picked = null;
  for (const c of candidates) {
    if (fs.existsSync(path.join(SC_DIR, c))) { picked = c; break; }
  }
  if (!picked) continue;
  if (entry._legacyFile === f && entry.file.endsWith(picked)) continue;
  entry._legacyFile = f;
  entry.file = `../images/spritecook/${picked}`;
  migrated++;
}

fs.writeFileSync(ASSETS, JSON.stringify(data, null, 2) + '\n');
console.log(`Migrated ${migrated} asset path(s) from sprites/portraits → spritecook.`);
