# Events & Cross-Event Memory

> **Audited:** 2026-04-16 against `src/maps/randomEvents.js`.

## Current state

- ~100 event templates.
- Each event is **self-contained**. No references to other events, no persistent flags visible across events.
- Choice outcomes grant rewards (`gold`, `item`, `heal`) but do not write to a shared ledger.

## The problem

The user's example — "rescue person A, later A finds you and gives you something" — is not possible today. There's no place to write "I rescued A" where the follow-up event can read from.

## Proposed: the Flag Ledger

Add a single `GameState.flags: { [flagId: string]: number | boolean | string }` map. Events can read and write it via two new event fields:

```js
{
  id: 'rescue_merchant_bessa',
  requires: { flag: 'met_bessa', equals: false },        // gate
  outcomes: {
    saved: {
      text: 'Bessa weeps and promises to find you again.',
      reward: { gold: 20 },
      setFlags: { rescued_bessa: true, bessa_owes: 1 }   // write
    },
    left_her: { setFlags: { bessa_angry: true } }
  }
}
```

Follow-up event:

```js
{
  id: 'bessa_repays',
  requires: { flag: 'rescued_bessa', equals: true },     // only fires if prior event set it
  weight: 2,                                             // weighted selection
  consumesFlag: 'rescued_bessa',                         // one-shot; cleared after
  npcName: 'Bessa',
  lines: [{ text: 'I told you I would find you.' }],
  outcomes: {
    repay: { reward: { item: 'rare_ring' }, setFlags: { bessa_friend: true } }
  }
}
```

Three primitives — `requires`, `setFlags`, `consumesFlag` — are enough to express every chain the user described.

### Chain primitives

| Field | Purpose |
|---|---|
| `requires` | Gate: event cannot fire unless flags match. Supports `equals`, `gte`, `lte`, `exists`. |
| `setFlags` | Write: on outcome selection, update the ledger. |
| `consumesFlag` | Clear a flag after this event (one-shot chains). |
| `incrementFlag` | Treat as counter (e.g. `bessa_owes: 3`). |
| `weight` | Bias random selection when multiple events are eligible. |

### Persisting

Serialize `GameState.flags` alongside save data. Already trivial since it's a flat map.

## Example chains to ship

1. **Bessa the Tinker** (4 links) — rescue → reunion gift → stolen from → final revenge quest.
2. **Grenn Blackhand** (3 links) — spare bandit → he warns you of an ambush → he joins as a temporary companion at L10.
3. **The Lost Scholar** (5 links) — find journal → deliver to guild → translation arrives → location marker → boss encounter.
4. **The Wounded Drake** (3 links) — spare a dragon whelp → it circles overhead in act 3 → full ally dragon in act 5 boss fight.
5. **The Cursed Coin** (infinite link) — pick up a coin → every few events it whispers, each time offering a small reward for a small corruption; at `corruption ≥ 5` a boss spawns.
6. **Rival Adventurer** (branching) — meet a rival → compete, race, betray — any of 3 paths determines whether they are an ally, neutral NPC, or boss at L20.
7. **The Traveling Shrine** (repeating) — a shrine moves between zones tracked by a zone flag, follows the player.

## Mod UI: Custom Content Manager

A new `/game13/assets/custom-content.html` page (separate, also unlisted in nav) listing:

- **Your characters** (imported from Claude-generated JSON, validated against schema)
- **Your spells** (validated against the effect-DSL)
- **Your events / chains** (validated for flag-ledger correctness — no dangling `requires` references)
- **Your portraits** (uploaded files, class mix-and-match composer)

Each row shows status: ✅ valid / ⚠️ warnings / ❌ schema errors, with inline fix hints.

Storage: `localStorage.game13_mods_v1 = { characters: [...], spells: [...], events: [...], portraits: [...] }`.

Export: "Download as JSON" + "Copy prompt for Claude" buttons, using the schema from [proposed-schema](./proposed-schema.md).
