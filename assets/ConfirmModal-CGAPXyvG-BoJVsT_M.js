import{E as d,J as l,Y as f}from"./play-QH26u79V.js";import"./savesClient-Lt_9u8Ks-B0TWHWS2.js";const s=`
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
`;function p({title:r="Confirm",message:a="",confirmText:t="Confirm",cancelText:c="Cancel",onConfirm:e,onCancel:n}={}){d("confirm-modal-styles",s);const o=l("div","confirm-modal-overlay");o.innerHTML=`
    <div class="confirm-modal-box" role="dialog" aria-modal="true" aria-label="${r}">
      <div class="confirm-modal-title">${r}</div>
      <div class="confirm-modal-msg">${a}</div>
      <div class="confirm-modal-actions">
        <button type="button" class="confirm-modal-btn cancel" data-cm-action="cancel">${c}</button>
        <button type="button" class="confirm-modal-btn confirm" data-cm-action="confirm">${t}</button>
      </div>
    </div>
  `;const i=()=>f(o);return o.querySelector('[data-cm-action="cancel"]').addEventListener("click",()=>{i(),typeof n=="function"&&n()}),o.querySelector('[data-cm-action="confirm"]').addEventListener("click",()=>{i(),typeof e=="function"&&e()}),o.addEventListener("click",m=>{m.target===o&&(i(),typeof n=="function"&&n())}),document.body.appendChild(o),o}export{p as showConfirmModal};
