import{Y as ut,Z as dt,$ as mt,a0 as gt,a1 as W,a2 as bt,a3 as K,a4 as ft,a8 as Y,a9 as G,aa as ht,G as _,R as q,i as vt,c as kt,ac as Z,ad as J,p as xt,J as yt,U as $t,V as Q,S as V,ae as tt,af as et,Q as _t,ag as j,a7 as st,ah as wt,r as at}from"./play-CctEuBOF.js";import{showConfirmModal as it}from"./ConfirmModal-DQ97N49q.js";import"./modulepreload-polyfill-B5Qt9EMX.js";let R=null;function nt(){R&&R.parentNode&&R.parentNode.removeChild(R),R=null}function St(p,e){const l=e.getBoundingClientRect(),t=p.getBoundingClientRect();let d=l.left+l.width/2-t.width/2,s=l.top-t.height-10;d<10&&(d=10),d+t.width>window.innerWidth-10&&(d=window.innerWidth-t.width-10),s<10&&(s=l.bottom+10),p.style.left=`${d}px`,p.style.top=`${s}px`}function ot(p,e,l={}){if(!p)return()=>{};const t=l.className||"rsg-tooltip",d=g=>{nt();const f=e();if(!f)return;const b=document.createElement("div");b.className=t,b.innerHTML=f,document.body.appendChild(b),R=b,St(b,g.currentTarget||p)},s=()=>nt();p.addEventListener("mouseenter",d),p.addEventListener("mouseleave",s);let r=null;const i=g=>{clearTimeout(r),r=setTimeout(()=>d(g),350)},o=()=>{clearTimeout(r),setTimeout(s,1500)},a=()=>{clearTimeout(r),s()};return p.addEventListener("touchstart",i,{passive:!0}),p.addEventListener("touchend",o),p.addEventListener("touchcancel",a),()=>{p.removeEventListener("mouseenter",d),p.removeEventListener("mouseleave",s),p.removeEventListener("touchstart",i),p.removeEventListener("touchend",o),p.removeEventListener("touchcancel",a),clearTimeout(r)}}function lt(){if(document.getElementById("rsg-tooltip-styles"))return;const p=document.createElement("style");p.id="rsg-tooltip-styles",p.textContent=`
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
  `,document.head.appendChild(p)}function Pt(p){return p==="magic"?"Magic Damage":p==="light"?"Light Damage":"Heavy Damage"}function Ct(p,e={}){const{withSpendButtons:l=!1,pendingAttrPoints:t=0,includeHeader:d=!1,headerLabel:s=l?"Attributes":"Character Stats",baseToggleId:r="stats-base-chk"}=e;if(!p)return'<div class="stat-row"><span>No character selected</span></div>';const i=p.baseAttrs||p.attrs||{STR:8,DEX:8,INT:8,CON:8},o=p.attrs||i,a=ut(),g=p.equipment||{};let f=0;for(const c of Object.values(g))c!=null&&c.armor&&(f+=c.armor);const b=0,m=dt(p);f+=m.armor||0;const h=mt(g),v=a?i:{STR:(o.STR||8)+(m.str||0),DEX:(o.DEX||8)+(m.dex||0),INT:(o.INT||8)+(m.int||0),CON:(o.CON||8)+(m.con||0)},$=gt(g)+(m.dmg||0),n=W(v,a?0:$,h),u=W(i,0,h),x=Pt(h),M=a?0:m.magicResist||0,T=(c,k)=>({hp:k?G(p):50+c.CON*10,mp:k?Y(p):30+c.INT*8,hit:Math.min(95,70+Math.round(c.DEX*1.2)+(k&&m.hit||0)),dodge:Math.min(40,5+Math.round(c.DEX*.8)+(k&&m.dodge||0)),spl:+(c.INT*.025+(k&&m.spellPower||0)).toFixed(2)}),y=T(a?i:v,!a),E=T(i,!1),S=a?b:f,U=a?0:bt(p).resistAll||0,z=K(S,U),I=K(b,0),w=(c,k,A)=>{const B=ht(k,A,c);return B?` style="color:${B}"`:""},L=["STR","DEX","INT","CON"].map(c=>{const k=c.toLowerCase(),A=v[c],B=w(k,A,i[c]);if(l){const X=t>0;return`
        <div class="stat-row stat-row-attr">
          <span class="sr-label stat-label" data-stat="${c}">${c}</span>
          <span class="sr-val"${B}>${Math.floor(A)}</span>
          <button type="button" class="sr-attr-btn${X?"":" disabled"}" data-attr="${c}" ${X?"":"disabled"} aria-label="Increase ${c}">+1</button>
        </div>`}return`<div class="stat-row"><span class="sr-label stat-label" data-stat="${c}">${c}</span><span class="sr-val"${B}>${Math.floor(A)}</span></div>`}).join(""),P=new Set(["str","dex","int","con","hp","mp","dmg","armor","hit","dodge","magicresist","magicResist","spellpower","spellPower"]),N={goldFind:"Gold Find",xpFind:"XP Find",manaRegen:"Mana Regen",lifeSteal:"Life Steal",manaSteal:"Mana Steal",initiative:"Initiative",critChance:"Crit Chance",critDamage:"Crit Damage",spellPower:"Spell Power",tradePrices:"Trade Prices"},C=[];if(!a){try{const c=ft(p);if((c==null?void 0:c.blockChance)>0){const k=`+${(c.blockChance*100).toFixed(1).replace(/\.0$/,"")}%`;C.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Chance">Block Chance</span><span class="sr-val" style="color:#6db3ff">${k}</span></div>`)}(c==null?void 0:c.blockPower)>0&&C.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Power">Block Power</span><span class="sr-val" style="color:#6db3ff">+${Math.round(c.blockPower)}</span></div>`)}catch{}for(const c of Object.keys(m)){if(P.has(c)||P.has(c.toLowerCase()))continue;const k=m[c];if(!k)continue;const A=N[c]||c.replace(/([A-Z])/g," $1").replace(/^./,pt=>pt.toUpperCase()),ct=(c==="goldFind"||c==="xpFind"||c==="critChance"||c==="critDamage"||c==="tradePrices")&&Math.abs(k)<=3?`+${(k*100).toFixed(1).replace(/\.0$/,"")}%`:c==="lifeSteal"||c==="manaSteal"?`+${Math.round(k*10)/10}%`:`+${Math.round(k*100)/100}`;C.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="${A}">${A}</span><span class="sr-val" style="color:#6db3ff">${ct}</span></div>`)}}const D=C.length?C.join(""):'<div class="stat-row"><span class="sr-label" style="color:#5a4a42;font-style:italic">None</span><span class="sr-val" style="color:#5a4a42">—</span></div>',F=d?`<div class="panel-label">${s}</div>`:"",O=`<button type="button" class="auto-toggle stats-base-toggle${a?" on":""}" id="${r}" aria-pressed="${a?"true":"false"}" title="Show base attributes (without item bonuses)">${a?'<span class="auto-check" aria-hidden="true">✓</span>':'<span class="auto-check auto-off" aria-hidden="true">○</span>'}Show Base Attributes</button>`,H=`
    <div class="stat-row"><span class="sr-label stat-label" data-stat="HP">HP</span><span class="sr-val"${w("hp",y.hp,E.hp)}>${Math.floor(y.hp)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Mana">Mana</span><span class="sr-val"${w("mp",y.mp,E.mp)}>${Math.floor(y.mp)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Armor">Armor</span><span class="sr-val"${w("armor",S,b)}>${Math.floor(S)}</span></div>
    <div class="stat-row" title="Armor ${(z.armorDr*100).toFixed(1)}% + Misc ${(z.miscDr*100).toFixed(1)}% (multiplicative)"><span class="sr-label stat-label" data-stat="Damage Reduction">Damage Reduction</span><span class="sr-val"${w("dmgReduction",z.totalDr,I.totalDr)}>${(z.totalDr*100).toFixed(1)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Magic Resist">Magic Resist</span><span class="sr-val"${w("magicResist",M,0)}>${Math.floor(M)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Hit">Hit</span><span class="sr-val"${w("hit",y.hit,E.hit)}>${Math.floor(y.hit)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Dodge">Dodge</span><span class="sr-val"${w("dodge",y.dodge,E.dodge)}>${Math.floor(y.dodge)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="${x}">${x}</span><span class="sr-val"${w("dmg",n[1],u[1])}>${Math.floor(n[0])}-${Math.floor(n[1])}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Spell Power">Spell Power</span><span class="sr-val"${w("spellPower",y.spl,E.spl)}>+${Math.round(y.spl*100)}%</span></div>
  `;return l?`
      ${F}
      ${O}
      <div class="cs-stats-grid">
        <div class="cs-section cs-section-attrs">
          <div class="panel-label">Attributes</div>
          ${L}
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
        ${L}
        <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
        ${D}
      </div>
    </div>
  `}function At(p,e){if(!e||!e.autoBuild)return!1;for(const l of p||[])if(l&&l!==e&&l.autoBuild===e.autoBuild)return!0;return!1}const rt={active:"auto_active",passive:"auto_passive",attrs:"auto_attrs"},Mt={active:"pendingSkillPoints",passive:"pendingPassivePoints",attrs:"pendingAttrPoints"},Tt={active:"Auto-spend talent points",passive:"Auto-spend passive points",attrs:"Auto-spend attribute points"},Et={active:"Talent points will be auto-spent on each level-up using the class default order. You will not get a chance to pick talents yourself until you turn this off.",passive:"Passive points will be auto-spent on each level-up using the class default order. You will not get to choose which passives to learn until you turn this off.",attrs:"Attribute points will be auto-spent on each level-up using the class default priority. You will not get to choose which attributes to raise until you turn this off."};function zt(p){if(!p||typeof p!="object")return[];const e=[],l=s=>`${Math.round(s*100)}%`,t=s=>`${s} round${s===1?"":"s"}`,d={targets:s=>`Hits ${s} targets`,damageMult:s=>`Damage: ${s}x multiplier`,damage_mult:s=>`Damage: ${s}x multiplier`,dmgBuff:s=>`+${l(s)} party damage`,dmgReduct:s=>`-${l(s)} damage taken`,reflect:s=>`Reflects ${l(s)} damage back`,duration:s=>`Lasts ${t(s)}`,aoe:s=>`Area: ${s}`,tempHp:s=>`+${s} temporary HP per member`,healMult:s=>`Heals ${s}x multiplier`,attackSpeed:s=>`+${l(s)} attack speed`,mpCost:s=>s<0?`Mana cost -${Math.abs(s)}`:`Mana cost +${s}`,bleed:s=>`Applies Bleed (${t((s==null?void 0:s.duration)??s)})`,statusEffects:s=>Array.isArray(s)?s.map(r=>`${Math.round((r.chance||1)*100)}% chance: ${r.type} (${t(r.duration)})`).join(", "):String(s),status_apply:s=>`Applies ${s}`,immuneStun:s=>s?"Immune to Stun":"",immuneBleed:s=>s?"Immune to Bleed":"",unlocksCompanion:s=>`Unlocks companion: ${s}`};for(const[s,r]of Object.entries(p)){if(r==null||r===!1)continue;const i=d[s];if(i){const o=i(r);o&&e.push(o)}else{const o=s.replace(/_/g," ").replace(/([A-Z])/g," $1").trim(),a=typeof r=="object"?JSON.stringify(r):String(r);e.push(`${o}: ${a}`)}}return e}class Nt{constructor(e,l){this.manager=e,this.audio=l,this._el=null,this._selectedCharIdx=0,this._selectedSkill=null,this._mobileDetailView=!1,this._tab="active"}onEnter(){try{const e=_.get(),l=(e==null?void 0:e.party)||[];let t=-1;e!=null&&e.skillFocusId&&(t=l.findIndex(s=>s&&s.id===e.skillFocusId),e.skillFocusId=null),t<0&&(t=l.findIndex(s=>s&&(s.pendingSkillPoints||0)+(s.pendingPassivePoints||0)+(s.pendingAttrPoints||0)>0)),t>=0&&(this._selectedCharIdx=t);const d=l[this._selectedCharIdx];d&&!this._tabPinned&&((d.pendingSkillPoints||0)>0?this._tab="active":(d.pendingPassivePoints||0)>0?this._tab="passive":(d.pendingAttrPoints||0)>0&&(this._tab="attrs")),this._tabPinned=!1;for(const s of l){if(!s||!s.autoBuild||q())continue;const r=this._tab;for(const i of["active","passive","attrs"]){if(!s.autoBuild[`auto_${i}`])continue;this._tab=i;const o=this._selectedCharIdx;this._selectedCharIdx=l.indexOf(s);let a=0;for(;this._applyOneRecommended(s)&&a++<200;);this._selectedCharIdx=o}this._tab=r}}catch{}this._build()}_build(){vt("skill-styles",Bt),this._el=kt("div","skill-screen"),this.manager.uiOverlay.appendChild(this._el),this._render()}_render(){var f,b,m,h,v,$;const l=_.get().party,t=l[this._selectedCharIdx],d=t?Z(t.class):[],s=t?J(t.class,t.level||1):[],r=(t==null?void 0:t.talentsPurchased)||{},i={};for(const n of[".skill-list-panel",".skill-detail-panel",".passive-panel",".attrs-panel"]){const u=this._el.querySelector(n);u&&(i[n]=u.scrollTop)}const o=window.scrollY||document.documentElement.scrollTop,a=document.activeElement;if(a&&a!==document.body&&typeof a.blur=="function")try{a.blur()}catch{}this._el.innerHTML=`
      <div class="skill-header">
        <div class="skill-char-tabs" id="skill-char-tabs">
          ${l.map((n,u)=>{const x=(n.pendingSkillPoints||0)+(n.pendingPassivePoints||0)+(n.pendingAttrPoints||0),M=x>0&&u!==this._selectedCharIdx;return`
            <button type="button" class="sct-tab${u===this._selectedCharIdx?" active":""}" data-idx="${u}">
              <span class="sct-portrait">${xt(n,24)}</span>
              ${n.name} ${yt(n,12,"sct-class-icon")}<br><small>${n.className||n.class} Lv${n.level||1}</small>
              ${M?`<span class="sct-badge">${x>9?"9+":x}</span>`:""}
            </button>`}).join("")}
        </div>
        <div class="skill-header-btns">
          ${this._mobileDetailView?'<button type="button" class="skill-back-mobile" id="skill-back-mobile">← Back</button>':""}
          <button type="button" class="skill-close" id="skill-close">✕</button>
        </div>
      </div>
      <div class="skill-mode-tabs">
        <button type="button" class="smt-tab${this._tab==="active"?" active":""}${(f=t==null?void 0:t.autoBuild)!=null&&f.auto_active?" auto-on":""}" data-mode="active">
          Spells${t&&(t.pendingSkillPoints||0)>0?` <span class="smt-badge" title="Unspent talent points — click an option to spend">+${t.pendingSkillPoints}</span>`:""}${(b=t==null?void 0:t.autoBuild)!=null&&b.auto_active?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
        <button type="button" class="smt-tab${this._tab==="passive"?" active":""}${(m=t==null?void 0:t.autoBuild)!=null&&m.auto_passive?" auto-on":""}" data-mode="passive">
          Passive${t&&(t.pendingPassivePoints||0)>0?` <span class="smt-badge" title="Unspent passive points — click an option to spend">+${t.pendingPassivePoints}</span>`:""}${(h=t==null?void 0:t.autoBuild)!=null&&h.auto_passive?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
        <button type="button" class="smt-tab${this._tab==="attrs"?" active":""}${(v=t==null?void 0:t.autoBuild)!=null&&v.auto_attrs?" auto-on":""}" data-mode="attrs">
          Attributes${t&&(t.pendingAttrPoints||0)>0?` <span class="smt-badge" title="Unspent attribute points — click an option to spend">+${t.pendingAttrPoints}</span>`:""}${($=t==null?void 0:t.autoBuild)!=null&&$.auto_attrs?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
      </div>
      ${this._tab==="attrs"?this._renderAttrsPanel(t):this._tab==="passive"?this._renderPassivePanel(t):`
      <div class="skill-layout${this._mobileDetailView?" mobile-detail-open":""}">
        <!-- Skill list -->
        <div class="skill-list-panel">
          <div class="skill-panel-head">
            <div class="panel-label">Spells</div>
            ${t?this._renderAutoToggle(t,"active"):""}
          </div>
          ${t?`<div class="passive-points-banner pp-banner-compact" style="margin-bottom:0.65rem" title="Unspent talent points — click an option to spend"><span class="pp-num pp-num-fixed">+${t.pendingSkillPoints||0}</span><span class="pp-tip-pop">Unspent talent points — click an option to spend</span></div>`:""}
          ${d.map(n=>{const u=s.find(x=>x.name===n.name);return`
              <div class="skill-row${u?"":" locked"}${this._selectedSkill===n.name?" selected":""}" data-skill="${n.name}">
                <div class="sk-level-badge">Lv${n.unlockLevel}</div>
                <div class="sk-info">
                  <div class="sk-name">${n.name}</div>
                  <div class="sk-type">${n.type} · ${n.aoe||n.target||"self"}</div>
                </div>
                <div class="sk-cost">${n.mpCost>0?`${n.mpCost} MP`:"Passive"}</div>
                ${u?"":'<div class="sk-lock-icon">🔒</div>'}
              </div>
            `}).join("")}
        </div>
        <!-- Skill detail / talents -->
        <div class="skill-detail-panel">
          ${this._selectedSkill?this._renderSkillDetail(t,r):`
            <div class="skill-select-prompt">Select a skill to view its description and upgrade talents.</div>
          `}
        </div>
      </div>
      `}
    `,this._wireEvents(),$t(this._el);const g=this._el.querySelector("#skill-stats-base");g&&g.addEventListener("click",()=>{const n=!g.classList.contains("on");Q(n),this._render()});for(const n of Object.keys(i)){const u=this._el.querySelector(n);u&&(u.scrollTop=i[n])}window.scrollTo(0,o)}_renderSkillDetail(e,l){var g,f,b,m,h,v,$;const t=Object.values(V).find(n=>n.name===this._selectedSkill);if(!t)return"";const d=t.talents||[],s=(e==null?void 0:e.pendingSkillPoints)||0;let r=null,i=null;if(e){const n=e.attrs||{},u=dt(e),x={STR:(n.STR||8)+(u.str||0),DEX:(n.DEX||8)+(u.dex||0),INT:(n.INT||8)+(u.int||0),CON:(n.CON||8)+(u.con||0)},M=x.INT*.025+(u.spellPower||0);var o=t;try{o=tt(t,e)}catch{}if(t.damageStat){const T=t.damageStat,y=/int|spell/i.test(T)||["fire","ice","lightning","holy","necro","magic"].includes(t.type),E=+o.damageMult||0;let S={};try{S=(typeof et=="function"?(g=et().combat)==null?void 0:g.skill:null)||{}}catch{}const U=S.heroDamageMult??1,z=(((b=(f=e==null?void 0:e.equipment)==null?void 0:f.weapon)==null?void 0:b.weaponCategory)||((h=(m=e==null?void 0:e.equipment)==null?void 0:m.weapon)==null?void 0:h.subtype)||"").toLowerCase(),I=o.damageCategory||(y?"magic":/2h|hammer|maul/.test(z)?"heavy":"light"),w=I==="magic"?S.magicMult??.78:I==="heavy"?S.heavyMult??1:S.lightMult??1,L=E*U*w,P=(v=e==null?void 0:e.equipment)==null?void 0:v.weapon,N=(P==null?void 0:P.damage)||(P==null?void 0:P.dmg)||[],C=N.length===2?(N[0]+N[1])/2:0,D=C,F=Math.round((x.STR||8)*1.5),O=y?M:F*.05,H=y?0:Math.round(C*.1),c=D*L*(1+O)+H;r=Math.max(0,Math.round(c)),t.__estTip={sv:D,finalMult:L,powerBonus:O,weaponFlavor:H,weaponMid:C,isMagic:y,cat:I}}if(t.healStat){const T=t.healStat,y=x[T.toUpperCase()]||0;i=Math.round((+o.healMult||0)*y*(1+M))}}let a=t;try{e&&(a=tt(t,e))}catch{}return`
      <div class="skill-detail-inner">
        <button type="button" class="sd-back-inline" id="sd-back-inline" aria-label="Back to spells list">← Back to spells</button>
        <div class="sd-name">${t.name}</div>
        <div class="sd-type"><span class="sd-badge">${t.type}</span>${t.aoe?`<span class="sd-badge">${t.aoe}</span>`:""}</div>
        <div class="sd-desc">${t.description}</div>
        ${t.mpCost>0?`<div class="sd-cost">Mana Cost: <strong>${t.mpCost}</strong></div>`:""}
        ${t.damageStat?`<div class="sd-formula">Damage: ${a.damageMult}× weapon damage${a.damageMult!==t.damageMult?` <span style="color:#6a8aa0">(base ${t.damageMult}×, upgraded)</span>`:""}</div>`:""}
        ${r!==null?`<div class="sd-estimate">Est. Damage: <strong>~${r}</strong> <span style="color:#8a7a6a">per primary target, before armor/resist</span></div>`:""}
        ${t.__estTip?`<div class="sd-formula" style="font-size:0.7rem;color:#a89870;margin-top:0.15rem">
          wpn ${t.__estTip.weaponMid.toFixed(0)}
          × ${t.__estTip.finalMult.toFixed(2)}
          × (1 + ${t.__estTip.powerBonus.toFixed(2)} ${t.__estTip.isMagic?"SP":"AP"})
          ${t.__estTip.weaponFlavor>0?` + ${t.__estTip.weaponFlavor}`:""}
          <span style="color:#6a6070">· ${t.__estTip.cat}</span>
        </div>`:""}
        ${t.healStat?`<div class="sd-formula">Heal: ${a.healMult}× ${t.healStat.toUpperCase()}${a.healMult!==t.healMult?` <span style="color:#6a8aa0">(base ${t.healMult}×)</span>`:""}</div>`:""}
        ${i!==null?`<div class="sd-estimate">Est. Heal: <strong>~${i}</strong></div>`:""}
        ${($=t.statusEffects)!=null&&$.length?`
          <div class="sd-effects">
            ${t.statusEffects.map(n=>`<div class="sd-effect"><span class="eff-name">${n.type.toUpperCase()}</span> ${Math.round(n.chance*100)}% chance · ${n.duration} rounds</div>`).join("")}
          </div>
        `:""}
        ${d.length?`
          <div class="sd-talents-title">Upgrade Talents</div>
          <div class="sd-talents">
            ${d.map(n=>{const u=l[n.id],x=!u&&s>0;return`
                <div class="sd-talent${u?" purchased":""}">
                  <div class="sdt-info">
                    <div class="sdt-name">${n.name}</div>
                    <div class="sdt-desc">${n.desc}</div>
                  </div>
                  <button type="button" class="sdt-btn${u?" done":""}" data-talent="${n.id}" ${u||!x?"disabled":""}>
                    ${u?"✓ Learned":"Learn (1 pt)"}
                  </button>
                </div>
              `}).join("")}
          </div>
        `:'<div style="color:#8a7a6a;font-size:0.8rem;margin-top:1rem">No upgrade talents available for this skill.</div>'}
      </div>
    `}_renderRecommendBar(e){const l=this._tab,t=l==="active"?e.pendingSkillPoints||0:l==="passive"?e.pendingPassivePoints||0:e.pendingAttrPoints||0,d=`auto_${l}`,s=!!(e.autoBuild&&e.autoBuild[d]),r=q();return`
      <div class="recommend-bar">
        <button type="button" class="recommend-btn${t>0?"":" disabled"}" id="recommend-btn" ${t>0?"":"disabled"}>
          ✦ Recommend
        </button>
        ${r?"":`<label class="recommend-auto">
              <input type="checkbox" id="recommend-auto" ${s?"checked":""}>
              Auto
            </label>`}
        <span class="recommend-note">${t>0?`${t} point${t===1?"":"s"} pending`:"No points pending"}</span>
      </div>
    `}_recommendAttr(e){const l=_t.find(a=>a.id===e.class),t=(l==null?void 0:l.primaryAttr)||"STR",d=e.baseAttrs||{STR:8,DEX:8,INT:8,CON:8},s=e.attrs||{...d},r=(s[t]||0)-(d[t]||0),i=(s.CON||0)-(d.CON||0),o=r+i;return o>0&&i/o<.2?"CON":t}_recommendPassive(e){const l=j(e.class),t=e.passiveRanks||{},d=/lifesteal|life_steal|mana_regen|mana_steal|regen|lifebind|soulbind|exotic|leech|siphon/i,s=l.find(r=>d.test(r.id+" "+(r.name||"")+" "+(r.desc||""))&&(t[r.id]||0)<r.maxRank);return s?s.id:(l.find(r=>(t[r.id]||0)<r.maxRank)||{}).id||null}_recommendTalent(e){const l=Z(e.class),t=J(e.class,e.level||1),d=e.talentsPurchased||{},s=[...t].sort((r,i)=>(r.unlockLevel||0)-(i.unlockLevel||0));for(const r of s){const i=l.find(o=>o.name===r.name)||r;for(const o of i.talents||[])if(!d[o.id])return{skillName:r.name,talentId:o.id}}return null}_applyOneRecommended(e){const l=this._tab;if(l==="attrs"){if((e.pendingAttrPoints||0)<=0)return!1;const d=this._recommendAttr(e);e.attrs[d]=(e.attrs[d]||8)+1,e.pendingAttrPoints-=1;try{e.maxHp=G(e),e.maxMp=Y(e)}catch{}return!0}if(l==="passive"){if((e.pendingPassivePoints||0)<=0)return!1;const d=this._recommendPassive(e);if(!d)return!1;const r=j(e.class).find(o=>o.id===d);if(!r)return!1;e.passiveRanks||(e.passiveRanks={});const i=e.passiveRanks[d]||0;return i>=r.maxRank?!1:(e.passiveRanks[d]=i+1,e.pendingPassivePoints-=1,st(e),!0)}if((e.pendingSkillPoints||0)<=0)return!1;const t=this._recommendTalent(e);return t?(e.talentsPurchased||(e.talentsPurchased={}),e.talentsPurchased[t.talentId]=!0,e.pendingSkillPoints=Math.max(0,(e.pendingSkillPoints||0)-1),this._selectedSkill=t.skillName,!0):!1}_renderPassivePanel(e){if(!e)return'<div class="passive-empty">No character selected.</div>';const l=j(e.class),t=e.passiveRanks||{},d=e.pendingPassivePoints||0;return`
      <div class="passive-panel">
        <div class="passive-header">
          <div class="panel-label">Passives</div>
          ${this._renderAutoToggle(e,"passive")}
        </div>
        <div class="passive-points-banner pp-banner-compact" style="margin-bottom:0.65rem" title="Unspent passive points — click an option to spend">
          <span class="pp-num pp-num-fixed">+${d}</span>
          <span class="pp-tip-pop">Unspent passive points — click an option to spend</span>
        </div>
        <div class="passive-nodes">
          ${l.map((s,r)=>{const i=t[s.id]||0,o=d>0&&i<s.maxRank;return`
              <div class="passive-node${i>0?" owned":""}">
                <div class="pn-index">${r+1}</div>
                <div class="pn-info">
                  <div class="pn-name">${s.name}</div>
                  <div class="pn-desc">${s.desc}</div>
                  <div class="pn-rank">Rank <strong>${i}</strong> / ${s.maxRank}</div>
                </div>
                <button type="button" class="pn-btn${o?"":" disabled"}" data-passive="${s.id}" ${o?"":"disabled"}>
                  ${i>=s.maxRank?"✓ Maxed":"Learn (1 pt)"}
                </button>
              </div>
            `}).join("")}
        </div>
        <div class="passive-hint">Earn 1 Passive Point every 2 levels. Bonuses are permanent.</div>
      </div>
    `}_renderAttrsPanel(e){if(!e)return'<div class="passive-empty">No character selected.</div>';const l=e.pendingAttrPoints||0,t=Ct(e,{withSpendButtons:!0,pendingAttrPoints:l,includeHeader:!1,baseToggleId:"skill-stats-base"});return`
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
          ${t}
        </div>
        <div class="passive-hint">Spend deferred points from level-ups any time.</div>
      </div>
    `}_renderAutoToggle(e,l){var r;if((r=_.get())!=null&&r.manualCombat)return"";const t=rt[l],d=!!(e.autoBuild&&e.autoBuild[t]);return q()?"":`
      <button type="button" class="auto-toggle${d?" on":""}" data-auto-tab="${l}" aria-pressed="${d?"true":"false"}" title="${d?"Auto: On":"Auto: Off"}">
        ${d?'<span class="auto-check" aria-hidden="true">✓</span>':'<span class="auto-check auto-off" aria-hidden="true">○</span>'}Auto
      </button>
    `}_wireEvents(){var l,t,d,s,r;(l=this._el.querySelector("#skill-close"))==null||l.addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),(t=this._el.querySelector("#sd-back-inline"))==null||t.addEventListener("click",()=>{this.audio.playSfx("click"),this._mobileDetailView=!1,this._selectedSkill=null,this._render()}),(d=this._el.querySelector("#skill-back-mobile"))==null||d.addEventListener("click",()=>{this.audio.playSfx("click"),this._mobileDetailView=!1,this._selectedSkill=null,this._render()}),this._el.querySelectorAll(".sct-tab").forEach(i=>{i.addEventListener("click",()=>{var g;this.audio.playSfx("click"),this._selectedCharIdx=parseInt(i.dataset.idx),this._selectedSkill=null,this._mobileDetailView=!1;const o=_.get(),a=(g=o==null?void 0:o.party)==null?void 0:g[this._selectedCharIdx];a&&((a.pendingSkillPoints||0)>0?this._tab="active":(a.pendingPassivePoints||0)>0?this._tab="passive":(a.pendingAttrPoints||0)>0&&(this._tab="attrs")),this._render()})}),this._el.querySelectorAll(".skill-row").forEach(i=>{i.addEventListener("click",()=>{i.classList.contains("locked")||(this.audio.playSfx("click"),this._selectedSkill=i.dataset.skill,this._mobileDetailView=!0,this._render())})}),this._el.querySelectorAll(".smt-tab").forEach(i=>{i.addEventListener("click",()=>{this.audio.playSfx("click"),this._tab=i.dataset.mode,this._selectedSkill=null,this._mobileDetailView=!1,this._render()})}),(s=this._el.querySelector("#recommend-btn"))==null||s.addEventListener("click",()=>{const o=_.get().party[this._selectedCharIdx];o&&this._applyOneRecommended(o)&&(this.audio.playSfx("spell"),this._render())}),(r=this._el.querySelector("#recommend-auto"))==null||r.addEventListener("change",i=>{if(q()){i.target.checked=!1;return}const o=_.get(),a=o.party[this._selectedCharIdx];if(!a){i.target.checked=!1;return}const f=`auto_${this._tab}`;if(i.target.checked){const b=()=>{a.autoBuild||(a.autoBuild={}),a.autoBuild[f]=!0;let m=0;for(;this._applyOneRecommended(a)&&m++<200;);this.audio.playSfx("spell"),this._render()};if(o.autoModeAccepted){b();return}i.target.checked=!1,it({title:"Enable Auto-Recommend?",message:"Auto-apply recommended points on level-up for this tab? You can uncheck this later.",confirmText:"Enable Auto",cancelText:"Cancel",onConfirm:()=>{i.target.checked=!0,o.autoModeAccepted=!0,b()}})}else a.autoBuild&&(a.autoBuild[f]=!1)}),this._el.querySelectorAll(".passive-node").forEach(i=>{lt(),ot(i,()=>{const o=i.querySelector("[data-passive]"),a=o==null?void 0:o.dataset.passive,f=_.get().party[this._selectedCharIdx];if(!f||!a)return"";const m=j(f.class).find(v=>v.id===a);if(!m)return"";const h=(f.passiveRanks||{})[a]||0;return`<div class="tt-title">${m.name}</div><div class="tt-sub">Rank ${h} / ${m.maxRank}</div><div class="tt-row">${m.desc}</div>`})}),this._el.querySelectorAll("[data-passive]").forEach(i=>{i.addEventListener("click",()=>{if(i.disabled)return;const a=_.get().party[this._selectedCharIdx];if(!a||(a.pendingPassivePoints||0)<=0)return;const g=i.dataset.passive,b=j(a.class).find(h=>h.id===g);if(!b)return;a.passiveRanks||(a.passiveRanks={});const m=a.passiveRanks[g]||0;m>=b.maxRank||(a.passiveRanks[g]=m+1,a.pendingPassivePoints-=1,st(a),this.audio.playSfx("spell"),this._render())})}),this._el.querySelectorAll("[data-attr]").forEach(i=>{i.addEventListener("click",()=>{if(i.disabled)return;const a=_.get().party[this._selectedCharIdx];if(!a||(a.pendingAttrPoints||0)<=0)return;const g=i.dataset.attr;a.attrs||(a.attrs={STR:8,DEX:8,INT:8,CON:8}),a.attrs[g]=(a.attrs[g]||8)+1,a.pendingAttrPoints-=1;try{a.maxHp=G(a),a.maxMp=Y(a)}catch{}this.audio.playSfx("spell"),this._render()})}),this._el.querySelectorAll("[data-auto-tab]").forEach(i=>{i.addEventListener("click",()=>{if(q()){this._showHardLockTip(i);return}const o=_.get(),a=o.party[this._selectedCharIdx];if(!a)return;const g=i.dataset.autoTab,f=rt[g],b=Mt[g];if(!f)return;if(!a.autoBuild||At(o.party,a)){const u=a.autoBuild||{};a.autoBuild={auto_attrs:!!u.auto_attrs,auto_passive:!!u.auto_passive,auto_active:!!u.auto_active}}const m=!!a.autoBuild[f],h=a[b]||0,v=()=>{const u=this._tab;this._tab=g;let x=0;for(;this._applyOneRecommended(a)&&x++<200;);this._tab=u},$=u=>{a.autoBuild[f]=u,u&&v(),this.audio.playSfx("click"),this._render()};if(m&&h>0){v(),this.audio.playSfx("click"),this._render();return}if(m||h<=0){$(!m);return}const n=_.get();if(n.autoModeAccepted){$(!0);return}it({title:Tt[g]+"?",message:Et[g],confirmText:"Enable Auto",cancelText:"Cancel",onConfirm:()=>{n.autoModeAccepted=!0,$(!0)}})})});const e=this._el.querySelector("#skill-stats-base");e&&!e._wired&&(e._wired=!0,e.addEventListener("click",()=>{const i=!e.classList.contains("on");Q(i),this._render()})),this._el.querySelectorAll("[data-talent]").forEach(i=>{i.addEventListener("click",()=>{var b;if(i.disabled)return;const a=_.get().party[this._selectedCharIdx];if(!a||(a.pendingSkillPoints||0)<=0||(a.talentsPurchased||(a.talentsPurchased={}),a.talentsPurchased[i.dataset.talent]))return;a.talentsPurchased[i.dataset.talent]=!0,a.pendingSkillPoints=Math.max(0,(a.pendingSkillPoints||0)-1);const g=i.dataset.talent,f=Object.values(V);for(const m of f){const h=(m.talents||[]).find(v=>v.id===g);if((b=h==null?void 0:h.effect)!=null&&b.unlocksCompanion){const v=h.effect.unlocksCompanion,$=wt[v];if($){const n={...$,id:v+"_"+a.id,templateId:v,ownerId:a.id,ownerName:a.name,level:a.level||1,attrs:{...$.attrs}},u=Math.floor(((a.level||1)-1)*.5);n.attrs.STR+=u,n.attrs.DEX+=u,n.attrs.INT+=u,n.attrs.CON+=u,n.maxHp=50+n.attrs.CON*10,n.hp=n.maxHp,n.maxMp=10+n.attrs.INT*3,n.mp=n.maxMp,_.addToCompanions(n)||_.addToBench(n)}break}}this.audio.playSfx("spell"),this._render()})}),this._el.querySelectorAll(".sd-talent").forEach(i=>{const o=i.querySelector("[data-talent]");if(!o)return;const a=o.dataset.talent;let g=null,f=null;for(const b of Object.values(V)){const m=(b.talents||[]).find(h=>h.id===a);if(m){g=m.effect,f=m.desc;break}}lt(),ot(i,()=>{const b=g?zt(g):[];return!b.length&&!f?null:`${b.length?b.map(h=>`<div class="tt-row">${h}</div>`).join(""):""}`})})}_showHardLockTip(e){var r,i,o;if((r=this._el)==null?void 0:r.querySelector(".hard-lock-tip"))return;const t=document.createElement("div");t.className="hard-lock-tip",t.textContent="Auto disabled on Hard difficulty.";const d=e?e.getBoundingClientRect():null,s=(i=this._el)==null?void 0:i.getBoundingClientRect();d&&s&&(t.style.position="absolute",t.style.top=d.bottom-s.top+6+"px",t.style.left=d.left-s.left+"px"),(o=this._el)==null||o.appendChild(t),setTimeout(()=>t.remove(),2e3)}onPause(){this._el&&(this._el.style.display="none")}onResume(){this._el&&(this._el.style.display="")}update(){}draw(){}onExit(){at(this._el),this._el=null}destroy(){at(this._el),this._el=null}}const Bt=`
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
`;export{Nt as SkillTreeScreen};
