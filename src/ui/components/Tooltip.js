/**
 * Tooltip — shared hover/tap-and-hold tooltip primitive.
 *
 * Call `attachTooltip(el, () => htmlString)` and get:
 *   - desktop: hover enter/leave
 *   - touch:   350ms long-press shows; touchend auto-hides after 1.5s
 *   - viewport-clamped positioning (prefers above, flips below if cut off)
 *
 * One active tooltip at a time. `hideTooltip()` removes it immediately.
 * Content callback returns an HTML string. Return empty/null to skip.
 */

let _currentTooltip = null;

function _removeCurrent() {
  if (_currentTooltip && _currentTooltip.parentNode) {
    _currentTooltip.parentNode.removeChild(_currentTooltip);
  }
  _currentTooltip = null;
}

export function hideTooltip() {
  _removeCurrent();
}

function _position(tooltip, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  let top = rect.top - tooltipRect.height - 10;
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  if (top < 10) top = rect.bottom + 10;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

/**
 * Attach a tooltip to an element. Returns a detach function.
 * @param {HTMLElement} el - target element
 * @param {() => (string|null)} htmlProvider - called each time tooltip shows
 * @param {object} [opts]
 * @param {string} [opts.className='rsg-tooltip'] - css class for the tooltip container
 */
export function attachTooltip(el, htmlProvider, opts = {}) {
  if (!el) return () => {};
  const className = opts.className || 'rsg-tooltip';

  const show = (event) => {
    _removeCurrent();
    const html = htmlProvider();
    if (!html) return;
    const tooltip = document.createElement('div');
    tooltip.className = className;
    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);
    _currentTooltip = tooltip;
    _position(tooltip, event.currentTarget || el);
  };

  const hide = () => _removeCurrent();

  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', hide);
  let holdTimer = null;
  const onTouchStart = (e) => {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => show(e), 350);
  };
  const onTouchEnd = () => {
    clearTimeout(holdTimer);
    setTimeout(hide, 1500);
  };
  const onTouchCancel = () => { clearTimeout(holdTimer); hide(); };
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchend', onTouchEnd);
  el.addEventListener('touchcancel', onTouchCancel);

  return () => {
    el.removeEventListener('mouseenter', show);
    el.removeEventListener('mouseleave', hide);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', onTouchCancel);
    clearTimeout(holdTimer);
  };
}

/**
 * Inject shared tooltip CSS once per document.
 */
export function injectTooltipStyles() {
  if (document.getElementById('rsg-tooltip-styles')) return;
  const style = document.createElement('style');
  style.id = 'rsg-tooltip-styles';
  style.textContent = `
    .rsg-tooltip {
      position: fixed;
      z-index: 3000;
      max-width: min(360px, calc(100vw - 16px));
      padding: 0.55rem 0.75rem;
      background: #140a18;
      border: 1px solid #e8a020;
      border-radius: 6px;
      color: #f0e8d8;
      font-family: 'Inter', sans-serif;
      font-size: 0.78rem;
      line-height: 1.4;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(232, 160, 32, 0.25);
      pointer-events: none;
      box-sizing: border-box;
    }
    .rsg-tooltip .tt-title { color: #ffd060; font-weight: bold; margin-bottom: 0.3rem; }
    .rsg-tooltip .tt-sub { color: rgba(200,160,100,0.75); font-size: 0.7rem; margin-bottom: 0.35rem; }
    .rsg-tooltip .tt-row { margin: 0.15rem 0; }
    .rsg-tooltip .tt-divider { border-top: 1px solid rgba(232,160,32,0.25); margin: 0.4rem 0; }
  `;
  document.head.appendChild(style);
}
