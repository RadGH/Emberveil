/**
 * Bootstrap vanilla game data into the mod registry so it's visible through
 * the schema surface (custom-content.html "Loaded" tab, spell-catalog exports,
 * mod-time lookups). This is non-invasive: existing game code keeps reading
 * WEAPON_BASES / ARMOR_BASES / CLASSES directly; the registry just mirrors
 * them for inspection and cross-pack references.
 *
 * Bootstrap runs once at startup and is safe to re-invoke (idempotent).
 */
import { WEAPON_BASES, ARMOR_BASES, AFFIXES_ACT1, SHIELD_AFFIXES } from '../game/items.js';
import { CLASSES } from '../game/classes.js';
import { SKILLS } from '../game/skills.js';
import { ENEMIES } from '../maps/mapData.js';
import { registerPack, getAll } from './registry.js';

let bootstrapped = false;

export function bootstrapVanilla() {
  if (bootstrapped) return;
  bootstrapped = true;

  const weaponItems = Object.entries(WEAPON_BASES).map(([id, base]) => ({
    id: `vanilla_weapon_${id}`,
    name: base.name,
    type: 'weapon',
    weaponCategory: base.weaponCategory,
    subtype: base.subtype,
    dmg: Array.isArray(base.dmg) ? base.dmg : [base.dmg, base.dmg],
    speed: base.speed,
    twoHanded: !!base.twoHanded,
    statScaling: base.statScaling,
    tags: ['vanilla', base.weaponCategory, base.dragon ? 'dragon' : null].filter(Boolean),
    _vanillaKey: id
  }));

  const armorItems = Object.entries(ARMOR_BASES).map(([id, base]) => ({
    id: `vanilla_armor_${id}`,
    name: base.name,
    type: base.type === 'accessory' ? 'accessory' : 'armor',
    armor: base.armor || 0,
    slot: base.slot,
    tier: base.tier,
    tags: ['vanilla', base.tier, base.isShield ? 'shield' : null, base.dragon ? 'dragon' : null].filter(Boolean),
    _vanillaKey: id
  }));

  const affixItems = [
    ...AFFIXES_ACT1.prefixes.map(a => ({ ...a, id: `vanilla_prefix_${a.id}`, affixKind: 'prefix', type: 'affix', _vanillaKey: a.id })),
    ...AFFIXES_ACT1.suffixes.map(a => ({ ...a, id: `vanilla_suffix_${a.id}`, affixKind: 'suffix', type: 'affix', _vanillaKey: a.id })),
    ...SHIELD_AFFIXES.map(a => ({ ...a, id: `vanilla_shield_${a.id}`, affixKind: 'shield', type: 'affix', _vanillaKey: a.id }))
  ];

  const classList = Array.isArray(CLASSES) ? CLASSES : Object.values(CLASSES);
  const classEntries = classList.map((def) => ({
    id: `vanilla_class_${def.id}`,
    name: def.name || def.id,
    primaryAttr: def.primaryAttr,
    startingStats: def.startingStats || def.baseStats || {},
    role: def.role,
    armorTier: def.armorTier,
    weapons: def.weapons,
    skills: def.skills,
    tags: ['vanilla'],
    _vanillaKey: def.id
  }));

  registerPack({
    id: 'vanilla_items_bootstrap',
    version: '1.0.0',
    name: 'Vanilla Items (read-only)',
    items: [...weaponItems, ...armorItems, ...affixItems]
  });

  registerPack({
    id: 'vanilla_classes_bootstrap',
    version: '1.0.0',
    name: 'Vanilla Classes (read-only)',
    classes: classEntries
  });

  const skillEntries = [];
  const skillsObj = SKILLS && typeof SKILLS === 'object' ? SKILLS : {};
  for (const [classId, skillList] of Object.entries(skillsObj)) {
    if (!Array.isArray(skillList)) continue;
    for (const sk of skillList) {
      if (!sk || !sk.id) continue;
      skillEntries.push({
        id: `vanilla_skill_${sk.id}`,
        name: sk.name || sk.id,
        mpCost: sk.mpCost,
        targeting: sk.targeting,
        description: sk.description,
        effects: sk.effects || [],
        talents: sk.talents,
        tier: sk.tier,
        unlockLevel: sk.unlockLevel,
        classOrigin: classId,
        tags: ['vanilla', classId],
        _vanillaKey: sk.id
      });
    }
  }
  if (skillEntries.length) {
    registerPack({
      id: 'vanilla_skills_bootstrap',
      version: '1.0.0',
      name: 'Vanilla Skills (read-only)',
      skills: skillEntries
    });
  }

  const enemyEntries = [];
  const enemiesObj = ENEMIES && typeof ENEMIES === 'object' ? ENEMIES : {};
  for (const [id, def] of Object.entries(enemiesObj)) {
    if (!def) continue;
    enemyEntries.push({
      id: `vanilla_enemy_${id}`,
      name: def.name || id,
      classId: 'enemy',
      hp: def.hp,
      maxHp: def.maxHp || def.hp,
      dmg: def.dmg,
      armor: def.armor,
      hit: def.hit,
      dodge: def.dodge,
      magicResist: def.magicResist,
      xpValue: def.xpValue,
      gold: def.gold,
      loot: def.loot,
      tags: ['vanilla', 'enemy'],
      _vanillaKey: id
    });
  }
  if (enemyEntries.length) {
    registerPack({
      id: 'vanilla_enemies_bootstrap',
      version: '1.0.0',
      name: 'Vanilla Enemies (read-only)',
      characters: enemyEntries
    });
  }
}

export function getVanillaItemCount() {
  return getAll('items').filter(i => i._pack?.startsWith('vanilla_')).length;
}
