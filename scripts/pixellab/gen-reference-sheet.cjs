/**
 * gen-reference-sheet.cjs — generate a multi-view reference sheet for one character.
 *
 * Output: public/images/pixellab/<spriteId>/reference_sheet.png (768×256 stitched
 *         front | east | south). Used only for subsequent BitForge calls and for
 *         review on the Tools > PixelLab Redesign page. Never rendered in-game.
 *
 * Usage:
 *   node scripts/pixellab/gen-reference-sheet.cjs <spriteId> [--dry-run] [--confirm]
 *
 * Reads art direction from public/data/art_direction/<spriteId>.json.
 * Identity-anchors the call on artDirection.referenceSheet.sourcePortraitPath.
 * Updates public/data/pixellab_redesign_state.json on success.
 */

const fs   = require('node:fs');
const path = require('node:path');
const { generateBitforge, REPO_ROOT } = require('./client.cjs');

const AD_DIR    = path.join(REPO_ROOT, 'public', 'data', 'art_direction');
const STATE     = path.join(REPO_ROOT, 'public', 'data', 'pixellab_redesign_state.json');
const OUT_BASE  = path.join(REPO_ROOT, 'public', 'images', 'pixellab');

function loadArtDirection(spriteId) {
  const p = path.join(AD_DIR, `${spriteId}.json`);
  if (!fs.existsSync(p)) throw new Error(`art direction not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadState() {
  return JSON.parse(fs.readFileSync(STATE, 'utf8'));
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
}

function saveArtDirection(spriteId, ad) {
  fs.writeFileSync(path.join(AD_DIR, `${spriteId}.json`), JSON.stringify(ad, null, 2) + '\n');
}

/** Compose the reference-sheet prompt. BitForge caps output at 200×200, so the
 *  "reference sheet" is a single locked east-profile view rather than a stitched
 *  turnaround. This single PNG becomes the style_image for every subsequent
 *  frame call — the identity anchor for the pose regeneration pass.
 */
function composePrompt(ad) {
  // Scale pixelHeight (expressed against a 256-canvas) up to the 400-canvas reference.
  const scaledH = Math.round((ad.pixelHeight || 180) * 400 / 256);
  return [
    `IDENTITY (this image becomes the canonical identity anchor — preserve in every downstream frame): ${ad.identity}`,
    `OUTFIT: ${ad.outfit}`,
    `WEAPONS: ${ad.weapons}`,
    `CLASS: ${ad.class}. Full-body view, head to feet visible. Character occupies ${scaledH}px of the 400px canvas height (~${Math.round(scaledH / 400 * 100)}%). Feet aligned near the bottom; headroom above.`,
    `POSE: full-body side profile facing right (east), calm combat-ready idle, arms relaxed at sides (for humanoids) or four legs planted (for quadrupeds). Head up, eyes visible. NOT a portrait bust, NOT a close-up — entire character from head to feet.`,
    `STYLE: detailed pixel art with clean readable silhouette, warm pixel-art palette.`,
  ].join('\n\n');
}

function composeNegative(ad) {
  return [
    'portrait bust, close-up head shot, cropped at chest, cropped at waist',
    'multiple faces, extra eyes, deformed face',
    'blurry, smudged, motion blur, soft edges',
    'background scenery, landscape, interior walls, solid color background',
    ...(ad.bannedSubstrings || []),
  ].join(', ');
}

async function main() {
  const args = process.argv.slice(2);
  const spriteId = args.find(a => !a.startsWith('--'));
  const dryRun  = args.includes('--dry-run');
  const confirm = args.includes('--confirm');
  if (!spriteId) throw new Error('usage: gen-reference-sheet.cjs <spriteId> [--dry-run] [--confirm]');

  const ad = loadArtDirection(spriteId);
  const state = loadState();
  if (!state.characters[spriteId]) throw new Error(`spriteId not registered in state.json: ${spriteId}`);

  const prompt = composePrompt(ad);
  const negativePrompt = composeNegative(ad);
  const outRel = `public/images/pixellab/${spriteId}/reference_sheet.png`;
  const outAbs = path.join(REPO_ROOT, outRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  const srcPortrait = ad.referenceSheet?.sourcePortraitPath
    ? path.join(REPO_ROOT, 'public', ad.referenceSheet.sourcePortraitPath)
    : null;
  if (srcPortrait && !fs.existsSync(srcPortrait)) {
    console.warn(`[ref-sheet] sourcePortraitPath does not exist on disk: ${srcPortrait} — proceeding without style image.`);
  }

  const r = await generateBitforge({
    prompt,
    width:  400,
    height: 400,
    styleImagePath: srcPortrait && fs.existsSync(srcPortrait) ? srcPortrait : undefined,
    negativePrompt,
    out: outAbs,
    dryRun, confirm,
    tag: `${spriteId}:reference_sheet`,
  });

  // Persist provenance
  ad.referenceSheet = {
    ...(ad.referenceSheet || {}),
    path: `images/pixellab/${spriteId}/reference_sheet.png`,
    prompt,
    bitforgeAssetId: r.logEntry?.usage?.asset_id || null,
    sourcePortraitPath: ad.referenceSheet?.sourcePortraitPath || null,
    generatedAt: dryRun ? null : new Date().toISOString(),
    approvedAt: null,
  };
  saveArtDirection(spriteId, ad);

  state.characters[spriteId].referenceStatus = dryRun ? 'dry_run' : 'generated';
  state.characters[spriteId].status = dryRun ? 'pending' : 'reference_generated';
  saveState(state);

  console.log(JSON.stringify({ ok: true, mode: dryRun ? 'dry-run' : 'live', out: outRel, estCredits: r.logEntry.estCredits, tag: r.logEntry.tag }, null, 2));
}

main().catch(e => { console.error(e.message); process.exit(1); });
