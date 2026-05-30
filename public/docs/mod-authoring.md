## Mod Authoring Guide

How to write a mod pack for Emberveil.

### Quickstart

1. Download the schemas from `/assets/custom-content.html` → Schemas tab.
2. Write a JSON pack:

```json
{
  "id": "my_first_pack",
  "version": "1.0.0",
  "name": "My First Pack",
  "skills": [
    {
      "id": "my_bolt",
      "name": "Custom Bolt",
      "class": "mage",
      "unlockLevel": 1,
      "mpCost": 3,
      "targeting": { "side": "enemy", "count": 1 },
      "effects": [
        { "op": "damage", "stat": "int", "mult": 1.2, "amount": 4, "target": "target" }
      ]
    }
  ]
}
```

3. Open `/assets/custom-content.html`, paste, click **Validate** then **Load into runtime**.
4. Your content is now live in the current session. (Persistence across sessions is wishlist — see "Wire new content into runtime" on the mod-system board.)

### Reference pack

`public/mods/examples/starter-pack.json` demonstrates every DSL op across 24 skills + 5 event chains + 2 loot tables. Copy any entry as a starting point.

### Asking Claude to write a pack for you

Send Claude the schemas and a prose description:

> "Here are the Emberveil v1 mod schemas [attach schemas/v1/*.json]. I want a new class called 'Stormwalker' with 6 skills themed around lightning and wind, 1 tier-1 appearance that reuses the mage sprite. Follow the starter-pack conventions."

Claude can read the schemas and produce a structurally-valid pack. Validate with custom-content.html before loading.

### Common pitfalls

- **Unknown op** — a typo in `op:` silently misfires. Structural check catches this on load.
- **Missing id** — any entity without `id` is skipped with a telemetry hit.
- **Non-canonical stat names** — use `str`/`dex`/`int`/`con`, not `strength` etc. Normalization is wishlist (M131).
- **Ritual without `thenEffects`** — the payload runs after N rounds; schema requires both fields.
- **Flag persistence** — `setFlag`/`requireFlag` ops currently live on a per-cast ctx. Persistent event-chain flag ledger is on the wishlist (M131).
