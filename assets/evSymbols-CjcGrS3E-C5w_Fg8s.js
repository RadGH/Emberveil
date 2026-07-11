const c=`
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
`;let i=!1;function a(){if(i||typeof document>"u")return;if(document.getElementById("ev-symbols")){i=!0;return}const t=document.createElement("div");t.innerHTML=c.trim();const r=t.firstElementChild;r&&document.body&&(document.body.appendChild(r),i=!0)}function k(t,r="lozenge"){if(!t)return;a();const s=`corner-${r}`,n="http://www.w3.org/2000/svg",l="http://www.w3.org/1999/xlink";for(const d of["tl","tr","bl","br"]){const e=document.createElementNS(n,"svg");e.setAttribute("class",`ev-corner ev-corner--${d}`),e.setAttribute("aria-hidden","true"),e.setAttribute("width","32"),e.setAttribute("height","32"),e.setAttribute("viewBox","0 0 32 32");const o=document.createElementNS(n,"use");o.setAttribute("href",`#${s}`),o.setAttributeNS(l,"xlink:href",`#${s}`),e.appendChild(o),t.appendChild(e)}}export{a,k};
