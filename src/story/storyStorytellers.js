import { normalizeStoryteller } from './storyLedger.js';

export const STORYTELLER_PROFILES = Object.freeze({
  chronicler: {
    id: 'chronicler',
    displayName: 'The Chronicler',
    bio: 'Weaves consistent narrative threads and rewards coherent routes.',
    preferredThemes: ['lore', 'investigation', 'faction', 'memory'],
    combatFrequency: 0.45,
    skillCheckVariety: 0.6,
    thematicConsistency: 0.85,
    pressureBias: 0.0,
    rules: {
      maxSameTypeStreak: 2,
      minNodesBetweenBosses: 25,
      forceRestAfterBrutalFight: true,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'narrative_coherence_bonus',
  },
  ash_prophet: {
    id: 'ash_prophet',
    displayName: 'The Ash Prophet',
    bio: 'Reads omens in soot and sends the route sideways.',
    preferredThemes: ['omen', 'mystery', 'danger', 'rupture'],
    combatFrequency: 0.55,
    skillCheckVariety: 0.5,
    thematicConsistency: 0.7,
    pressureBias: 0.2,
    rules: {
      maxSameTypeStreak: 3,
      minNodesBetweenBosses: 18,
      forceRestAfterBrutalFight: true,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'dark_omen_interrupt',
  },
  warbringer: {
    id: 'warbringer',
    displayName: 'The Warbringer',
    bio: 'Pushes momentum and escalates when the party keeps winning.',
    preferredThemes: ['battle', 'ambush', 'frontline', 'conflict'],
    combatFrequency: 0.7,
    skillCheckVariety: 0.4,
    thematicConsistency: 0.6,
    pressureBias: 0.15,
    rules: {
      maxSameTypeStreak: 2,
      minNodesBetweenBosses: 16,
      forceRestAfterBrutalFight: true,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'momentum_escalation',
  },
  trickster: {
    id: 'trickster',
    displayName: 'The Trickster',
    bio: 'Breaks patterns and deliberately derails predictable routing.',
    preferredThemes: ['chaos', 'surprise', 'mischief', 'hidden'],
    combatFrequency: 0.5,
    skillCheckVariety: 0.85,
    thematicConsistency: 0.4,
    pressureBias: 0.0,
    rules: {
      maxSameTypeStreak: 2,
      minNodesBetweenBosses: 15,
      forceRestAfterBrutalFight: true,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'every_6th_random',
  },
  pilgrim: {
    id: 'pilgrim',
    displayName: 'The Pilgrim',
    bio: 'Rewards discovery, hidden paths, and patient route-finding.',
    preferredThemes: ['lore', 'hidden', 'discovery', 'rest'],
    combatFrequency: 0.35,
    skillCheckVariety: 0.7,
    thematicConsistency: 0.7,
    pressureBias: -0.1,
    rules: {
      maxSameTypeStreak: 3,
      minNodesBetweenBosses: 22,
      forceRestAfterBrutalFight: true,
      fallbackAllowed: true,
    },
    uniqueMechanic: 'discovery_pool_3x',
  },
  iron_judge: {
    id: 'iron_judge',
    displayName: 'The Iron Judge',
    bio: 'Refuses soft fallback and punishes sloppy routing.',
    preferredThemes: ['discipline', 'justice', 'conflict', 'confrontation'],
    combatFrequency: 0.6,
    skillCheckVariety: 0.5,
    thematicConsistency: 0.75,
    pressureBias: 0.25,
    rules: {
      maxSameTypeStreak: 2,
      minNodesBetweenBosses: 20,
      forceRestAfterBrutalFight: false,
      fallbackAllowed: false,
    },
    uniqueMechanic: 'no_fallback_ambush_instead',
  },
});

export function getStorytellerProfile(id) {
  return STORYTELLER_PROFILES[normalizeStoryteller(id)] || STORYTELLER_PROFILES.chronicler;
}

export function pressureBandName(pressure = 0) {
  const p = clampPressure(pressure);
  if (p <= 29) return 'Calm';
  if (p <= 59) return 'Tense';
  if (p <= 79) return 'Urgent';
  return 'Crisis';
}

export function clampPressure(value) {
  return Math.max(0, Math.min(100, Math.trunc(Number(value) || 0)));
}

export function profileThemeMatch(profile, candidate) {
  const themes = candidate.themeTags || [];
  return themes.some(tag => profile.preferredThemes.includes(tag));
}

export function uniqueMechanicTag(profile) {
  return profile.uniqueMechanic;
}
