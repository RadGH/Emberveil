/**
 * gen-frame.cjs — generate one of the 7 canonical frames for one character.
 *
 *   portrait | south | east | east_attack | east_spell | east_block | east_ko
 *
 * Strategy:
 *   • Always include the full identity + outfit + weapons from art direction.
 *   • Append the pose-specific clause (attackStyle / spellStyle / blockStyle /
 *     koStyle / portraitStyle / southStyle) verbatim.
 *   • Use the locked reference_sheet.png as the BitForge style image for
 *     every non-reference call, so the character stays on-model.
 *   • Enforce the action-vocab guardrail: the composed prompt MUST NOT
 *     contain any substring from artDirection.bannedSubstrings (case-insensitive).
 *     If it does, the call is vetoed and logged — we never silently strip.
 *
 * Output: public/images/pixellab/<spriteId>/<pose>.png  (256×256)
 *
 * Usage:
 *   node scripts/pixellab/gen-frame.cjs <spriteId> <pose> [--dry-run] [--confirm]
 *   node scripts/pixellab/gen-frame.cjs oracle --all [--dry-run]   # 7 poses in sequence
 */

const fs   = require('node:fs');
const path = require('node:path');
const { generateBitforge, REPO_ROOT } = require('./client.cjs');

const AD_DIR = path.join(REPO_ROOT, 'public', 'data', 'art_direction');
const STATE  = path.join(REPO_ROOT, 'public', 'data', 'pixellab_redesign_state.json');
const LOG    = path.join(REPO_ROOT, 'memory', 'pixellab_log.jsonl');

const POSES = ['portrait', 'south', 'east', 'east_attack', 'east_spell', 'east_block', 'east_ko'];

const POSE_META = {
  portrait:    { styleKey: 'portraitStyle', framing: 'bust shot from mid-chest up, three-quarter view, centered in a 256x256 canvas, shoulders fill the lower third.' },
  south:       { styleKey: 'southStyle',    framing: 'full body facing camera (south), feet aligned to bottom edge of 256x256 canvas.' },
  east:        { styleKey: null,            framing: 'full body facing east (camera-right), combat idle, feet on bottom edge of 256x256 canvas.' },
  east_attack: { styleKey: 'attackStyle',   framing: 'full body facing east, mid-action attack frame, feet on bottom edge of 256x256 canvas.' },
  east_spell:  { styleKey: 'spellStyle',    framing: 'full body facing east, mid-cast spell frame, feet on bottom edge of 256x256 canvas.' },
  east_block:  { styleKey: 'blockStyle',    framing: 'full body facing east, mid-defensive-stance frame, feet on bottom edge of 256x256 canvas.' },
  east_ko:     { styleKey: 'koStyle',       framing: 'full body on the ground, knocked out, fit within 256x256 canvas.' },
};

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function saveJson(p, o) { fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); }

function composePrompt(ad, pose) {
  const meta = POSE_META[pose];
  const poseClause = meta.styleKey ? ad[meta.styleKey] : null;
  // Scale: sprite fills `pixelHeight` of the 256px canvas, NOT the full canvas.
  // This preserves relative size between species (dragon > human > goblin > cat).
  const ph = ad.pixelHeight || 180;
  const scale = `SCALE (non-negotiable): the ${ad.displayName || ad.spriteId} must occupy approximately ${ph}px of the 256px canvas height — roughly ${Math.round(ph / 256 * 100)}% of the canvas. Do NOT stretch or upscale the figure to fill the frame. Extra space above head and/or below feet is correct and preserves scale relative to other species. Feet (or lowest point of body for KO / quadruped) aligned near the bottom.`;
  const lines = [
    `IDENTITY (must match reference sheet exactly): ${ad.identity}`,
    `OUTFIT: ${ad.outfit}`,
    `WEAPONS: ${ad.weapons}`,
    `POSE (${pose}): ${poseClause || 'neutral combat idle, consistent with reference sheet.'}`,
    `FRAMING: ${meta.framing}`,
    scale,
    `STYLE: pixel art, transparent background, no ground shadow, no borders, no text. Match the palette and style of the reference portrait at ${ad.referenceSheet?.sourcePortraitPath || 'the linked portrait'}.`,
    `NEGATIVE: do not add weapons or props not listed in WEAPONS. Do not change palette, species, or outfit from the reference sheet. Do not zoom in to fill the canvas — respect SCALE.`,
  ];
  return lines.join('\n\n');
}

/**
 * Returns array of banned substrings found in `text`, case-insensitive,
 * with word-boundary matching so "whip" does NOT match "whipped" and
 * "armor" does NOT match a "no armor" NEGATIVE clause. The guardrail's
 * job is to catch a pose clause that TRIES to introduce banned gear
 * ("holds a sword") — not to lint our own scaffolding.
 *
 * Multi-word banned phrases (e.g. "standing upright") are matched as
 * whole phrases with word boundaries at start/end.
 */
function guardrailViolations(text, banned) {
  if (!text) return [];
  const hits = [];
  for (const b of (banned || [])) {
    const pattern = '\\b' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '\\b';
    const re = new RegExp(pattern, 'i');
    if (re.test(text)) hits.push(b);
  }
  return hits;
}

function logVeto(spriteId, pose, prompt, violations) {
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, JSON.stringify({
    ts: new Date().toISOString(),
    tag: `${spriteId}:${pose}`,
    mode: 'vetoed',
    reason: 'guardrail',
    violations,
    prompt,
  }) + '\n');
}

async function genOne(spriteId, pose, opts) {
  const ad = loadJson(path.join(AD_DIR, `${spriteId}.json`));
  const state = loadJson(STATE);
  if (!state.characters[spriteId]) throw new Error(`spriteId not registered in state.json: ${spriteId}`);
  if (!POSES.includes(pose)) throw new Error(`unknown pose: ${pose}. Valid: ${POSES.join(', ')}`);

  const refAbs = ad.referenceSheet?.path
    ? path.join(REPO_ROOT, 'public', ad.referenceSheet.path)
    : null;
  if (!opts.dryRun && (!refAbs || !fs.existsSync(refAbs))) {
    throw new Error(`reference sheet not found at ${refAbs}. Run gen-reference-sheet.cjs first.`);
  }
  // On dry-run, reference may not exist yet; keep the path so the log shows
  // what the live call would use.

  const prompt = composePrompt(ad, pose);

  // Guardrail: only check the author-written pose clause (attackStyle, etc.).
  // The composed prompt also includes our own NEGATIVE/WEAPONS scaffolding
  // that intentionally uses banned words in disallowing contexts; we don't
  // want to lint our own safety text. If the author's pose clause contains
  // a banned term (e.g. attackStyle says "swings her sword"), we veto.
  const styleKey = POSE_META[pose].styleKey;
  const poseClause = styleKey ? ad[styleKey] || '' : '';
  const violations = guardrailViolations(poseClause, ad.bannedSubstrings);
  if (violations.length) {
    logVeto(spriteId, pose, prompt, violations);
    throw new Error(`[guardrail] ${spriteId}:${pose} — artDirection.${styleKey} contains banned word(s) ${JSON.stringify(violations)}. Rewrite the pose clause to remove them before generating.`);
  }

  const outRel = `public/images/pixellab/${spriteId}/${pose}.png`;
  const outAbs = path.join(REPO_ROOT, outRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  const r = await generateBitforge({
    prompt,
    width: 256, height: 256,
    styleImagePath: refAbs,
    negativePrompt: [
      'multiple faces, extra eyes, deformed face, blurry',
      'background scenery, landscape, solid color background, grey background',
      'motion blur, soft edges, washed-out colors',
      'portrait bust, cropped character',
      ...(ad.bannedSubstrings || []),
    ].join(', '),
    out: outAbs,
    dryRun: opts.dryRun, confirm: opts.confirm,
    tag: `${spriteId}:${pose}`,
  });

  ad.frames = ad.frames || {};
  ad.frames[pose] = {
    path: `images/pixellab/${spriteId}/${pose}.png`,
    prompt,
    bitforgeAssetId: r.logEntry?.usage?.asset_id || null,
    generatedAt: opts.dryRun ? null : new Date().toISOString(),
    approvedAt: null,
  };
  saveJson(path.join(AD_DIR, `${spriteId}.json`), ad);

  state.characters[spriteId].framesStatus[pose] = opts.dryRun ? 'dry_run' : 'generated';
  saveJson(STATE, state);

  return { pose, out: outRel, estCredits: r.logEntry.estCredits, mode: opts.dryRun ? 'dry-run' : 'live' };
}

async function main() {
  const args = process.argv.slice(2);
  const positional = args.filter(a => !a.startsWith('--'));
  const spriteId = positional[0];
  const poseArg  = positional[1];
  const all     = args.includes('--all');
  const dryRun  = args.includes('--dry-run');
  const confirm = args.includes('--confirm');
  if (!spriteId) throw new Error('usage: gen-frame.cjs <spriteId> <pose> [--dry-run]  OR  <spriteId> --all');

  const poses = all ? POSES : [poseArg];
  if (!all && !poseArg) throw new Error('pose required unless --all');

  const results = [];
  for (const p of poses) {
    // eslint-disable-next-line no-await-in-loop -- serial to respect credit ceiling & state.json order
    results.push(await genOne(spriteId, p, { dryRun, confirm }));
  }
  console.log(JSON.stringify({ ok: true, spriteId, results }, null, 2));
}

main().catch(e => { console.error(e.message); process.exit(1); });
