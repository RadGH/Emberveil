/**
 * quests.js — M236 questline scaffold ("The Architect's Hand").
 *
 * Diablo-2-style flow: the main-quest beats advance automatically as you
 * clear act bosses. Side quests are optional and show on the bounty board.
 * Recurring NPCs (Silas, Kaela, Marek) show up across multiple acts with
 * twists. Quest state is written to gs.quests (added here as a first pass).
 */

// Recurring NPCs. Portrait paths route through the existing pixellab
// pipeline — Silas reuses cleric_male art, Kaela reuses ranger (female),
// Marek reuses warlock (hooded). This is the "vibe-coded" stand-in so the
// narrative ships without blocking on bespoke NPC portraits.
export const QUEST_NPCS = {
  silas: {
    id: 'silas', name: 'Silas Veilward',
    portrait: 'images/spritecook/cleric_male_portrait.png',
    appearance: 'cleric_male',
    roles: ['mentor', 'traitor (revealed Act 3)', 'final-act red herring'],
    bio: 'A grey-bearded scholar of the Ember who finds the player in every town until Act 3.',
  },
  kaela: {
    id: 'kaela', name: 'Kaela Thorne',
    portrait: 'images/spritecook/ranger_portrait.png',
    appearance: 'ranger',
    roles: ['rival (Act 1-2)', 'reluctant ally (Act 4+)'],
    bio: 'A smug ranger bounty hunter who keeps beating you to the mark — until it gets her hurt.',
  },
  marek: {
    id: 'marek', name: 'Marek Greel',
    portrait: 'images/spritecook/warlock_portrait.png',
    appearance: 'warlock',
    roles: ['scholar (Act 2)', 'hooded advisor (Act 3-4)', 'The Architect (Act 5)'],
    bio: 'A quiet hooded scholar who keeps turning up. Claims to study the Ember. He is the Architect.',
  },
};

// Quest status machine: 'inactive' | 'active' | 'completed' | 'failed'.
export const QUEST_STATUS = { INACTIVE: 'inactive', ACTIVE: 'active', COMPLETED: 'completed', FAILED: 'failed' };

// Main-quest beats. Each advances automatically when the linked boss dies
// (wired via CombatScreen victory). Optional side quests live in SIDE_QUESTS.
export const MAIN_QUESTS = [
  {
    id: 'mq_act1', title: 'Blood at the Border', act: 1,
    giver: 'silas',
    summary: 'Silas suspects the goblin raids are a cover. Clear the Border Roads boss to find what the cult left behind.',
    autoCompleteOnBossKill: 'border_boss',
    reveal: 'The goblins served "the ones in the robes." Silas names them the Ashen Veil.',
  },
  {
    id: 'mq_act2', title: 'Embers Over Cinderhold', act: 2,
    giver: 'silas',
    summary: 'Silas asks you to find his missing daughter Lysa. The Ashen Veil took her to the Ember Plateau.',
    autoCompleteOnBossKill: 'plateau_boss',
    reveal: 'Lysa is dead. A letter in her hand accuses Silas of handing her to the cult. A hooded scholar named Marek Greel offers sympathy.',
  },
  {
    id: 'mq_act3', title: 'The Veil Breach', act: 3,
    giver: 'silas',
    summary: 'Confront Silas at Dreadhearth. He will not survive Archfiend Malgrath alone. Choose: spare him or end it.',
    autoCompleteOnBossKill: 'breach_boss',
    reveal: 'Silas admits the Ashen Veil compromised him decades ago. He swears he tried to escape it. The Architect — someone higher — runs the cult.',
    choices: ['spare_silas', 'execute_silas'],
  },
  {
    id: 'mq_act4', title: 'Shards of the Architect', act: 4,
    giver: 'kaela',
    summary: 'Kaela Thorne has been tracking the cult through the portal. She asks for three void shards to trace the Architect.',
    autoCompleteOnBossKill: 'core_boss',
    reveal: 'The shards point at a hooded scholar. Kaela recognises Marek Greel.',
  },
  {
    id: 'mq_act5', title: 'The Architect', act: 5,
    giver: 'kaela',
    summary: 'Marek Greel is the Architect. Silas was his puppet for decades. Put him down.',
    autoCompleteOnBossKill: 'rift_boss',
    reveal: 'Reality settles. The Ember cools. The wise man in the town square was never the wise man.',
  },
];

// Side quests — bounty-board. Act 2+ only. Each wraps an existing encounter,
// so completion is "kill the encounter" or "clear the node." Kept short on
// purpose so the bounty board is a filler loop, not a reading assignment.
export const SIDE_QUESTS = [
  { id: 'sq_thornwood_spider', act: 1, title: 'Spider Queen Bounty', target: 'thornwood_boss', reward: { gold: 120 } },
  { id: 'sq_dust_obsidian',   act: 2, title: 'Raze the Obsidian Fort', target: 'obsidian_fort', reward: { gold: 200 } },
  { id: 'sq_dust_priest',     act: 2, title: 'Silence the Veil High Priest', target: 'veil_high_priest', reward: { gold: 280 } },
  { id: 'sq_ember_keep',      act: 3, title: 'Inferno Keep Contract', target: 'inferno_keep', reward: { gold: 360 } },
  { id: 'sq_hell_reliquary',  act: 3, title: 'Demon Reliquary', target: 'demon_reliquary', reward: { gold: 420 } },
  { id: 'sq_core_crypt',      act: 4, title: 'Memory Crypt Sweep', target: 'memory_crypt', reward: { gold: 500 } },
  { id: 'sq_core_fortress',   act: 4, title: 'Shard Fortress Siege', target: 'shard_fortress', reward: { gold: 600 } },
  { id: 'sq_rift_patrol',     act: 5, title: 'Void Patrol Contract', target: 'void_nexus_ambush', reward: { gold: 700 } },
  { id: 'sq_rift_camp',       act: 5, title: 'Abyssal Camp', target: 'abyssal_garrison', reward: { gold: 820 } },
  { id: 'sq_act6_dragons',    act: 6, title: 'Dragon Patrol Bounty', target: 'dragon_patrol', reward: { gold: 950 } },
];

// Call after every combat / map event to advance main-quest state. Safe to
// call with unknown ids — returns null if nothing advanced.
export function advanceOnBossKill(gs, bossEncounterId) {
  if (!gs) return null;
  gs.quests = gs.quests || {};
  for (const q of MAIN_QUESTS) {
    if (q.autoCompleteOnBossKill === bossEncounterId && gs.quests[q.id] !== QUEST_STATUS.COMPLETED) {
      gs.quests[q.id] = QUEST_STATUS.COMPLETED;
      // Auto-activate the next act's quest so the journal always shows a
      // current objective. Last act's quest just completes.
      const next = MAIN_QUESTS.find(n => n.act === q.act + 1);
      if (next) gs.quests[next.id] = QUEST_STATUS.ACTIVE;
      return q;
    }
  }
  return null;
}

// Activate the Act 1 quest automatically the first time the player hits the
// map (called from MapScreen onEnter).
export function ensureMainQuestStarted(gs) {
  if (!gs) return;
  gs.quests = gs.quests || {};
  if (!gs.quests.mq_act1) gs.quests.mq_act1 = QUEST_STATUS.ACTIVE;
}
