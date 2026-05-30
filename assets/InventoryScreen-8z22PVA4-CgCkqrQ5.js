import{E as F,J as H,Q as X,k as $,o as j,H as Y,Z as Q,a as W,c as Z,y as D,b as R,i as G,f as J,z as V,g as ee,j as O,m as te,l as N,$ as ae,n as A,p as B,O as U,Y as E,q as ie,r as oe,u as ne,v as re}from"./play-QH26u79V.js";import{showConfirmModal as se}from"./ConfirmModal-CGAPXyvG-BoJVsT_M.js";import"./savesClient-Lt_9u8Ks-B0TWHWS2.js";const le=["weapon","offhand","head","chest","legs","hands","feet","ring1","ring2","necklace"],de={weapon:"Weapon",offhand:"Off-hand",head:"Head",chest:"Chest",legs:"Legs",hands:"Hands",feet:"Feet",ring1:"Ring",ring2:"Ring",necklace:"Necklace"};function ce(z,e,o){var n;const d=[...e.inventory||[]];let l=0;for(const p of d){if((n=e.isManuallyUnequipped)!=null&&n.call(e,p.id))continue;const i=z.autoEquip;z.autoEquip=!0;try{const r=e.tryAutoEquip(p);r&&r.member&&r.member.id===z.id&&l++}catch{}z.autoEquip=i}l>0&&o&&o.playSfx("purchase")}class be{constructor(e,o){this.manager=e,this.audio=o,this._el=null,this._selectedCharIdx=0,this._charScrollPos=new Map,this._tt=null,this._compareMode=!1,this._compareSecondary=!1,this._currentTooltipItem=null,this._isTouch=typeof window<"u"&&("ontouchstart"in window||navigator.maxTouchPoints>0)}onEnter(){this._build()}_build(){F("inv-styles",pe),this._el=H("div","inv-screen"),this.manager.uiOverlay.appendChild(this._el),this._render()}_render(){X(this._el,()=>this._renderImpl())}_renderImpl(){const e=$.get(),o=(e.inventoryContext||"default")==="party-inactive",n=e.bench||[],d=o?[...e.party,...e.companions,...n]:[...e.party,...e.companions];if(e.inventoryFocusId){const i=d.findIndex(r=>r.id===e.inventoryFocusId);i>=0&&(this._selectedCharIdx=i),e.inventoryFocusId=null}const l=d[this._selectedCharIdx]||d[0];this._selectedCharIdx>=d.length&&(this._selectedCharIdx=0),this._el.innerHTML=`
      <div class="inv-header">
        <div class="inv-char-tabs" id="char-tabs">
          ${d.map((i,r)=>{const m=n.includes(i);return`
            <button type="button" class="char-tab${r===this._selectedCharIdx?" active":""}" data-idx="${r}" style="${m?"opacity:0.55;border-style:dashed":""}">
              ${i.name}${m?" <small>(inactive)</small>":""}<br><small>${i.className||i.class}</small>
            </button>`}).join("")}
        </div>
        <button type="button" class="inv-close" id="inv-close">✕ Close</button>
      </div>
      <div class="inv-layout">
        <!-- Equipment slots (left) -->
        <div class="equip-panel">
          <div class="panel-label panel-label-row">
            <span>Inventory</span>
            ${l&&!(l.isCompanion&&l.class==="companion")?(()=>{var i;return(i=$.get())!=null&&i.manualCombat||j()?"":`<button type="button" class="auto-toggle${l.autoEquip?" on":""}" id="inv-autoequip" aria-pressed="${l.autoEquip?"true":"false"}" title="When new items appear in your bag and they're an upgrade for this character, auto-equip them. Items you manually unequip are remembered and never auto-equipped.">
                ${l.autoEquip?'<span class="auto-check" aria-hidden="true">✓</span>':'<span class="auto-check auto-off" aria-hidden="true">○</span>'}Auto
              </button>`})():""}
          </div>
          <div class="inv-char-header">
            ${l?`<div class="inv-portrait-wrap">${Y(l,70,"inv-portrait")}</div>`:""}
            <div class="inv-char-identity">
              <div class="inv-char-name">${(l==null?void 0:l.name)||"No Character"} ${l?Q(l,14,"inv-class-icon"):""}</div>
            </div>
          </div>
          <div class="panel-label" style="margin-top:0.5rem">Equipped</div>
          <div class="equip-slots" id="equip-slots">
            ${(()=>{var i,r;const m=(l==null?void 0:l.isCompanion)&&(l==null?void 0:l.class)==="companion",f=(r=(i=l==null?void 0:l.equipment)==null?void 0:i.weapon)==null?void 0:r.twoHanded;return le.map(w=>{var t;const a=(t=l==null?void 0:l.equipment)==null?void 0:t[w];return`
                  <div class="equip-slot${a?" has-item":""}${w==="offhand"&&f||m?" slot-disabled":""}${m?" slot-companion":""}" data-slot="${w}">
                    <div class="es-label">${de[w]}${m?'<span class="es-companion-tag">[Companion]</span>':""}</div>
                    ${a?(()=>{const c=a.isUnique?"#ff8020":a.setId?"#b060ff":`var(--rarity-${a.rarity})`;return`
                      <div class="es-item" data-itemid="${a.id}" data-slot="${w}">
                        <div class="esi-name" style="color:${c}">${a.name}</div>
                        <div class="esi-stat">${a.dmg?`${a.dmg[0]}-${a.dmg[1]}`:a.armor?`+${a.armor} arm`:""}</div>
                      </div>`})():'<div class="es-empty">— empty —</div>'}
                  </div>
                `}).join("")})()}
          </div>
          <div class="char-stats-panel">
            <div class="panel-label">Character Stats</div>
            ${this._renderCharStats(l)}
          </div>
        </div>
        <!-- Inventory grid (right) -->
        <div class="inv-items-panel">
          <div class="panel-label">Inventory (${e.inventory.length} items)</div>
          <div class="inv-grid" id="inv-grid">
            ${e.inventory.length===0?'<div class="inv-empty">Your pack is empty. Visit the merchant or defeat enemies to find equipment.</div>':e.inventory.map(i=>{const r=this._upgradeTier(l,i),m=this._slotsForItem(l,i).join(" "),f=r?` data-upgrade-tier="${r}"`:"",w=r?` upgrade-${r}`:"",t=i.isUnique?"#ff8020":i.setId?"#b060ff":`var(--rarity-${i.rarity})`,a=i.setId?'<div class="iic-set-tag">Set</div>':"",c=i.isUnique?'<div class="iic-unique-tag">Unique</div>':"";return`
                <div class="inv-item-card${w}${i.isUnique?" iic-unique":""}${i.setId?" iic-set":""}" data-id="${i.id}" data-slots="${m}"${f}>
                  <div class="iic-rarity-bar" style="background:${t}"></div>
                  <div class="iic-name" style="color:${t}">${i.name}</div>
                  ${a}${c}
                  <div class="iic-type">${i.subtype||i.type}</div>
                  <div class="iic-stat">${i.dmg?`Dmg ${i.dmg[0]}-${i.dmg[1]}`:i.armor?`Arm +${i.armor}`:""}</div>
                  <div class="iic-quality">${i.quality}</div>
                  <button type="button" class="iic-equip-btn" data-equip="${i.id}">Equip</button>
                </div>
              `}).join("")}
          </div>
        </div>
      </div>
      <div id="inv-tt" class="inv-tooltip" style="display:none"><button class="inv-tt-close" aria-label="Close" type="button">×</button><div class="inv-tt-body"></div></div>
    `,this._wireEvents(),W(this._el);const p=this._el.querySelector("#stats-base-chk");p&&p.addEventListener("click",()=>{var i,r;const m=(i=this._el)==null?void 0:i.querySelector(".equip-panel"),f=m?m.scrollTop:0,w=!p.classList.contains("on");Z(w),this.audio.playSfx("click"),this._render();const t=(r=this._el)==null?void 0:r.querySelector(".equip-panel");t&&(t.scrollTop=f)})}_slotsForItem(e,o){if(!o||!e)return[];const n=[];return o.type==="weapon"?(n.push("weapon"),(o.offHandOk||!o.twoHanded)&&!o.twoHanded&&n.push("offhand"),n):o.subtype==="ring"||o.slot==="ring"?["ring1","ring2"]:o.slot?[o.slot]:o.subtype?[o.subtype]:[]}_upgradeTier(e,o){var n;if(!e||!o||e.isCompanion&&e.class==="companion")return null;const d=this._slotsForItem(e,o);if(!d.length)return null;const l=e.equipment||{};for(const r of d)if(!l[r]){if(r==="offhand"&&(n=l.weapon)!=null&&n.twoHanded)continue;return"empty"}const p=D(o,e).total;let i=-1/0;for(const r of d){const m=l[r];if(!m)continue;const f=D(m,e).total;if(f<=0)continue;const w=(p-f)/f;w>i&&(i=w)}return i<=0||i===-1/0?null:i<=.05?"minor":i<=.2?"medium":i<=.5?"major":"huge"}_vsItemForCompare(e,o){if(!e||!o)return null;const n=e.equipment||{},d=this._slotsForItem(e,o);if(!d.length)return null;let l=d[0],p=d[1];d.includes("ring1")&&d.includes("ring2")&&(l="ring1",p="ring2");const i=this._compareSecondary&&p?p:l;return{vs:n[i]||null,slot:i,hasSecondary:!!p&&p!==l}}_openCompareModal(e,o,n={}){if(!e)return;const{hero:d=null,slotLabel:l=null,hasSecondary:p=!1,inInv:i=!1,onEquip:r}=n;F("inv-cmp-modal-styles",`
      .inv-cmp-modal-backdrop {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.78);
        display: flex; align-items: center; justify-content: center;
        padding: 0;
      }
      .inv-cmp-modal {
        position: relative;
        width: 85vw; max-width: 420px;
        max-height: 88vh;
        background: #110a08;
        border: 2px solid rgba(232,160,32,0.55);
        border-radius: 10px;
        box-shadow: 0 8px 48px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(232,160,32,0.08);
        display: flex; flex-direction: column;
        overflow: hidden;
      }
      .inv-cmp-modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.65rem 0.9rem 0.55rem;
        border-bottom: 1px solid rgba(232,160,32,0.18);
        flex-shrink: 0;
      }
      .inv-cmp-modal-title {
        font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em;
        color: #e8a020; text-transform: uppercase;
      }
      .inv-cmp-modal-close {
        width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
        background: none; border: none; cursor: pointer; color: #c0a080; font-size: 1.3rem;
        border-radius: 6px; margin: -0.4rem -0.5rem -0.4rem 0;
      }
      .inv-cmp-modal-close:hover { background: rgba(232,160,32,0.12); color: #e8c060; }
      .inv-cmp-modal-body {
        overflow-y: auto; flex: 1; padding: 0.7rem 0.9rem;
        -webkit-overflow-scrolling: touch;
      }
      .inv-cmp-section-label {
        font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
        text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.35rem;
        padding: 0.2rem 0.45rem; background: rgba(232,160,32,0.07);
        border-radius: 4px; border-left: 3px solid rgba(232,160,32,0.4);
      }
      .inv-cmp-section-label.candidate { border-left-color: #60d080; color: #90c8a0; }
      .inv-cmp-section-label.equipped  { border-left-color: #6898d8; color: #90b0d8; }
      .inv-cmp-divider {
        margin: 0.7rem 0; border: none; border-top: 1px solid rgba(232,160,32,0.15);
      }
      .inv-cmp-modal-footer {
        display: flex; gap: 0.5rem; padding: 0.55rem 0.9rem 0.7rem;
        border-top: 1px solid rgba(232,160,32,0.18); flex-shrink: 0;
      }
      .inv-cmp-footer-btn {
        flex: 1; min-height: 48px; padding: 0.5rem 0.7rem;
        background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.35);
        border-radius: 7px; color: #e8a020; font-size: 0.88rem; font-weight: 700;
        cursor: pointer; letter-spacing: 0.03em;
      }
      .inv-cmp-footer-btn:hover { background: rgba(232,160,32,0.22); }
      .inv-cmp-footer-btn.equip {
        background: rgba(96,208,128,0.12); border-color: rgba(96,208,128,0.45); color: #b0e8c0;
      }
      .inv-cmp-footer-btn.equip:hover { background: rgba(96,208,128,0.24); }
      .inv-cmp-footer-btn.secondary {
        background: rgba(104,152,216,0.1); border-color: rgba(104,152,216,0.4); color: #90b0d8;
      }
    `);const m=R(e,d);let f;o?f=R(o,d):f=`<span style="color:#60d080;font-style:italic">Slot ${l||""} is empty — direct upgrade.</span>`;let w='<button class="inv-cmp-footer-btn" data-modal-action="close">Close</button>';p&&(w+='<button class="inv-cmp-footer-btn secondary" data-modal-action="secondary">Compare 2nd</button>'),i&&(w+='<button class="inv-cmp-footer-btn equip" data-modal-action="equip">Equip</button>');const t=H("div","inv-cmp-modal-backdrop");t.innerHTML=`
      <div class="inv-cmp-modal" role="dialog" aria-modal="true" aria-label="Item Compare">
        <div class="inv-cmp-modal-header">
          <span class="inv-cmp-modal-title">Compare Items</span>
          <button class="inv-cmp-modal-close" data-modal-action="close" aria-label="Close">&#x2715;</button>
        </div>
        <div class="inv-cmp-modal-body">
          <div class="inv-cmp-section-label candidate">Considered</div>
          <div class="inv-cmp-candidate-body">${m}</div>
          <hr class="inv-cmp-divider">
          <div class="inv-cmp-section-label equipped">Equipped (${l||"slot"})</div>
          <div class="inv-cmp-equipped-body">${f}</div>
        </div>
        <div class="inv-cmp-modal-footer">${w}</div>
      </div>
    `;const a=()=>{t.remove(),this._activeCmpModal=null};t.addEventListener("click",s=>{s.target===t&&a()});const c=s=>{s.key==="Escape"&&(a(),window.removeEventListener("keydown",c))};window.addEventListener("keydown",c),t.querySelectorAll("[data-modal-action]").forEach(s=>{s.addEventListener("click",b=>{b.stopPropagation();const _=s.dataset.modalAction;if(_==="close")a(),window.removeEventListener("keydown",c);else if(_==="equip")a(),window.removeEventListener("keydown",c),r&&r(e);else if(_==="secondary"){this._compareSecondary=!this._compareSecondary;const x=$.get().party||[],g=x[this._selectedCharIdx]||x[0],v=this._vsItemForCompare(g,e),y=t.querySelector(".inv-cmp-equipped-body"),q=t.querySelector(".inv-cmp-section-label.equipped");v!=null&&v.vs&&y?y.innerHTML=R(v.vs,d):y&&(y.innerHTML=`<span style="color:#60d080;font-style:italic">Slot ${(v==null?void 0:v.slot)||""} is empty.</span>`),q&&(q.textContent=`Equipped (${(v==null?void 0:v.slot)||"slot"})`)}})}),document.body.appendChild(t),this._activeCmpModal=t;const u=t.querySelector(".inv-cmp-modal-close");u&&u.focus()}_renderCharStats(e){if(!e)return'<div class="stat-row"><span>No character selected</span></div>';const o=e.baseAttrs||e.attrs,n=e.attrs,d=G(),l=e.equipment||{};let p=0;for(const h of Object.values(l))h!=null&&h.armor&&(p+=h.armor);const i=0,r=J(e);p+=r.armor||0;const m=V(l),f=d?o:{STR:n.STR+(r.str||0),DEX:n.DEX+(r.dex||0),INT:n.INT+(r.int||0),CON:n.CON+(r.con||0)},w=ee(l)+(r.dmg||0),t=O(f,d?0:w,m),a=O(o,0,m),c=m==="magic"?"Magic Damage":m==="light"?"Light Damage":"Heavy Damage",u=d?0:r.magicResist||0,s=(h,k)=>({hp:k?oe(e):50+h.CON*10,mp:k?ie(e):30+h.INT*8,hit:Math.min(95,70+Math.round(h.DEX*1.2)+(k&&r.hit||0)),dodge:Math.min(40,5+Math.round(h.DEX*.8)+(k&&r.dodge||0)),spl:h.INT*.025+(k&&r.spellPower||0)}),b=s(d?o:f,!d),_=s(o,!1),x=d?i:p,g=d?0:te(e).resistAll||0,v=N(x,g),y=N(i,0),q=(h,k,M)=>{const P=ne(k,M,h);return P?` style="color:${P}"`:""},T=["STR","DEX","INT","CON"].map(h=>{const k=h.toLowerCase(),M=f[h];return`<div class="stat-row"><span class="sr-label stat-label" data-stat="${h}">${h}</span><span class="sr-val"${q(k,M,o[h])}>${Math.floor(M)}</span></div>`}).join(""),L=new Set(["str","dex","int","con","hp","mp","dmg","armor","hit","dodge","magicresist","magicResist","spellpower","spellPower"]),I={goldFind:"Gold Find",xpFind:"XP Find",manaRegen:"Mana Regen",lifeSteal:"Life Steal",manaSteal:"Mana Steal",initiative:"Initiative",critChance:"Crit Chance",critDamage:"Crit Damage",spellPower:"Spell Power",tradePrices:"Trade Prices"},S=[];if(!d){try{const h=ae(e);if((h==null?void 0:h.blockChance)>0){const k=`+${A(h.blockChance)}`;S.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Chance">Block Chance</span><span class="sr-val" style="color:#6db3ff">${k}</span></div>`)}(h==null?void 0:h.blockPower)>0&&S.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Power">Block Power</span><span class="sr-val" style="color:#6db3ff">+${Math.round(h.blockPower)}</span></div>`)}catch{}for(const h of Object.keys(r)){if(L.has(h)||L.has(h.toLowerCase()))continue;const k=r[h];if(!k)continue;const M=I[h]||h.replace(/([A-Z])/g," $1").replace(/^./,K=>K.toUpperCase()),P=(h==="goldFind"||h==="xpFind"||h==="critChance"||h==="critDamage"||h==="tradePrices")&&Math.abs(k)<=3?`+${A(k)}`:h==="lifeSteal"||h==="manaSteal"?`+${B(k,"pct")}`:`+${B(k,"auto")}`;S.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="${M}">${M}</span><span class="sr-val" style="color:#6db3ff">${P}</span></div>`)}}const C=S.length?S.join(""):'<div class="stat-row"><span class="sr-label" style="color:#5a4a42;font-style:italic">None</span><span class="sr-val" style="color:#5a4a42">—</span></div>';return`
      <button type="button" class="auto-toggle stats-base-toggle${d?" on":""}" id="stats-base-chk" aria-pressed="${d?"true":"false"}" title="Show base attributes (without item bonuses)">${d?'<span class="auto-check" aria-hidden="true">✓</span>':'<span class="auto-check auto-off" aria-hidden="true">○</span>'}Show Base Attributes</button>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="HP">HP</span><span class="sr-val"${q("hp",b.hp,_.hp)}>${Math.floor(b.hp)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Mana">Mana</span><span class="sr-val"${q("mp",b.mp,_.mp)}>${Math.floor(b.mp)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Armor">Armor</span><span class="sr-val"${q("armor",x,i)}>${Math.floor(x)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Damage Reduction">Damage Reduction</span><span class="sr-val"${q("dmgReduction",v.totalDr,y.totalDr)}>${A(v.totalDr)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Magic Resist">Magic Resist</span><span class="sr-val"${q("magicResist",u,0)}>${Math.floor(u)}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Hit">Hit</span><span class="sr-val"${q("hit",b.hit,_.hit)}>${Math.floor(b.hit)}%</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Dodge">Dodge</span><span class="sr-val"${q("dodge",b.dodge,_.dodge)}>${Math.floor(b.dodge)}%</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="${c}">${c}</span><span class="sr-val"${q("dmg",t[1],a[1])}>${Math.floor(t[0])}-${Math.floor(t[1])}</span></div>
      <div class="stat-row"><span class="sr-label stat-label" data-stat="Spell Power">Spell Power</span><span class="sr-val"${q("spellPower",b.spl,_.spl)}>+${Math.round(b.spl*100)}%</span></div>
      <div class="panel-label" style="margin-top:0.75rem">Attributes</div>
      ${T}
      <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
      ${C}
    `}_doEquip(e,o,n,d){e.equipment||(e.equipment={}),o.twoHanded&&o.type==="weapon"&&e.equipment.offhand&&($.addToInventoryRaw(e.equipment.offhand),delete e.equipment.offhand),e.equipment[n]&&$.addToInventoryRaw(e.equipment[n]),e.equipment[n]=o,$.removeFromInventory(o.id),$.unmarkManuallyUnequipped(o.id),U(e)}_showSlotPicker(e,o,n){var d,l;const p=H("div","slot-picker-overlay"),i=(d=e.equipment)==null?void 0:d.weapon,r=(l=e.equipment)==null?void 0:l.offhand,m=i==null?void 0:i.twoHanded;p.innerHTML=`
      <div class="spo-box">
        <div class="spo-title">Equip to which slot?</div>
        <div class="spo-item-name" style="color:${`var(--rarity-${o.rarity})`}">${o.name}</div>
        <div class="spo-actions">
          <button type="button" class="spo-btn" id="spo-weapon">
            Main Hand${i?`<br><small style="color:#8a7a6a">Replaces: ${i.name}</small>`:""}
          </button>
          <button type="button" class="spo-btn" id="spo-offhand" ${m?'disabled title="Unequip 2H weapon first"':""}>
            Off Hand${r?`<br><small style="color:#8a7a6a">Replaces: ${r.name}</small>`:""}${m?'<br><small style="color:#c04030">2H equipped</small>':""}
          </button>
        </div>
        <button type="button" class="spo-cancel" id="spo-cancel">Cancel</button>
      </div>
    `,p.querySelector("#spo-weapon").addEventListener("click",()=>{this.audio.playSfx("click"),this._doEquip(e,o,"weapon",n),E(p),this._render()}),p.querySelector("#spo-offhand").addEventListener("click",()=>{m||(this.audio.playSfx("click"),this._doEquip(e,o,"offhand",n),E(p),this._render())}),p.querySelector("#spo-cancel").addEventListener("click",()=>E(p)),this._el.appendChild(p)}_showRingPicker(e,o,n){var d,l;const p=H("div","slot-picker-overlay"),i=(d=e.equipment)==null?void 0:d.ring1,r=(l=e.equipment)==null?void 0:l.ring2;p.innerHTML=`
      <div class="spo-box">
        <div class="spo-title">Equip to which ring slot?</div>
        <div class="spo-item-name" style="color:${`var(--rarity-${o.rarity})`}">${o.name}</div>
        <div class="spo-actions">
          <button type="button" class="spo-btn" id="spo-ring1">
            Ring Slot 1${i?`<br><small style="color:#8a7a6a">Replaces: ${i.name}</small>`:""}
          </button>
          <button type="button" class="spo-btn" id="spo-ring2">
            Ring Slot 2${r?`<br><small style="color:#8a7a6a">Replaces: ${r.name}</small>`:""}
          </button>
        </div>
        <button type="button" class="spo-cancel" id="spo-cancel">Cancel</button>
      </div>
    `,p.querySelector("#spo-ring1").addEventListener("click",()=>{this.audio.playSfx("click"),this._doEquip(e,o,"ring1",n),E(p),this._render()}),p.querySelector("#spo-ring2").addEventListener("click",()=>{this.audio.playSfx("click"),this._doEquip(e,o,"ring2",n),E(p),this._render()}),p.querySelector("#spo-cancel").addEventListener("click",()=>E(p)),this._el.appendChild(p)}_showInfoModal(e){const o=H("div","slot-picker-overlay");o.innerHTML=`
      <div class="spo-box">
        <div class="spo-title">Notice</div>
        <div class="spo-item-name" style="color:#c0b090;font-style:normal">${e}</div>
        <button type="button" class="spo-cancel" id="info-ok">OK</button>
      </div>
    `,o.querySelector("#info-ok").addEventListener("click",()=>E(o)),o.addEventListener("click",n=>{n.target===o&&E(o)}),this._el.appendChild(o)}_equipItemFlow(e){var o,n,d,l,p,i;const r=$.get(),m=[...r.party,...r.companions][this._selectedCharIdx];if(!m||!e)return;if(m.isCompanion&&m.class==="companion"){this._showInfoModal("Companions cannot equip items.");return}const f=e.type==="weapon",w=e.twoHanded,t=e.offHandOk||!w&&f;if(f&&!w&&t){const c=!!((o=m.equipment)!=null&&o.weapon),u=!!((n=m.equipment)!=null&&n.offhand),s=(l=(d=m.equipment)==null?void 0:d.weapon)==null?void 0:l.twoHanded;if(!c){this._doEquip(m,e,"weapon",r),this._render();return}if(!u&&!s){this._doEquip(m,e,"offhand",r),this._render();return}this._showSlotPicker(m,e,r);return}if(e.subtype==="ring"){const c=!!((p=m.equipment)!=null&&p.ring1),u=!!((i=m.equipment)!=null&&i.ring2);if(!c){this._doEquip(m,e,"ring1",r),this._render();return}if(!u){this._doEquip(m,e,"ring2",r),this._render();return}this._showRingPicker(m,e,r);return}let a=e.slot;a||(f?a="weapon":a=e.subtype),this._doEquip(m,e,a,r),this._render()}_wireEvents(){var e;(e=this._el.querySelector("#inv-close"))==null||e.addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()});const o=this._el.querySelector("#inv-autoequip");o&&o.addEventListener("click",()=>{if(j())return;this.audio.playSfx("click");const t=$.get(),a=[...t.party,...t.companions,...t.bench||[]][this._selectedCharIdx];if(!a)return;if(a.autoEquip){a.autoEquip=!1,this._render();return}const c=()=>{a.autoEquip=!0,ce(a,t,this.audio),this._render()};if(t.autoModeAccepted){c();return}se({title:"Enable Auto-Equip?",message:"Auto-equip will automatically equip upgrades for this character as they appear. Items you manually unequip are remembered and skipped. You can turn this off at any time.",confirmText:"Enable Auto",cancelText:"Cancel",onConfirm:()=>{t.autoModeAccepted=!0,c()}})}),this._el.querySelectorAll(".char-tab").forEach(t=>{t.addEventListener("click",()=>{this.audio.playSfx("click");const a=this._el.querySelector(".inv-items-panel")||this._el.querySelector(".equip-panel");a&&this._charScrollPos.set(this._selectedCharIdx,a.scrollTop),this._selectedCharIdx=parseInt(t.dataset.idx),this._render(),requestAnimationFrame(()=>{var c,u;const s=((c=this._el)==null?void 0:c.querySelector(".inv-items-panel"))||((u=this._el)==null?void 0:u.querySelector(".equip-panel"));s&&(s.scrollTop=this._charScrollPos.get(this._selectedCharIdx)||0)})})}),this._el.querySelectorAll("[data-equip]").forEach(t=>{t.addEventListener("click",()=>{var a,c,u,s,b,_;this.audio.playSfx("click");const x=t.dataset.equip,g=$.get(),v=[...g.party,...g.companions][this._selectedCharIdx],y=g.inventory.find(S=>S.id===x);if(!v||!y)return;if(v.isCompanion&&v.class==="companion"){this._showInfoModal("Companions cannot equip items.");return}const q=y.type==="weapon",T=y.twoHanded,L=y.offHandOk||!T&&q;if(q&&!T&&L){const S=!!((a=v.equipment)!=null&&a.weapon),C=!!((c=v.equipment)!=null&&c.offhand),h=(s=(u=v.equipment)==null?void 0:u.weapon)==null?void 0:s.twoHanded;if(!S){this._doEquip(v,y,"weapon",g),this._render();return}if(!C&&!h){this._doEquip(v,y,"offhand",g),this._render();return}this._showSlotPicker(v,y,g);return}if(y.subtype==="ring"){const S=!!((b=v.equipment)!=null&&b.ring1),C=!!((_=v.equipment)!=null&&_.ring2);if(!S){this._doEquip(v,y,"ring1",g),this._render();return}if(!C){this._doEquip(v,y,"ring2",g),this._render();return}this._showRingPicker(v,y,g);return}let I=y.slot;I||(q?I="weapon":I=y.subtype),this._doEquip(v,y,I,g),this._render()})}),this._el.querySelectorAll("[data-slot]").forEach(t=>{t.dataset.itemid&&t.addEventListener("click",()=>{var a;const c=$.get(),u=[...c.party,...c.companions][this._selectedCharIdx],s=t.dataset.slot;if(!((a=u==null?void 0:u.equipment)!=null&&a[s]))return;this.audio.playSfx("click");const b=u.equipment[s];$.markManuallyUnequipped(b.id),$.addToInventoryRaw(b),delete u.equipment[s],U(u),this._render()})});const n=this._el.querySelector("#inv-tt"),d=n==null?void 0:n.querySelector(".inv-tt-body"),l=n==null?void 0:n.querySelector(".inv-tt-close"),p=()=>{const t=$.get(),a=[...t.party,...t.companions,...t.bench||[]];return{gs:t,char:a[this._selectedCharIdx]}},i=t=>{const{gs:a,char:c}=p();return a.inventory.find(u=>u.id===t)||Object.values((c==null?void 0:c.equipment)||{}).find(u=>(u==null?void 0:u.id)===t)},r=t=>{var a;if(!d||!t)return;const{gs:c,char:u}=p();if(this._compareMode){const s=this._vsItemForCompare(u,t),b=(s==null?void 0:s.vs)||null,_=(s==null?void 0:s.slot)||null;let x=null;s!=null&&s.hasSecondary&&(x=this._isTouch?'Tap "Compare 2nd" below to compare against the other slot.':"Hold Alt+Shift to compare against the other slot.");let g="";if(this._isTouch&&(g+=`<div class="tt-breadcrumb">Inventory <span class="bc-sep">›</span> ${t.name} <span class="bc-sep">›</span> <strong>Compare</strong></div>`),g+=re(t,b,{hero:u,slotLabel:_,secondaryHint:x}),this._isTouch){const v=!!((a=c==null?void 0:c.inventory)!=null&&a.find(y=>y.id===t.id));g+=`<div class="tt-cmp-actions">
            <button type="button" class="tt-cmp-btn" data-cmp-action="exit">Back</button>
            ${s!=null&&s.hasSecondary?'<button type="button" class="tt-cmp-btn" data-cmp-action="secondary">Compare 2nd</button>':""}
            ${v?'<button type="button" class="tt-cmp-btn primary" data-cmp-action="equip">Equip</button>':""}
          </div>`}d.innerHTML=g}else{let s="";if(this._isTouch&&(s+=`<div class="tt-breadcrumb">Inventory <span class="bc-sep">›</span> <strong>${t.name}</strong></div>`),s+=R(t,u),this._isTouch){const b=this._slotsForItem(u,t),_=!!$.get().inventory.find(x=>x.id===t.id);b.length&&(s+=`<div class="tt-cmp-actions">
              ${b.length?'<button type="button" class="tt-cmp-btn" data-cmp-action="enter">Compare</button>':""}
              ${_?'<button type="button" class="tt-cmp-btn primary" data-cmp-action="equip">Equip</button>':""}
            </div>`)}d.innerHTML=s}d.querySelectorAll("[data-cmp-action]").forEach(s=>{s.addEventListener("click",b=>{var _;b.stopPropagation();const x=s.dataset.cmpAction;if(x==="enter"){if(window.matchMedia("(max-width: 700px)").matches){const g=this._currentTooltipItem,{gs:v,char:y}=p(),q=this._vsItemForCompare(y,g),T=(q==null?void 0:q.vs)||null,L=(q==null?void 0:q.slot)||null,I=!!(q!=null&&q.hasSecondary),S=!!((_=v==null?void 0:v.inventory)!=null&&_.find(C=>C.id===(g==null?void 0:g.id)));f(),this._openCompareModal(g,T,{hero:y,slotLabel:L,hasSecondary:I,inInv:S,onEquip:C=>{this._equipItemFlow(C)}});return}this._compareMode=!0,this._compareSecondary=!1}else if(x==="exit")this._compareMode=!1,this._compareSecondary=!1;else if(x==="secondary")this._compareSecondary=!this._compareSecondary;else if(x==="equip"){this.audio.playSfx("click");const g=this._currentTooltipItem;f(),this._equipItemFlow(g);return}this._currentTooltipItem&&r(this._currentTooltipItem)})})},m=(t,a,c,u)=>{if(!n||!t)return;this._currentTooltipItem=t,r(t),n.style.display="block",n.classList.toggle("touch-open",!!u);const s=8,b=window.innerWidth,_=window.innerHeight;n.style.left=Math.max(s,a+12)+"px",n.style.top=Math.max(s,c+12)+"px";const x=n.getBoundingClientRect();let g=x.left,v=x.top;x.right>b-s&&(g=Math.max(s,b-x.width-s)),x.bottom>_-s&&(v=Math.max(s,_-x.height-s)),n.style.left=g+"px",n.style.top=v+"px"},f=()=>{n&&(n.style.display="none",n.classList.remove("touch-open"),this._currentTooltipItem=null,this._isTouch||(this._compareMode=!1,this._compareSecondary=!1))};l==null||l.addEventListener("click",t=>{t.stopPropagation(),f()});const w=(t,a)=>{for(const c of t){const u=this._el.querySelector(`.equip-slot[data-slot="${c}"]`);u&&u.classList.toggle("slot-hover",a)}};if(this._el.querySelectorAll(".inv-item-card, .es-item").forEach(t=>{t.addEventListener("pointerenter",a=>{if(a.pointerType==="touch"||a.pointerType==="pen")return;const c=t.dataset.id||t.dataset.itemid,u=i(c);if(u){if(t.classList.contains("inv-item-card")){const{char:s}=p(),b=this._slotsForItem(s,u);w(b,!0),t._hoverSlots=b}this._isTouch||(this._compareMode=!!a.altKey,this._compareSecondary=!!(a.altKey&&a.shiftKey)),m(u,a.clientX,a.clientY,!1)}}),t.addEventListener("pointerleave",a=>{a.pointerType==="touch"||a.pointerType==="pen"||(t._hoverSlots&&(w(t._hoverSlots,!1),t._hoverSlots=null),f())}),t.addEventListener("click",a=>{if(!(a.pointerType==="touch"||a.pointerType==="pen"||this._isTouch)||a.target.closest&&a.target.closest(".iic-equip-btn"))return;const c=t.dataset.id||t.dataset.itemid,u=i(c);if(!u)return;const s=t.getBoundingClientRect();m(u,s.left,s.bottom,!0)})}),!this._isTouch&&n&&!n._altBound){n._altBound=!0;const t=a=>{if(n.style.display==="none"||!this._currentTooltipItem||a.key!=="Alt"&&a.key!=="Shift")return;const c=!!a.altKey||a.type==="keydown"&&a.key==="Alt",u=c&&(!!a.shiftKey||a.type==="keydown"&&a.key==="Shift"),s=a.type==="keyup"?a.key==="Alt"?!1:!!a.altKey:c,b=a.type==="keyup"?a.key==="Shift"?!1:!!a.altKey&&!!a.shiftKey:u;this._compareMode===s&&this._compareSecondary===b||(this._compareMode=s,this._compareSecondary=b,r(this._currentTooltipItem))};window.addEventListener("keydown",t),window.addEventListener("keyup",t),n._altKeyHandler=t}n&&!n._outsideBound&&(n._outsideBound=!0,document.addEventListener("click",t=>{var a,c;n.style.display!=="none"&&n.classList.contains("touch-open")&&(n.contains(t.target)||(c=(a=t.target).closest)!=null&&c.call(a,".inv-item-card, .es-item")||f())},!0))}onPause(){this._el&&(this._el.style.display="none")}onResume(){this._el&&(this._el.style.display="")}update(){}draw(){}onExit(){const e=$.get();e.inventoryContext=null,E(this._el),this._el=null}destroy(){E(this._el),this._el=null}}const pe=`
/* M322: button-style auto-toggle, mirrors the SkillTreeScreen .auto-toggle.
   Defined here so the inventory screen renders consistently even before the
   SkillTreeScreen is mounted in a session. */
.auto-toggle {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.65rem; min-height: 36px; border-radius: 6px;
  background: rgba(20,12,28,0.7); border: 1px solid rgba(232,160,32,0.2);
  color: #8a7a6a; font-size: 0.7rem; font-weight: 600; cursor: pointer;
  letter-spacing: 0.05em; font-family: inherit;
}
.auto-toggle:hover { border-color: rgba(232,160,32,0.45); color: #e8a020; }
.auto-toggle.on { border-color: rgba(72,176,96,0.6); color: #6dd180; background: rgba(72,176,96,0.1); }
.auto-toggle .auto-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  background: #48b060; color: #06200d; font-size: 10px; font-weight: 800;
  line-height: 1;
}
/* M384 — unchecked state: gold outline circle, no background. */
.auto-toggle .auto-check.auto-off {
  background: transparent;
  border: 1px solid rgba(232,160,32,0.7);
  color: transparent;
  font-weight: 400;
}
/* M406 — inline: panel label immediately followed by Auto toggle (not far-right). */
.panel-label-row {
  display: flex; align-items: center; justify-content: flex-start;
  gap: 0.5rem; flex-wrap: wrap;
}
.panel-label-row .auto-toggle { margin: 0; }
.inv-screen {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: linear-gradient(180deg,#0a0608,#120a10); color: #f0e8d8;
  font-family: 'Inter', sans-serif;
}
.inv-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 1rem; border-bottom: 1px solid rgba(232,160,32,0.15);
  background: rgba(0,0,0,0.3); flex-shrink: 0; gap: 0.5rem;
}
.inv-char-tabs { display: flex; gap: 0.4rem; overflow-x: auto; }
.char-tab {
  padding: 0.4rem 0.85rem; background: rgba(26,18,24,0.6);
  border: 1px solid rgba(232,160,32,0.1); border-radius: 6px;
  color: #8a7a6a; font-size: 0.75rem; cursor: pointer; min-height: 44px; text-align: center;
  transition: all 0.2s;
}
.char-tab.active { border-color: rgba(232,160,32,0.5); color: #e8a020; background: rgba(232,160,32,0.08); }
.char-tab small { font-size: 0.6rem; }
.inv-close { background: none; border: none; color: #8a7a6a; cursor: pointer; font-size: 0.85rem; padding: 0.4rem 0.6rem; min-height: 36px; }
.inv-close:hover { color: #f0e8d8; }
.inv-layout { flex: 1; display: grid; grid-template-columns: 260px 1fr; overflow: hidden; }
@media (max-width: 600px) { .inv-layout { grid-template-columns: 1fr; } .equip-panel { display: none; } }
.panel-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.6rem; }
.inv-char-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; }
.inv-portrait-wrap { width: 80px; height: 80px; padding: 5px; box-sizing: border-box; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
.inv-portrait { border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px solid rgba(232,160,32,0.25); width: 100% !important; height: 100% !important; }
.inv-class-icon { margin-left: 4px; vertical-align: middle; display: inline-flex; }
.inv-char-identity { flex: 1; }
/* M312 #37: 0.6rem bottom margin to match .panel-label spacing */
.inv-char-class { font-size: 0.72rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.6rem; }
.inv-char-name { font-family: 'Cinzel', Georgia, serif; font-size: 0.95rem; color: #f0e8d8; letter-spacing: 0.04em; display: flex; align-items: center; gap: 0.4rem; }
.equip-panel {
  padding: 1rem; border-right: 1px solid rgba(232,160,32,0.1);
  overflow-y: auto; display: flex; flex-direction: column; gap: 1rem;
}
.equip-slots { display: flex; flex-direction: column; gap: 0.35rem; }
.equip-slot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.45rem 0.65rem; background: rgba(26,18,24,0.5);
  border: 1px solid rgba(255,255,255,0.05); border-radius: 5px; min-height: 40px;
}
.equip-slot.has-item { border-color: rgba(232,160,32,0.15); cursor: pointer; }
.equip-slot.has-item:hover { border-color: rgba(232,160,32,0.4); }
.es-label { font-size: 0.65rem; color: #8a7a6a; min-width: 55px; }
.es-item { flex: 1; text-align: right; }
.esi-name { font-size: 0.72rem; font-weight: 600; }
.esi-stat { font-size: 0.62rem; color: #8a7a6a; }
.es-empty { font-size: 0.65rem; color: #3a2a22; }
.char-stats-panel { margin-top: 0.5rem; }
.stat-row { display: flex; justify-content: space-between; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.75rem; }
.sr-label { color: #8a7a6a; }
.sr-val { font-family: 'Cinzel', serif; font-weight: 700; color: #e8a020; }
.inv-items-panel { padding: 1rem; overflow-y: auto; }
.inv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.6rem; }
.inv-item-card {
  position: relative; padding: 0.75rem; background: rgba(26,18,24,0.7);
  border: 1px solid rgba(232,160,32,0.08); border-radius: 8px;
  transition: border-color 0.15s; overflow: hidden;
}
.inv-item-card:hover { border-color: rgba(232,160,32,0.3); }
.iic-rarity-bar { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
.iic-name { font-size: 0.78rem; font-weight: 600; margin-bottom: 0.15rem; }
.iic-type { font-size: 0.62rem; color: #8a7a6a; text-transform: capitalize; }
.iic-stat { font-size: 0.68rem; color: #c0b090; margin-top: 0.2rem; }
.iic-quality { font-size: 0.6rem; color: #6a5a52; text-transform: capitalize; }
/* M305: set and unique item card markers */
.iic-set-tag { font-size: 0.58rem; font-weight: 700; color: #b060ff; letter-spacing: 0.06em; text-transform: uppercase; }
.iic-unique-tag { font-size: 0.58rem; font-weight: 700; color: #ff8020; letter-spacing: 0.06em; text-transform: uppercase; }
.inv-item-card.iic-set { border-color: rgba(176,96,255,0.25); }
.inv-item-card.iic-set:hover { border-color: rgba(176,96,255,0.5); }
.inv-item-card.iic-unique { border-color: rgba(255,128,32,0.25); }
.inv-item-card.iic-unique:hover { border-color: rgba(255,128,32,0.5); }
.iic-equip-btn {
  margin-top: 0.5rem; width: 100%; padding: 0.3rem; background: rgba(232,160,32,0.1);
  border: 1px solid rgba(232,160,32,0.25); border-radius: 4px;
  color: #e8a020; font-size: 0.7rem; font-weight: 600; cursor: pointer; min-height: 28px;
}
.iic-equip-btn:hover { background: rgba(232,160,32,0.22); }
.inv-empty { grid-column: 1/-1; text-align: center; padding: 3rem 2rem; font-size: 0.85rem; color: #4a3a32; }
.inv-tooltip {
  position: fixed; z-index: 1000; pointer-events: none;
  background: rgba(10,6,8,0.95); border: 1px solid rgba(232,160,32,0.4);
  border-radius: 8px; padding: 0.75rem 1rem; font-size: 0.8rem;
  line-height: 1.7;
  max-width: min(420px, calc(100vw - 16px));
  /* M374: bound tooltip height + scroll. On iPhone, an item with many
     affixes + the Equip/Compare buttons could extend below the viewport
     and the buttons became unreachable. Now the tooltip itself scrolls. */
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  color: #f0e8d8;
  box-sizing: border-box;
}
.inv-tooltip.touch-open { pointer-events: auto; padding-right: 2rem; }
/* M348 — close button enlarged to 36px (was 24px which was below the
   44-target threshold AND visually disappeared on iPhone because it
   sat under the safe-area inset). Padding shifted so it stays visible
   even when the tooltip scrolls. */
.inv-tooltip .inv-tt-close {
  position: sticky; top: 0; float: right;
  width: 40px; height: 40px;
  border: 1px solid rgba(232,160,32,0.45);
  background: rgba(232,160,32,0.22); color: #f8d880;
  border-radius: 6px; font-size: 1.2rem; line-height: 1; cursor: pointer;
  display: none; align-items: center; justify-content: center; padding: 0;
  margin: -0.4rem -0.5rem 0.3rem 0.4rem;
  z-index: 2;
}
.inv-tooltip.touch-open .inv-tt-close { display: inline-flex; }
.inv-tooltip .inv-tt-close:hover { background: rgba(232,160,32,0.35); color: #fff; }
.inv-tooltip .tt-affix { white-space: nowrap; }
.slot-picker-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0.72); z-index: 200;
  display: flex; align-items: center; justify-content: center;
}
.spo-box {
  background: #12090f; border: 1px solid rgba(232,160,32,0.3); border-radius: 12px;
  padding: 1.75rem; text-align: center; max-width: 300px; width: 90%;
}
.spo-title { font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #f0e8d8; margin-bottom: 0.4rem; }
.spo-item-name { font-size: 0.85rem; font-weight: 600; margin-bottom: 1.25rem; }
.spo-actions { display: flex; gap: 0.7rem; margin-bottom: 0.8rem; }
.spo-btn {
  flex: 1; padding: 0.75rem 0.5rem; background: rgba(232,160,32,0.1);
  border: 1px solid rgba(232,160,32,0.35); border-radius: 8px;
  color: #e8a020; font-family: 'Cinzel', serif; font-size: 0.82rem; font-weight: 700;
  cursor: pointer; min-height: 64px; line-height: 1.4; transition: background 0.15s;
}
.spo-btn:hover:not(:disabled) { background: rgba(232,160,32,0.22); }
.spo-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.spo-cancel { background: none; border: none; color: #8a7a6a; cursor: pointer; font-size: 0.78rem; min-height: 36px; }
.spo-cancel:hover { color: #f0e8d8; }
.equip-slot.slot-disabled { opacity: 0.35; pointer-events: none; }
.equip-slot.slot-disabled .es-label::after { content: ' [2H]'; color: #c04030; font-size: 0.58rem; }
.equip-slot.slot-companion.slot-disabled .es-label::after { content: ''; }
.es-companion-tag { color: #6a5a52; font-size: 0.58rem; margin-left: 0.25rem; }

/* U8 — slot-hover highlight when user is hovering a fitting inventory item */
.equip-slot.slot-hover {
  border-color: rgba(96,208,128,0.7) !important;
  background: rgba(96,208,128,0.08);
  box-shadow: 0 0 8px rgba(96,208,128,0.35);
}

/* U8 — upgrade glow tiers on inventory cards */
.inv-item-card.upgrade-empty {
  border: 2px solid #60d080;
  box-shadow: 0 0 12px rgba(96,208,128,0.45);
}
.inv-item-card.upgrade-minor {
  border: 1px solid rgba(96,208,128,0.25);
}
.inv-item-card.upgrade-medium {
  border: 1px solid rgba(96,208,128,0.55);
  box-shadow: 0 0 8px rgba(96,208,128,0.30);
}
.inv-item-card.upgrade-major {
  border: 2px solid rgba(96,208,128,0.85);
  box-shadow: 0 0 14px rgba(96,208,128,0.55);
}
.inv-item-card.upgrade-huge {
  border: 2px solid #fff;
  animation: invShimmer 1s linear infinite;
}
@keyframes invShimmer {
  0%   { border-color: #60d080; box-shadow: 0 0 14px rgba(96,208,128,0.7); }
  33%  { border-color: #60a8e8; box-shadow: 0 0 14px rgba(96,168,232,0.7); }
  66%  { border-color: #e8c860; box-shadow: 0 0 14px rgba(232,200,96,0.7); }
  100% { border-color: #60d080; box-shadow: 0 0 14px rgba(96,208,128,0.7); }
}

/* U8 — compare-mode tooltip groups + touch action buttons */
.inv-tooltip .tt-cmp-vs { font-style: italic; }
.inv-tooltip .tt-cmp-hdr { display: inline-block; margin-top: 0.35rem; font-weight: 600; letter-spacing: 0.04em; }
.inv-tooltip .tt-cmp-actions {
  display: flex; gap: 0.4rem; margin-top: 0.6rem;
  /* M374: stick action buttons to the bottom of the scrollable tooltip so
     Equip / Compare are always reachable without scrolling. */
  position: sticky; bottom: -0.5rem;
  background: rgba(10,6,8,0.95);
  padding: 0.4rem 0;
  margin-bottom: -0.5rem;
}
/* M348 — Equip / Compare buttons bumped to 44px tap target. Below the
   threshold iOS sometimes suppresses the synthesized click that follows
   touchend, which the user reported as "buttons do nothing on iPhone." */
.inv-tooltip .tt-cmp-btn {
  flex: 1; padding: 0.6rem 0.7rem; background: rgba(232,160,32,0.12);
  border: 1px solid rgba(232,160,32,0.35); border-radius: 6px;
  color: #e8a020; font-size: 0.85rem; font-weight: 600; cursor: pointer;
  min-height: 44px;
}
.inv-tooltip .tt-cmp-btn:hover { background: rgba(232,160,32,0.24); }
.inv-tooltip .tt-cmp-btn.primary { background: rgba(96,208,128,0.14); border-color: rgba(96,208,128,0.5); color: #b0e8c0; }
.inv-tooltip .tt-cmp-btn.primary:hover { background: rgba(96,208,128,0.26); }
.inv-tooltip .tt-breadcrumb {
  font-size: 0.7rem; color: #8a7a6a; letter-spacing: 0.02em; margin-bottom: 0.5rem;
  padding-bottom: 0.4rem; border-bottom: 1px solid rgba(232,160,32,0.12);
}
.inv-tooltip .tt-breadcrumb strong { color: #e8a020; font-weight: 600; }
.inv-tooltip .tt-breadcrumb .bc-sep { color: #4a3a32; margin: 0 0.3rem; }
@media (max-width: 720px) {
  .iic-equip-btn { display: none !important; }
  .inv-item-card { cursor: pointer; }
}
`;export{be as InventoryScreen};
