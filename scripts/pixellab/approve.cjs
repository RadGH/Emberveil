/**
 * approve.cjs — promote reviewed PixelLab candidates to canonical in-game frames.
 *
 *   node scripts/pixellab/approve.cjs <spriteId>           # approve all 7 + reference sheet
 *   node scripts/pixellab/approve.cjs <spriteId> <pose>    # approve one frame
 *   node scripts/pixellab/approve.cjs <spriteId> reference # lock the reference sheet only
 *
 * For each approved frame:
 *   1. Copy   public/images/pixellab/<id>/<pose>.png
 *      → new public/images/spritecook/<id>_<pose>.png
 *   2. Back  up the displaced file to
 *          public/images/_bg-removal-backup/<id>_<pose>_pre-pixellab.png
 *      (only if one existed and hasn't been backed up already).
 *   3. Stamp approvedAt in art_direction/<id>.json.
 *   4. Update pixellab_redesign_state.json.
 *
 * Afterwards, ALWAYS runs the existing thumbnail generator and image-review
 * manifest rebuild so the gallery reflects the change.
 *
 * Never touches git. Never pushes. User commits when ready.
 */

const fs   = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT  = path.resolve(__dirname, '..', '..');
const AD_DIR     = path.join(REPO_ROOT, 'public', 'data', 'art_direction');
const STATE      = path.join(REPO_ROOT, 'public', 'data', 'pixellab_redesign_state.json');
const PIXELLAB   = path.join(REPO_ROOT, 'public', 'images', 'pixellab');
const SPRITECOOK = path.join(REPO_ROOT, 'public', 'images', 'spritecook');
const BACKUP     = path.join(REPO_ROOT, 'public', 'images', '_bg-removal-backup');
const ARCHIVE    = path.join(REPO_ROOT, 'public', 'assets', 'character-redesign-archive');

const POSES = ['portrait','south','east','east_attack','east_spell','east_block','east_ko'];

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJson(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }

function backupOriginal(spriteId, pose) {
  const orig = path.join(SPRITECOOK, `${spriteId}_${pose}.png`);
  if (!fs.existsSync(orig)) return false;
  fs.mkdirSync(BACKUP, { recursive: true });
  const dst = path.join(BACKUP, `${spriteId}_${pose}_pre-pixellab.png`);
  if (fs.existsSync(dst)) return false;  // already backed up, don't clobber
  fs.copyFileSync(orig, dst);
  return true;
}

/**
 * Archive the current canonical frame (if it exists) before overwriting it.
 * Archive location: public/assets/character-redesign-archive/<spriteId>/<timestamp>/
 * Also writes an index.json in the character subdirectory.
 */
function archiveFrame(spriteId, pose, ad) {
  const existing = path.join(SPRITECOOK, `${spriteId}_${pose}.png`);
  if (!fs.existsSync(existing)) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const charDir   = path.join(ARCHIVE, spriteId);
  const snapDir   = path.join(charDir, timestamp);
  fs.mkdirSync(snapDir, { recursive: true });

  // Copy image
  const imgDst = path.join(snapDir, `${pose}.png`);
  fs.copyFileSync(existing, imgDst);

  // Write per-snapshot meta
  const meta = {
    spriteId,
    pose,
    archivedAt: new Date().toISOString(),
    sourcePath: `images/spritecook/${spriteId}_${pose}.png`,
    prompt: ad.frames?.[pose]?.prompt || '',
    approvedAt: ad.frames?.[pose]?.approvedAt || null,
  };
  fs.writeFileSync(path.join(snapDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  // Update character-level index
  const indexPath = path.join(charDir, 'index.json');
  let idx = { spriteId, snapshots: [] };
  if (fs.existsSync(indexPath)) {
    try { idx = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch (_) {}
  }
  idx.snapshots.push({ timestamp, pose, archivedAt: meta.archivedAt });
  idx.snapshots.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  fs.writeFileSync(indexPath, JSON.stringify(idx, null, 2) + '\n');

  console.log(`[archive] ${spriteId}/${pose} → ${snapDir}`);
}

function approveFrame(spriteId, pose, ad, state) {
  const src = path.join(PIXELLAB, spriteId, `${pose}.png`);
  if (!fs.existsSync(src)) throw new Error(`candidate missing: ${src}`);

  // Archive previous version before overwriting
  archiveFrame(spriteId, pose, ad);

  backupOriginal(spriteId, pose);

  const dst = path.join(SPRITECOOK, `${spriteId}_${pose}.png`);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);

  ad.frames = ad.frames || {};
  ad.frames[pose] = ad.frames[pose] || {};
  ad.frames[pose].path = `images/spritecook/${spriteId}_${pose}.png`;
  ad.frames[pose].approvedAt = new Date().toISOString();

  state.characters[spriteId].framesStatus[pose] = 'approved';
  return dst;
}

function approveReference(spriteId, ad, state) {
  if (!ad.referenceSheet?.path) throw new Error('no reference sheet to approve');
  const abs = path.join(REPO_ROOT, 'public', ad.referenceSheet.path);
  if (!fs.existsSync(abs)) throw new Error(`reference sheet missing on disk: ${abs}`);
  ad.referenceSheet.approvedAt = new Date().toISOString();
  state.characters[spriteId].referenceStatus = 'approved';
  return abs;
}

/** Rebuild the top-level archive index (public/assets/character-redesign-archive/index.json). */
function rebuildArchiveIndex() {
  if (!fs.existsSync(ARCHIVE)) return;
  const chars = fs.readdirSync(ARCHIVE)
    .filter(name => fs.statSync(path.join(ARCHIVE, name)).isDirectory());
  const indexPath = path.join(ARCHIVE, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ characters: chars.sort() }, null, 2) + '\n');
}

function runThumbnails() {
  const r = spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'generate_thumbnails.js')], { stdio: 'inherit' });
  if (r.status !== 0) console.warn('[approve] thumbnail generator exited non-zero; continuing.');
}

function runManifestRebuild() {
  const script = path.join(REPO_ROOT, 'scripts', 'build-image-review-manifest.cjs');
  if (!fs.existsSync(script)) { console.warn('[approve] manifest script not found; skipping.'); return; }
  const r = spawnSync('node', [script], { stdio: 'inherit' });
  if (r.status !== 0) console.warn('[approve] manifest rebuild exited non-zero; continuing.');
}

async function main() {
  const [spriteId, target] = process.argv.slice(2);
  if (!spriteId) throw new Error('usage: approve.cjs <spriteId> [pose|reference]');

  const adPath = path.join(AD_DIR, `${spriteId}.json`);
  const ad = loadJson(adPath);
  const state = loadJson(STATE);
  if (!state.characters[spriteId]) throw new Error(`unknown spriteId: ${spriteId}`);

  const approved = [];

  if (!target) {
    // approve reference + all 7 poses
    if (ad.referenceSheet?.path) { approveReference(spriteId, ad, state); approved.push('reference'); }
    for (const p of POSES) {
      const candidate = path.join(PIXELLAB, spriteId, `${p}.png`);
      if (fs.existsSync(candidate)) {
        approveFrame(spriteId, p, ad, state);
        approved.push(p);
      }
    }
  } else if (target === 'reference') {
    approveReference(spriteId, ad, state);
    approved.push('reference');
  } else if (POSES.includes(target)) {
    approveFrame(spriteId, target, ad, state);
    approved.push(target);
  } else {
    throw new Error(`unknown target: ${target}. Use a pose name, 'reference', or omit for all.`);
  }

  // Roll up top-level status
  const allApproved = POSES.every(p => state.characters[spriteId].framesStatus[p] === 'approved');
  if (allApproved && state.characters[spriteId].referenceStatus === 'approved') {
    state.characters[spriteId].status = 'approved';
  } else if (state.characters[spriteId].referenceStatus === 'approved') {
    state.characters[spriteId].status = 'reference_approved';
  }

  saveJson(adPath, ad);
  saveJson(STATE, state);

  console.log(JSON.stringify({ ok: true, spriteId, approved }, null, 2));

  rebuildArchiveIndex();
  runThumbnails();
  runManifestRebuild();
}

main().catch(e => { console.error(e.message); process.exit(1); });
