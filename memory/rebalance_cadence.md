# Rebalance Cadence

**Re-run the rebalance survey tool every 20 milestones.**

Tool: `public/assets/rebalance.html` (navigate to `/assets/rebalance.html` in any running game13 server).

Procedure:
1. Open the page, click **Run Simulation** (200 runs × 24 scenarios × 4 levels).
2. Click **Save Snapshot** — it prompts for a milestone label (e.g. `m97`).
3. Write the downloaded JSON to `public/assets/rebalance_snapshots/m<NN>.json` and add the filename to `index.json`.
4. Compare against prior snapshots via the drift chart.
5. Copy the generated prompt from the textarea into a new Claude Code session to request balance changes.

Next scheduled re-run: **M97** (20 after the M77 baseline snapshot).

Why 20 milestones: roughly matches the cadence at which skill numbers, class kits, and tap weapon power budgets drift enough that balance work pays off without being noise.
