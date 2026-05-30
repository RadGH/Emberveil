#!/usr/bin/env node
/**
 * Normalize wishlist.html checkboxes so the `<div class="box">` state matches
 * the `<span class="tag status-*">` tag on each `.wl-item` row:
 *   status-done  → box must have "checked"
 *   status-drop  → box must NOT have "checked" (dropped items stay empty)
 *   status-todo  → box must NOT have "checked"
 *   status-wip   → box must NOT have "checked" (progress shown by the tag)
 *
 * Also syncs the item-level .done / .dropped / .wip modifier class on the
 * .wl-item wrapper so CSS styling lines up with the tag.
 *
 * Idempotent. Walks any path given on argv (files or dirs).
 *
 * Usage:
 *   node scripts/sync-wishlist-checkboxes.cjs <path> [<path>...]
 */
const fs = require('fs');
const path = require('path');

const ITEM_RE = /<div class="wl-item([^"]*)">([\s\S]*?)<\/div>\s*<\/div>\s*(?=<\/div>|<div class="wl-|<\/section|<\/div>\s*<section|<div class="wl-group|<h3>|<h2>|$)/g;

function normalize(html) {
  let changed = 0;
  // Walk each .wl-item. Look inside for: the first `.box` div and the first
  // `.tag status-*` span. Sync both so tag is authoritative.
  const out = html.replace(
    /<div class="wl-item([^"]*)"><div class="box([^"]*)"><\/div><div class="body">([\s\S]*?)<\/div><\/div>/g,
    (full, itemMods, boxMods, bodyInner) => {
      const tagMatch = bodyInner.match(/<span class="tag (status-[a-z]+)">/);
      if (!tagMatch) return full;
      const tag = tagMatch[1];
      const shouldCheck = tag === 'status-done';
      const hasCheck = /\bchecked\b/.test(boxMods);
      let newBoxMods = boxMods;
      if (shouldCheck && !hasCheck) newBoxMods = (boxMods + ' checked').replace(/\s+/g, ' ');
      else if (!shouldCheck && hasCheck) newBoxMods = boxMods.replace(/\s*\bchecked\b/, '');
      // Normalize wrapper modifier class
      let modifier = '';
      if (tag === 'status-done') modifier = 'done';
      else if (tag === 'status-drop') modifier = 'dropped';
      else if (tag === 'status-wip') modifier = 'wip';
      // Keep any non-state classes; strip done/dropped/wip first
      let itemModsClean = itemMods.replace(/\s*\b(done|dropped|wip)\b/g, '');
      if (modifier) itemModsClean = (itemModsClean + ' ' + modifier).replace(/\s+/g, ' ');
      if (newBoxMods === boxMods && itemModsClean === itemMods) return full;
      changed++;
      return `<div class="wl-item${itemModsClean}"><div class="box${newBoxMods}"></div><div class="body">${bodyInner}</div></div>`;
    }
  );
  return { html: out, changed };
}

function processFile(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const { html, changed } = normalize(src);
  if (changed > 0 && html !== src) {
    fs.writeFileSync(fp, html);
    console.log(`  ${fp} — ${changed} row(s) normalized`);
  } else {
    console.log(`  ${fp} — already in sync`);
  }
  return changed;
}

function walk(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return processFile(target);
  if (st.isDirectory()) {
    let total = 0;
    for (const entry of fs.readdirSync(target)) {
      const p = path.join(target, entry);
      const s = fs.statSync(p);
      if (s.isDirectory()) { total += walk(p); continue; }
      if (entry === 'wishlist.html') total += processFile(p);
    }
    return total;
  }
  return 0;
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: sync-wishlist-checkboxes.cjs <path> [<path>...]');
  process.exit(2);
}
let total = 0;
for (const a of args) {
  console.log(`Scanning ${a}`);
  total += walk(a);
}
console.log(`Total rows normalized: ${total}`);
