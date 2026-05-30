/**
 * Shared Character/Hire builder stylesheet.
 * Extracted from CharacterBuilderScreen (M494) so HireBuilderScreen can
 * inject the same gold/brown .cb-* theme without importing
 * CharacterBuilderScreen (which transitively pulls in TownScreen and
 * would create a circular import — see the M253 hotfix note in
 * HireBuilderScreen).
 */
export const CB_STYLES = `
.cb-screen {
  position: absolute; inset: 0; overflow-y: auto;
  display: flex; flex-direction: column;
  background: linear-gradient(180deg, #0a0608 0%, #120a10 100%);
  color: #f0e8d8; font-family: 'Inter', sans-serif;
}
.cb-header {
  text-align: center; padding: 2rem 1.5rem 1rem;
  border-bottom: 1px solid rgba(232,160,32,0.15);
  flex-shrink: 0;
}
.cb-title {
  font-family: 'Cinzel', Georgia, serif;
  font-size: clamp(1.5rem, 4vw, 2rem); font-weight: 900;
  color: #e8a020; letter-spacing: 0.1em;
}
.cb-subtitle { font-size: 0.8rem; color: #8a7a6a; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 0.4rem; }
.cb-class-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem; padding: 1.5rem; flex: 1;
}
.cb-class-card {
  background: rgba(26,18,24,0.8);
  border: 1px solid rgba(232,160,32,0.12);
  border-radius: 10px; padding: 1rem 0.75rem;
  cursor: pointer; transition: all 0.2s;
  display: flex; flex-direction: column; gap: 0.3rem;
  min-height: 140px;
}
.cb-class-card:hover { border-color: rgba(232,160,32,0.5); background: rgba(36,26,32,0.9); transform: translateY(-2px); }
.cb-class-card.selected { border-color: #e8a020; background: rgba(232,160,32,0.12); }
.cb-class-card.locked { opacity: 0.45; cursor: not-allowed; filter: grayscale(0.7); }
.cb-class-card.locked:hover { transform: none; border-color: rgba(192,64,48,0.5); background: rgba(20,10,10,0.92); opacity: 0.98; filter: grayscale(0.2); }
.cb-class-card.locked:hover .cb-class-unlock { color: #ff8080; font-weight: 700; }
.cb-lock { font-size: 0.75rem; }
.cb-class-unlock { font-size: 0.65rem; color: #c04030; font-style: italic; margin-top: auto; }
.cb-unlock-counter { font-size: 0.7rem; color: #8a7a6a; margin-top: 0.4rem; letter-spacing: 0.08em; }
.cb-class-icon { width: 36px; height: 36px; color: #e8a020; margin-bottom: 0.25rem; }
.cb-class-name { font-family: 'Cinzel', serif; font-size: 0.95rem; font-weight: 700; color: #f0e8d8; }
.cb-class-role { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8a7a6a; }
.cb-class-hook { font-size: 0.72rem; color: #c0b090; line-height: 1.4; margin-top: 0.25rem; flex: 1; }
.cb-class-armor { font-size: 0.65rem; color: #e8a020; opacity: 0.7; }
.cb-footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1rem 1.5rem; border-top: 1px solid rgba(232,160,32,0.15);
  flex-shrink: 0; gap: 1rem;
  position: sticky; bottom: 0;
  background: linear-gradient(180deg, rgba(18,10,16,0.85) 0%, #120a10 40%);
  z-index: 10;
}
.cb-btn {
  padding: 0.75rem 1.5rem; border-radius: 6px; border: none;
  font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700;
  letter-spacing: 0.05em; cursor: pointer; min-height: 44px; min-width: 120px;
  transition: all 0.2s;
}
.cb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cb-btn-ghost { background: none; border: 1px solid rgba(255,255,255,0.2); color: #8a7a6a; }
.cb-btn-ghost:hover:not(:disabled) { color: #f0e8d8; border-color: rgba(255,255,255,0.4); }
.cb-btn-primary { background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.6); color: #e8a020; }
.cb-btn-primary:hover:not(:disabled) { background: rgba(232,160,32,0.25); }
.cb-btn-gold { background: linear-gradient(135deg, #c04030, #e8a020); color: #0a0608; font-weight: 900; border: none; }
.cb-btn-gold:hover { filter: brightness(1.1); }
.cb-stats-area { flex: 1; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; max-width: 480px; margin: 0 auto; width: 100%; }
.cb-name-row { display: flex; flex-direction: column; gap: 0.5rem; }
.cb-label { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #8a7a6a; }
.cb-name-input {
  background: rgba(26,18,24,0.8); border: 1px solid rgba(232,160,32,0.3);
  border-radius: 6px; padding: 0.75rem 1rem; color: #f0e8d8;
  font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700;
  width: 100%; min-height: 44px; outline: none;
}
.cb-name-input:focus { border-color: rgba(232,160,32,0.7); }
.cb-sub-label { font-size: 0.65rem; color: #6a5a4a; text-transform: none; letter-spacing: 0; font-weight: 400; margin-left: 6px; }
.cb-appearance-row { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
/* #appearance-grid is now a flex column: filter bar on top, grouped grid below */
#appearance-grid {
  display: flex; flex-direction: column; gap: 0;
  background: rgba(18,9,13,0.55); border: 1px solid rgba(232,160,32,0.2); border-radius: 10px;
  overflow: hidden;
}
/* Gender filter bar */
.cb-gender-filter-bar {
  display: flex; flex-direction: row; gap: 0;
  border-bottom: 1px solid rgba(232,160,32,0.15);
  flex-shrink: 0;
}
.cb-gender-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  background: transparent; border: none; border-right: 1px solid rgba(232,160,32,0.12);
  color: #8a7a6a; cursor: pointer; padding: 0.55rem 0.25rem;
  min-height: 44px; transition: background 0.15s, color 0.15s;
  font-family: 'Cinzel', serif; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.04em;
}
.cb-gender-btn:last-child { border-right: none; }
.cb-gender-btn:hover { background: rgba(232,160,32,0.08); color: #c0b090; }
.cb-gender-btn.active { background: rgba(232,160,32,0.15); color: #e8a020; }
.cb-gender-icon { width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; }
.cb-gender-icon svg { width: 14px; height: 14px; fill: currentColor; }
.cb-gender-label { /* text is fine as-is */ }
/* Flat grid — single continuous row of portrait tiles */
.cb-appearance-flat-grid {
  overflow-y: auto; padding: 8px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 6px; max-height: 240px;
}
.cb-appearance-tile {
  position: relative; cursor: pointer; border: 2px solid transparent; border-radius: 8px;
  overflow: hidden; width: 72px; height: 72px; background: #0a0608;
  transition: border-color 0.15s, transform 0.15s; flex-shrink: 0;
}
.cb-appearance-tile:hover { border-color: rgba(232,160,32,0.5); transform: translateY(-1px); }
.cb-appearance-tile.selected { border-color: #e8a020; box-shadow: 0 0 8px rgba(232,160,32,0.5); }
.cb-appearance-tile img { width: 100%; height: 100%; object-fit: cover; display: block; image-rendering: pixelated; }
.cb-appearance-name {
  position: absolute; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.72);
  color: #f0e8d8; font-size: 9px; text-align: center; padding: 2px 3px;
  letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
/* Small gender badge on each tile */
.cb-appearance-gender-badge {
  position: absolute; top: 3px; right: 3px; width: 12px; height: 12px;
  opacity: 0.75; pointer-events: none;
}
.cb-appearance-gender-badge svg { width: 12px; height: 12px; fill: #e8e0d0; }
/* Fame-locked tiles */
.cb-appearance-tile.fame-locked {
  opacity: 0.48; cursor: not-allowed; filter: grayscale(0.65);
}
.cb-appearance-tile.fame-locked:hover { border-color: rgba(192,96,32,0.45); transform: none; }
.cb-fame-lock-badge {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: rgba(8,4,10,0.55);
  color: #e08020; font-size: 8px; gap: 2px; pointer-events: none;
}
.cb-fame-lock-badge span { font-family: 'Cinzel', serif; font-weight: 700; font-size: 7px; letter-spacing: 0.04em; }
@keyframes cb-fame-shake {
  0%,100% { transform: translateX(0); }
  20%,60%  { transform: translateX(-4px); }
  40%,80%  { transform: translateX(4px); }
}
.cb-appearance-tile.fame-shake { animation: cb-fame-shake 0.35s ease; }

/* Fame banner above appearance grid */
.cb-fame-banner {
  padding: 0.35rem 0.6rem;
  background: rgba(232,120,16,0.1);
  border: 1px solid rgba(232,120,16,0.25);
  border-radius: 6px;
  font-size: 0.72rem;
  color: #c09050;
  text-align: center;
}

/* Empty state */
.cb-appearance-empty {
  padding: 1.5rem; text-align: center; font-size: 0.8rem; color: #6a5a4a; font-style: italic;
}
.cb-points-banner {
  text-align: center; padding: 0.75rem;
  background: rgba(232,160,32,0.08); border-radius: 6px;
  font-size: 0.9rem; color: #e8a020; font-weight: 600;
}
.cb-points-banner span { font-size: 1.4rem; font-weight: 900; }
.cb-attrs { display: flex; flex-direction: column; gap: 0.75rem; }
.cb-attr-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.85rem 1rem; background: rgba(26,18,24,0.6);
  border: 1px solid rgba(255,255,255,0.06); border-radius: 8px;
}
.cb-attr-name { font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700; color: #e8a020; }
.cb-attr-desc { font-size: 0.68rem; color: #8a7a6a; margin-top: 0.15rem; }
.cb-attr-controls { display: flex; align-items: center; gap: 0.75rem; }
.cb-attr-btn {
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.3);
  color: #e8a020; font-size: 1.1rem; font-weight: 700; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.cb-attr-btn:hover { background: rgba(232,160,32,0.25); }
.cb-attr-val { font-family: 'Cinzel', serif; font-size: 1.2rem; font-weight: 900; color: #f0e8d8; min-width: 2rem; text-align: center; }
.cb-preview-panel {
  background: rgba(26,18,24,0.6); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 1rem;
}
.cb-preview-title { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.75rem; }
.cb-preview-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 0.5rem; }
.preview-stat { text-align: center; }
.preview-stat-wide { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: baseline; padding: 0.2rem 0.5rem; border-top: 1px solid rgba(232,160,32,0.1); }
.preview-stat-wide .ps-label { display: inline; }
.preview-stat-wide .ps-val { display: inline; margin-top: 0; }
.ps-label { display: block; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.08em; color: #8a7a6a; }
.ps-val { display: block; font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #e8a020; margin-top: 0.1rem; }

/* M339 — three compact icon+name buttons in a 3-col grid; the selected
   difficulty's paragraph renders below in #cb-diff-desc and updates as
   the user changes selection. Whole picker fits on one screen alongside
   the (collapsed) Advanced Options section. */
.cb-diff-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem;
  padding: 1.25rem 1.5rem 0.5rem; max-width: 520px; margin: 0 auto; width: 100%;
}
.cb-diff-card {
  background: rgba(26,18,24,0.8);
  border: 1px solid rgba(232,160,32,0.18);
  border-radius: 10px; padding: 0.85rem 0.5rem;
  cursor: pointer; transition: all 0.2s;
  display: flex; flex-direction: column; align-items: center; gap: 0.35rem;
  min-height: 92px; font-family: inherit;
}
.cb-diff-card:hover { border-color: rgba(232,160,32,0.5); background: rgba(36,26,32,0.9); transform: translateY(-2px); }
.cb-diff-card.selected { border-color: #e8a020; background: rgba(232,160,32,0.12); box-shadow: 0 0 12px rgba(232,160,32,0.25); }
.cb-diff-icon { width: 28px; height: 28px; color: #e8a020; }
.cb-diff-icon svg { width: 28px; height: 28px; fill: currentColor; }
.cb-diff-card[data-diff="easy"]   .cb-diff-icon { color: #60c080; }
.cb-diff-card[data-diff="normal"] .cb-diff-icon { color: #6db3ff; }
.cb-diff-card[data-diff="hard"]   .cb-diff-icon { color: #c04030; }
.cb-diff-name { font-family: 'Cinzel', serif; font-size: 0.92rem; font-weight: 800; color: #f0e8d8; letter-spacing: 0.06em; text-align: center; }
.cb-diff-card.selected .cb-diff-name { color: #f8d880; }
/* Description block below the three buttons. */
.cb-diff-desc {
  max-width: 520px; margin: 0 auto 0.5rem; padding: 0 1.5rem;
  width: 100%; font-size: 0.85rem; color: #c8b890; line-height: 1.55;
}
.cb-diff-desc strong { color: #f8d880; font-family: 'Cinzel', serif; letter-spacing: 0.04em; }
.cb-diff-bonuses { display: flex; gap: 0.5rem; margin-top: 0.4rem; flex-wrap: wrap; }
.cb-diff-bonus {
  padding: 0.15rem 0.55rem; border-radius: 99px;
  background: rgba(232,160,32,0.12); border: 1px solid rgba(232,160,32,0.35);
  color: #f8d880; font-weight: 600; font-size: 0.75rem;
}

.cb-advanced { max-width: 520px; margin: 0 auto 1rem; padding: 0 1.5rem; width: 100%; }
.cb-advanced-toggle {
  width: 100%; display: flex; align-items: center; gap: 0.5rem;
  background: rgba(26,18,24,0.6); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px; padding: 0.7rem 1rem; cursor: pointer;
  color: #c0b090; font-family: 'Cinzel', serif; font-size: 0.8rem; font-weight: 600;
  letter-spacing: 0.06em; min-height: 44px;
}
.cb-advanced-toggle:hover { color: #f0e8d8; border-color: rgba(232,160,32,0.4); }
.cb-adv-caret { font-size: 0.7rem; color: #e8a020; min-width: 14px; }
.cb-advanced-panel {
  margin-top: 0.6rem; padding: 1rem;
  background: rgba(18,12,16,0.8); border: 1px solid rgba(232,160,32,0.15);
  border-radius: 8px; display: flex; flex-direction: column; gap: 1rem;
}
.cb-adv-row { display: flex; flex-direction: column; gap: 1rem; }
.cb-adv-label { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; color: #8a7a6a; }
.cb-adv-input {
  background: rgba(10,6,8,0.85); border: 1px solid rgba(232,160,32,0.25);
  border-radius: 6px; padding: 0.6rem 0.8rem; color: #f0e8d8;
  font-family: 'Inter', sans-serif; font-size: 0.85rem;
  min-height: 40px; outline: none;
}
.cb-adv-input:focus { border-color: rgba(232,160,32,0.65); }
.cb-adv-help {
  font-size: 0.7rem; color: #6a5a4a; line-height: 1.4;
  /* M336 — help text now wraps under the title in the right column,
     leaving the checkbox tall and aligned in the left column. */
  grid-row: 2; grid-column: 2 / 3;
}
/* M336 — checkline is a 2-row, 2-col grid: checkbox spans both rows on
   the left, title on row 1 right, help on row 2 right. */
.cb-adv-checkline {
  display: grid; grid-template-columns: 1fr auto;
  /* the checkbox is the FIRST child via DOM order, so it sits in col 1 */
  grid-template-columns: auto 1fr;
  align-items: start; column-gap: 0.6rem; row-gap: 0.25rem;
  cursor: pointer;
  color: #f0e8d8; font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700;
  min-height: 32px; margin-top: 1rem;
}
.cb-adv-checkline input[type="checkbox"] {
  width: 18px; height: 18px; accent-color: #e8a020; cursor: pointer;
  grid-row: 1 / 3;
}
input#adv-fog,
input#adv-hardcore,
input#adv-manual { grid-row: 1 / 3; align-self: start; margin-top: 0.15rem; }
.cb-adv-label-inline { letter-spacing: 0.05em; grid-row: 1; grid-column: 2 / 3; }

/* M399 — Build picker step. */
.cb-build-grid {
  display: grid; gap: 0.6rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  padding: 0.5rem;
}
.cb-build-card {
  text-align: left; padding: 0.85rem 1rem;
  background: rgba(20, 14, 36, 0.7);
  border: 1px solid rgba(232, 160, 32, 0.3);
  border-radius: 6px; cursor: pointer; color: #f0e8d8;
  font-family: inherit; transition: border-color 160ms ease, transform 80ms ease;
}
.cb-build-card:hover { border-color: rgba(232, 200, 64, 0.6); transform: translateY(-1px); }
.cb-build-card.selected {
  border-color: var(--gold-glow, #f8e890);
  box-shadow: 0 0 12px rgba(248, 232, 144, 0.35);
  background: rgba(40, 30, 60, 0.85);
}
.cb-build-name {
  font-family: 'Cinzel', serif; font-size: 1.05rem; color: #e8c840;
  margin-bottom: 0.25rem; letter-spacing: 0.04em;
}
.cb-build-tags { display: flex; gap: 0.3rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
.cb-build-tag {
  font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.08em;
  background: rgba(232, 160, 32, 0.15); color: #e8a020;
  padding: 0.05rem 0.4rem; border-radius: 3px;
}
.cb-build-attrs { display: flex; gap: 0.35rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
.cb-build-attr {
  font-size: 0.7rem; padding: 0.1rem 0.45rem; border-radius: 3px;
  background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.1);
  font-family: 'Inter', monospace;
}
.cb-build-attr-str { color: #e8a060; }
.cb-build-attr-dex { color: #80d090; }
.cb-build-attr-int { color: #80a8e8; }
.cb-build-attr-con { color: #e0c080; }
.cb-build-desc {
  font-size: 0.78rem; color: #c8b8a8; line-height: 1.4;
  margin-bottom: 0.35rem;
}
.cb-build-skills, .cb-build-weapons {
  font-size: 0.68rem; color: rgba(232, 200, 128, 0.65);
  margin-top: 0.15rem; line-height: 1.3;
}
.cb-build-skills strong, .cb-build-weapons strong { color: #e8c840; font-weight: 600; }
.cb-build-empty {
  padding: 1rem; text-align: center; color: rgba(232, 200, 128, 0.55);
  font-size: 0.85rem; font-style: italic;
}
`;
