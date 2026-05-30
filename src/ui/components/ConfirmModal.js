// src/ui/components/ConfirmModal.js
//
// In-game confirm modal (dark backdrop + panel + Cancel/Confirm buttons).
// Built because browser confirm() can be permanently disabled by users
// ("don't show more dialogs from this site"), at which point game toggles
// that depend on it silently no-op. This replacement is always visible.
//
// Usage:
//   import { showConfirmModal } from '../components/ConfirmModal.js';
//   showConfirmModal({
//     title: 'Enable Auto?',
//     message: 'This will spend all pending points automatically...',
//     confirmText: 'Enable',
//     cancelText: 'Cancel',
//     onConfirm: () => { ... },
//     onCancel: () => { ... }, // optional
//   });

import { createEl, removeEl, injectStyles } from '../../utils/dom.js';

const STYLES = `
.confirm-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.72);
  z-index: 5000; display: flex; align-items: center; justify-content: center;
  font-family: 'Inter', sans-serif;
}
.confirm-modal-box {
  background: #12090f; border: 1px solid rgba(232,160,32,0.4);
  border-radius: 12px; padding: 1.5rem 1.4rem;
  max-width: 340px; width: 90%;
  color: #f0e8d8; box-shadow: 0 12px 32px rgba(0,0,0,0.6);
}
.confirm-modal-title {
  font-family: 'Cinzel', serif; font-size: 1.05rem; font-weight: 700;
  color: #e8a020; margin-bottom: 0.55rem;
}
.confirm-modal-msg {
  font-size: 0.85rem; line-height: 1.5; color: #d0c0a8;
  margin-bottom: 1.1rem; white-space: pre-line;
}
.confirm-modal-actions { display: flex; gap: 0.6rem; justify-content: flex-end; }
.confirm-modal-btn {
  padding: 0.55rem 1rem; min-height: 40px;
  border-radius: 6px; font-family: 'Cinzel', serif; font-size: 0.82rem;
  font-weight: 700; cursor: pointer; transition: background 0.15s, border-color 0.15s;
}
.confirm-modal-btn.cancel {
  background: rgba(20,12,28,0.6); color: #c0b090;
  border: 1px solid rgba(232,160,32,0.18);
}
.confirm-modal-btn.cancel:hover { background: rgba(20,12,28,0.85); }
.confirm-modal-btn.confirm {
  background: rgba(232,160,32,0.18); color: #e8a020;
  border: 1px solid rgba(232,160,32,0.5);
}
.confirm-modal-btn.confirm:hover { background: rgba(232,160,32,0.32); }
`;

/**
 * Show an in-game confirm modal. Returns the overlay element so the
 * caller can dismiss it manually if needed.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.confirmText='Confirm']
 * @param {string} [opts.cancelText='Cancel']
 * @param {() => void} opts.onConfirm
 * @param {() => void} [opts.onCancel]
 * @returns {HTMLElement}
 */
export function showConfirmModal({
  title = 'Confirm',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
} = {}) {
  injectStyles('confirm-modal-styles', STYLES);
  const overlay = createEl('div', 'confirm-modal-overlay');
  overlay.innerHTML = `
    <div class="confirm-modal-box" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="confirm-modal-title">${title}</div>
      <div class="confirm-modal-msg">${message}</div>
      <div class="confirm-modal-actions">
        <button type="button" class="confirm-modal-btn cancel" data-cm-action="cancel">${cancelText}</button>
        <button type="button" class="confirm-modal-btn confirm" data-cm-action="confirm">${confirmText}</button>
      </div>
    </div>
  `;
  const close = () => removeEl(overlay);
  overlay.querySelector('[data-cm-action="cancel"]').addEventListener('click', () => {
    close();
    if (typeof onCancel === 'function') onCancel();
  });
  overlay.querySelector('[data-cm-action="confirm"]').addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });
  // Click on the backdrop (but not the box) cancels.
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
      if (typeof onCancel === 'function') onCancel();
    }
  });
  document.body.appendChild(overlay);
  return overlay;
}
