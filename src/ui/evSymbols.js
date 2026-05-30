/**
 * evSymbols — M392
 * Idempotent injector for the corner-lozenge/flourish/simple SVG <symbol>
 * defs used by the .ev-panel border system.
 *
 * Source markup intentionally inlined here (rather than fetched from
 * ev-symbols.html) so the boot path is synchronous and there's exactly one
 * place to swap art tokens.
 */

const SYMBOL_MARKUP = `
<svg width="0" height="0" style="position:absolute;overflow:hidden" aria-hidden="true" id="ev-symbols">
  <defs>
    <symbol id="corner-lozenge" viewBox="0 0 32 32">
      <rect x="9" y="9" width="14" height="14"
            fill="var(--ember-deep,#0d0820)"
            stroke="var(--border-stroke,#c8a020)" stroke-width="1.5"
            transform="rotate(45 16 16)"/>
      <line x1="16" y1="5" x2="16" y2="9"
            stroke="var(--border-stroke,#c8a020)" stroke-width="1"
            stroke-linecap="round" opacity="0.5"/>
    </symbol>
    <symbol id="corner-flourish" viewBox="0 0 32 32">
      <rect x="10" y="10" width="12" height="12"
            fill="var(--ember-deep,#0d0820)"
            stroke="var(--border-stroke,#c8a020)" stroke-width="1.4"
            transform="rotate(45 16 16)"/>
      <path d="M16,7.5 C15,5 11,3.5 8,2"
            fill="none"
            stroke="var(--border-stroke,#c8a020)" stroke-width="0.9"
            stroke-linecap="round"/>
      <path d="M7.5,16 C5,15 3.5,11 2,8"
            fill="none"
            stroke="var(--border-stroke,#c8a020)" stroke-width="0.9"
            stroke-linecap="round"/>
      <circle cx="7.5" cy="2" r="1.4" fill="var(--border-stroke,#c8a020)"/>
      <circle cx="2" cy="7.5" r="1.4" fill="var(--border-stroke,#c8a020)"/>
      <circle cx="11.5" cy="4.5" r="0.8" fill="none"
              stroke="var(--border-stroke,#c8a020)" stroke-width="0.8"/>
      <circle cx="4.5" cy="11.5" r="0.8" fill="none"
              stroke="var(--border-stroke,#c8a020)" stroke-width="0.8"/>
    </symbol>
    <symbol id="corner-simple" viewBox="0 0 32 32">
      <polyline points="14,4 4,4 4,14" fill="none"
                stroke="var(--border-stroke,#c8a020)" stroke-width="2"
                stroke-linecap="square" stroke-linejoin="miter"/>
      <polyline points="13,7 7,7 7,13" fill="none"
                stroke="var(--border-stroke,#c8a020)" stroke-width="0.8"
                stroke-linecap="square" stroke-linejoin="miter" opacity="0.4"/>
    </symbol>
  </defs>
</svg>
`;

let _injected = false;

export function ensureEvSymbols() {
  if (_injected) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('ev-symbols')) { _injected = true; return; }
  const wrap = document.createElement('div');
  wrap.innerHTML = SYMBOL_MARKUP.trim();
  const node = wrap.firstElementChild;
  if (node && document.body) {
    document.body.appendChild(node);
    _injected = true;
  }
}

/**
 * Append four corner <svg><use href="#corner-{variant}"/></svg> children to a
 * panel element. Caller is expected to have set `position: relative` and to
 * use one of the .ev-panel size aliases for offset positioning.
 *
 * @param {HTMLElement} panelEl
 * @param {'lozenge'|'flourish'|'simple'} variant
 */
export function appendEvCorners(panelEl, variant = 'lozenge') {
  if (!panelEl) return;
  ensureEvSymbols();
  const id = `corner-${variant}`;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK = 'http://www.w3.org/1999/xlink';
  for (const pos of ['tl', 'tr', 'bl', 'br']) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', `ev-corner ev-corner--${pos}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '32');
    svg.setAttribute('height', '32');
    svg.setAttribute('viewBox', '0 0 32 32');
    const use = document.createElementNS(SVG_NS, 'use');
    use.setAttribute('href', `#${id}`);
    use.setAttributeNS(XLINK, 'xlink:href', `#${id}`);
    svg.appendChild(use);
    panelEl.appendChild(svg);
  }
}
