/**
 * preserveScroll — capture window + descendant scroll positions, run fn (which
 * typically re-renders via innerHTML), then restore the captured positions.
 *
 * innerHTML re-renders nuke scrollTop on every descendant and often let the
 * document jump to the top when the focused button unmounts. Wrap a re-render
 * in this helper to keep the player where they were after +1 Attribute,
 * Buy Talent, etc.
 *
 * Uses className-based matching so restoration survives the re-render (new
 * element instances replace the captured ones).
 */
export function preserveScroll(rootEl, fn) {
  const snap = [];
  const doc = window.scrollY || document.documentElement.scrollTop || 0;
  if (rootEl && rootEl.querySelectorAll) {
    rootEl.querySelectorAll('*').forEach((n) => {
      if (n.scrollTop > 0 && n.className && typeof n.className === 'string') {
        snap.push({ className: n.className, top: n.scrollTop });
      }
    });
  }
  // Blur any focused interactive element so its removal during fn() doesn't
  // trigger the browser "scroll focused element into view" heuristic, which
  // was the root cause of +1 Attribute / Buy Talent scrolling to the top.
  const active = document.activeElement;
  if (active && active !== document.body && typeof active.blur === 'function') {
    try { active.blur(); } catch (_) {}
  }
  fn();
  if (rootEl && rootEl.querySelectorAll) {
    for (const s of snap) {
      const m = rootEl.getElementsByClassName(s.className)[0];
      if (m) m.scrollTop = s.top;
    }
  }
  // Always restore document scroll, even when doc was 0, because auto-scroll
  // on focus-loss can jump the document up/down mid-render.
  window.scrollTo(0, doc);
}
