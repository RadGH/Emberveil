export const STORY_QUESTS = {
  primary_act1_emberwood: {
    id: 'primary_act1_emberwood',
    category: 'primary',
    act: 1,
    title: 'The Emberwood Holds',
    startCondition: { op: 'flag', flag: 'act1_started' },
    phases: [
      {
        id: 'find_the_road',
        label: 'Find the old road',
        completeCondition: { op: 'flag', flag: 'arrived_old_road' },
        onComplete: [
          { type: 'quest_log', text: 'The old road is still passable, but something has marked the stones.' },
          { type: 'faction_delta', faction: 'emberguard', amount: 1 },
        ],
        nextPhase: 'choose_first_ally',
      },
      {
        id: 'choose_first_ally',
        label: 'Choose who walks beside you',
        completeCondition: { op: 'any', terms: [
          { op: 'companion', companion: 'lyra_ashwalker', recruited: true },
          { op: 'companion', companion: 'orren_gravetide', recruited: true },
        ] },
        onComplete: [
          { type: 'quest_log', text: 'An ally has joined the road.' },
          { type: 'set_flag', flag: 'act1_companion_recruited' },
        ],
        nextPhase: 'reach_gloomridge',
      },
      {
        id: 'reach_gloomridge',
        label: 'Reach Gloomridge',
        completeCondition: { op: 'flag', flag: 'gloomridge_found' },
        onComplete: [
          { type: 'quest_log', text: 'Gloomridge waits under a low red sky.' },
          { type: 'pressure', amount: 4 },
        ],
      },
    ],
    outcomes: [
      {
        id: 'act1_path_opened',
        condition: { op: 'flag', flag: 'gloomridge_found' },
        effects: [
          { type: 'unlock_map_transition', targetMap: 'act2_veilscar' },
          { type: 'quest_log', text: 'The road to Act 2 is marked for a later milestone.' },
        ],
      },
    ],
  },
};

export const STORY_DIALOG_POOLS = {
  arrival: {
    id: 'arrival',
    nodes: {
      arrival_emberwood_001: {
        id: 'arrival_emberwood_001',
        speaker: 'Lyra Ashwalker',
        text: 'The birds stopped at dawn. That means the road is listening.',
        choices: [
          {
            id: 'ask_scout',
            label: 'Ask Lyra to scout ahead',
            effects: [
              { type: 'set_flag', flag: 'arrived_old_road' },
              { type: 'recruit_companion', companion: 'lyra_ashwalker' },
              { type: 'companion_approval', companion: 'lyra_ashwalker', amount: 2 },
              { type: 'quest_log', questId: 'primary_act1_emberwood', text: 'Lyra joined as the first scout.' },
            ],
            next: 'pool:arrival#arrival_emberwood_002',
          },
          {
            id: 'ask_orren',
            label: 'Ask Orren to hold the line',
            effects: [
              { type: 'set_flag', flag: 'arrived_old_road' },
              { type: 'recruit_companion', companion: 'orren_gravetide' },
              { type: 'companion_approval', companion: 'orren_gravetide', amount: 2 },
              { type: 'pressure', amount: -2 },
            ],
            next: 'pool:arrival#arrival_emberwood_002',
          },
        ],
      },
      arrival_emberwood_002: {
        id: 'arrival_emberwood_002',
        speaker: 'Road Shrine',
        text: 'A cracked mile marker warms when touched.',
        choices: [
          {
            id: 'mark_memory',
            label: 'Mark the road in memory',
            effects: [
              { type: 'set_flag', flag: 'road_memory_marked' },
              { type: 'lore_unlock', loreId: 'old_road_marker' },
              { type: 'undoable_mark' },
            ],
            next: null,
          },
          {
            id: 'lyra_reads_tracks',
            label: 'Let Lyra read the tracks',
            requires: { op: 'companion', companion: 'lyra_ashwalker', active: true },
            companionCondition: { op: 'companion', companion: 'lyra_ashwalker', active: true, min: 1 },
            effects: [
              { type: 'set_flag', flag: 'gloomridge_found' },
              { type: 'companion_approval', companion: 'lyra_ashwalker', amount: 1 },
            ],
            next: null,
          },
        ],
      },
    },
  },
};

export const STORY_CONTENT = {
  quests: STORY_QUESTS,
  dialogPools: STORY_DIALOG_POOLS,
};
