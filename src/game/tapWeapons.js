/**
 * Tap Weapons & Utilities — M72
 *
 * Party-shared tap items. During combat the player may tap once per turn while
 * cooldown is 0. Weapons trigger on enemies; utilities trigger on allies.
 * Cooldowns are tracked in either individual turns or full rounds.
 *
 * Icons are drawn procedurally on a canvas context so no image assets are needed.
 */

// ---------- helpers ----------
function fillCircle(ctx, x, y, r, color) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function stroke(ctx, color, w = 2) { ctx.strokeStyle = color; ctx.lineWidth = w; }

// ---------- icons ----------
const ICONS = {
  blade(ctx, x, y, s) {
    stroke(ctx, '#d8d8e0', Math.max(2, s * 0.08));
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * 0.35, y + s * 0.35); ctx.lineTo(x + s * 0.35, y - s * 0.35); ctx.stroke();
    stroke(ctx, '#b8a060', Math.max(1, s * 0.05));
    ctx.beginPath(); ctx.moveTo(x - s * 0.2, y - s * 0.2); ctx.lineTo(x + s * 0.2, y + s * 0.2); ctx.stroke();
  },
  bow(ctx, x, y, s) {
    stroke(ctx, '#a86840', Math.max(2, s * 0.08));
    ctx.beginPath(); ctx.arc(x, y, s * 0.4, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
    stroke(ctx, '#e0d8c0', Math.max(1, s * 0.04));
    ctx.beginPath(); ctx.moveTo(x + s * 0.22, y - s * 0.33); ctx.lineTo(x + s * 0.22, y + s * 0.33); ctx.stroke();
    stroke(ctx, '#f0e8d0', Math.max(2, s * 0.06));
    ctx.beginPath(); ctx.moveTo(x - s * 0.3, y); ctx.lineTo(x + s * 0.25, y); ctx.stroke();
  },
  catapult(ctx, x, y, s) {
    stroke(ctx, '#8a6a40', Math.max(2, s * 0.08));
    ctx.beginPath(); ctx.moveTo(x - s * 0.35, y + s * 0.3); ctx.lineTo(x + s * 0.3, y - s * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.35, y + s * 0.3); ctx.lineTo(x + s * 0.2, y + s * 0.3); ctx.stroke();
    fillCircle(ctx, x + s * 0.3, y - s * 0.3, s * 0.12, '#6a4a30');
  },
  star_caller(ctx, x, y, s) {
    const sp = 5, rO = s * 0.4, rI = s * 0.18;
    ctx.fillStyle = '#f0d060';
    ctx.beginPath();
    for (let i = 0; i < sp * 2; i++) {
      const r = i % 2 === 0 ? rO : rI;
      const a = (i * Math.PI) / sp - Math.PI / 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = s * 0.3; ctx.shadowColor = '#ffe080'; ctx.fill();
    ctx.shadowBlur = 0;
  },
  ninja_stars(ctx, x, y, s) {
    // Throwing knives — three small blades fanning diagonally
    const knives = [
      { dx: -s * 0.25, dy: s * 0.18, rot: -Math.PI * 0.18 },
      { dx: 0,          dy: 0,         rot: -Math.PI * 0.10 },
      { dx: s * 0.22,  dy: -s * 0.18, rot: -Math.PI * 0.02 },
    ];
    for (const k of knives) {
      ctx.save();
      ctx.translate(x + k.dx, y + k.dy);
      ctx.rotate(k.rot);
      // Blade
      ctx.fillStyle = '#d8dce4';
      ctx.fillRect(-s * 0.22, -s * 0.025, s * 0.34, s * 0.05);
      // Tip (triangle)
      ctx.beginPath();
      ctx.moveTo(s * 0.12, -s * 0.05);
      ctx.lineTo(s * 0.24, 0);
      ctx.lineTo(s * 0.12, s * 0.05);
      ctx.closePath(); ctx.fill();
      // Hilt
      ctx.fillStyle = '#5a3a1e';
      ctx.fillRect(-s * 0.26, -s * 0.035, s * 0.05, s * 0.07);
      ctx.restore();
    }
  },
  fireball(ctx, x, y, s) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.4);
    g.addColorStop(0, '#fff0a0'); g.addColorStop(0.4, '#f08020'); g.addColorStop(1, '#601010');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, s * 0.38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,120,0.8)';
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.42); ctx.quadraticCurveTo(x + s * 0.15, y - s * 0.1, x, y + s * 0.05);
    ctx.quadraticCurveTo(x - s * 0.15, y - s * 0.1, x, y - s * 0.42); ctx.fill();
  },
  dragon_call(ctx, x, y, s) {
    stroke(ctx, '#c04040', Math.max(2, s * 0.06));
    ctx.beginPath();
    ctx.moveTo(x - s * 0.4, y);
    ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.3, x, y - s * 0.15);
    ctx.quadraticCurveTo(x + s * 0.2, y, x + s * 0.4, y - s * 0.25);
    ctx.stroke();
    ctx.fillStyle = '#e85020';
    ctx.beginPath(); ctx.arc(x + s * 0.4, y - s * 0.25, s * 0.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(240,120,40,0.6)';
    ctx.beginPath(); ctx.moveTo(x + s * 0.35, y - s * 0.18); ctx.lineTo(x + s * 0.5, y - s * 0.05); ctx.lineTo(x + s * 0.35, y + s * 0.05); ctx.closePath(); ctx.fill();
  },
  chain_lightning(ctx, x, y, s) {
    stroke(ctx, '#80d0ff', Math.max(2, s * 0.08));
    ctx.beginPath();
    ctx.moveTo(x - s * 0.3, y - s * 0.35);
    ctx.lineTo(x + s * 0.05, y - s * 0.05);
    ctx.lineTo(x - s * 0.1, y + s * 0.05);
    ctx.lineTo(x + s * 0.3, y + s * 0.35);
    ctx.stroke();
    ctx.shadowBlur = s * 0.3; ctx.shadowColor = '#80d0ff'; ctx.stroke(); ctx.shadowBlur = 0;
  },
  spirit_hammer(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(200,220,255,0.75)';
    ctx.fillRect(x - s * 0.28, y - s * 0.3, s * 0.56, s * 0.22);
    stroke(ctx, '#a0c0e0', Math.max(1, s * 0.04));
    ctx.strokeRect(x - s * 0.28, y - s * 0.3, s * 0.56, s * 0.22);
    ctx.fillStyle = '#8090a8';
    ctx.fillRect(x - s * 0.04, y - s * 0.08, s * 0.08, s * 0.38);
  },
  void_lance(ctx, x, y, s) {
    stroke(ctx, '#a060e0', Math.max(2, s * 0.08));
    ctx.beginPath(); ctx.moveTo(x - s * 0.38, y + s * 0.38); ctx.lineTo(x + s * 0.38, y - s * 0.38); ctx.stroke();
    ctx.fillStyle = '#c080ff';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.38, y - s * 0.38);
    ctx.lineTo(x + s * 0.22, y - s * 0.18);
    ctx.lineTo(x + s * 0.18, y - s * 0.22);
    ctx.closePath(); ctx.fill();
  },
  rejuvenate(ctx, x, y, s) {
    stroke(ctx, '#60e080', Math.max(2, s * 0.07));
    ctx.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = s * 0.3 + Math.sin(a * 3) * s * 0.06;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
    fillCircle(ctx, x, y, s * 0.1, '#a0ffa0');
  },
  heal(ctx, x, y, s) {
    ctx.fillStyle = '#60e060';
    ctx.fillRect(x - s * 0.08, y - s * 0.32, s * 0.16, s * 0.64);
    ctx.fillRect(x - s * 0.32, y - s * 0.08, s * 0.64, s * 0.16);
    ctx.shadowBlur = s * 0.2; ctx.shadowColor = '#a0ffa0';
    ctx.fillRect(x - s * 0.08, y - s * 0.32, s * 0.16, s * 0.64);
    ctx.shadowBlur = 0;
  },
  shield(ctx, x, y, s) {
    ctx.fillStyle = '#4080c0';
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.38);
    ctx.lineTo(x + s * 0.3, y - s * 0.2);
    ctx.lineTo(x + s * 0.25, y + s * 0.25);
    ctx.lineTo(x, y + s * 0.38);
    ctx.lineTo(x - s * 0.25, y + s * 0.25);
    ctx.lineTo(x - s * 0.3, y - s * 0.2);
    ctx.closePath(); ctx.fill();
    stroke(ctx, '#a0d0ff', Math.max(1, s * 0.04));
    ctx.stroke();
  },
  deflect(ctx, x, y, s) {
    stroke(ctx, '#c0d8ff', Math.max(2, s * 0.07));
    ctx.beginPath(); ctx.arc(x, y, s * 0.35, -Math.PI * 0.3, Math.PI * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, s * 0.35, Math.PI * 0.7, Math.PI * 1.3); ctx.stroke();
  },
  enchant(ctx, x, y, s) {
    ctx.fillStyle = '#e0a0ff';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(a) * s * 0.3, py = y + Math.sin(a) * s * 0.3;
      ctx.beginPath(); ctx.arc(px, py, s * 0.06, 0, Math.PI * 2); ctx.fill();
    }
    fillCircle(ctx, x, y, s * 0.1, '#ffe0ff');
  },
  cleanse(ctx, x, y, s) {
    stroke(ctx, '#ffffff', Math.max(2, s * 0.07));
    ctx.beginPath(); ctx.arc(x, y, s * 0.32, 0, Math.PI * 2); ctx.stroke();
    stroke(ctx, '#e0f0ff', Math.max(1, s * 0.05));
    ctx.beginPath(); ctx.moveTo(x - s * 0.2, y); ctx.lineTo(x - s * 0.05, y + s * 0.15); ctx.lineTo(x + s * 0.22, y - s * 0.15); ctx.stroke();
  },
  rally(ctx, x, y, s) {
    stroke(ctx, '#ffc040', Math.max(2, s * 0.07));
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.2); ctx.lineTo(x, y - s * 0.35); ctx.lineTo(x + s * 0.3, y + s * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.35); ctx.lineTo(x + s * 0.3, y + s * 0.35); ctx.stroke();
  },
  haste(ctx, x, y, s) {
    stroke(ctx, '#80ffc0', Math.max(2, s * 0.07));
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.3, y + i * s * 0.18);
      ctx.lineTo(x + s * 0.05, y + i * s * 0.18);
      ctx.lineTo(x - s * 0.05, y + i * s * 0.18 + s * 0.08);
      ctx.lineTo(x + s * 0.3, y + i * s * 0.18 - s * 0.08);
      ctx.stroke();
    }
  },
  taunt_totem(ctx, x, y, s) {
    ctx.fillStyle = '#c08040';
    ctx.fillRect(x - s * 0.12, y - s * 0.35, s * 0.24, s * 0.7);
    ctx.fillStyle = '#e8c060';
    ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#201008';
    ctx.fillRect(x - s * 0.04, y - s * 0.24, s * 0.03, s * 0.05);
    ctx.fillRect(x + s * 0.01, y - s * 0.24, s * 0.03, s * 0.05);
  },
  phoenix_feather(ctx, x, y, s) {
    stroke(ctx, '#ff8040', Math.max(2, s * 0.06));
    ctx.beginPath(); ctx.moveTo(x - s * 0.25, y + s * 0.38); ctx.quadraticCurveTo(x, y - s * 0.4, x + s * 0.3, y - s * 0.1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,160,60,0.6)';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.25, y + s * 0.38);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      ctx.quadraticCurveTo(x + t * s * 0.2, y + s * 0.3 - t * s * 0.5, x + t * s * 0.35, y + s * 0.1 - t * s * 0.2);
    }
    ctx.fill();
  },
};

// ---------- tap weapons (10) ----------
export const TAP_WEAPONS = [
  { id: 'blade', name: 'Tap Blade', type: 'weapon', description: 'A quick slash on the tapped enemy. No cooldown — tap every turn.',
    cooldown: { unit: 'turns', amount: 0 }, power: [8, 14], targeting: 'single', effectColor: '#d8d8e0', icon: ICONS.blade, sfx: 'hit' },
  { id: 'bow', name: 'Hunter\'s Bow', type: 'weapon', description: 'Arc-shot arrow from off-screen. Solid single-target damage.',
    cooldown: { unit: 'turns', amount: 2 }, power: [25, 40], targeting: 'single', effectColor: '#d8c890', icon: ICONS.bow, sfx: 'hit' },
  { id: 'catapult', name: 'Field Catapult', type: 'weapon', description: 'Boulder lands on an enemy group. Hits everyone in that group.',
    cooldown: { unit: 'rounds', amount: 5 }, power: [35, 55], targeting: 'aoe_group', effectColor: '#a08060', icon: ICONS.catapult, sfx: 'hit' },
  { id: 'star_caller', name: 'Star Caller', type: 'weapon', description: 'A burning star falls on the tap point. Massive AoE.',
    cooldown: { unit: 'rounds', amount: 4 }, power: [50, 60], targeting: 'aoe_group', effectColor: '#ffe080', icon: ICONS.star_caller, sfx: 'spell' },
  { id: 'ninja_stars', name: 'Throwing Knives', type: 'weapon', description: 'Three throwing knives fan out and strike up to three enemies.',
    cooldown: { unit: 'turns', amount: 2 }, power: [12, 18], targeting: 'chain', effectColor: '#b0b8c0', icon: ICONS.ninja_stars, sfx: 'hit' },
  { id: 'fireball', name: 'Fireball', type: 'weapon', description: 'A rolling ball of flame explodes on impact with splash damage.',
    cooldown: { unit: 'turns', amount: 3 }, power: [30, 45], targeting: 'aoe_group', effectColor: '#ff8030', icon: ICONS.fireball, sfx: 'spell' },
  { id: 'dragon_call', name: 'Dragon Call', type: 'weapon', description: 'Summon a dragon that breathes across ALL enemies. Signature weapon.',
    cooldown: { unit: 'rounds', amount: 8 }, power: [38, 46], targeting: 'aoe_all', effectColor: '#e85020', icon: ICONS.dragon_call, sfx: 'spell' },
  { id: 'chain_lightning', name: 'Chain Lightning', type: 'weapon', description: 'Lightning zaps the tapped enemy then arcs to two more.',
    cooldown: { unit: 'turns', amount: 3 }, power: [18, 28], targeting: 'chain', effectColor: '#80d0ff', icon: ICONS.chain_lightning, sfx: 'spell' },
  { id: 'spirit_hammer', name: 'Spirit Hammer', type: 'weapon', description: 'A colossal spectral hammer slams down. Heavy damage + stagger.',
    cooldown: { unit: 'rounds', amount: 4 }, power: [40, 60], targeting: 'single', effectColor: '#c0d8ff', icon: ICONS.spirit_hammer, sfx: 'hit' },
  { id: 'void_lance', name: 'Void Lance', type: 'weapon', description: 'Pierces in a line through every enemy in the tapped group.',
    cooldown: { unit: 'rounds', amount: 3 }, power: [25, 40], targeting: 'line', effectColor: '#a060e0', icon: ICONS.void_lance, sfx: 'spell' },
];

// ---------- tap utilities (10) ----------
export const TAP_UTILITIES = [
  { id: 'rejuvenate', name: 'Rejuvenate', type: 'utility', description: 'Heal-over-time on the ally nearest the tap (prefers lowest HP).',
    cooldown: { unit: 'turns', amount: 3 }, power: [15, 25], targeting: 'single', effectColor: '#60e080', icon: ICONS.rejuvenate, sfx: 'shrine' },
  { id: 'heal', name: 'Group Heal', type: 'utility', description: '50 HP split across up to 3 allies near the tap.',
    cooldown: { unit: 'rounds', amount: 4 }, power: [50, 50], targeting: 'allies_near', effectColor: '#a0ffa0', icon: ICONS.heal, sfx: 'shrine' },
  { id: 'shield', name: 'Barrier', type: 'utility', description: '25 barrier HP on up to 3 allies near the tap.',
    cooldown: { unit: 'rounds', amount: 3 }, power: [25, 25], targeting: 'allies_near', effectColor: '#4080c0', icon: ICONS.shield, sfx: 'shrine' },
  { id: 'deflect', name: 'Deflect', type: 'utility', description: 'Absorbs the next incoming hit on the tapped ally in full.',
    cooldown: { unit: 'rounds', amount: 5 }, power: [0, 0], targeting: 'single', effectColor: '#c0d8ff', icon: ICONS.deflect, sfx: 'shrine' },
  { id: 'enchant', name: 'Enchant Weapon', type: 'utility', description: 'Bonus damage buff on the tapped ally until replaced.',
    cooldown: { unit: 'turns', amount: 2 }, power: [0, 0], targeting: 'single', effectColor: '#e0a0ff', icon: ICONS.enchant, sfx: 'shrine' },
  { id: 'cleanse', name: 'Cleanse', type: 'utility', description: 'Removes all debuffs from the tapped ally and heals 15.',
    cooldown: { unit: 'rounds', amount: 3 }, power: [15, 15], targeting: 'single', effectColor: '#ffffff', icon: ICONS.cleanse, sfx: 'shrine' },
  { id: 'rally', name: 'Rally', type: 'utility', description: 'Party-wide +15% damage for 2 rounds.',
    cooldown: { unit: 'rounds', amount: 6 }, power: [0, 0], targeting: 'allies_near', effectColor: '#ffc040', icon: ICONS.rally, sfx: 'shrine' },
  { id: 'haste', name: 'Haste', type: 'utility', description: 'Tapped ally acts twice on their next turn.',
    cooldown: { unit: 'rounds', amount: 5 }, power: [0, 0], targeting: 'single', effectColor: '#80ffc0', icon: ICONS.haste, sfx: 'shrine' },
  { id: 'taunt_totem', name: 'Taunt Totem', type: 'utility', description: 'A totem that draws enemy attacks for 2 rounds.',
    cooldown: { unit: 'rounds', amount: 6 }, power: [0, 0], targeting: 'single', effectColor: '#c08040', icon: ICONS.taunt_totem, sfx: 'shrine' },
  { id: 'phoenix_feather', name: 'Phoenix Feather', type: 'utility', description: 'Revive a fallen ally near the tap at 30% HP.',
    cooldown: { unit: 'rounds', amount: 10 }, power: [0, 0], targeting: 'single', effectColor: '#ff8040', icon: ICONS.phoenix_feather, sfx: 'victory' },
];

// ---------- combined map ----------
export const TAP_ALL = {};
for (const w of TAP_WEAPONS) TAP_ALL[w.id] = w;
for (const u of TAP_UTILITIES) TAP_ALL[u.id] = u;

export function getTapItem(id) { return TAP_ALL[id] || null; }

// ---------- resolution ----------
function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

function pickDamageTargets(def, ctx) {
  const { targetEnemy, enemies } = ctx;
  if (!targetEnemy) return [];
  switch (def.targeting) {
    case 'single': return [targetEnemy];
    case 'aoe_all': return enemies.filter(e => e.alive);
    case 'aoe_group': {
      // Same group as target, if group info present, else nearest 3
      if (targetEnemy.groupIndex != null) {
        return enemies.filter(e => e.alive && e.groupIndex === targetEnemy.groupIndex);
      }
      const sorted = enemies.filter(e => e.alive).slice().sort((a, b) => dist2(a, targetEnemy) - dist2(b, targetEnemy));
      return sorted.slice(0, 3);
    }
    case 'chain': {
      const alive = enemies.filter(e => e.alive && e !== targetEnemy);
      const sorted = alive.slice().sort((a, b) => dist2(a, targetEnemy) - dist2(b, targetEnemy));
      return [targetEnemy, ...sorted.slice(0, 2)];
    }
    case 'line': {
      // Enemies roughly in same vertical band as target
      const band = 60;
      return enemies.filter(e => e.alive && Math.abs(e.y - targetEnemy.y) < band);
    }
    default: return [targetEnemy];
  }
}

function pickHealTargets(def, ctx) {
  const { targetAlly, allies } = ctx;
  if (!targetAlly) return [];
  switch (def.targeting) {
    case 'single': return [targetAlly];
    case 'allies_near': {
      const alive = allies.filter(a => a.alive);
      const sorted = alive.slice().sort((a, b) => dist2(a, targetAlly) - dist2(b, targetAlly));
      return sorted.slice(0, 3);
    }
    default: return [targetAlly];
  }
}

/**
 * Given a tap item and combat context, produce an effect descriptor.
 * ctx: { clickX, clickY, enemies, allies, targetEnemy, targetAlly }
 */
export function resolveTap(def, ctx) {
  if (!def) return null;
  const rng = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
  const [pmin, pmax] = def.power || [0, 0];
  const amount = pmax > 0 ? rng(pmin, pmax) : 0;

  if (def.type === 'weapon') {
    const targets = pickDamageTargets(def, ctx);
    return {
      kind: 'damage',
      itemId: def.id,
      targets,
      amountEach: amount,
      projectile: { color: def.effectColor, from: { x: ctx.clickX - 200, y: ctx.clickY - 120 }, to: { x: ctx.clickX, y: ctx.clickY } },
      sfx: def.sfx || 'hit',
    };
  }

  // utility
  const targets = pickHealTargets(def, ctx);
  return {
    kind: def.id === 'phoenix_feather' ? 'revive'
        : def.id === 'shield' ? 'shield'
        : def.id === 'deflect' ? 'deflect'
        : def.id === 'enchant' ? 'enchant'
        : def.id === 'cleanse' ? 'cleanse'
        : def.id === 'rally' ? 'rally'
        : def.id === 'haste' ? 'haste'
        : def.id === 'taunt_totem' ? 'taunt'
        : 'heal',
    itemId: def.id,
    targets,
    amountEach: def.id === 'heal' ? Math.floor(50 / Math.max(1, targets.length)) : amount,
    projectile: { color: def.effectColor, from: { x: ctx.clickX, y: ctx.clickY - 150 }, to: { x: ctx.clickX, y: ctx.clickY } },
    sfx: def.sfx || 'shrine',
  };
}
