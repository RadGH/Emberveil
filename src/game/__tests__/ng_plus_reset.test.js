import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, resetRunProgression } from '../gameState.js';

/**
 * NG+ progression isolation. The bug: starting NG+ left map node
 * completion markers, story flags, random-event picks, etc. populated
 * from the previous run, so the new run rendered already-cleared
 * nodes / drained drop-chances / consumed one-time dialogs.
 *
 * Contract: resetRunProgression() wipes per-run progression, preserves
 * meta (heroes, inventory, fame, achievements). GameState.startNgPlus()
 * uses it and bumps ngPlus.
 */
describe('NG+ run-progression reset', () => {
  beforeEach(() => {
    GameState.init({
      id: 'h1',
      heroName: 'Test',
      heroClass: 'warrior',
      attrs: { str: 10, dex: 10, int: 10, con: 10 },
      level: 1,
      maxHp: 100,
      maxMp: 50,
    });
  });

  function seedRunProgression(gs) {
    gs.storyFlags.cleared_hidden_path = true;
    gs.storyFlags.prologue_warned = true;
    gs.storyFlags.shade_warned_malgrath = true;
    gs.storyFlags.yssira_sky_seen = true;
    gs.visitedNodes.add('node_a');
    gs.visitedNodes.add('node_b');
    gs.sneakedNodes.add('node_b');
    gs.usedShrines.add('shrine_1');
    gs.shrineBuffs.push({ type: 'might', combatsLeft: 3 });
    gs.skillChecksAttempted = new Set(['skill_1', 'skill_2']);
    gs.completedBosses.push('border_boss');
    gs.completedDungeons.push('dungeon_1');
    gs.unlockedZones.push('thornwood', 'dust_roads');
    gs.seenEvents.push('event_1', 'event_2');
    gs.assignedRandomEvents['thornwood:node_a'] = 'event_x';
    gs.nodeOverlays.thornwood = [{ id: 'ov1', nodeId: 'n1' }];
    gs.fogRevealed.thornwood = ['n1', 'n2'];
    gs._bossChestItems = [{ id: 'sword' }];
    gs._bossChestNodeId = 'border_boss';
    gs.portal = { nodeId: 'pn', zoneId: 'thornwood' };
    gs.infiniteRun = { active: true, floor: 7 };
    gs.act = 3;
    gs.zoneId = 'dust_roads';
    gs.nodeId = 'mid';
    gs.zoneNodeIds = { dust_roads: 'mid', thornwood: 'n3' };
    if (gs.stats) gs.stats.run = { combatsWon: 42 };
  }

  it('resetRunProgression clears every per-run container', () => {
    const gs = GameState.get();
    seedRunProgression(gs);

    resetRunProgression(gs);

    expect(gs.storyFlags).toEqual({});
    expect(gs.visitedNodes.size).toBe(1);
    expect(gs.visitedNodes.has('start')).toBe(true);
    expect(gs.sneakedNodes.size).toBe(0);
    expect(gs.usedShrines.size).toBe(0);
    expect(gs.shrineBuffs).toEqual([]);
    expect(gs.skillChecksAttempted.size).toBe(0);
    expect(gs.completedBosses).toEqual([]);
    expect(gs.completedDungeons).toEqual([]);
    expect(gs.unlockedZones).toEqual(['prologue']);
    expect(gs.seenEvents).toEqual([]);
    expect(gs.assignedRandomEvents).toEqual({});
    expect(gs.nodeOverlays).toEqual({});
    expect(gs.fogRevealed).toEqual({});
    expect(gs._bossChestItems).toBeNull();
    expect(gs._bossChestNodeId).toBeNull();
    expect(gs.portal).toBeNull();
    expect(gs.infiniteRun).toBeNull();
    expect(gs.act).toBe(0);
    expect(gs.zoneId).toBe('prologue');
    expect(gs.nodeId).toBe('start');
    expect(gs.zoneNodeIds).toEqual({ prologue: 'start' });
  });

  it('resetRunProgression bumps runCount', () => {
    const gs = GameState.get();
    expect(gs.runCount).toBeUndefined();
    resetRunProgression(gs);
    expect(gs.runCount).toBe(2);
    resetRunProgression(gs);
    expect(gs.runCount).toBe(3);
  });

  it('resetRunProgression uses fresh containers (no shared refs)', () => {
    const gs = GameState.get();
    const beforeFlags = gs.storyFlags;
    const beforeVisited = gs.visitedNodes;
    const beforeOverlays = gs.nodeOverlays;
    resetRunProgression(gs);
    // Mutating the post-reset containers must not affect the pre-reset
    // ones (catches shared-reference bugs like the auto-skill issue).
    gs.storyFlags.new_flag = true;
    gs.visitedNodes.add('new_node');
    gs.nodeOverlays.zone_z = [{}];
    expect(beforeFlags).not.toBe(gs.storyFlags);
    expect(beforeVisited).not.toBe(gs.visitedNodes);
    expect(beforeOverlays).not.toBe(gs.nodeOverlays);
  });

  it('startNgPlus preserves heroes, inventory, fame, achievements', () => {
    const gs = GameState.get();
    // Seed meta-progression that NG+ must keep.
    gs.party[0].level = 17;
    gs.party[0].pendingAttrPoints = 0;
    gs.inventory.push({ id: 'epic_sword', rarity: 'epic' });
    gs.materials.iron_scrap = 25;
    gs.achievements.first_blood = { unlocked: true, date: '2026-01-01' };
    gs.tavernHired = { 'town_a': ['hire_1'] };
    // Seed per-run progression that must be wiped.
    seedRunProgression(gs);
    const fameBefore = gs.fame;

    GameState.startNgPlus();

    // Meta preserved
    expect(gs.party.length).toBe(1);
    expect(gs.party[0].level).toBe(17);
    expect(gs.party[0].pendingAttrPoints).toBe(5); // NG+ grants +5
    expect(gs.inventory.some(i => i.id === 'epic_sword')).toBe(true);
    expect(gs.materials.iron_scrap).toBe(25);
    expect(gs.achievements.first_blood?.unlocked).toBe(true);
    expect(gs.tavernHired).toEqual({ 'town_a': ['hire_1'] });
    expect(gs.fame).toBe(fameBefore);
    expect(gs.ngPlus).toBe(1);
    // Run progression wiped
    expect(gs.storyFlags).toEqual({});
    expect(gs.completedBosses).toEqual([]);
    expect(gs.visitedNodes.has('node_a')).toBe(false);
    expect(gs.unlockedZones).toEqual(['prologue']);
    expect(gs.zoneId).toBe('prologue');
    expect(gs.act).toBe(0);
  });

  it('startNgPlus stacks on subsequent calls', () => {
    GameState.startNgPlus();
    GameState.startNgPlus();
    expect(GameState.getNgPlus()).toBe(2);
    expect(GameState.get().runCount).toBe(3);
  });
});
