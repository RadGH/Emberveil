/**
 * toast.js — lightweight shared toast notification helper.
 *
 * Usage:
 *   showToast('Auto-equipped Iron Sword to Aria', { onClick: () => openInventory() });
 *   showToast('Sword is an upgrade for Aria — open inventory', { onClick: () => openInventory(), duration: 5000 });
 *
 * Toasts stack vertically, each fades out after `duration` ms (default 4000).
 * Up to 4 toasts visible at once; oldest is removed when the queue overflows.
 */

import { injectStyles } from '../../utils/dom.js';

const MAX_VISIBLE = 4;
let _container = null;
let _active = []; // { el, timerId }

function _ensureContainer() {
  if (_container && _container.isConnected) return _container;
  injectStyles('rsg-toast-styles', TOAST_STYLES);
  _container = document.createElement('div');
  _container.className = 'rsg-toast-container';
  document.body.appendChild(_container);
  return _container;
}

function _remove(entry) {
  const idx = _active.indexOf(entry);
  if (idx !== -1) _active.splice(idx, 1);
  if (entry.timerId) clearTimeout(entry.timerId);
  if (entry.el && entry.el.parentNode) {
    entry.el.classList.add('rsg-toast-out');
    // Remove element after animation
    setTimeout(() => {
      if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    }, 300);
  }
}

/**
 * @param {string} message - HTML string displayed in the toast.
 * @param {object} [opts]
 * @param {number} [opts.duration=4000] - auto-dismiss delay in ms.
 * @param {Function} [opts.onClick] - if provided, toast is tappable and calls this on click.
 */
export function showToast(message, opts = {}) {
  const duration = opts.duration ?? 4000;
  const container = _ensureContainer();

  // Evict oldest if over limit.
  if (_active.length >= MAX_VISIBLE) {
    _remove(_active[0]);
  }

  const el = document.createElement('div');
  const variantClass = opts.variant ? ` rsg-toast-${opts.variant}` : '';
  el.className = 'rsg-toast' + (opts.onClick ? ' rsg-toast-clickable' : '') + variantClass;
  el.innerHTML = message;

  if (opts.onClick) {
    el.addEventListener('click', () => {
      _remove(entry);
      opts.onClick();
    });
  }

  // Tap-to-dismiss on non-clickable toasts.
  el.addEventListener('click', () => {
    if (!opts.onClick) _remove(entry);
  });

  container.appendChild(el);

  const entry = { el, timerId: null };
  _active.push(entry);

  entry.timerId = setTimeout(() => _remove(entry), duration);
  return entry;
}

const TOAST_STYLES = `
.rsg-toast-container {
  position: fixed;
  bottom: 4.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 9000;
  pointer-events: none;
  align-items: center;
  width: min(90vw, 360px);
}
.rsg-toast {
  pointer-events: auto;
  background: rgba(20, 12, 28, 0.96);
  border: 1px solid rgba(232, 192, 64, 0.45);
  color: #f0e8d8;
  padding: 0.55rem 0.9rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-family: 'Inter', sans-serif;
  line-height: 1.35;
  box-shadow: 0 2px 12px rgba(0,0,0,0.55);
  animation: rsg-toast-in 0.25s ease-out;
  max-width: 100%;
  text-align: center;
}
.rsg-toast-clickable {
  cursor: pointer;
  border-color: rgba(64, 160, 255, 0.5);
  color: #88c8ff;
}
.rsg-toast-clickable:hover {
  background: rgba(30, 18, 40, 0.98);
  border-color: rgba(64, 160, 255, 0.8);
}
.rsg-toast-achievement {
  border-color: rgba(232, 192, 32, 0.85);
  border-width: 1.5px;
  font-size: 0.82rem;
  padding: 0.7rem 1.1rem;
  box-shadow: 0 2px 18px rgba(232,160,0,0.22), 0 2px 12px rgba(0,0,0,0.55);
  cursor: pointer;
}
.rsg-toast-achievement:hover {
  background: rgba(28, 18, 38, 0.98);
  border-color: rgba(248,216,64,0.95);
}
.rsg-toast-out {
  animation: rsg-toast-out 0.3s ease-in forwards;
}
@keyframes rsg-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes rsg-toast-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(8px); }
}
`;
