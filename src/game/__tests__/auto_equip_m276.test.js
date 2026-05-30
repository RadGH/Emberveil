// M276 U10 — auto-equip behavior. Items added to a party member with
// autoEquip=true should land in their best slot when an upgrade or empty
// slot exists. Manually-unequipped items are blocklisted.
import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../gameState.js';
import { generateItem } from '../items.js';

function makeHero(over = {}) {
  return {
    id: 'h1', name: 'Hero', class: 'fighter', level: 1,
    hp: 50, maxHp: 50, mp: 30, maxMp: 30,
    attrs: { STR: 10, DEX: 10, INT: 10, CON: 10 },
    skills: [], equipment: {}, autoEquip: true,
    ...over,
  };
}

describe('M276 U10 — tryAutoEquip', () => {
  beforeEach(() => {
    GameState.init(makeHero());
  });

  it('auto-equips into an empty slot when autoEquip is true', () => {
    const item = generateItem('sword', 'magic', 'medium');
    expect(item).toBeTruthy();
    GameState.addToInventory(item);
    const gs = GameState.get();
    // Item should be on hero, NOT in inventory.
    expect(gs.party[0].equipment.weapon?.id).toBe(item.id);
    expect(gs.inventory.find(i => i.id === item.id)).toBeUndefined();
  });

  it('does NOT auto-equip when autoEquip is false (item stays in bag)', () => {
    const gs = GameState.get();
    gs.party[0].autoEquip = false;
    const item = generateItem('sword', 'magic', 'medium');
    GameState.addToInventory(item);
    expect(gs.party[0].equipment.weapon).toBeUndefined();
    expect(gs.inventory.find(i => i.id === item.id)).toBeTruthy();
  });

  it('does NOT auto-equip a manually-unequipped item even with autoEquip=true', () => {
    const item = generateItem('sword', 'magic', 'medium');
    GameState.markManuallyUnequipped(item.id);
    GameState.addToInventory(item);
    const gs = GameState.get();
    expect(gs.party[0].equipment.weapon).toBeUndefined();
    expect(gs.inventory.find(i => i.id === item.id)).toBeTruthy();
  });

  it('skips companions even if they have autoEquip=true', () => {
    const gs = GameState.get();
    gs.companions = [makeHero({ id: 'c1', name: 'Pet', isCompanion: true, class: 'companion', autoEquip: true })];
    gs.party[0].autoEquip = false; // only the companion has autoEquip=true
    const item = generateItem('sword', 'magic', 'medium');
    GameState.addToInventory(item);
    expect(gs.companions[0].equipment.weapon).toBeUndefined();
    expect(gs.inventory.find(i => i.id === item.id)).toBeTruthy();
  });

  it('addToInventoryRaw bypasses auto-equip', () => {
    const item = generateItem('sword', 'magic', 'medium');
    GameState.addToInventoryRaw(item);
    const gs = GameState.get();
    expect(gs.party[0].equipment.weapon).toBeUndefined();
    expect(gs.inventory.find(i => i.id === item.id)).toBeTruthy();
  });
});

describe('M276 B4/U9 — boss chest pre-roll persistence', () => {
  it('round-trips _bossChestItems through toSaveData/load', () => {
    GameState.init(makeHero());
    const gs = GameState.get();
    gs._bossChestItems = [generateItem('sword', 'rare', 'high'), generateItem('ring', 'rare', 'high')];
    gs._bossChestNodeId = 'border_boss_node';
    const saved = GameState.toSaveData();
    // Sanity: chest items persisted on save data.
    expect(Array.isArray(saved._bossChestItems)).toBe(true);
    expect(saved._bossChestItems.length).toBe(2);
    expect(saved._bossChestNodeId).toBe('border_boss_node');
    GameState.load(saved);
    const reloaded = GameState.get();
    expect(reloaded._bossChestItems.length).toBe(2);
    expect(reloaded._bossChestItems[0].id).toBe(saved._bossChestItems[0].id);
  });

  it('manuallyUnequipped Set survives toSaveData/load', () => {
    GameState.init(makeHero());
    GameState.markManuallyUnequipped('item_xyz');
    const saved = GameState.toSaveData();
    expect(Array.isArray(saved.manuallyUnequipped)).toBe(true);
    GameState.load(saved);
    expect(GameState.isManuallyUnequipped('item_xyz')).toBe(true);
  });
});
