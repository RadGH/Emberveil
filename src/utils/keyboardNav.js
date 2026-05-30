/**
 * keyboardNav.js — M297 keyboard navigation helper
 *
 * Wraps a container element and provides:
 *   - Tab/Shift-Tab: native browser focus cycling (no override needed)
 *   - Arrow keys: navigate among focusable children in vertical / horizontal / grid layouts
 *   - Enter: click the currently focused element
 *   - Escape: call onEscape callback (default: blur focus)
 *
 * mount(container, options) — start listening
 * unmount(container)        — remove all listeners
 *
 * Options:
 *   layout: 'vertical' | 'horizontal' | 'grid' | 'auto' (default 'vertical')
 *   cols: number — columns in grid layout (required for 'grid')
 *   onEscape: () => void — called on Escape key
 *   focusFirst: boolean — auto-focus first focusable child on mount (default false)
 *   selector: string — custom CSS selector for focusable children
 *
 * Touch protection: the helper only activates focus management from keyboard
 * events. Touch events do not trigger the arrow-key or enter handler, so
 * phone users never see stranded focus states from keyboard logic.
 */

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'select:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Returns all currently focusable elements inside a container. */
function getFocusable(container, selector) {
  return [...container.querySelectorAll(selector || FOCUSABLE)].filter(el => {
    if (el.offsetParent === null && !el.closest('[style*="position: fixed"]') && !el.closest('[style*="position:fixed"]')) {
      // Element not rendered (hidden via display:none etc.) — skip, unless it's
      // inside a fixed overlay which may have offsetParent = null legitimately.
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  });
}

/**
 * Compute number of columns for a grid of elements by checking their rendered x positions.
 * Falls back to `fallback` if the layout is not clearly a grid.
 */
function detectCols(elements, fallback) {
  if (!elements.length) return fallback || 1;
  const firstY = elements[0].getBoundingClientRect().top;
  let cols = 0;
  for (const el of elements) {
    if (Math.abs(el.getBoundingClientRect().top - firstY) > 4) break;
    cols++;
  }
  return cols > 1 ? cols : (fallback || 1);
}

/** Active mount registry: container → { handler, options } */
const _registry = new Map();

/**
 * Mount keyboard navigation on a container.
 * Safe to call multiple times on the same container (re-mounts cleanly).
 */
export function mount(container, options = {}) {
  if (!container) return;
  // Unmount any existing handler first.
  unmount(container);

  const {
    layout = 'vertical',
    cols = null,
    onEscape = null,
    focusFirst = false,
    selector = null,
  } = options;

  let _usingKeyboard = false;

  const handler = (e) => {
    // Ignore if focus is inside an <input>, <textarea>, or <select> — those
    // elements handle arrow keys for their own purposes.
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
      if (e.key !== 'Escape') return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (onEscape) onEscape();
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      // Let native buttons handle Enter/Space; only intercept for non-button focusables.
      if (active && active.tagName !== 'BUTTON' && active.tagName !== 'A' && active.tagName !== 'INPUT') {
        e.preventDefault();
        active.click();
      }
      return;
    }

    const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
    if (!isArrow) return;

    const focusable = getFocusable(container, selector);
    if (!focusable.length) return;

    const currentIdx = focusable.indexOf(active);

    let nextIdx = currentIdx;
    const effectiveLayout = layout;

    if (effectiveLayout === 'horizontal') {
      if (e.key === 'ArrowLeft')  nextIdx = Math.max(0, currentIdx - 1);
      if (e.key === 'ArrowRight') nextIdx = Math.min(focusable.length - 1, currentIdx + 1);
    } else if (effectiveLayout === 'grid') {
      const effectiveCols = cols || detectCols(focusable, 3);
      if (e.key === 'ArrowLeft')  nextIdx = Math.max(0, currentIdx - 1);
      if (e.key === 'ArrowRight') nextIdx = Math.min(focusable.length - 1, currentIdx + 1);
      if (e.key === 'ArrowUp')    nextIdx = Math.max(0, currentIdx - effectiveCols);
      if (e.key === 'ArrowDown')  nextIdx = Math.min(focusable.length - 1, currentIdx + effectiveCols);
    } else {
      // vertical (default)
      if (e.key === 'ArrowUp')   nextIdx = Math.max(0, currentIdx - 1);
      if (e.key === 'ArrowDown') nextIdx = Math.min(focusable.length - 1, currentIdx + 1);
      // Allow left/right to also move vertically for convenience
      if (e.key === 'ArrowLeft')  nextIdx = Math.max(0, currentIdx - 1);
      if (e.key === 'ArrowRight') nextIdx = Math.min(focusable.length - 1, currentIdx + 1);
    }

    if (nextIdx !== currentIdx && nextIdx >= 0 && nextIdx < focusable.length) {
      e.preventDefault();
      _usingKeyboard = true;
      focusable[nextIdx].focus({ preventScroll: false });
    } else if (currentIdx === -1 && focusable.length > 0) {
      // No element focused yet — focus first/last depending on direction
      e.preventDefault();
      _usingKeyboard = true;
      const start = (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
        ? focusable.length - 1 : 0;
      focusable[start].focus({ preventScroll: false });
    }
  };

  container.addEventListener('keydown', handler);
  _registry.set(container, { handler, options });

  if (focusFirst) {
    // Use rAF so the DOM is settled (useful after innerHTML writes).
    requestAnimationFrame(() => {
      const focusable = getFocusable(container, selector);
      if (focusable.length) focusable[0].focus({ preventScroll: true });
    });
  }
}

/**
 * Remove keyboard navigation from a container.
 */
export function unmount(container) {
  if (!container) return;
  const entry = _registry.get(container);
  if (!entry) return;
  container.removeEventListener('keydown', entry.handler);
  _registry.delete(container);
}

/**
 * Convenience: mount keyboard navigation that calls manager.pop() on Escape.
 * Most screens use this signature.
 */
export function mountScreen(container, manager, options = {}) {
  mount(container, {
    layout: 'vertical',
    focusFirst: true,
    onEscape: () => manager.pop(),
    ...options,
  });
}

/**
 * Inject the global :focus-visible ring style once.
 * Called from main.js so it applies site-wide before any screen renders.
 */
export function injectFocusStyles() {
  if (document.getElementById('kbd-focus-styles')) return;
  const s = document.createElement('style');
  s.id = 'kbd-focus-styles';
  // Gold ring matching the Emberveil theme.
  // :focus-visible only activates for keyboard focus, not mouse/touch.
  s.textContent = `
    :focus-visible {
      outline: 2px solid var(--color-primary, #e8a020);
      outline-offset: 2px;
    }
    /* Boost specificity for elements that reset outline in their own rules */
    button:focus-visible,
    [role="button"]:focus-visible,
    [tabindex]:focus-visible,
    a:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--color-primary, #e8a020);
      outline-offset: 2px;
    }
    /* Toggle switches in SettingsScreen get a slightly larger ring */
    .toggle-switch:focus-visible {
      outline: 2px solid var(--color-primary, #e8a020);
      outline-offset: 3px;
    }
  `;
  document.head.appendChild(s);
}
