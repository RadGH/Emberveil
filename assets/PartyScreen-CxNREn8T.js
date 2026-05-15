const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/StatsScreen-CTpAHS8r.js","assets/play-Ckl2Sz1Z.js","assets/savesClient-DUFjgBxb.js","assets/play-DgvcVtSe.css"])))=>i.map(i=>d[i]);
import{r as A,i as S,c as M,h as L,G as m,j as k,k as _,p as E,_ as C,P,n as H,x as z,l as N,C as I}from"./play-Ckl2Sz1Z.js";import"./savesClient-DUFjgBxb.js";function v(n){return n?!!n.isCompanion||n.class==="companion":!1}const q=`
.party-screen {
  position: absolute; inset: 0; background: rgba(4,2,10,0.97);
  display: flex; flex-direction: column; overflow: hidden; color: #e8e0d0;
  font-family: 'Cinzel', Georgia, serif;
}
.ps-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1rem 0.5rem; border-bottom: 1px solid rgba(255,200,80,0.25);
  flex-shrink: 0;
}
.ps-title { font-size: 1.1rem; color: #e8c840; letter-spacing: 0.1em; }
.ps-close {
  background: none; border: 1px solid rgba(255,200,80,0.4); color: #e8c840;
  padding: 0.35rem 0.8rem; border-radius: 4px; cursor: pointer; font-size: 0.85rem;
  font-family: inherit;
}
.ps-body {
  flex: 1; overflow-y: auto; padding: 0.75rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.ps-section-title {
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.15em;
  color: rgba(232,200,64,0.7); margin-bottom: 0.25rem;
}
.ps-slots {
  display: grid; grid-template-columns: 1fr; gap: 0.4rem;
}
@media (min-width: 560px) {
  .ps-slots { grid-template-columns: 1fr 1fr; }
}
.ps-slot {
  display: flex; align-items: center; gap: 0.6rem;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px; padding: 0.5rem 0.75rem; cursor: pointer;
  transition: border-color 0.15s;
}
.ps-slot:hover { border-color: rgba(232,200,64,0.5); }
.ps-slot.ps-selected { border-color: #e8c840; background: rgba(232,200,64,0.1); }
.ps-slot.ps-empty {
  border-style: dashed; border-color: rgba(255,255,255,0.15);
  cursor: default; opacity: 0.5;
}
.ps-slot-icon {
  width: 80px; height: 80px; border-radius: 8px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; background: rgba(255,255,255,0.08); overflow: hidden;
  padding: 5px; box-sizing: border-box;
}
.ps-slot-icon .char-portrait {
  border-radius: 6px; background: rgba(255,255,255,0.06);
  width: 100% !important; height: 100% !important;
}
.ps-slot-class-icon { margin-left: 4px; display: inline-flex; vertical-align: middle; }
.ps-slot-info { flex: 1; min-width: 0; }
.ps-slot-name { font-size: 0.9rem; font-weight: 700; color: #f0e8d8; }
.ps-slot-class { font-size: 0.72rem; color: rgba(200,180,140,0.7); text-transform: uppercase; letter-spacing: 0.08em; }
.ps-slot-stats { font-size: 0.72rem; color: rgba(200,180,140,0.6); margin-top: 0.15rem; }
/* M337 — XP progress strip beneath HP/MP. Hover reveals current/next-level
   target via the title attribute set in _xpBar(). */
.ps-xp-row { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.3rem; }
.ps-xp-label { font-size: 0.62rem; letter-spacing: 0.08em; text-transform: uppercase; color: #e8c840; font-weight: 700; flex: 0 0 auto; }
.ps-xp-bar { flex: 1 1 auto; height: 5px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; border: 1px solid rgba(232,200,64,0.25); }
.ps-xp-fill { height: 100%; background: linear-gradient(90deg, #c89020, #f8e890); border-radius: 2px; transition: width 0.25s ease; }
.ps-slot-badge { display: none; }
.ps-columns { display: flex; flex-direction: column; gap: 0.75rem; }
@media (min-width: 760px) {
  .ps-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
  .ps-col { display: flex; flex-direction: column; gap: 0.75rem; }
}
.ps-detail {
  margin-top: 0.5rem; padding: 0.6rem 0.75rem; background: rgba(232,200,64,0.06);
  border: 1px solid rgba(232,200,64,0.3); border-radius: 6px;
}
.ps-detail-title { color: #e8c840; font-size: 0.85rem; margin-bottom: 0.35rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
.ps-rename-display { cursor: text; padding: 1px 4px; border-radius: 3px; border: 1px dashed transparent; }
.ps-rename-display:hover, .ps-rename-display:focus { border-color: rgba(232,200,64,0.5); outline: none; }
.ps-rename-input {
  font-family: inherit; font-size: 0.85rem; color: #f0e8d8;
  background: rgba(0,0,0,0.5); border: 1px solid rgba(232,200,64,0.55);
  border-radius: 3px; padding: 2px 6px; min-height: 28px; min-width: 9rem;
}
.ps-default-name { font-size: 0.65rem; color: rgba(232,200,64,0.55); font-style: italic; letter-spacing: 0.04em; }
.ps-detail-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.ps-detail-btn {
  background: rgba(232,200,64,0.15); border: 1px solid rgba(232,200,64,0.5);
  color: #e8c840; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer;
  font-family: inherit; font-size: 0.72rem;
}
.ps-action-bar {
  flex-shrink: 0; padding: 0.75rem; display: flex; gap: 0.5rem; justify-content: center;
  border-top: 1px solid rgba(255,200,80,0.15);
}
.ps-btn {
  background: rgba(232,200,64,0.15); border: 1px solid rgba(232,200,64,0.5);
  color: #e8c840; padding: 0.5rem 1.2rem; border-radius: 5px; cursor: pointer;
  font-family: inherit; font-size: 0.85rem;
}
.ps-btn:hover { background: rgba(232,200,64,0.25); }
.ps-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ps-hint {
  font-size: 0.72rem; color: rgba(200,180,140,0.55); text-align: center;
  padding: 0.35rem 0; font-family: sans-serif; letter-spacing: 0;
}
.ps-divider { height: 1px; background: rgba(255,200,80,0.12); margin: 0.25rem 0; }
.ps-slot-actions { display: flex; gap: 0.3rem; flex-shrink: 0; }
.ps-slot-btn {
  font-family: inherit; font-size: 0.65rem; padding: 0.25rem 0.5rem; border-radius: 4px;
  cursor: pointer; border: 1px solid; background: none; white-space: nowrap;
}
.ps-slot-btn.dismiss { color: #c08040; border-color: rgba(192,128,64,0.5); }
.ps-slot-btn.dismiss:hover { background: rgba(192,128,64,0.15); }
.ps-slot-btn.recruit { color: #60c060; border-color: rgba(96,192,96,0.5); }
.ps-slot-btn.recruit:hover { background: rgba(96,192,96,0.15); }
.ps-slot-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ps-toast {
  position: absolute; bottom: 5rem; left: 50%; transform: translateX(-50%);
  background: rgba(20,12,28,0.95); border: 1px solid rgba(232,200,64,0.4);
  color: #e8c840; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.78rem;
  pointer-events: none; z-index: 10; animation: ps-fade 2s ease-out forwards;
}
@keyframes ps-fade { 0%{opacity:1} 70%{opacity:1} 100%{opacity:0} }
.ps-role-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 3px;
  background: rgba(120,120,120,0.18);
  border: 1px solid rgba(120,120,120,0.35);
  vertical-align: middle; margin-left: 3px; cursor: default;
  flex-shrink: 0; opacity: 0.92;
}
`,T={tank:{label:"Tank",color:"#4080c0",svg:'<rect x="3" y="7" width="8" height="7" rx="1"/><path d="M7 3L3 7h8z"/>'},healer:{label:"Healer",color:"#40c080",svg:'<path d="M7 3v8M3 7h8"/>'},support:{label:"Support",color:"#c8a020",svg:'<path d="M7 2l1.5 4H13l-3.5 2.5 1.3 4L7 10 3.2 12.5l1.3-4L1 6h4.5z"/>'},dps:{label:"DPS",color:"#c04040",svg:'<path d="M3 11L11 3M9 3h2v2"/><path d="M3 11l3-1 1-3"/>'}};function R(n){if(!n.class||n.class==="companion"||n.isCompanion)return null;const e=I.find(s=>s.id===n.class),t=(e==null?void 0:e.role)||"";return/tank|front|wall|fortress/i.test(t)?"tank":/heal|cleric|medic|restor/i.test(t)?"healer":/support|buff|maestro|bard|shaman/i.test(t)?"support":"dps"}function B(n){const e=R(n);if(!e)return"";const t=T[e];return`<span class="ps-role-badge" title="${t.label}" aria-label="Role: ${t.label}" style="--rb-color:${t.color}"><svg viewBox="0 0 14 14" width="14" height="14" fill="${t.color}" stroke="${t.color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${t.svg}</svg></span>${H("role_badges")}`}function D(n){typeof n.hp=="number"&&typeof n.maxHp=="number"&&n.hp>n.maxHp&&(n.hp=n.maxHp);const e=Math.round((n.hp||0)/(n.maxHp||1)*100),t=e>60?"#60c060":e>30?"#e8c840":"#e06040",s=typeof n.hp=="number"?Math.floor(n.hp):n.hp??"?",i=typeof n.maxHp=="number"?Math.floor(n.maxHp):n.maxHp??"?";return`HP: <span style="color:${t}">${s}/${i}</span>`}function j(n){if(!n||n.isCompanion||n.class==="companion")return"";const e=n.level||1,t=n.xp||0,s=z(e),i=N(e);if(i==null)return`<div class="ps-xp-row"><span class="ps-xp-label">XP:</span><div class="ps-xp-bar" title="MAX (Level ${e})"><div class="ps-xp-fill" style="width:100%"></div></div></div>`;const o=Math.max(1,i-s),l=Math.max(0,t-s),r=Math.max(0,Math.min(100,Math.round(l/o*100)));return`<div class="ps-xp-row"><span class="ps-xp-label">XP:</span><div class="ps-xp-bar" title="${`XP: ${t} / ${i} (Level ${e} → ${e+1})`}"><div class="ps-xp-fill" style="width:${r}%"></div></div></div>`}class F{constructor(e,t){this.manager=e,this.audio=t,this._el=null,this._selectedA=null}onEnter(){this._build()}onPause(){this._el&&(this._el.style.display="none")}onResume(){this._el&&(this._el.style.display="flex")}onExit(){A(this._el),this._el=null}_build(){S("party-screen-styles",q),this._el=M("div","party-screen"),this.manager.uiOverlay.appendChild(this._el),this._render()}_render(){return L(this._el,()=>this._renderImpl())}_renderImpl(){var r;const e=m.get(),t=e.bench||[],s=t.filter(a=>!v(a)),i=t.filter(a=>v(a)),o=`
      <div class="ps-col">
        <div class="ps-section-title">Active Heroes (${e.party.length}/4)</div>
        <div class="ps-slots">
          ${e.party.map((a,u)=>this._slotHTML(a,"party",u)).join("")}
          ${e.party.length<4?'<div class="ps-slot ps-empty"><div class="ps-slot-icon">＋</div><div class="ps-slot-info" style="color:rgba(200,180,140,0.4)">Empty slot</div></div>':""}
        </div>
        <div class="ps-section-title">Inactive Heroes (${s.length})</div>
        <div class="ps-slots">
          ${s.length>0?s.map(a=>this._slotHTML(a,"bench",t.indexOf(a))).join(""):'<div class="ps-hint">No inactive heroes.</div>'}
        </div>
      </div>`,l=`
      <div class="ps-col">
        <div class="ps-section-title">Companions (${e.companions.length}/4)</div>
        <div class="ps-slots">
          ${e.companions.length>0?e.companions.map((a,u)=>this._slotHTML(a,"companions",u)).join(""):'<div class="ps-hint">No companions.</div>'}
        </div>
        <div class="ps-section-title">Inactive Companions (${i.length})</div>
        <div class="ps-slots">
          ${i.length>0?i.map(a=>this._slotHTML(a,"bench",t.indexOf(a))).join(""):'<div class="ps-hint">No inactive companions.</div>'}
        </div>
      </div>`;this._el.innerHTML=`
      <div class="ps-header">
        <div class="ps-title">Party Management</div>
        <button type="button" class="ps-close" id="ps-close">✕ Close</button>
      </div>
      <div class="ps-body">
        <div class="ps-columns">${o}${l}</div>
        ${this._selectedA?this._detailHTML():""}
      </div>
      <div class="ps-action-bar">
        <button type="button" class="ps-btn" id="ps-swap" ${this._canSwap()?"":"disabled"}>⇄ Swap</button>
        <button type="button" class="ps-btn" id="ps-move-up" ${this._canMoveUp()?"":"disabled"}>↑ Up</button>
        <button type="button" class="ps-btn" id="ps-move-down" ${this._canMoveDown()?"":"disabled"}>↓ Down</button>
        <button type="button" class="ps-btn" id="ps-stats"><svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="7" width="2" height="4"/><rect x="5" y="4" width="2" height="7"/><rect x="9" y="1" width="2" height="10"/></svg> Stats</button>
      </div>
      <div class="ps-hint">${this._selectedA?"✓ Selected: "+((r=this._getSelected())==null?void 0:r.name)+" — select another to swap, or use Up/Down to reorder.":"Tap a hero to select them."}</div>
    `,this._wire()}_detailHTML(){const e=this._getSelected();if(!e)return"";const t=e.defaultName||e.name,s=e.customName&&e.customName!==t?`<span class="ps-default-name" title="Default name (cleared if rename is left blank)">orig: ${t}</span>`:"";return`
      <div class="ps-detail">
        <div class="ps-detail-title">
          <span id="ps-rename-display" class="ps-rename-display" tabindex="0" role="button" aria-label="Rename ${e.name}" title="Tap name to rename">${e.name}</span>
          <input type="text" id="ps-rename-input" class="ps-rename-input" value="${(e.customName||"").replace(/"/g,"&quot;")}" placeholder="${t}" maxlength="24" hidden>
          ${k(e,14,"ps-slot-class-icon")} — ${e.className||e.class} Lv.${e.level||1}
          ${s}
        </div>
        <div class="ps-detail-btns">
          <button type="button" class="ps-detail-btn" id="ps-detail-rename">Rename</button>
          <button type="button" class="ps-detail-btn" id="ps-detail-inv">Inventory</button>
          <button type="button" class="ps-detail-btn" id="ps-detail-spells">Spells</button>
          <button type="button" class="ps-detail-btn" id="ps-detail-passives">Passives</button>
          <button type="button" class="ps-detail-btn" id="ps-detail-attrs">Attributes</button>
        </div>
      </div>`}_commitRename(e){var i,o;const t=this._getSelected();if(!t||!e)return;const s=(e.value||"").trim();t.defaultName||(t.defaultName=t.name),s?s===t.defaultName?(t.customName="",t.name=t.defaultName):(t.customName=s,t.name=s):(t.customName="",t.name=t.defaultName);try{(o=(i=_).saveCurrentGame)==null||o.call(i)}catch{}this._render()}_wireRename(){const e=this._el;if(!e)return;const t=e.querySelector("#ps-rename-display"),s=e.querySelector("#ps-rename-input"),i=e.querySelector("#ps-detail-rename");if(!t||!s)return;const o=()=>{t.hidden=!0,s.hidden=!1,s.focus(),s.select()},l=()=>{s.hidden=!0,t.hidden=!1};t.addEventListener("click",o),t.addEventListener("keydown",r=>{(r.key==="Enter"||r.key===" ")&&(r.preventDefault(),o())}),i==null||i.addEventListener("click",()=>{var r,a;(a=(r=this.audio)==null?void 0:r.playSfx)==null||a.call(r,"click"),o()}),s.addEventListener("keydown",r=>{r.key==="Enter"?(r.preventDefault(),this._commitRename(s)):r.key==="Escape"&&(r.preventDefault(),l())}),s.addEventListener("blur",()=>{this._commitRename(s)})}_slotHTML(e,t,s){const i=this._selectedA&&this._selectedA.source===t&&this._selectedA.index===s,o=t==="bench"?"reserve":t==="companions"?"companion":"party",l=m.get(),r=t==="party"&&l.party.length>1||t==="companions",a=e.isCompanion||e.class==="companion",u=t==="bench"&&(a?l.companions.length<4:l.party.length<4);return`<div class="ps-slot${i?" ps-selected":""}" data-source="${t}" data-index="${s}">
      <div class="ps-slot-icon">${E(e,32)}</div>
      <div class="ps-slot-info">
        <div class="ps-slot-name">${e.name}${e.isPet&&e.ownerName?` (${e.ownerName}'s pet)`:""} ${k(e,14,"ps-slot-class-icon")}${B(e)}</div>
        <div class="ps-slot-class">${e.class||"companion"} · Lv.${e.level||1}</div>
        <div class="ps-slot-stats">${D(e)} · MP: ${e.mp??"?"}/${e.maxMp??"?"}</div>
        ${j(e)}
      </div>
      <div class="ps-slot-actions">
        ${r?`<button type="button" class="ps-slot-btn dismiss" data-dismiss="${t}:${s}">Stand Down</button>`:""}
        ${u?`<button type="button" class="ps-slot-btn recruit" data-recruit="${s}">Add to Party</button>`:""}
      </div>
      <div class="ps-slot-badge${t==="bench"?" bench":""}">${o}</div>
    </div>`}_wire(){var o,l,r,a,u;this._el.querySelector("#ps-close").addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),(o=this._el.querySelector("#ps-stats"))==null||o.addEventListener("click",async()=>{this.audio.playSfx("click");const{StatsScreen:c}=await C(async()=>{const{StatsScreen:d}=await import("./StatsScreen-CTpAHS8r.js");return{StatsScreen:d}},__vite__mapDeps([0,1,2,3]));this.manager.push(new c(this.manager,this.audio,{tab:"party"}))}),this._wireRename(),this._el.querySelectorAll(".ps-slot[data-source]").forEach(c=>{c.addEventListener("click",()=>{const d=c.dataset.source,p=parseInt(c.dataset.index);this._onSlotClick(d,p)})}),this._el.querySelectorAll("[data-dismiss]").forEach(c=>{c.addEventListener("click",d=>{d.stopPropagation();const[p,b]=c.dataset.dismiss.split(":"),g=parseInt(b),h=m.get(),y=p==="party"?h.party:h.companions;if(p==="party"&&h.party.length<=1)return;const[x]=y.splice(g,1);if(h.bench=h.bench||[],h.bench.push(x),!x.isCompanion&&x.id){const w=f=>f.isPet&&f.ownerId===x.id,$=h.companions.filter(w);h.companions=h.companions.filter(f=>!w(f));for(const f of $)h.bench.push(f)}this._selectedA=null,this.audio.playSfx("click"),_.saveCurrentGame(),this._render()})}),this._el.querySelectorAll("[data-recruit]").forEach(c=>{c.addEventListener("click",d=>{d.stopPropagation();const p=parseInt(c.dataset.recruit),b=m.get(),[g]=b.bench.splice(p,1);if(g.isCompanion||g.class==="companion"){if(b.companions.length>=4)return;b.companions.push(g)}else{if(b.party.length>=4)return;b.party.push(g)}this._selectedA=null,this.audio.playSfx("click"),_.saveCurrentGame(),this._render()})});const e=c=>{const d=this._getSelected();if(!d)return;this.audio.playSfx("click");const p=m.get(),b=p.party.includes(d)||p.companions.includes(d);p.inventoryContext=b?"default":"party-inactive",p.inventoryFocusId=d.id;const g=[...p.party||[],...p.companions||[]],h=Math.max(0,g.findIndex(y=>y&&y.id===d.id));this.manager.replace(new P(this.manager,this.audio,{tab:c,charIdx:h}))};(l=this._el.querySelector("#ps-detail-inv"))==null||l.addEventListener("click",()=>e("inventory")),(r=this._el.querySelector("#ps-detail-spells"))==null||r.addEventListener("click",()=>e("spells")),(a=this._el.querySelector("#ps-detail-passives"))==null||a.addEventListener("click",()=>e("passives")),(u=this._el.querySelector("#ps-detail-attrs"))==null||u.addEventListener("click",()=>e("attributes"));const t=this._el.querySelector("#ps-swap");t&&!t.disabled&&t.addEventListener("click",()=>this._doSwap());const s=this._el.querySelector("#ps-move-up");s&&!s.disabled&&s.addEventListener("click",()=>this._doMove(-1));const i=this._el.querySelector("#ps-move-down");i&&!i.disabled&&i.addEventListener("click",()=>this._doMove(1))}_onSlotClick(e,t){if(!this._selectedA)this._selectedA={source:e,index:t};else if(this._selectedA.source===e&&this._selectedA.index===t)this._selectedA=null;else{this._doSwapWith({source:e,index:t});return}this._render()}_getSelected(){if(!this._selectedA)return null;const e=m.get();return(this._selectedA.source==="party"?e.party:this._selectedA.source==="companions"?e.companions:e.bench)[this._selectedA.index]}_canSwap(){return this._selectedA!==null}_canMoveUp(){return this._selectedA&&this._selectedA.source==="party"&&this._selectedA.index>0}_canMoveDown(){const e=m.get();return this._selectedA&&this._selectedA.source==="party"&&this._selectedA.index<e.party.length-1}_doSwap(){const e=m.get();if(!this._selectedA||e.bench.length===0)return;const t=this._selectedA.source==="party"?e.party:e.companions,s=t[this._selectedA.index],i=e.bench[0];t[this._selectedA.index]=i,e.bench[0]=s,e.bench.splice(0,1,s),this._selectedA=null,this._autosave(),this._render()}_doSwapWith(e){const t=m.get(),s=u=>u==="party"?t.party:u==="companions"?t.companions:t.bench,i=s(this._selectedA.source),o=s(e.source),l=i[this._selectedA.index],r=o[e.index];if(this._selectedA.source==="companions"&&r&&!v(r)){this._selectedA=null,this._render();return}if(e.source==="companions"&&l&&!v(l)){this._selectedA=null,this._render();return}if(this._selectedA.source==="party"&&r&&v(r)){this._selectedA=null,this._render();return}if(e.source==="party"&&l&&v(l)){this._selectedA=null,this._render();return}const a=i[this._selectedA.index];i[this._selectedA.index]=o[e.index],o[e.index]=a,t.party=t.party.filter(Boolean),t.companions=t.companions.filter(Boolean),this._selectedA=null,this._autosave(),this._render()}_autosave(){try{_.saveCurrentGame()}catch{}}_doMove(e){const t=m.get();if(!this._selectedA||this._selectedA.source!=="party")return;const s=this._selectedA.index,i=s+e;i<0||i>=t.party.length||([t.party[s],t.party[i]]=[t.party[i],t.party[s]],this._selectedA.index=i,this._render())}}export{F as PartyScreen,v as isCompanionEntity};
