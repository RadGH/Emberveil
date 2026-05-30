/**
 * lore.js — M298
 *
 * All lore compendium entries for Emberveil, authored by Claude.
 * Categories: World | Factions | Bestiary | Locations | History | Arcana
 *
 * Each entry:
 *   id         — unique snake_case key
 *   category   — World | Factions | Bestiary | Locations | History | Arcana
 *   title      — display name
 *   body       — 100-150 word dark-fantasy prose (Claude-authored)
 *   unlockedBy — { type: 'always' | 'lore_node' | 'boss_kill' | 'achievement', id?: '...' }
 */

export const LORE_ENTRIES = [
  // ══ WORLD ═══════════════════════════════════════════════════════════════

  {
    id: 'world_emberveil',
    category: 'World',
    title: 'The Emberveil',
    body: `Before the world had a name, there was the Veil — a membrane of living fire that separated the mortal realm from the Architect's domain. Those who lived near it called it the Emberveil. Its glow is not warmth; it is the light of things that should not exist leaking through. The Veil has always been thin in places, but it grows thinner each season. Where it tears, old things enter. Where it frays, magic bleeds out uncontrolled. Some scholars believe the Emberveil is not separating two worlds but stitching them together — and the stitching is failing.`,
    unlockedBy: { type: 'always' },
  },
  {
    id: 'world_the_realm',
    category: 'World',
    title: 'The Mortal Realm',
    body: `Six distinct lands form the known world. The Goblin Frontier stretches across the eastern border, a contested land of abandoned fortresses and shallow graves. Beyond it, the Ashen Wastes collect the fallout of an ancient volcanic catastrophe that never fully cooled. South of the Wastes, Hell's Breach is a wound in the earth that predates memory. The Cosmic Void is not a place — it is an absence where the sky once was, filled now with something that looks at you back. At the edge of the world, the Dragon's Reach keeps its own counsel. Between all of it: Emberglen, where heroes begin.`,
    unlockedBy: { type: 'always' },
  },
  {
    id: 'world_the_veil_corruption',
    category: 'World',
    title: 'The Corruption',
    body: `The corruption is not a disease. It is intent. Whatever moves behind the Veil has been testing the membrane for generations, probing its weaknesses, sending emissaries ahead of its true arrival. The corruption spreads outward from Veil-tears: animals mutate, the dead refuse to stay dead, and people who breathe the air too long begin to see shapes in shadows and hear commands in static. The Veil Cult calls this Awakening. The Cleric orders call it Abomination. Both are correct. The question is not whether the corruption will spread. The question is who survives it.`,
    unlockedBy: { type: 'lore_node', id: 'lore_monolith' },
  },
  {
    id: 'world_the_architect',
    category: 'World',
    title: 'The Architect',
    body: `Nothing survives that directly faced the Architect and lived to describe it accurately. Fragmented texts call it an intelligence that preceded the world, something that built this reality as a vessel for a purpose mortals lack the context to understand. The Goblin shamans paint it as a spider at the center of a web. The dragons called it the First Flame before their tongue went extinct. What the texts agree on: the Architect is not evil. It is not good. It is patient, and it has been waiting for the Emberveil to thin enough for it to act. That threshold has nearly been reached.`,
    unlockedBy: { type: 'boss_kill', id: 'void_boss' },
  },

  // ══ FACTIONS ════════════════════════════════════════════════════════════

  {
    id: 'faction_veil_cult',
    category: 'Factions',
    title: 'The Veil Cult',
    body: `They were alchemists once, obsessed with understanding the Veil's composition. The obsession consumed them. The Veil Cult now serves the corruption knowingly, believing that what lies beyond the Veil is not a threat but an ascension. Members undergo voluntary Veil-exposure to gain powers that shorten their lifespans and alter their physiology. Their strongholds cluster near Veil-tears, and they sacrifice significant resources to prevent those tears from healing. Their leadership, called the Stitchers, can walk through minor Veil-gaps unharmed. What they serve, they do not disclose.`,
    unlockedBy: { type: 'always' },
  },
  {
    id: 'faction_cleric_order',
    category: 'Factions',
    title: 'The Cleric Orders',
    body: `Three Cleric Orders operate in the mortal realm, each claiming divine authority and each disagreeing about the nature of that authority. The Order of the Living Flame maintains that the Veil must be sealed at any cost. The Order of the Open Hand prioritizes the living over doctrinal concerns and will negotiate even with Veil-touched creatures. The Order of the Last Page believes the corruption is a reckoning and that the only salvation is comprehension — they study the Architect's texts obsessively. All three cooperate when a Veil-tear threatens civilians. On every other matter, they are adversaries.`,
    unlockedBy: { type: 'always' },
  },
  {
    id: 'faction_guild_of_embers',
    category: 'Factions',
    title: 'The Guild of Embers',
    body: `Not every problem in the Goblin Frontier is supernatural. The Guild of Embers is a mercenary collective that formed when the standing armies retreated from the border twenty years ago. They fill the gap: contracts for escort, extermination, recovery, and salvage. They do not discriminate by race or origin, which makes them despised by some and relied upon by everyone. Heroes hired through the Guild wear the Ember-brand — a small mark burned into the forearm — and are recognized at every frontier settlement. The Guild keeps no political loyalties. Their only loyalty is to the contract and to each other.`,
    unlockedBy: { type: 'achievement', id: 'full_party' },
  },
  {
    id: 'faction_dragons',
    category: 'Factions',
    title: 'The Dragon Courts',
    body: `Before the Cosmic Void opened, dragons governed the Dragon's Reach as a loose court of ancient intelligences, each sovereign over a territory determined by breath-type. That court is effectively dissolved. The Void's arrival fragmented dragon society — some chose to seal themselves in deep warrens and wait out the apocalypse; others sided with the corruption for reasons their kin consider insane; a rare few chose mortal allies, producing the Dragon Knight bloodlines. The remaining feral dragons defend territories reflexively, without the strategic precision of their ancestors. They are dangerous but no longer purposeful.`,
    unlockedBy: { type: 'boss_kill', id: 'dragon_boss' },
  },

  // ══ BESTIARY ════════════════════════════════════════════════════════════

  {
    id: 'bestiary_goblins',
    category: 'Bestiary',
    title: 'Goblins',
    body: `Goblins were not always organized. Three generations of contact with Veil-corruption has accelerated their tribal structure into something more militarized. The largest groups field shamans who channel raw Veil-energy into crude but effective combat magic. The foot soldiers are individually weak; they are designed by evolution to survive through numbers, flanking, and attrition. They do not retreat willingly — the tribal structure punishes desertion. Goblin camps are always temporary, always guarded, and always within running distance of a defensible hole. Killing the shaman first destabilizes the unit. This is not a tactic most learn on the second encounter.`,
    unlockedBy: { type: 'always' },
  },
  {
    id: 'bestiary_veil_elementals',
    category: 'Bestiary',
    title: 'Veil Elementals',
    body: `Not creatures of this world, Veil Elementals are solidified bleed-through — pieces of the energy behind the Veil that gained local coherence during a major tear. They do not eat, sleep, or plan. They exist in a state of sustained disruption, drawn instinctively toward heat, light, and living magic. Their attacks are not violent so much as corrosive — contact with a Veil Elemental introduces corruption into a target's blood that accumulates over time. They cannot be reasoned with. Sealing the tear that spawned them causes them to lose coherence within hours, but they rarely linger long enough for that to matter.`,
    unlockedBy: { type: 'lore_node', id: 'lore_monolith' },
  },
  {
    id: 'bestiary_unraveler',
    category: 'Bestiary',
    title: 'The Unraveler',
    body: `The Unraveler is not a monster. It is a consequence. When Veil-corruption reaches a threshold density in a region, the region itself begins to reorganize around a singular will — the Architect's will, expressed as raw dissolution. The Unraveler is the visible expression of this reorganization: a convergence of corrupted matter and broken spatial logic that attacks not bodies but the concept of physical integrity. Those it kills do not leave corpses. Those who survive an Unraveler encounter describe the sensation as being asked, very quietly, to stop existing. It is immune to conventional disruption. Its only weakness is the Veil-sealing techniques employed by senior Clerics.`,
    unlockedBy: { type: 'boss_kill', id: 'void_boss' },
  },
  {
    id: 'bestiary_bone_hound',
    category: 'Bestiary',
    title: 'Bone Hounds',
    body: `Necromantic experiments from the Shattered Hell era did not end when the practitioner died. Bone Hounds are the persistent result: skeletal constructs built from multiple canine and humanoid specimens, driven by a basic hunting directive that outlasted their creator's capacity to update it. They track by residual magical signature, not scent, which makes invisibility useless against them. They do not tire, do not feel pain, and do not lose confidence. Some have been active for forty years. The oldest surviving Bone Hound has changed territories six times as the landscape around it collapsed. It is, in its own way, impressive.`,
    unlockedBy: { type: 'always' },
  },

  // ══ LOCATIONS ═══════════════════════════════════════════════════════════

  {
    id: 'location_emberglen',
    category: 'Locations',
    title: 'Emberglen',
    body: `A frontier settlement that should not have survived. Emberglen sits at the intersection of three old roads, one of which runs directly east into Goblin Frontier territory. The population is small, the walls are patched, and the Cleric temple is one room. What Emberglen has that comparable settlements lack is stubbornness: its founders refused to relocate when the Frontier expanded toward them, and every generation since has made the same refusal. The settlement's economy runs on contract work and salvage. Its tavern, The Ember & Ash, maintains the only functioning hearth within two days' ride that is not controlled by someone dangerous.`,
    unlockedBy: { type: 'always' },
  },
  {
    id: 'location_veil_stronghold',
    category: 'Locations',
    title: 'Veil Stronghold',
    body: `The Veil Stronghold was a frontier garrison before the cult took it. The original garrison commander's name was stripped from the records when it was discovered she had been feeding the cult information for seven years before defecting entirely. The Stronghold now serves as the Veil Cult's primary staging ground in the Frontier Zone — a logistics hub for Veil-tear activity, cultist recruitment, and the preparation of larger incursions. Its walls are reinforced with Veil-calcified stone that disrupts magical attacks from outside. Breaching it requires either overwhelming force or exceptional deception. Most parties that attempt it discover which of these they lack.`,
    unlockedBy: { type: 'lore_node', id: 'lore_monolith' },
  },
  {
    id: 'location_cosmic_void',
    category: 'Locations',
    title: 'The Cosmic Void',
    body: `The Void opened forty years ago above what was previously a mountain range. The mountains are still there, technically, but they exist inside the Void now, which means they exist in a state of conditional reality — present when observed by someone standing in the mortal realm, absent when approached. Traveling into the Void requires a Void-anchor: a crystallized piece of the old sky that keeps the traveler's physical continuity intact. Travelers report that inside the Void, time is legible but not sequential — you can see what happened and what will happen, but you experience them simultaneously, which causes most people to lose the ability to plan.`,
    unlockedBy: { type: 'achievement', id: 'act4_enter' },
  },
  {
    id: 'location_ashfort',
    category: 'Locations',
    title: 'Ashfort',
    body: `Ashfort was built on volcanic bedrock during the first expansion into the Ashen Wastes, intended as a permanent forward base. The volcano is dormant now but was active during construction, which explains why the lower city is partially slag. The upper city, built after the eruption cycle ended, is better maintained: stone-on-stone construction, wider streets designed for siege equipment movement, and a Blacksmith guild that supplies the entire western Wasteland campaign. The population is military-adjacent — retired soldiers, support contractors, and the families of people who never went home. Ashfort has not been peaceful since it was founded. It has been quiet occasionally.`,
    unlockedBy: { type: 'achievement', id: 'act2_clear' },
  },

  // ══ HISTORY ═════════════════════════════════════════════════════════════

  {
    id: 'history_first_veil_tear',
    category: 'History',
    title: 'The First Tear',
    body: `The records are contested, but most historians place the First Veil Tear at 200 years before the current age. A fishing village on the eastern coast reported that their nets began pulling up organisms that matched nothing in any compendium. Three days later, the village was gone — not destroyed, just gone. The ground where it stood showed evidence of extreme heat from beneath rather than above. The Cleric Order of the Living Flame conducted the first documented investigation and sealed the tear using the Veil-binding technique that is still taught today. The village was never rebuilt. The land is currently inside the Goblin Frontier, which the shamans consider sacred.`,
    unlockedBy: { type: 'always' },
  },
  {
    id: 'history_the_great_war',
    category: 'History',
    title: 'The Border Wars',
    body: `The Border Wars were not one war. They were forty years of recurring conflict between the expanding Goblin tribes — driven east by Veil-corruption they did not understand but could sense — and the mortal settlements that had assumed the eastern lands were uninhabited. Neither side was wrong about what they needed. Both sides were wrong about the other. The wars ended not through victory but exhaustion: the Goblin expansion stopped when the Veil-corruption in the east stabilized, and the mortal settlements could not afford to pursue into corrupted territory. The current Frontier is the stable line that emerged. Both sides maintain it by ignoring each other as consistently as possible.`,
    unlockedBy: { type: 'achievement', id: 'act2_clear' },
  },
  {
    id: 'history_dragon_exodus',
    category: 'History',
    title: 'The Dragon Exodus',
    body: `When the Cosmic Void opened, the dragons were the first to understand what it meant. They had Architect-memory in their oldest bloodlines — ancestral knowledge imprinted before the first Veil-tear. They called a full Court for the first time in recorded history. The deliberation lasted eleven days. At the end of it, the Court fractured. Most chose isolation. A small number chose to join the corruption, believing the Architect's return was the correct end-state for the world. The Dragon Knights are the descendants of the third faction — those who chose mortal alliance, believing that the Architect's plan was not inevitable and that sufficient interference could change it. They were, and remain, the minority opinion.`,
    unlockedBy: { type: 'achievement', id: 'act4_enter' },
  },

  // ══ ARCANA ══════════════════════════════════════════════════════════════

  {
    id: 'arcana_the_veil_magic',
    category: 'Arcana',
    title: 'Veil-Derived Magic',
    body: `All magic in the mortal realm originates from the Emberveil. This is not metaphorical. The Veil leaks constantly at a low level — a slow diffusion of energy that accumulates in living tissue over a lifetime and becomes what practitioners call Mana. Mages, Clerics, and Warlocks differ not in access to this energy but in how they process and redirect it. Mages impose mathematical order on raw Veil-energy. Clerics channel it through a doctrinal framework that filters the Architect's influence. Warlocks accept the Veil-energy without filtering, which produces more powerful and less predictable results. All three traditions agree that overexposure to pure Veil-energy is lethal. They disagree about the threshold.`,
    unlockedBy: { type: 'always' },
  },
  {
    id: 'arcana_the_ember_flame',
    category: 'Arcana',
    title: 'The Ember Flame',
    body: `Ember Flame is not fire. It is the visual manifestation of Veil-energy discharging into the mortal air — the same phenomenon that makes the Emberveil itself visible at night. Ember Flame burns at a temperature calibrated to its wielder's intent, not to any physical property of its fuel. This is why it is impossible to accidentally start an Ember Flame: it requires deliberate channeling. The flame can burn cold, burn hot, burn selectively, or burn nothing at all while producing heat. Fire-school Mages spend their first three years learning to distinguish Ember Flame from natural combustion, because the treatment for each is entirely different.`,
    unlockedBy: { type: 'achievement', id: 'codex_opened' },
  },
  {
    id: 'arcana_enchanting',
    category: 'Arcana',
    title: 'Enchantment Theory',
    body: `Enchanting is the practice of binding Veil-energy into an object so that the object expresses that energy passively and permanently. The difficulty is not the binding — most practitioners can manage that — but the stability. Veil-energy wants to discharge. An enchanted item is, at the atomic level, a controlled explosion held in suspension. Enchanters spend more of their training on failure conditions than on success states. A poorly stabilized enchantment does not merely fail to function; it releases its stored energy in a manner calibrated to whatever was being suppressed. A sword enchanted for fire and improperly stabilized becomes a fire hazard with a handle. This is why enchanted items are expensive. It is also why Enchanters are cautious people.`,
    unlockedBy: { type: 'achievement', id: 'enchanted' },
  },
  {
    id: 'arcana_necromancy',
    category: 'Arcana',
    title: 'Necromantic Practices',
    body: `Necromancy is not illegal in the mortal realm. It is regulated, which is worse — regulation implies it is considered legitimate enough to require oversight. The practice involves redirecting Veil-energy through organic material that is no longer producing its own life-energy. The result moves and responds to the practitioner's direction but does not think, does not suffer, and does not age further. Undead are not dead people. They are dead tissue occupied by channeled Veil-energy. The person who lived in that tissue is not present. Necromancers who tell themselves otherwise tend to make increasingly poor decisions over time. The Shattered Hell's condition is attributed, in most accounts, to a Necromancer who told themselves otherwise for twenty-two years.`,
    unlockedBy: { type: 'achievement', id: 'act3_clear' },
  },
  {
    id: 'arcana_sealing_arts',
    category: 'Arcana',
    title: 'Veil-Sealing Arts',
    body: `The technique for sealing a Veil-tear was developed by the Order of the Living Flame and has not been significantly improved in 200 years. It requires at least three practitioners working in synchronized resonance, a prepared anchor made from pre-tear stone, and approximately six uninterrupted hours. During those six hours, anything that wants the tear to remain open will attempt to stop the sealing. This is the primary reason the Cleric Orders maintain combat training — not because they want to fight, but because anything worth sealing is defended by something that learned to prefer an open Veil. The Sealing Arts are not secret. They are simply difficult to perform under the conditions in which they are typically needed.`,
    unlockedBy: { type: 'boss_kill', id: 'core_boss' },
  },
];

/**
 * Returns lore categories in canonical order.
 */
export const LORE_CATEGORIES = ['World', 'Factions', 'Bestiary', 'Locations', 'History', 'Arcana'];

/**
 * Check if a lore entry should be unlocked given current game state.
 * @param {object} entry  LORE_ENTRIES item
 * @param {object} gs     GameState snapshot
 * @param {Set}    loreUnlocked  Set of unlocked lore ids from game state
 */
export function isLoreUnlocked(entry, gs, loreUnlocked) {
  const ub = entry.unlockedBy;
  if (!ub || ub.type === 'always') return true;
  if (ub.type === 'lore_node') {
    return loreUnlocked.has(entry.id) || !!(gs.storyFlags?.[`cleared_${ub.id}`]);
  }
  if (ub.type === 'boss_kill') {
    return !!(gs.completedBosses?.includes(ub.id)) || loreUnlocked.has(entry.id);
  }
  if (ub.type === 'achievement') {
    return !!(gs.achievements?.[ub.id]?.unlocked) || loreUnlocked.has(entry.id);
  }
  return loreUnlocked.has(entry.id);
}
