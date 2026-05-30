export function createEl(tag, className, attrs = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function removeEl(el) {
  el?.parentNode?.removeChild(el);
}

export function injectStyles(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}
