import{k as $,o as j,E as ct,J as pt,x as G,U as J,H as ut,Z as mt,a as gt,c as W,A as V,f as dt,B as Q,C as K,w as bt,D as q,r as Y,q as Z,O as tt,G as ht,Y as et,i as ft,z as vt,g as kt,j as at,m as xt,l as st,$ as yt,u as $t}from"./play-QH26u79V.js";import{showConfirmModal as it}from"./ConfirmModal-CGAPXyvG-BoJVsT_M.js";import"./savesClient-Lt_9u8Ks-B0TWHWS2.js";let R=null;function nt(){R&&R.parentNode&&R.parentNode.removeChild(R),R=null}function wt(u,e){const l=e.getBoundingClientRect(),r=u.getBoundingClientRect();let c=l.left+l.width/2-r.width/2,t=l.top-r.height-10;c<10&&(c=10),c+r.width>window.innerWidth-10&&(c=window.innerWidth-r.width-10),t<10&&(t=l.bottom+10),u.style.left=`${c}px`,u.style.top=`${t}px`}function lt(u,e,l={}){if(!u)return()=>{};const r=l.className||"rsg-tooltip",c=n=>{nt();const b=e();if(!b)return;const h=document.createElement("div");h.className=r,h.innerHTML=b,document.body.appendChild(h),R=h,wt(h,n.currentTarget||u)},t=()=>nt();u.addEventListener("mouseenter",c),u.addEventListener("mouseleave",t);let o=null;const s=n=>{clearTimeout(o),o=setTimeout(()=>c(n),350)},a=()=>{clearTimeout(o),setTimeout(t,1500)},i=()=>{clearTimeout(o),t()};return u.addEventListener("touchstart",s,{passive:!0}),u.addEventListener("touchend",a),u.addEventListener("touchcancel",i),()=>{u.removeEventListener("mouseenter",c),u.removeEventListener("mouseleave",t),u.removeEventListener("touchstart",s),u.removeEventListener("touchend",a),u.removeEventListener("touchcancel",i),clearTimeout(o)}}function ot(){if(document.getElementById("rsg-tooltip-styles"))return;const u=document.createElement("style");u.id="rsg-tooltip-styles",u.textContent=`
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
  `,document.head.appendChild(u)}function _t(u){return u==="magic"?"Magic Damage":u==="light"?"Light Damage":"Heavy Damage"}function St(u,e={}){const{withSpendButtons:l=!1,pendingAttrPoints:r=0,includeHeader:c=!1,headerLabel:t=l?"Attributes":"Character Stats",baseToggleId:o="stats-base-chk"}=e;if(!u)return'<div class="stat-row"><span>No character selected</span></div>';const s=u.baseAttrs||u.attrs||{STR:8,DEX:8,INT:8,CON:8},a=u.attrs||s,i=ft(),n=u.equipment||{};let b=0;for(const p of Object.values(n))p!=null&&p.armor&&(b+=p.armor);const h=0,g=dt(u);b+=g.armor||0;const v=vt(n),k=i?s:{STR:(a.STR||8)+(g.str||0),DEX:(a.DEX||8)+(g.dex||0),INT:(a.INT||8)+(g.int||0),CON:(a.CON||8)+(g.con||0)},d=kt(n)+(g.dmg||0),m=at(k,i?0:d,v),f=at(s,0,v),w=_t(v),B=i?0:g.magicResist||0,T=(p,y)=>({hp:y?Y(u):50+p.CON*10,mp:y?Z(u):30+p.INT*8,hit:Math.min(95,70+Math.round(p.DEX*1.2)+(y&&g.hit||0)),dodge:Math.min(40,5+Math.round(p.DEX*.8)+(y&&g.dodge||0)),spl:+(p.INT*.025+(y&&g.spellPower||0)).toFixed(2)}),x=T(i?s:k,!i),C=T(s,!1),S=i?h:b,X=i?0:xt(u).resistAll||0,E=st(S,X),I=st(h,0),_=(p,y,M)=>{const z=$t(y,M,p);return z?` style="color:${z}"`:""},N=["STR","DEX","INT","CON"].map(p=>{const y=p.toLowerCase(),M=k[p],z=_(y,M,s[p]);if(l){const U=r>0;return`
        <div class="stat-row stat-row-attr">
          <span class="sr-label stat-label" data-stat="${p}">${p}</span>
          <span class="sr-val"${z}>${Math.floor(M)}</span>
          <button type="button" class="sr-attr-btn${U?"":" disabled"}" data-attr="${p}" ${U?"":"disabled"} aria-label="Increase ${p}">+1</button>
        </div>`}return`<div class="stat-row"><span class="sr-label stat-label" data-stat="${p}">${p}</span><span class="sr-val"${z}>${Math.floor(M)}</span></div>`}).join(""),A=new Set(["str","dex","int","con","hp","mp","dmg","armor","hit","dodge","magicresist","magicResist","spellpower","spellPower"]),L={goldFind:"Gold Find",xpFind:"XP Find",manaRegen:"Mana Regen",lifeSteal:"Life Steal",manaSteal:"Mana Steal",initiative:"Initiative",critChance:"Crit Chance",critDamage:"Crit Damage",spellPower:"Spell Power",tradePrices:"Trade Prices"},P=[];if(!i){try{const p=yt(u);if((p==null?void 0:p.blockChance)>0){const y=`+${(p.blockChance*100).toFixed(1).replace(/\.0$/,"")}%`;P.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Chance">Block Chance</span><span class="sr-val" style="color:#6db3ff">${y}</span></div>`)}(p==null?void 0:p.blockPower)>0&&P.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Power">Block Power</span><span class="sr-val" style="color:#6db3ff">+${Math.round(p.blockPower)}</span></div>`)}catch{}for(const p of Object.keys(g)){if(A.has(p)||A.has(p.toLowerCase()))continue;const y=g[p];if(!y)continue;const M=L[p]||p.replace(/([A-Z])/g," $1").replace(/^./,U=>U.toUpperCase()),z=(p==="goldFind"||p==="xpFind"||p==="critChance"||p==="critDamage"||p==="tradePrices")&&Math.abs(y)<=3?`+${(y*100).toFixed(1).replace(/\.0$/,"")}%`:p==="lifeSteal"||p==="manaSteal"?`+${Math.round(y*10)/10}%`:`+${Math.round(y*100)/100}`;P.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="${M}">${M}</span><span class="sr-val" style="color:#6db3ff">${z}</span></div>`)}}const D=P.length?P.join(""):'<div class="stat-row"><span class="sr-label" style="color:#5a4a42;font-style:italic">None</span><span class="sr-val" style="color:#5a4a42">—</span></div>',F=c?`<div class="panel-label">${t}</div>`:"",O=`<button type="button" class="auto-toggle stats-base-toggle${i?" on":""}" id="${o}" aria-pressed="${i?"true":"false"}" title="Show base attributes (without item bonuses)">${i?'<span class="auto-check" aria-hidden="true">✓</span>':'<span class="auto-check auto-off" aria-hidden="true">○</span>'}Show Base Attributes</button>`,H=`
    <div class="stat-row"><span class="sr-label stat-label" data-stat="HP">HP</span><span class="sr-val"${_("hp",x.hp,C.hp)}>${Math.floor(x.hp)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Mana">Mana</span><span class="sr-val"${_("mp",x.mp,C.mp)}>${Math.floor(x.mp)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Armor">Armor</span><span class="sr-val"${_("armor",S,h)}>${Math.floor(S)}</span></div>
    <div class="stat-row" title="Armor ${(E.armorDr*100).toFixed(1)}% + Misc ${(E.miscDr*100).toFixed(1)}% (multiplicative)"><span class="sr-label stat-label" data-stat="Damage Reduction">Damage Reduction</span><span class="sr-val"${_("dmgReduction",E.totalDr,I.totalDr)}>${(E.totalDr*100).toFixed(1)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Magic Resist">Magic Resist</span><span class="sr-val"${_("magicResist",B,0)}>${Math.floor(B)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Hit">Hit</span><span class="sr-val"${_("hit",x.hit,C.hit)}>${Math.floor(x.hit)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Dodge">Dodge</span><span class="sr-val"${_("dodge",x.dodge,C.dodge)}>${Math.floor(x.dodge)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="${w}">${w}</span><span class="sr-val"${_("dmg",m[1],f[1])}>${Math.floor(m[0])}-${Math.floor(m[1])}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Spell Power">Spell Power</span><span class="sr-val"${_("spellPower",x.spl,C.spl)}>+${Math.round(x.spl*100)}%</span></div>
  `;return l?`
      ${F}
      ${O}
      <div class="cs-stats-grid">
        <div class="cs-section cs-section-attrs">
          <div class="panel-label">Attributes</div>
          ${N}
        </div>
        <div class="cs-section cs-section-derived">
          <div class="panel-label">Derived Stats</div>
          ${H}
          <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
          ${D}
        </div>
      </div>
    `:`
    ${F}
    ${O}
    <div class="cs-stats-grid">
      <div class="cs-section cs-section-derived">
        ${H}
      </div>
      <div class="cs-section cs-section-attrs">
        <div class="panel-label">Attributes</div>
        ${N}
        <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
        ${D}
      </div>
    </div>
  `}function Pt(u,e){if(!e||!e.autoBuild)return!1;for(const l of u||[])if(l&&l!==e&&l.autoBuild===e.autoBuild)return!0;return!1}const rt={active:"auto_active",passive:"auto_passive",attrs:"auto_attrs"},Mt={active:"pendingSkillPoints",passive:"pendingPassivePoints",attrs:"pendingAttrPoints"},Ct={active:"Auto-spend talent points",passive:"Auto-spend passive points",attrs:"Auto-spend attribute points"},At={active:"Talent points will be auto-spent on each level-up using the class default order. You will not get a chance to pick talents yourself until you turn this off.",passive:"Passive points will be auto-spent on each level-up using the class default order. You will not get to choose which passives to learn until you turn this off.",attrs:"Attribute points will be auto-spent on each level-up using the class default priority. You will not get to choose which attributes to raise until you turn this off."};function zt(u){if(!u||typeof u!="object")return[];const e=[],l=t=>`${Math.round(t*100)}%`,r=t=>`${t} round${t===1?"":"s"}`,c={targets:t=>`Hits ${t} targets`,damageMult:t=>`Damage: ${t}x multiplier`,damage_mult:t=>`Damage: ${t}x multiplier`,dmgBuff:t=>`+${l(t)} party damage`,dmgReduct:t=>`-${l(t)} damage taken`,reflect:t=>`Reflects ${l(t)} damage back`,duration:t=>`Lasts ${r(t)}`,aoe:t=>`Area: ${t}`,tempHp:t=>`+${t} temporary HP per member`,healMult:t=>`Heals ${t}x multiplier`,attackSpeed:t=>`+${l(t)} attack speed`,mpCost:t=>t<0?`Mana cost -${Math.abs(t)}`:`Mana cost +${t}`,bleed:t=>`Applies Bleed (${r((t==null?void 0:t.duration)??t)})`,statusEffects:t=>Array.isArray(t)?t.map(o=>`${Math.round((o.chance||1)*100)}% chance: ${o.type} (${r(o.duration)})`).join(", "):String(t),status_apply:t=>`Applies ${t}`,immuneStun:t=>t?"Immune to Stun":"",immuneBleed:t=>t?"Immune to Bleed":"",unlocksCompanion:t=>`Unlocks companion: ${t}`};for(const[t,o]of Object.entries(u)){if(o==null||o===!1)continue;const s=c[t];if(s){const a=s(o);a&&e.push(a)}else{const a=t.replace(/_/g," ").replace(/([A-Z])/g," $1").trim(),i=typeof o=="object"?JSON.stringify(o):String(o);e.push(`${a}: ${i}`)}}return e}class It{constructor(e,l){this.manager=e,this.audio=l,this._el=null,this._selectedCharIdx=0,this._selectedSkill=null,this._mobileDetailView=!1,this._tab="active"}onEnter(){try{const e=$.get(),l=(e==null?void 0:e.party)||[];let r=-1;e!=null&&e.skillFocusId&&(r=l.findIndex(t=>t&&t.id===e.skillFocusId),e.skillFocusId=null),r<0&&(r=l.findIndex(t=>t&&(t.pendingSkillPoints||0)+(t.pendingPassivePoints||0)+(t.pendingAttrPoints||0)>0)),r>=0&&(this._selectedCharIdx=r);const c=l[this._selectedCharIdx];c&&!this._tabPinned&&((c.pendingSkillPoints||0)>0?this._tab="active":(c.pendingPassivePoints||0)>0?this._tab="passive":(c.pendingAttrPoints||0)>0&&(this._tab="attrs")),this._tabPinned=!1;for(const t of l){if(!t||!t.autoBuild||j())continue;const o=this._tab;for(const s of["active","passive","attrs"]){if(!t.autoBuild[`auto_${s}`])continue;this._tab=s;const a=this._selectedCharIdx;this._selectedCharIdx=l.indexOf(t);let i=0;for(;this._applyOneRecommended(t)&&i++<200;);this._selectedCharIdx=a}this._tab=o}}catch{}this._build()}_build(){ct("skill-styles",Tt),this._el=pt("div","skill-screen"),this.manager.uiOverlay.appendChild(this._el),this._render()}_render(){var e,l,r,c,t,o;const s=$.get().party,a=s[this._selectedCharIdx],i=a?G(a.class):[],n=a?J(a.class,a.level||1):[],b=(a==null?void 0:a.talentsPurchased)||{},h={};for(const d of[".skill-list-panel",".skill-detail-panel",".passive-panel",".attrs-panel"]){const m=this._el.querySelector(d);m&&(h[d]=m.scrollTop)}const g=window.scrollY||document.documentElement.scrollTop,v=document.activeElement;if(v&&v!==document.body&&typeof v.blur=="function")try{v.blur()}catch{}this._el.innerHTML=`
      <div class="skill-header">
        <div class="skill-char-tabs" id="skill-char-tabs">
          ${s.map((d,m)=>{const f=(d.pendingSkillPoints||0)+(d.pendingPassivePoints||0)+(d.pendingAttrPoints||0),w=f>0&&m!==this._selectedCharIdx;return`
            <button type="button" class="sct-tab${m===this._selectedCharIdx?" active":""}" data-idx="${m}">
              <span class="sct-portrait">${ut(d,24)}</span>
              ${d.name} ${mt(d,12,"sct-class-icon")}<br><small>${d.className||d.class} Lv${d.level||1}</small>
              ${w?`<span class="sct-badge">${f>9?"9+":f}</span>`:""}
            </button>`}).join("")}
        </div>
        <div class="skill-header-btns">
          ${this._mobileDetailView?'<button type="button" class="skill-back-mobile" id="skill-back-mobile">← Back</button>':""}
          <button type="button" class="skill-close" id="skill-close">✕</button>
        </div>
      </div>
      <div class="skill-mode-tabs">
        <button type="button" class="smt-tab${this._tab==="active"?" active":""}${(e=a==null?void 0:a.autoBuild)!=null&&e.auto_active?" auto-on":""}" data-mode="active">
          Spells${a&&(a.pendingSkillPoints||0)>0?` <span class="smt-badge" title="Unspent talent points — click an option to spend">+${a.pendingSkillPoints}</span>`:""}${(l=a==null?void 0:a.autoBuild)!=null&&l.auto_active?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
        <button type="button" class="smt-tab${this._tab==="passive"?" active":""}${(r=a==null?void 0:a.autoBuild)!=null&&r.auto_passive?" auto-on":""}" data-mode="passive">
          Passive${a&&(a.pendingPassivePoints||0)>0?` <span class="smt-badge" title="Unspent passive points — click an option to spend">+${a.pendingPassivePoints}</span>`:""}${(c=a==null?void 0:a.autoBuild)!=null&&c.auto_passive?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
        <button type="button" class="smt-tab${this._tab==="attrs"?" active":""}${(t=a==null?void 0:a.autoBuild)!=null&&t.auto_attrs?" auto-on":""}" data-mode="attrs">
          Attributes${a&&(a.pendingAttrPoints||0)>0?` <span class="smt-badge" title="Unspent attribute points — click an option to spend">+${a.pendingAttrPoints}</span>`:""}${(o=a==null?void 0:a.autoBuild)!=null&&o.auto_attrs?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
      </div>
      ${this._tab==="attrs"?this._renderAttrsPanel(a):this._tab==="passive"?this._renderPassivePanel(a):`
      <div class="skill-layout${this._mobileDetailView?" mobile-detail-open":""}">
        <!-- Skill list -->
        <div class="skill-list-panel">
          <div class="skill-panel-head">
            <div class="panel-label">Spells</div>
            ${a?this._renderAutoToggle(a,"active"):""}
          </div>
          ${a?`<div class="passive-points-banner pp-banner-compact" style="margin-bottom:0.65rem" title="Unspent talent points — click an option to spend"><span class="pp-num pp-num-fixed">+${a.pendingSkillPoints||0}</span><span class="pp-tip-pop">Unspent talent points — click an option to spend</span></div>`:""}
          ${i.map(d=>{const m=n.find(f=>f.name===d.name);return`
              <div class="skill-row${m?"":" locked"}${this._selectedSkill===d.name?" selected":""}" data-skill="${d.name}">
                <div class="sk-level-badge">Lv${d.unlockLevel}</div>
                <div class="sk-info">
                  <div class="sk-name">${d.name}</div>
                  <div class="sk-type">${d.type} · ${d.aoe||d.target||"self"}</div>
                </div>
                <div class="sk-cost">${d.mpCost>0?`${d.mpCost} MP`:"Passive"}</div>
                ${m?"":'<div class="sk-lock-icon">🔒</div>'}
              </div>
            `}).join("")}
        </div>
        <!-- Skill detail / talents -->
        <div class="skill-detail-panel">
          ${this._selectedSkill?this._renderSkillDetail(a,b):`
            <div class="skill-select-prompt">Select a skill to view its description and upgrade talents.</div>
          `}
        </div>
      </div>
      `}
    `,this._wireEvents(),gt(this._el);const k=this._el.querySelector("#skill-stats-base");k&&k.addEventListener("click",()=>{const d=!k.classList.contains("on");W(d),this._render()});for(const d of Object.keys(h)){const m=this._el.querySelector(d);m&&(m.scrollTop=h[d])}window.scrollTo(0,g)}_renderSkillDetail(e,l){var r,c,t,o,s,a,i;const n=Object.values(V).find(m=>m.name===this._selectedSkill);if(!n)return"";const b=n.talents||[],h=(e==null?void 0:e.pendingSkillPoints)||0;let g=null,v=null;if(e){const m=e.attrs||{},f=dt(e),w={STR:(m.STR||8)+(f.str||0),DEX:(m.DEX||8)+(f.dex||0),INT:(m.INT||8)+(f.int||0),CON:(m.CON||8)+(f.con||0)},B=w.INT*.025+(f.spellPower||0);var k=n;try{k=Q(n,e)}catch{}if(n.damageStat){const T=n.damageStat,x=/int|spell/i.test(T)||["fire","ice","lightning","holy","necro","magic"].includes(n.type),C=+k.damageMult||0;let S={};try{S=(typeof K=="function"?(r=K().combat)==null?void 0:r.skill:null)||{}}catch{}const X=S.heroDamageMult??1,E=(((t=(c=e==null?void 0:e.equipment)==null?void 0:c.weapon)==null?void 0:t.weaponCategory)||((s=(o=e==null?void 0:e.equipment)==null?void 0:o.weapon)==null?void 0:s.subtype)||"").toLowerCase(),I=k.damageCategory||(x?"magic":/2h|hammer|maul/.test(E)?"heavy":"light"),_=I==="magic"?S.magicMult??.78:I==="heavy"?S.heavyMult??1:S.lightMult??1,N=C*X*_,A=(a=e==null?void 0:e.equipment)==null?void 0:a.weapon,L=(A==null?void 0:A.damage)||(A==null?void 0:A.dmg)||[],P=L.length===2?(L[0]+L[1])/2:0,D=P,F=Math.round((w.STR||8)*1.5),O=x?B:F*.05,H=x?0:Math.round(P*.1),p=D*N*(1+O)+H;g=Math.max(0,Math.round(p)),n.__estTip={sv:D,finalMult:N,powerBonus:O,weaponFlavor:H,weaponMid:P,isMagic:x,cat:I}}if(n.healStat){const T=n.healStat,x=w[T.toUpperCase()]||0;v=Math.round((+k.healMult||0)*x*(1+B))}}let d=n;try{e&&(d=Q(n,e))}catch{}return`
      <div class="skill-detail-inner">
        <button type="button" class="sd-back-inline" id="sd-back-inline" aria-label="Back to spells list">← Back to spells</button>
        <div class="sd-name">${n.name}</div>
        <div class="sd-type"><span class="sd-badge">${n.type}</span>${n.aoe?`<span class="sd-badge">${n.aoe}</span>`:""}</div>
        <div class="sd-desc">${n.description}</div>
        ${n.mpCost>0?`<div class="sd-cost">Mana Cost: <strong>${n.mpCost}</strong></div>`:""}
        ${n.damageStat?`<div class="sd-formula">Damage: ${d.damageMult}× weapon damage${d.damageMult!==n.damageMult?` <span style="color:#6a8aa0">(base ${n.damageMult}×, upgraded)</span>`:""}</div>`:""}
        ${g!==null?`<div class="sd-estimate">Est. Damage: <strong>~${g}</strong> <span style="color:#8a7a6a">per primary target, before armor/resist</span></div>`:""}
        ${n.__estTip?`<div class="sd-formula" style="font-size:0.7rem;color:#a89870;margin-top:0.15rem">
          wpn ${n.__estTip.weaponMid.toFixed(0)}
          × ${n.__estTip.finalMult.toFixed(2)}
          × (1 + ${n.__estTip.powerBonus.toFixed(2)} ${n.__estTip.isMagic?"SP":"AP"})
          ${n.__estTip.weaponFlavor>0?` + ${n.__estTip.weaponFlavor}`:""}
          <span style="color:#6a6070">· ${n.__estTip.cat}</span>
        </div>`:""}
        ${n.healStat?`<div class="sd-formula">Heal: ${d.healMult}× ${n.healStat.toUpperCase()}${d.healMult!==n.healMult?` <span style="color:#6a8aa0">(base ${n.healMult}×)</span>`:""}</div>`:""}
        ${v!==null?`<div class="sd-estimate">Est. Heal: <strong>~${v}</strong></div>`:""}
        ${(i=n.statusEffects)!=null&&i.length?`
          <div class="sd-effects">
            ${n.statusEffects.map(m=>`<div class="sd-effect"><span class="eff-name">${m.type.toUpperCase()}</span> ${Math.round(m.chance*100)}% chance · ${m.duration} rounds</div>`).join("")}
          </div>
        `:""}
        ${b.length?`
          <div class="sd-talents-title">Upgrade Talents</div>
          <div class="sd-talents">
            ${b.map(m=>{const f=l[m.id],w=!f&&h>0;return`
                <div class="sd-talent${f?" purchased":""}">
                  <div class="sdt-info">
                    <div class="sdt-name">${m.name}</div>
                    <div class="sdt-desc">${m.desc}</div>
                  </div>
                  <button type="button" class="sdt-btn${f?" done":""}" data-talent="${m.id}" ${f||!w?"disabled":""}>
                    ${f?"✓ Learned":"Learn (1 pt)"}
                  </button>
                </div>
              `}).join("")}
          </div>
        `:'<div style="color:#8a7a6a;font-size:0.8rem;margin-top:1rem">No upgrade talents available for this skill.</div>'}
      </div>
    `}_renderRecommendBar(e){const l=this._tab,r=l==="active"?e.pendingSkillPoints||0:l==="passive"?e.pendingPassivePoints||0:e.pendingAttrPoints||0,c=`auto_${l}`,t=!!(e.autoBuild&&e.autoBuild[c]),o=j();return`
      <div class="recommend-bar">
        <button type="button" class="recommend-btn${r>0?"":" disabled"}" id="recommend-btn" ${r>0?"":"disabled"}>
          ✦ Recommend
        </button>
        ${o?"":`<label class="recommend-auto">
              <input type="checkbox" id="recommend-auto" ${t?"checked":""}>
              Auto
            </label>`}
        <span class="recommend-note">${r>0?`${r} point${r===1?"":"s"} pending`:"No points pending"}</span>
      </div>
    `}_recommendAttr(e){const l=bt.find(i=>i.id===e.class),r=(l==null?void 0:l.primaryAttr)||"STR",c=e.baseAttrs||{STR:8,DEX:8,INT:8,CON:8},t=e.attrs||{...c},o=(t[r]||0)-(c[r]||0),s=(t.CON||0)-(c.CON||0),a=o+s;return a>0&&s/a<.2?"CON":r}_recommendPassive(e){const l=q(e.class),r=e.passiveRanks||{},c=/lifesteal|life_steal|mana_regen|mana_steal|regen|lifebind|soulbind|exotic|leech|siphon/i,t=l.find(o=>c.test(o.id+" "+(o.name||"")+" "+(o.desc||""))&&(r[o.id]||0)<o.maxRank);return t?t.id:(l.find(o=>(r[o.id]||0)<o.maxRank)||{}).id||null}_recommendTalent(e){const l=G(e.class),r=J(e.class,e.level||1),c=e.talentsPurchased||{},t=[...r].sort((o,s)=>(o.unlockLevel||0)-(s.unlockLevel||0));for(const o of t){const s=l.find(a=>a.name===o.name)||o;for(const a of s.talents||[])if(!c[a.id])return{skillName:o.name,talentId:a.id}}return null}_applyOneRecommended(e){const l=this._tab;if(l==="attrs"){if((e.pendingAttrPoints||0)<=0)return!1;const c=this._recommendAttr(e);e.attrs[c]=(e.attrs[c]||8)+1,e.pendingAttrPoints-=1;try{e.maxHp=Y(e),e.maxMp=Z(e)}catch{}return!0}if(l==="passive"){if((e.pendingPassivePoints||0)<=0)return!1;const c=this._recommendPassive(e);if(!c)return!1;const t=q(e.class).find(s=>s.id===c);if(!t)return!1;e.passiveRanks||(e.passiveRanks={});const o=e.passiveRanks[c]||0;return o>=t.maxRank?!1:(e.passiveRanks[c]=o+1,e.pendingPassivePoints-=1,tt(e),!0)}if((e.pendingSkillPoints||0)<=0)return!1;const r=this._recommendTalent(e);return r?(e.talentsPurchased||(e.talentsPurchased={}),e.talentsPurchased[r.talentId]=!0,e.pendingSkillPoints=Math.max(0,(e.pendingSkillPoints||0)-1),this._selectedSkill=r.skillName,!0):!1}_renderPassivePanel(e){if(!e)return'<div class="passive-empty">No character selected.</div>';const l=q(e.class),r=e.passiveRanks||{},c=e.pendingPassivePoints||0;return`
      <div class="passive-panel">
        <div class="passive-header">
          <div class="panel-label">Passives</div>
          ${this._renderAutoToggle(e,"passive")}
        </div>
        <div class="passive-points-banner pp-banner-compact" style="margin-bottom:0.65rem" title="Unspent passive points — click an option to spend">
          <span class="pp-num pp-num-fixed">+${c}</span>
          <span class="pp-tip-pop">Unspent passive points — click an option to spend</span>
        </div>
        <div class="passive-nodes">
          ${l.map((t,o)=>{const s=r[t.id]||0,a=c>0&&s<t.maxRank;return`
              <div class="passive-node${s>0?" owned":""}">
                <div class="pn-index">${o+1}</div>
                <div class="pn-info">
                  <div class="pn-name">${t.name}</div>
                  <div class="pn-desc">${t.desc}</div>
                  <div class="pn-rank">Rank <strong>${s}</strong> / ${t.maxRank}</div>
                </div>
                <button type="button" class="pn-btn${a?"":" disabled"}" data-passive="${t.id}" ${a?"":"disabled"}>
                  ${s>=t.maxRank?"✓ Maxed":"Learn (1 pt)"}
                </button>
              </div>
            `}).join("")}
        </div>
        <div class="passive-hint">Earn 1 Passive Point every 2 levels. Bonuses are permanent.</div>
      </div>
    `}_renderAttrsPanel(e){if(!e)return'<div class="passive-empty">No character selected.</div>';const l=e.pendingAttrPoints||0,r=St(e,{withSpendButtons:!0,pendingAttrPoints:l,includeHeader:!1,baseToggleId:"skill-stats-base"});return`
      <div class="passive-panel attrs-panel">
        <div class="passive-header">
          <div class="panel-label">Attributes</div>
          ${this._renderAutoToggle(e,"attrs")}
        </div>
        <div class="passive-points-banner pp-banner-compact" style="margin-bottom:0.65rem" title="Unspent attribute points — click an option to spend">
          <span class="pp-num pp-num-fixed">+${l}</span>
          <span class="pp-tip-pop">Unspent attribute points — click an option to spend</span>
        </div>
        <div class="char-stats-panel attrs-stats-panel">
          ${r}
        </div>
        <div class="passive-hint">Spend deferred points from level-ups any time.</div>
      </div>
    `}_renderAutoToggle(e,l){var r;if((r=$.get())!=null&&r.manualCombat)return"";const c=rt[l],t=!!(e.autoBuild&&e.autoBuild[c]);return j()?"":`
      <button type="button" class="auto-toggle${t?" on":""}" data-auto-tab="${l}" aria-pressed="${t?"true":"false"}" title="${t?"Auto: On":"Auto: Off"}">
        ${t?'<span class="auto-check" aria-hidden="true">✓</span>':'<span class="auto-check auto-off" aria-hidden="true">○</span>'}Auto
      </button>
    `}_wireEvents(){var e,l,r,c,t;(e=this._el.querySelector("#skill-close"))==null||e.addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),(l=this._el.querySelector("#sd-back-inline"))==null||l.addEventListener("click",()=>{this.audio.playSfx("click"),this._mobileDetailView=!1,this._selectedSkill=null,this._render()}),(r=this._el.querySelector("#skill-back-mobile"))==null||r.addEventListener("click",()=>{this.audio.playSfx("click"),this._mobileDetailView=!1,this._selectedSkill=null,this._render()}),this._el.querySelectorAll(".sct-tab").forEach(s=>{s.addEventListener("click",()=>{var a;this.audio.playSfx("click"),this._selectedCharIdx=parseInt(s.dataset.idx),this._selectedSkill=null,this._mobileDetailView=!1;const i=$.get(),n=(a=i==null?void 0:i.party)==null?void 0:a[this._selectedCharIdx];n&&((n.pendingSkillPoints||0)>0?this._tab="active":(n.pendingPassivePoints||0)>0?this._tab="passive":(n.pendingAttrPoints||0)>0&&(this._tab="attrs")),this._render()})}),this._el.querySelectorAll(".skill-row").forEach(s=>{s.addEventListener("click",()=>{s.classList.contains("locked")||(this.audio.playSfx("click"),this._selectedSkill=s.dataset.skill,this._mobileDetailView=!0,this._render())})}),this._el.querySelectorAll(".smt-tab").forEach(s=>{s.addEventListener("click",()=>{this.audio.playSfx("click"),this._tab=s.dataset.mode,this._selectedSkill=null,this._mobileDetailView=!1,this._render()})}),(c=this._el.querySelector("#recommend-btn"))==null||c.addEventListener("click",()=>{const s=$.get().party[this._selectedCharIdx];s&&this._applyOneRecommended(s)&&(this.audio.playSfx("spell"),this._render())}),(t=this._el.querySelector("#recommend-auto"))==null||t.addEventListener("change",s=>{if(j()){s.target.checked=!1;return}const a=$.get(),i=a.party[this._selectedCharIdx];if(!i){s.target.checked=!1;return}const n=`auto_${this._tab}`;if(s.target.checked){const b=()=>{i.autoBuild||(i.autoBuild={}),i.autoBuild[n]=!0;let h=0;for(;this._applyOneRecommended(i)&&h++<200;);this.audio.playSfx("spell"),this._render()};if(a.autoModeAccepted){b();return}s.target.checked=!1,it({title:"Enable Auto-Recommend?",message:"Auto-apply recommended points on level-up for this tab? You can uncheck this later.",confirmText:"Enable Auto",cancelText:"Cancel",onConfirm:()=>{s.target.checked=!0,a.autoModeAccepted=!0,b()}})}else i.autoBuild&&(i.autoBuild[n]=!1)}),this._el.querySelectorAll(".passive-node").forEach(s=>{ot(),lt(s,()=>{const a=s.querySelector("[data-passive]"),i=a==null?void 0:a.dataset.passive,n=$.get().party[this._selectedCharIdx];if(!n||!i)return"";const b=q(n.class).find(g=>g.id===i);if(!b)return"";const h=(n.passiveRanks||{})[i]||0;return`<div class="tt-title">${b.name}</div><div class="tt-sub">Rank ${h} / ${b.maxRank}</div><div class="tt-row">${b.desc}</div>`})}),this._el.querySelectorAll("[data-passive]").forEach(s=>{s.addEventListener("click",()=>{if(s.disabled)return;const a=$.get().party[this._selectedCharIdx];if(!a||(a.pendingPassivePoints||0)<=0)return;const i=s.dataset.passive,n=q(a.class).find(h=>h.id===i);if(!n)return;a.passiveRanks||(a.passiveRanks={});const b=a.passiveRanks[i]||0;b>=n.maxRank||(a.passiveRanks[i]=b+1,a.pendingPassivePoints-=1,tt(a),this.audio.playSfx("spell"),this._render())})}),this._el.querySelectorAll("[data-attr]").forEach(s=>{s.addEventListener("click",()=>{if(s.disabled)return;const a=$.get().party[this._selectedCharIdx];if(!a||(a.pendingAttrPoints||0)<=0)return;const i=s.dataset.attr;a.attrs||(a.attrs={STR:8,DEX:8,INT:8,CON:8}),a.attrs[i]=(a.attrs[i]||8)+1,a.pendingAttrPoints-=1;try{a.maxHp=Y(a),a.maxMp=Z(a)}catch{}this.audio.playSfx("spell"),this._render()})}),this._el.querySelectorAll("[data-auto-tab]").forEach(s=>{s.addEventListener("click",()=>{if(j()){this._showHardLockTip(s);return}const a=$.get(),i=a.party[this._selectedCharIdx];if(!i)return;const n=s.dataset.autoTab,b=rt[n],h=Mt[n];if(!b)return;if(!i.autoBuild||Pt(a.party,i)){const f=i.autoBuild||{};i.autoBuild={auto_attrs:!!f.auto_attrs,auto_passive:!!f.auto_passive,auto_active:!!f.auto_active}}const g=!!i.autoBuild[b],v=i[h]||0,k=()=>{const f=this._tab;this._tab=n;let w=0;for(;this._applyOneRecommended(i)&&w++<200;);this._tab=f},d=f=>{i.autoBuild[b]=f,f&&k(),this.audio.playSfx("click"),this._render()};if(g&&v>0){k(),this.audio.playSfx("click"),this._render();return}if(g||v<=0){d(!g);return}const m=$.get();if(m.autoModeAccepted){d(!0);return}it({title:Ct[n]+"?",message:At[n],confirmText:"Enable Auto",cancelText:"Cancel",onConfirm:()=>{m.autoModeAccepted=!0,d(!0)}})})});const o=this._el.querySelector("#skill-stats-base");o&&!o._wired&&(o._wired=!0,o.addEventListener("click",()=>{const s=!o.classList.contains("on");W(s),this._render()})),this._el.querySelectorAll("[data-talent]").forEach(s=>{s.addEventListener("click",()=>{var a;if(s.disabled)return;const i=$.get().party[this._selectedCharIdx];if(!i||(i.pendingSkillPoints||0)<=0||(i.talentsPurchased||(i.talentsPurchased={}),i.talentsPurchased[s.dataset.talent]))return;i.talentsPurchased[s.dataset.talent]=!0,i.pendingSkillPoints=Math.max(0,(i.pendingSkillPoints||0)-1);const n=s.dataset.talent,b=Object.values(V);for(const h of b){const g=(h.talents||[]).find(v=>v.id===n);if((a=g==null?void 0:g.effect)!=null&&a.unlocksCompanion){const v=g.effect.unlocksCompanion,k=ht[v];if(k){const d={...k,id:v+"_"+i.id,templateId:v,ownerId:i.id,ownerName:i.name,level:i.level||1,attrs:{...k.attrs}},m=Math.floor(((i.level||1)-1)*.5);d.attrs.STR+=m,d.attrs.DEX+=m,d.attrs.INT+=m,d.attrs.CON+=m,d.maxHp=50+d.attrs.CON*10,d.hp=d.maxHp,d.maxMp=10+d.attrs.INT*3,d.mp=d.maxMp,$.addToCompanions(d)||$.addToBench(d)}break}}this.audio.playSfx("spell"),this._render()})}),this._el.querySelectorAll(".sd-talent").forEach(s=>{const a=s.querySelector("[data-talent]");if(!a)return;const i=a.dataset.talent;let n=null,b=null;for(const h of Object.values(V)){const g=(h.talents||[]).find(v=>v.id===i);if(g){n=g.effect,b=g.desc;break}}ot(),lt(s,()=>{const h=n?zt(n):[];return!h.length&&!b?null:`${h.length?h.map(g=>`<div class="tt-row">${g}</div>`).join(""):""}`})})}_showHardLockTip(e){var l,r,c;if((l=this._el)!=null&&l.querySelector(".hard-lock-tip"))return;const t=document.createElement("div");t.className="hard-lock-tip",t.textContent="Auto disabled on Hard difficulty.";const o=e?e.getBoundingClientRect():null,s=(r=this._el)==null?void 0:r.getBoundingClientRect();o&&s&&(t.style.position="absolute",t.style.top=o.bottom-s.top+6+"px",t.style.left=o.left-s.left+"px"),(c=this._el)==null||c.appendChild(t),setTimeout(()=>t.remove(),2e3)}onPause(){this._el&&(this._el.style.display="none")}onResume(){this._el&&(this._el.style.display="")}update(){}draw(){}onExit(){et(this._el),this._el=null}destroy(){et(this._el),this._el=null}}const Tt=`
.skill-screen {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  background: linear-gradient(180deg,#0a0608,#120a10); color: #f0e8d8;
  font-family: 'Inter', sans-serif;
}
.skill-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.5rem 1rem; border-bottom: 1px solid rgba(232,160,32,0.3);
  background: rgba(0,0,0,0.35); flex-shrink: 0;
}
.skill-char-tabs { display: flex; gap: 0.4rem; overflow-x: auto; }
.sct-tab {
  position: relative;
  padding: 0.4rem 0.85rem; background: rgba(20,12,28,0.7);
  border: 1px solid rgba(232,160,32,0.15); border-radius: 6px;
  color: #8a7a6a; font-size: 0.75rem; cursor: pointer; min-height: 44px; text-align: center;
  transition: all 0.2s;
}
.sct-badge { position: absolute; top: 2px; right: 2px; min-width: 16px; height: 16px; line-height: 16px; text-align: center; background: #e8a020; color: #1a1a2e; font-size: 10px; font-weight: 700; border-radius: 8px; padding: 0 3px; pointer-events: none; }
.sct-tab.active { border-color: rgba(232,160,32,0.6); color: #e8a020; background: rgba(232,160,32,0.1); }
.sct-tab small { font-size: 0.6rem; }
.sct-portrait { display: inline-block; vertical-align: middle; margin-right: 4px; }
.sct-portrait .char-portrait { border-radius: 3px; background: rgba(255,255,255,0.06); }
.skill-header-btns { display: flex; align-items: center; gap: 0.4rem; flex-shrink: 0; }
.skill-close { background: none; border: none; color: #8a7a6a; cursor: pointer; font-size: 1rem; padding: 0.4rem; min-height: 44px; min-width: 44px; }
.skill-layout { flex: 1; display: grid; grid-template-columns: 260px 1fr; overflow: hidden; }
.skill-back-mobile { display: none; background: none; border: none; color: #e8a020; cursor: pointer; font-size: 0.85rem; padding: 0.4rem 0.6rem; min-height: 44px; }
.sd-back-inline { display: none; background: rgba(232,160,32,0.12); border: 1px solid rgba(232,160,32,0.35); color: #e8a020; cursor: pointer; font-size: 0.85rem; font-weight: 600; padding: 0.5rem 0.8rem; min-height: 44px; border-radius: 4px; margin: 0 0 0.75rem; width: 100%; text-align: left; }
.sd-back-inline:hover { background: rgba(232,160,32,0.2); }
@media (max-width: 600px) {
  .skill-layout { grid-template-columns: 1fr; }
  .skill-list-panel { border-right: none; border-bottom: 1px solid rgba(232,160,32,0.15); }
  .skill-layout.mobile-detail-open .skill-list-panel { display: none; }
  .skill-layout:not(.mobile-detail-open) .skill-detail-panel { display: none; }
  .skill-back-mobile { display: block; }
  .sd-back-inline { display: block; }
}
.panel-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7a6a; margin-bottom: 0.75rem; }
.skill-list-panel { padding: 1rem; border-right: 1px solid rgba(232,160,32,0.15); overflow-y: auto; display: flex; flex-direction: column; gap: 0.35rem; }
.skill-row {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.65rem 0.75rem; background: rgba(20,12,28,0.5);
  border: 1px solid rgba(232,160,32,0.1); border-radius: 7px;
  cursor: pointer; transition: all 0.2s; min-height: 52px;
}
.skill-row:hover:not(.locked) { border-color: rgba(232,160,32,0.4); background: rgba(20,12,28,0.8); }
.skill-row.locked { opacity: 0.4; cursor: default; }
.skill-row.selected { border-color: rgba(232,160,32,0.7); background: rgba(232,160,32,0.12); }
.sk-level-badge {
  font-size: 0.6rem; font-weight: 700; padding: 0.2rem 0.4rem;
  background: rgba(232,160,32,0.2); border: 1px solid rgba(232,160,32,0.3);
  border-radius: 4px; color: #e8a020; flex-shrink: 0; white-space: nowrap;
}
.sk-info { flex: 1; }
.sk-name { font-family: 'Cinzel', serif; font-size: 0.85rem; font-weight: 700; }
.sk-type { font-size: 0.62rem; color: #8a7a6a; text-transform: capitalize; }
.sk-cost { font-size: 0.65rem; color: #c0a040; flex-shrink: 0; }
.sk-lock-icon { font-size: 0.7rem; }
.skill-detail-panel { padding: 1.5rem; overflow-y: auto; }
.skill-select-prompt { color: #8a7a6a; font-size: 0.85rem; text-align: center; margin-top: 3rem; }
.skill-detail-inner { max-width: 480px; }
.sd-name { font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 900; color: #e8a020; margin-bottom: 0.5rem; }
.sd-type { display: flex; gap: 0.4rem; margin-bottom: 0.75rem; }
.sd-badge { font-size: 0.65rem; font-weight: 600; padding: 0.2rem 0.5rem; background: rgba(232,160,32,0.15); border: 1px solid rgba(232,160,32,0.3); border-radius: 4px; color: #e8a020; text-transform: capitalize; }
.sd-desc { font-size: 0.88rem; line-height: 1.6; color: #c0b090; margin-bottom: 1rem; }
.sd-cost { font-size: 0.78rem; color: #c0a040; margin-bottom: 0.5rem; }
.sd-formula { font-size: 0.75rem; color: #c0c080; margin-bottom: 0.5rem; }
.sd-estimate { font-size: 0.8rem; color: #e8a020; margin-bottom: 0.5rem; }
.sd-effects { margin-bottom: 0.75rem; }
.sd-effect { font-size: 0.75rem; color: #c0a080; }
.eff-name { font-weight: 700; }
.sd-talents-title { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #8a7a6a; margin: 1.25rem 0 0.75rem; }
.sd-talents { display: flex; flex-direction: column; gap: 0.6rem; }
.sd-talent {
  display: flex; align-items: center; gap: 1rem;
  padding: 0.85rem 1rem; background: rgba(20,12,28,0.5);
  border: 1px solid rgba(232,160,32,0.12); border-radius: 8px;
}
.sd-talent.purchased { border-color: rgba(232,160,32,0.4); background: rgba(232,160,32,0.08); }
.sdt-info { flex: 1; }
.sdt-name { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.2rem; }
.sdt-desc { font-size: 0.75rem; color: #8a7a6a; line-height: 1.4; }
.sdt-btn {
  padding: 0.5rem 0.85rem; background: rgba(232,160,32,0.15);
  border: 1px solid rgba(232,160,32,0.4); border-radius: 6px;
  color: #e8a020; font-size: 0.75rem; font-weight: 600; cursor: pointer;
  min-height: 44px; white-space: nowrap; transition: background 0.15s;
}
.sdt-btn:hover:not(:disabled) { background: rgba(232,160,32,0.28); }
.sdt-btn.done { background: rgba(232,160,32,0.06); border-color: rgba(232,160,32,0.2); color: #8a6020; cursor: default; }
.skill-mode-tabs { display: flex; gap: 0.5rem; padding: 0.5rem 1rem; background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(232,160,32,0.2); flex-shrink: 0; }
.smt-tab { padding: 0.45rem 1rem; background: rgba(20,12,28,0.6); border: 1px solid rgba(232,160,32,0.15); border-radius: 6px; color: #8a7a6a; font-size: 0.78rem; font-weight: 600; cursor: pointer; min-height: 44px; }
.smt-tab.active { border-color: rgba(232,160,32,0.6); color: #e8a020; background: rgba(232,160,32,0.12); }
.smt-badge { display: inline-block; margin-left: 0.25rem; padding: 0.1rem 0.35rem; background: #c04030; color: #fff; font-size: 0.62rem; border-radius: 8px; min-width: 2.2em; text-align: center; box-sizing: border-box; cursor: help; }
/* M398 — compact +N badge variant of passive-points-banner; fixed width avoids
   layout shift when N drops 2→1→0 mid-spend. */
/* M404: compact banner — width hugs the +N pill, padding tightened to
   match the passives/attributes banner. The hover tooltip uses
   position:absolute + max-width so it does NOT stretch the banner or
   trigger horizontal scrollbars in narrow parents (the spells left
   column is 260px and was scrolling because the long nowrap tooltip
   pushed past its width). */
.pp-banner-compact { position: relative; padding: 0.25rem 0.5rem; cursor: help; align-self: flex-start; width: auto; max-width: max-content; }
.pp-num-fixed { min-width: 2.5em; text-align: center; display: inline-block; font-size: 1.05rem; }
.pp-tip-pop { position: absolute; left: 0; top: calc(100% + 4px); z-index: 50; background: #14101c; border: 1px solid rgba(232,160,32,0.45); padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.7rem; color: #d8c89c; opacity: 0; pointer-events: none; transition: opacity 0.15s ease; max-width: 220px; width: max-content; line-height: 1.3; }
.pp-banner-compact:hover .pp-tip-pop, .pp-banner-compact:focus-within .pp-tip-pop { opacity: 1; }
/* Stop the left-column overflow that the tooltip used to trigger: when
   overflow-y:auto is set without an explicit overflow-x, browsers
   compute X as auto too if any descendant overflows horizontally. */
.skill-list-panel { overflow-x: hidden; }
/* M227: Recommend bar. */
.recommend-bar {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.45rem 1rem;
  background: rgba(0,0,0,0.18);
  border-bottom: 1px solid rgba(232,160,32,0.12);
  flex-shrink: 0; flex-wrap: wrap;
}
.recommend-btn {
  padding: 0.45rem 0.9rem;
  background: rgba(64,168,96,0.15); border: 1px solid rgba(109,220,150,0.5);
  border-radius: 6px; color: #a6f0bc;
  font-family: 'Cinzel', serif; font-size: 0.78rem; font-weight: 700;
  cursor: pointer; min-height: 44px;
}
.recommend-btn:hover:not(.disabled) { background: rgba(64,168,96,0.25); color: #d0f0dc; }
.recommend-btn.disabled { opacity: 0.45; cursor: not-allowed; }
.recommend-auto {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font-size: 0.75rem; color: #c0b090; cursor: pointer;
}
.recommend-auto input { accent-color: #6ddc96; }
.recommend-note { font-size: 0.72rem; color: #8a7a6a; margin-left: auto; }
.passive-panel { flex: 1; padding: 1rem 1.25rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }
/* M406 — inline layout: label → auto toggle (grouped at start), points badge pushed to end */
.passive-header { display: flex; justify-content: flex-start; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.passive-header .passive-points-banner { margin-left: auto; }
.passive-points-banner { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.75rem; background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.35); border-radius: 6px; }
.pp-num { font-family: 'Cinzel', serif; font-size: 1.3rem; font-weight: 700; color: #e8a020; line-height: 1; }
.pp-label { font-size: 0.7rem; color: #8a7a6a; }
.passive-nodes { display: flex; flex-direction: column; gap: 0.55rem; }
.passive-nodes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.55rem; }
.passive-node { display: flex; align-items: center; gap: 0.8rem; padding: 0.7rem 0.85rem; background: rgba(20,12,28,0.6); border: 1px solid rgba(232,160,32,0.15); border-radius: 8px; }
.passive-node.owned { border-color: rgba(232,160,32,0.45); background: rgba(232,160,32,0.1); }
.pn-index { font-family: 'Cinzel', serif; font-size: 0.95rem; font-weight: 700; color: #e8a020; min-width: 22px; text-align: center; }
.pn-info { flex: 1; }
.pn-name { font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700; color: #e8e0d0; }
.pn-desc { font-size: 0.72rem; color: #c0b090; margin-top: 0.15rem; line-height: 1.35; }
.pn-rank { font-size: 0.66rem; color: #8a7a6a; margin-top: 0.25rem; letter-spacing: 0.05em; }
.pn-btn { padding: 0.5rem 0.85rem; background: rgba(232,160,32,0.18); border: 1px solid rgba(232,160,32,0.4); border-radius: 6px; color: #e8a020; font-size: 0.72rem; font-weight: 600; cursor: pointer; min-height: 44px; white-space: nowrap; }
.pn-btn:hover:not(:disabled) { background: rgba(232,160,32,0.32); }
.pn-btn.disabled, .pn-btn:disabled { opacity: 0.35; cursor: default; }
.passive-hint { font-size: 0.68rem; color: #6a5a52; text-align: center; font-style: italic; margin-top: 0.5rem; }
.passive-empty { padding: 2rem; color: #8a7a6a; text-align: center; }
.attr-section-title { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #e8a020; margin: 0.75rem 0 0.25rem; border-bottom: 1px solid rgba(232,160,32,0.2); padding-bottom: 0.25rem; }
.pn-extra { font-size: 0.62rem; color: #8a7a6a; font-style: italic; margin-left: 0.25rem; }

/* M276 — per-tab Auto toggle on Skills/Passive/Attributes */
/* M406 — Auto toggle sits inline next to the panel title (not far-right).
   Use flex-start gap so label + toggle are grouped together. */
.skill-panel-head { display: flex; justify-content: flex-start; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap; }
.skill-panel-head .panel-label { margin-bottom: 0; }
.auto-toggle {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.65rem; min-height: 44px; border-radius: 6px;
  background: rgba(20,12,28,0.7); border: 1px solid rgba(232,160,32,0.2);
  color: #8a7a6a; font-size: 0.7rem; font-weight: 600; cursor: pointer;
  letter-spacing: 0.05em;
}
.auto-toggle:hover { border-color: rgba(232,160,32,0.45); color: #e8a020; }
.auto-toggle.on { border-color: rgba(72,176,96,0.6); color: #6dd180; background: rgba(72,176,96,0.1); }
.auto-toggle .auto-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  background: #48b060; color: #06200d; font-size: 10px; font-weight: 800;
  line-height: 1;
}
/* M384 — unchecked state: gold outline circle, no background. Matches the
   surrounding button outline so the indicator reads as "available, not yet
   chosen." Becomes the solid green pip when toggled on. */
.auto-toggle .auto-check.auto-off {
  background: transparent;
  border: 1px solid rgba(232,160,32,0.7);
  color: transparent;
  font-weight: 400;
}

/* Tiny checkmark badge on the active/passive/attrs tab when Auto is on */
.smt-auto-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  background: #48b060; color: #06200d; font-size: 10px; font-weight: 800;
  margin-left: 0.3rem; line-height: 1;
  vertical-align: middle;
}
.smt-tab.auto-on { box-shadow: inset 0 0 0 1px rgba(72,176,96,0.35); }

/* M385 — Hard-difficulty lock state for Auto toggles */
.auto-toggle.hard-locked {
  opacity: 0.45; cursor: not-allowed; border-color: rgba(160,80,80,0.4); color: #8a6a6a;
}
.auto-lock-icon { font-size: 0.75rem; }
.recommend-auto-locked { opacity: 0.45; font-size: 0.75rem; color: #8a6a6a; display: inline-flex; align-items: center; gap: 0.25rem; }
.hard-lock-tip {
  z-index: 9999; background: rgba(20,8,8,0.95); border: 1px solid rgba(180,60,60,0.6);
  color: #e0a0a0; font-size: 0.72rem; padding: 0.35rem 0.65rem; border-radius: 6px;
  pointer-events: none; white-space: nowrap;
  animation: htip-fade 2s ease forwards;
}
@keyframes htip-fade { 0%,70%{opacity:1} 100%{opacity:0} }

/* Attributes tab — shared character-stats panel reuse */
.attrs-panel .char-stats-panel { padding: 0.5rem 0.75rem; background: rgba(20,12,28,0.5); border: 1px solid rgba(232,160,32,0.12); border-radius: 8px; }
.attrs-panel .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.78rem; gap: 0.5rem; }
.attrs-panel .stat-row:last-child { border-bottom: none; }
.attrs-panel .sr-label { color: #c0b090; }
.attrs-panel .sr-val { font-family: 'Cinzel', serif; font-weight: 700; color: #e8a020; }
.attrs-panel .stat-row-attr .sr-val { min-width: 28px; text-align: right; }
.attrs-panel .panel-label { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #8a7a6a; margin-top: 0.6rem; margin-bottom: 0.3rem; }
.attrs-panel .stats-base-toggle { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.7rem; color: #8a7a6a; cursor: pointer; padding: 0.25rem 0; }
.sr-attr-btn {
  padding: 0.3rem 0.65rem; min-height: 44px;
  background: rgba(232,160,32,0.18); border: 1px solid rgba(232,160,32,0.4);
  border-radius: 5px; color: #e8a020; font-size: 0.7rem; font-weight: 700;
  cursor: pointer; white-space: nowrap;
}
.sr-attr-btn:hover:not(:disabled) { background: rgba(232,160,32,0.32); }
.sr-attr-btn:disabled, .sr-attr-btn.disabled { opacity: 0.35; cursor: default; }
`;export{It as SkillTreeScreen};
