## No Silent Shelving

The core delivery rule. Restated here so it lives in versioned docs, not just in CLAUDE.md.

### The rule

When the user sends a list of requests (bug fixes, features, suggestions), the default contract is:

1. **Every item must be implemented in the same response cycle.** Scope is the user's call, not yours.
2. **If you cannot implement an item, call it out BEFORE you start work** — name the items and the reason, and wait for confirmation. If the user doesn't confirm a deferral, implement it.
3. **Never silently shelve an item into a "deferred" note in the changelog.** If it's not done, say so explicitly in the response text.
4. **No milestone is "shipped" until every item from the user's last message is either implemented or explicitly deferred with confirmation.** Do not run `release.sh` before that.
5. **At the end of a multi-item request, audit your own work** against the original list — ✅ done with file:line, or ⚠️ deferred with reason.

### Where deferred items go

Anything deferred must land in the **wishlist** (`public/assets/wishlist.html`) with:

- A clear label
- The reason for deferral
- Enough context that a future session knows how to pick it up

The wishlist is the single source of truth for "things we agreed to do later." Changelog deferrals are not acceptable.

### Related

- `no-silent-shelving` rule is quoted at the top of `CLAUDE.md` and `/home/radgh/claude/CLAUDE.md`.
- Wishlist tool: `public/assets/wishlist.html` — audited every milestone.
- Technical-debt register: wishlist section "Technical Debt Registry" captures explicitly-shelved items.

---

## Backward-Compatibility Notes (sibling guideline, M313+)

Any milestone that changes the save-file schema or removes a field that old saves may rely on **must** document those changes as backward-compat notes.

### How to record

Set `BREAKING_CHANGES` at release time (pipe-delimited):

```bash
BREAKING_CHANGES="fieldX added; old saves default to null|fieldY removed; safe to ignore on load" \
  bash /home/radgh/claude/release.sh game13
```

Or edit `game_meta.json` directly under `releases[N].breakingChanges: [...]`.

### What must be documented

- New save-file fields (with migration behavior: lazy, default value, or one-time migration).
- Removed or renamed save-file fields.
- Changes to the serialization format of existing fields (e.g., Set serialized as array).
- Combat or skill changes that render existing build configurations invalid.

### Where it surfaces

- `release-summary.json` (emitted by `emit-release-summary.cjs`) includes `breakingChanges`.
- The What's New splash (`TitleScreen._showWhatsNewSplash`) renders a "Migration Notes" section when `breakingChanges` is non-empty.
- `game_meta.json` `releases[N].breakingChanges` is the authoritative record.

### Retroactive notes added

| Milestone | Note |
|-----------|------|
| M302 | `levelSync` companion setting added; old saves default to independent leveling. |
| M305 | Legendary effect hooks added to item schema; old items with no hooks continue working. |
| M306 | `infiniteRun` field added; null on old saves, lazy-migrated on first access. |
| M307 | `craftingRecipesUnlocked` added as serialized Set; null on old saves triggers lazy migration. |
