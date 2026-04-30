import{t as ce,v as ne,w as pe,y as me,z as U,B as ue,D as W,E as ge,J as D,K as L,L as be,G as _,i as fe,c as he,P as V,Q as G,p as ve,k as ke,q as xe,s as K,S as z,R as Y,C as _e,T as N,I as J,r as Z}from"./play-B7EEPE2p.js";import{showConfirmModal as Q}from"./ConfirmModal-DSbZNKF-.js";import"./savesClient-DUFjgBxb.js";const $e={pet_skeletal_warrior:{id:"pet_skeletal_warrior",name:"Skeletal Warrior",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"necromancer",level:1,attrs:{STR:12,DEX:8,INT:4,CON:14},description:"Undead soldier bound by dark magic. Fights with hollow determination."},pet_bone_golem:{id:"pet_bone_golem",name:"Bone Golem",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"necromancer",level:1,attrs:{STR:16,DEX:4,INT:2,CON:18},description:"Massive construct of fused bones. Slow but devastating."},pet_wolf:{id:"pet_wolf",name:"Forest Wolf",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"druid",level:1,attrs:{STR:10,DEX:14,INT:4,CON:10},description:"A wild wolf bonded through nature magic. Swift and loyal."},pet_bear:{id:"pet_bear",name:"Cave Bear",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"druid",level:1,attrs:{STR:14,DEX:6,INT:4,CON:16},description:"A massive bear called from the deep woods. Absorbs punishment."},pet_imp:{id:"pet_imp",name:"Bound Imp",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"warlock",level:1,attrs:{STR:6,DEX:12,INT:12,CON:6},description:"A mischievous lesser demon. Small but cunning."},pet_demon:{id:"pet_demon",name:"Infernal Hound",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"warlock",level:1,attrs:{STR:14,DEX:10,INT:8,CON:12},description:"A summoned demon beast from the lower planes."},pet_war_hound:{id:"pet_war_hound",name:"Trained War Hound",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"ranger",level:1,attrs:{STR:10,DEX:14,INT:6,CON:10},description:"An armored hunting dog trained for battle."},pet_fire_elemental:{id:"pet_fire_elemental",name:"Fire Elemental",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"pyromancer",level:1,attrs:{STR:8,DEX:8,INT:16,CON:8},description:"A living flame summoned from the ember planes."},pet_lightning_elemental:{id:"pet_lightning_elemental",name:"Lightning Elemental",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"stormcaller",level:1,attrs:{STR:6,DEX:14,INT:14,CON:6},description:"A crackling bolt given form and purpose."},pet_familiar:{id:"pet_familiar",name:"Arcane Familiar",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"mage",level:1,attrs:{STR:4,DEX:10,INT:16,CON:8},description:"A mystical black cat wreathed in arcane runes, bound to its mage by ancient pact."},pet_clockwork_turret:{id:"pet_clockwork_turret",name:"Clockwork Turret",className:"Companion",class:"companion",isCompanion:!0,isPet:!0,ownerClass:"tinker",level:1,attrs:{STR:12,DEX:8,INT:10,CON:14},sprite:"clockwork_turret",description:"A brass tripod turret with a single arcane-blue eye. Springs wound tight, barrel loaded with rune-etched bolts."}};let A=null;function ee(){A&&A.parentNode&&A.parentNode.removeChild(A),A=null}function ye(u,s){const o=s.getBoundingClientRect(),e=u.getBoundingClientRect();let l=o.left+o.width/2-e.width/2,t=o.top-e.height-10;l<10&&(l=10),l+e.width>window.innerWidth-10&&(l=window.innerWidth-e.width-10),t<10&&(t=o.bottom+10),u.style.left=`${l}px`,u.style.top=`${t}px`}function te(u,s,o={}){if(!u)return()=>{};const e=o.className||"rsg-tooltip",l=b=>{ee();const c=s();if(!c)return;const p=document.createElement("div");p.className=e,p.innerHTML=c,document.body.appendChild(p),A=p,ye(p,b.currentTarget||u)},t=()=>ee();u.addEventListener("mouseenter",l),u.addEventListener("mouseleave",t);let n=null;const i=b=>{clearTimeout(n),n=setTimeout(()=>l(b),350)},a=()=>{clearTimeout(n),setTimeout(t,1500)},r=()=>{clearTimeout(n),t()};return u.addEventListener("touchstart",i,{passive:!0}),u.addEventListener("touchend",a),u.addEventListener("touchcancel",r),()=>{u.removeEventListener("mouseenter",l),u.removeEventListener("mouseleave",t),u.removeEventListener("touchstart",i),u.removeEventListener("touchend",a),u.removeEventListener("touchcancel",r),clearTimeout(n)}}function se(){if(document.getElementById("rsg-tooltip-styles"))return;const u=document.createElement("style");u.id="rsg-tooltip-styles",u.textContent=`
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
  `,document.head.appendChild(u)}function we(u){return u==="magic"?"Magic Damage":u==="light"?"Light Damage":"Heavy Damage"}function Se(u,s={}){const{withSpendButtons:o=!1,pendingAttrPoints:e=0,includeHeader:l=!1,headerLabel:t=o?"Attributes":"Character Stats",baseToggleId:n="stats-base-chk"}=s;if(!u)return'<div class="stat-row"><span>No character selected</span></div>';const i=u.baseAttrs||u.attrs||{STR:8,DEX:8,INT:8,CON:8},a=u.attrs||i,r=ce(),b=u.equipment||{};let c=0;for(const d of Object.values(b))d!=null&&d.armor&&(c+=d.armor);const p=0,g=ne(u);c+=g.armor||0;const h=pe(b),v=r?i:{STR:(a.STR||8)+(g.str||0),DEX:(a.DEX||8)+(g.dex||0),INT:(a.INT||8)+(g.int||0),CON:(a.CON||8)+(g.con||0)},f=me(b)+(g.dmg||0),m=U(v,r?0:f,h),k=U(i,0,h),w=we(h),C=r?0:g.magicResist||0,I=(d,x)=>({hp:x?L(u):50+d.CON*10,mp:x?D(u):30+d.INT*8,hit:Math.min(95,70+Math.round(d.DEX*1.2)+(x&&g.hit||0)),dodge:Math.min(40,5+Math.round(d.DEX*.8)+(x&&g.dodge||0)),spl:+(d.INT*.025+(x&&g.spellPower||0)).toFixed(2)}),$=I(r?i:v,!r),T=I(i,!1),M=r?p:c,ie=r?0:ue(u).resistAll||0,R=W(M,ie),oe=W(p,0),y=(d,x,S)=>{const P=be(x,S,d);return P?` style="color:${P}"`:""},O=["STR","DEX","INT","CON"].map(d=>{const x=d.toLowerCase(),S=v[d],P=y(x,S,i[d]);if(o){const B=e>0;return`
        <div class="stat-row stat-row-attr">
          <span class="sr-label stat-label" data-stat="${d}">${d}</span>
          <span class="sr-val"${P}>${Math.floor(S)}</span>
          <button type="button" class="sr-attr-btn${B?"":" disabled"}" data-attr="${d}" ${B?"":"disabled"} aria-label="Increase ${d}">+1</button>
        </div>`}return`<div class="stat-row"><span class="sr-label stat-label" data-stat="${d}">${d}</span><span class="sr-val"${P}>${Math.floor(S)}</span></div>`}).join(""),H=new Set(["str","dex","int","con","hp","mp","dmg","armor","hit","dodge","magicresist","magicResist","spellpower","spellPower"]),le={goldFind:"Gold Find",xpFind:"XP Find",manaRegen:"Mana Regen",lifeSteal:"Life Steal",manaSteal:"Mana Steal",initiative:"Initiative",critChance:"Crit Chance",critDamage:"Crit Damage",spellPower:"Spell Power",tradePrices:"Trade Prices"},E=[];if(!r){try{const d=ge(u);if((d==null?void 0:d.blockChance)>0){const x=`+${(d.blockChance*100).toFixed(1).replace(/\.0$/,"")}%`;E.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Chance">Block Chance</span><span class="sr-val" style="color:#6db3ff">${x}</span></div>`)}(d==null?void 0:d.blockPower)>0&&E.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="Block Power">Block Power</span><span class="sr-val" style="color:#6db3ff">+${Math.round(d.blockPower)}</span></div>`)}catch{}for(const d of Object.keys(g)){if(H.has(d)||H.has(d.toLowerCase()))continue;const x=g[d];if(!x)continue;const S=le[d]||d.replace(/([A-Z])/g," $1").replace(/^./,de=>de.toUpperCase()),re=(d==="goldFind"||d==="xpFind"||d==="critChance"||d==="critDamage"||d==="tradePrices")&&Math.abs(x)<=3?`+${(x*100).toFixed(1).replace(/\.0$/,"")}%`:d==="lifeSteal"||d==="manaSteal"?`+${Math.round(x*10)/10}%`:`+${Math.round(x*100)/100}`;E.push(`<div class="stat-row"><span class="sr-label stat-label" data-stat="${S}">${S}</span><span class="sr-val" style="color:#6db3ff">${re}</span></div>`)}}const j=E.length?E.join(""):'<div class="stat-row"><span class="sr-label" style="color:#5a4a42;font-style:italic">None</span><span class="sr-val" style="color:#5a4a42">—</span></div>',q=l?`<div class="panel-label">${t}</div>`:"",F=`<label class="stats-base-toggle ember-check"><input type="checkbox" id="${n}"${r?" checked":""}> Show Base Attributes</label>`,X=`
    <div class="stat-row"><span class="sr-label stat-label" data-stat="HP">HP</span><span class="sr-val"${y("hp",$.hp,T.hp)}>${Math.floor($.hp)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Mana">Mana</span><span class="sr-val"${y("mp",$.mp,T.mp)}>${Math.floor($.mp)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Armor">Armor</span><span class="sr-val"${y("armor",M,p)}>${Math.floor(M)}</span></div>
    <div class="stat-row" title="Armor ${(R.armorDr*100).toFixed(1)}% + Misc ${(R.miscDr*100).toFixed(1)}% (multiplicative)"><span class="sr-label stat-label" data-stat="Damage Reduction">Damage Reduction</span><span class="sr-val"${y("dmgReduction",R.totalDr,oe.totalDr)}>${(R.totalDr*100).toFixed(1)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Magic Resist">Magic Resist</span><span class="sr-val"${y("magicResist",C,0)}>${Math.floor(C)}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Hit">Hit</span><span class="sr-val"${y("hit",$.hit,T.hit)}>${Math.floor($.hit)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Dodge">Dodge</span><span class="sr-val"${y("dodge",$.dodge,T.dodge)}>${Math.floor($.dodge)}%</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="${w}">${w}</span><span class="sr-val"${y("dmg",m[1],k[1])}>${Math.floor(m[0])}-${Math.floor(m[1])}</span></div>
    <div class="stat-row"><span class="sr-label stat-label" data-stat="Spell Power">Spell Power</span><span class="sr-val"${y("spellPower",$.spl,T.spl)}>+${Math.round($.spl*100)}%</span></div>
  `;return o?`
      ${q}
      ${F}
      <div class="cs-stats-grid">
        <div class="cs-section cs-section-attrs">
          <div class="panel-label">Attributes</div>
          ${O}
        </div>
        <div class="cs-section cs-section-derived">
          <div class="panel-label">Derived Stats</div>
          ${X}
          <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
          ${j}
        </div>
      </div>
    `:`
    ${q}
    ${F}
    <div class="cs-stats-grid">
      <div class="cs-section cs-section-derived">
        ${X}
      </div>
      <div class="cs-section cs-section-attrs">
        <div class="panel-label">Attributes</div>
        ${O}
        <div class="panel-label" style="margin-top:0.75rem">Other Effects</div>
        ${j}
      </div>
    </div>
  `}const ae={active:"auto_active",passive:"auto_passive",attrs:"auto_attrs"},Ce={active:"pendingSkillPoints",passive:"pendingPassivePoints",attrs:"pendingAttrPoints"},Pe={active:"Auto-spend talent points",passive:"Auto-spend passive points",attrs:"Auto-spend attribute points"},Ae={active:"Talent points will be auto-spent on each level-up using the class default order. You will not get a chance to pick talents yourself until you turn this off.",passive:"Passive points will be auto-spent on each level-up using the class default order. You will not get to choose which passives to learn until you turn this off.",attrs:"Attribute points will be auto-spent on each level-up using the class default priority. You will not get to choose which attributes to raise until you turn this off."};function Te(u){if(!u||typeof u!="object")return[];const s=[],o=t=>`${Math.round(t*100)}%`,e=t=>`${t} round${t===1?"":"s"}`,l={targets:t=>`Hits ${t} targets`,damageMult:t=>`Damage: ${t}x multiplier`,damage_mult:t=>`Damage: ${t}x multiplier`,dmgBuff:t=>`+${o(t)} party damage`,dmgReduct:t=>`-${o(t)} damage taken`,reflect:t=>`Reflects ${o(t)} damage back`,duration:t=>`Lasts ${e(t)}`,aoe:t=>`Area: ${t}`,tempHp:t=>`+${t} temporary HP per member`,healMult:t=>`Heals ${t}x multiplier`,attackSpeed:t=>`+${o(t)} attack speed`,mpCost:t=>t<0?`Mana cost -${Math.abs(t)}`:`Mana cost +${t}`,bleed:t=>`Applies Bleed (${e((t==null?void 0:t.duration)??t)})`,statusEffects:t=>Array.isArray(t)?t.map(n=>`${Math.round((n.chance||1)*100)}% chance: ${n.type} (${e(n.duration)})`).join(", "):String(t),status_apply:t=>`Applies ${t}`,immuneStun:t=>t?"Immune to Stun":"",immuneBleed:t=>t?"Immune to Bleed":"",unlocksCompanion:t=>`Unlocks companion: ${t}`};for(const[t,n]of Object.entries(u)){if(n==null||n===!1)continue;const i=l[t];if(i){const a=i(n);a&&s.push(a)}else{const a=t.replace(/_/g," ").replace(/([A-Z])/g," $1").trim(),r=typeof n=="object"?JSON.stringify(n):String(n);s.push(`${a}: ${r}`)}}return s}class Me{constructor(s,o){this.manager=s,this.audio=o,this._el=null,this._selectedCharIdx=0,this._selectedSkill=null,this._mobileDetailView=!1,this._tab="active"}onEnter(){try{const s=_.get(),o=(s==null?void 0:s.party)||[];let e=-1;s!=null&&s.skillFocusId&&(e=o.findIndex(t=>t&&t.id===s.skillFocusId),s.skillFocusId=null),e<0&&(e=o.findIndex(t=>t&&(t.pendingSkillPoints||0)+(t.pendingPassivePoints||0)+(t.pendingAttrPoints||0)>0)),e>=0&&(this._selectedCharIdx=e);const l=o[this._selectedCharIdx];l&&((l.pendingSkillPoints||0)>0?this._tab="active":(l.pendingPassivePoints||0)>0?this._tab="passive":(l.pendingAttrPoints||0)>0&&(this._tab="attrs"));for(const t of o){if(!t||!t.autoBuild)continue;const n=this._tab;for(const i of["active","passive","attrs"]){if(!t.autoBuild[`auto_${i}`])continue;this._tab=i;const a=this._selectedCharIdx;this._selectedCharIdx=o.indexOf(t);let r=0;for(;this._applyOneRecommended(t)&&r++<200;);this._selectedCharIdx=a}this._tab=n}}catch{}this._build()}_build(){fe("skill-styles",Ee),this._el=he("div","skill-screen"),this.manager.uiOverlay.appendChild(this._el),this._render()}_render(){var c,p,g,h,v,f;const o=_.get().party,e=o[this._selectedCharIdx],l=e?V(e.class):[],t=e?G(e.class,e.level||1):[],n=(e==null?void 0:e.talentsPurchased)||{},i={};for(const m of[".skill-list-panel",".skill-detail-panel",".passive-panel",".attrs-panel"]){const k=this._el.querySelector(m);k&&(i[m]=k.scrollTop)}const a=window.scrollY||document.documentElement.scrollTop,r=document.activeElement;if(r&&r!==document.body&&typeof r.blur=="function")try{r.blur()}catch{}this._el.innerHTML=`
      <div class="skill-header">
        <div class="skill-char-tabs" id="skill-char-tabs">
          ${o.map((m,k)=>{const w=(m.pendingSkillPoints||0)+(m.pendingPassivePoints||0)+(m.pendingAttrPoints||0),C=w>0&&k!==this._selectedCharIdx;return`
            <button type="button" class="sct-tab${k===this._selectedCharIdx?" active":""}" data-idx="${k}">
              <span class="sct-portrait">${ve(m,24)}</span>
              ${m.name} ${ke(m,12,"sct-class-icon")}<br><small>${m.className||m.class} Lv${m.level||1}</small>
              ${C?`<span class="sct-badge">${w>9?"9+":w}</span>`:""}
            </button>`}).join("")}
        </div>
        <div class="skill-header-btns">
          ${this._mobileDetailView?'<button type="button" class="skill-back-mobile" id="skill-back-mobile">← Back</button>':""}
          <button type="button" class="skill-close" id="skill-close">✕</button>
        </div>
      </div>
      <div class="skill-mode-tabs">
        <button type="button" class="smt-tab${this._tab==="active"?" active":""}${(c=e==null?void 0:e.autoBuild)!=null&&c.auto_active?" auto-on":""}" data-mode="active">
          Skills${e&&(e.pendingSkillPoints||0)>0?` <span class="smt-badge">${e.pendingSkillPoints}</span>`:""}${(p=e==null?void 0:e.autoBuild)!=null&&p.auto_active?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
        <button type="button" class="smt-tab${this._tab==="passive"?" active":""}${(g=e==null?void 0:e.autoBuild)!=null&&g.auto_passive?" auto-on":""}" data-mode="passive">
          Passive${e&&(e.pendingPassivePoints||0)>0?` <span class="smt-badge">${e.pendingPassivePoints}</span>`:""}${(h=e==null?void 0:e.autoBuild)!=null&&h.auto_passive?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
        <button type="button" class="smt-tab${this._tab==="attrs"?" active":""}${(v=e==null?void 0:e.autoBuild)!=null&&v.auto_attrs?" auto-on":""}" data-mode="attrs">
          Attributes${e&&(e.pendingAttrPoints||0)>0?` <span class="smt-badge">${e.pendingAttrPoints}</span>`:""}${(f=e==null?void 0:e.autoBuild)!=null&&f.auto_attrs?' <span class="smt-auto-check" aria-label="Auto on" title="Auto on">✓</span>':""}
        </button>
      </div>
      ${this._tab==="attrs"?this._renderAttrsPanel(e):this._tab==="passive"?this._renderPassivePanel(e):`
      <div class="skill-layout${this._mobileDetailView?" mobile-detail-open":""}">
        <!-- Skill list -->
        <div class="skill-list-panel">
          <div class="skill-panel-head">
            <div class="panel-label">Skills${e!=null&&e.className?` — ${e.className}`:""}</div>
            ${e?this._renderAutoToggle(e,"active"):""}
          </div>
          ${e?`<div class="passive-points-banner" style="margin-bottom:0.65rem"><span class="pp-num">${e.pendingSkillPoints||0}</span><span class="pp-label">Talent Point${(e.pendingSkillPoints||0)===1?"":"s"} Available</span></div>`:""}
          ${l.map(m=>{const k=t.find(w=>w.name===m.name);return`
              <div class="skill-row${k?"":" locked"}${this._selectedSkill===m.name?" selected":""}" data-skill="${m.name}">
                <div class="sk-level-badge">Lv${m.unlockLevel}</div>
                <div class="sk-info">
                  <div class="sk-name">${m.name}</div>
                  <div class="sk-type">${m.type} · ${m.aoe||m.target||"self"}</div>
                </div>
                <div class="sk-cost">${m.mpCost>0?`${m.mpCost} MP`:"Passive"}</div>
                ${k?"":'<div class="sk-lock-icon">🔒</div>'}
              </div>
            `}).join("")}
        </div>
        <!-- Skill detail / talents -->
        <div class="skill-detail-panel">
          ${this._selectedSkill?this._renderSkillDetail(e,n):`
            <div class="skill-select-prompt">Select a skill to view its description and upgrade talents.</div>
          `}
        </div>
      </div>
      `}
    `,this._wireEvents(),xe(this._el);const b=this._el.querySelector("#skill-stats-base");b&&b.addEventListener("change",()=>{K(b.checked),this._render()});for(const m of Object.keys(i)){const k=this._el.querySelector(m);k&&(k.scrollTop=i[m])}window.scrollTo(0,a)}_renderSkillDetail(s,o){var b;const e=Object.values(z).find(c=>c.name===this._selectedSkill);if(!e)return"";const l=e.talents||[],t=(s==null?void 0:s.pendingSkillPoints)||0;let n=null,i=null;if(s){const c=s.attrs||{},p=ne(s),g={STR:(c.STR||8)+(p.str||0),DEX:(c.DEX||8)+(p.dex||0),INT:(c.INT||8)+(p.int||0),CON:(c.CON||8)+(p.con||0)},h=g.INT*.025+(p.spellPower||0);var a=e;try{a=Y(e,s)}catch{}if(e.damageStat){const v=e.damageStat,f=I=>g[I.toUpperCase()]||0,m=v==="str_int"?Math.max(f("str"),f("int")):f(v),k=/int|spell/i.test(v)||["fire","ice","lightning","holy","necro"].includes(e.type),C=(+a.damageMult||0)*m;n=Math.round(k?C*(1+h):C)}if(e.healStat){const v=e.healStat,f=g[v.toUpperCase()]||0;i=Math.round((+a.healMult||0)*f*(1+h))}}let r=e;try{s&&(r=Y(e,s))}catch{}return`
      <div class="skill-detail-inner">
        <div class="sd-name">${e.name}</div>
        <div class="sd-type"><span class="sd-badge">${e.type}</span>${e.aoe?`<span class="sd-badge">${e.aoe}</span>`:""}</div>
        <div class="sd-desc">${e.description}</div>
        ${e.mpCost>0?`<div class="sd-cost">Mana Cost: <strong>${e.mpCost}</strong></div>`:""}
        ${e.damageStat?`<div class="sd-formula">Damage: ${r.damageMult}× ${e.damageStat.toUpperCase()}${r.damageMult!==e.damageMult?` <span style="color:#6a8aa0">(base ${e.damageMult}×, upgraded)</span>`:""}</div>`:""}
        ${n!==null?`<div class="sd-estimate">Est. Damage: <strong>~${n}</strong> <span style="color:#8a7a6a">per target, before armor/resist</span></div>`:""}
        ${e.healStat?`<div class="sd-formula">Heal: ${r.healMult}× ${e.healStat.toUpperCase()}${r.healMult!==e.healMult?` <span style="color:#6a8aa0">(base ${e.healMult}×)</span>`:""}</div>`:""}
        ${i!==null?`<div class="sd-estimate">Est. Heal: <strong>~${i}</strong></div>`:""}
        ${(b=e.statusEffects)!=null&&b.length?`
          <div class="sd-effects">
            ${e.statusEffects.map(c=>`<div class="sd-effect"><span class="eff-name">${c.type.toUpperCase()}</span> ${Math.round(c.chance*100)}% chance · ${c.duration} rounds</div>`).join("")}
          </div>
        `:""}
        ${l.length?`
          <div class="sd-talents-title">Upgrade Talents</div>
          <div class="sd-talents">
            ${l.map(c=>{const p=o[c.id],g=!p&&t>0;return`
                <div class="sd-talent${p?" purchased":""}">
                  <div class="sdt-info">
                    <div class="sdt-name">${c.name}</div>
                    <div class="sdt-desc">${c.desc}</div>
                  </div>
                  <button type="button" class="sdt-btn${p?" done":""}" data-talent="${c.id}" ${p||!g?"disabled":""}>
                    ${p?"✓ Learned":"Learn (1 pt)"}
                  </button>
                </div>
              `}).join("")}
          </div>
        `:'<div style="color:#8a7a6a;font-size:0.8rem;margin-top:1rem">No upgrade talents available for this skill.</div>'}
      </div>
    `}_renderRecommendBar(s){const o=this._tab,e=o==="active"?s.pendingSkillPoints||0:o==="passive"?s.pendingPassivePoints||0:s.pendingAttrPoints||0,l=`auto_${o}`,t=!!(s.autoBuild&&s.autoBuild[l]);return`
      <div class="recommend-bar">
        <button type="button" class="recommend-btn${e>0?"":" disabled"}" id="recommend-btn" ${e>0?"":"disabled"}>
          ✦ Recommend
        </button>
        <label class="recommend-auto">
          <input type="checkbox" id="recommend-auto" ${t?"checked":""}>
          Auto
        </label>
        <span class="recommend-note">${e>0?`${e} point${e===1?"":"s"} pending`:"No points pending"}</span>
      </div>
    `}_recommendAttr(s){const o=_e.find(r=>r.id===s.class),e=(o==null?void 0:o.primaryAttr)||"STR",l=s.baseAttrs||{STR:8,DEX:8,INT:8,CON:8},t=s.attrs||{...l},n=(t[e]||0)-(l[e]||0),i=(t.CON||0)-(l.CON||0),a=n+i;return a>0&&i/a<.2?"CON":e}_recommendPassive(s){const o=N(s.class),e=s.passiveRanks||{},l=/lifesteal|life_steal|mana_regen|mana_steal|regen|lifebind|soulbind|exotic|leech|siphon/i,t=o.find(n=>l.test(n.id+" "+(n.name||"")+" "+(n.desc||""))&&(e[n.id]||0)<n.maxRank);return t?t.id:(o.find(n=>(e[n.id]||0)<n.maxRank)||{}).id||null}_recommendTalent(s){const o=V(s.class),e=G(s.class,s.level||1),l=s.talentsPurchased||{},t=[...e].sort((n,i)=>(n.unlockLevel||0)-(i.unlockLevel||0));for(const n of t){const i=o.find(a=>a.name===n.name)||n;for(const a of i.talents||[])if(!l[a.id])return{skillName:n.name,talentId:a.id}}return null}_applyOneRecommended(s){const o=this._tab;if(o==="attrs"){if((s.pendingAttrPoints||0)<=0)return!1;const l=this._recommendAttr(s);s.attrs[l]=(s.attrs[l]||8)+1,s.pendingAttrPoints-=1;try{s.maxHp=L(s),s.maxMp=D(s)}catch{}return!0}if(o==="passive"){if((s.pendingPassivePoints||0)<=0)return!1;const l=this._recommendPassive(s);if(!l)return!1;const n=N(s.class).find(a=>a.id===l);if(!n)return!1;s.passiveRanks||(s.passiveRanks={});const i=s.passiveRanks[l]||0;return i>=n.maxRank?!1:(s.passiveRanks[l]=i+1,s.pendingPassivePoints-=1,J(s),!0)}if((s.pendingSkillPoints||0)<=0)return!1;const e=this._recommendTalent(s);return e?(s.talentsPurchased||(s.talentsPurchased={}),s.talentsPurchased[e.talentId]=!0,s.pendingSkillPoints=Math.max(0,(s.pendingSkillPoints||0)-1),this._selectedSkill=e.skillName,!0):!1}_renderPassivePanel(s){if(!s)return'<div class="passive-empty">No character selected.</div>';const o=N(s.class),e=s.passiveRanks||{},l=s.pendingPassivePoints||0;return`
      <div class="passive-panel">
        <div class="passive-header">
          <div class="panel-label">Passives${s.className?` — ${s.className}`:""}</div>
          <div class="passive-points-banner">
            <span class="pp-num">${l}</span>
            <span class="pp-label">Passive Point${l===1?"":"s"} Available</span>
          </div>
          ${this._renderAutoToggle(s,"passive")}
        </div>
        <div class="passive-nodes">
          ${o.map((t,n)=>{const i=e[t.id]||0,a=l>0&&i<t.maxRank;return`
              <div class="passive-node${i>0?" owned":""}">
                <div class="pn-index">${n+1}</div>
                <div class="pn-info">
                  <div class="pn-name">${t.name}</div>
                  <div class="pn-desc">${t.desc}</div>
                  <div class="pn-rank">Rank <strong>${i}</strong> / ${t.maxRank}</div>
                </div>
                <button type="button" class="pn-btn${a?"":" disabled"}" data-passive="${t.id}" ${a?"":"disabled"}>
                  ${i>=t.maxRank?"✓ Maxed":"Learn (1 pt)"}
                </button>
              </div>
            `}).join("")}
        </div>
        <div class="passive-hint">Earn 1 Passive Point every 2 levels. Bonuses are permanent.</div>
      </div>
    `}_renderAttrsPanel(s){if(!s)return'<div class="passive-empty">No character selected.</div>';const o=s.pendingAttrPoints||0,e=Se(s,{withSpendButtons:!0,pendingAttrPoints:o,includeHeader:!1,baseToggleId:"skill-stats-base"});return`
      <div class="passive-panel attrs-panel">
        <div class="passive-header">
          <div class="panel-label">Attributes — ${s.className||s.class}</div>
          <div class="passive-points-banner">
            <span class="pp-num">${o}</span>
            <span class="pp-label">Attribute Point${o===1?"":"s"} Available</span>
          </div>
          ${this._renderAutoToggle(s,"attrs")}
        </div>
        <div class="char-stats-panel attrs-stats-panel">
          ${e}
        </div>
        <div class="passive-hint">Spend deferred points from level-ups any time.</div>
      </div>
    `}_renderAutoToggle(s,o){const e=ae[o],l=!!(s.autoBuild&&s.autoBuild[e]);return`
      <button type="button" class="auto-toggle${l?" on":""}" data-auto-tab="${o}" aria-pressed="${l?"true":"false"}" title="${l?"Auto: On":"Auto: Off"}">
        ${l?'<span class="auto-check" aria-hidden="true">✓</span>':'<span class="auto-check auto-off" aria-hidden="true">○</span>'}Auto
      </button>
    `}_wireEvents(){var o,e,l,t;(o=this._el.querySelector("#skill-close"))==null||o.addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),(e=this._el.querySelector("#skill-back-mobile"))==null||e.addEventListener("click",()=>{this.audio.playSfx("click"),this._mobileDetailView=!1,this._selectedSkill=null,this._render()}),this._el.querySelectorAll(".sct-tab").forEach(n=>{n.addEventListener("click",()=>{var r;this.audio.playSfx("click"),this._selectedCharIdx=parseInt(n.dataset.idx),this._selectedSkill=null,this._mobileDetailView=!1;const i=_.get(),a=(r=i==null?void 0:i.party)==null?void 0:r[this._selectedCharIdx];a&&((a.pendingSkillPoints||0)>0?this._tab="active":(a.pendingPassivePoints||0)>0?this._tab="passive":(a.pendingAttrPoints||0)>0&&(this._tab="attrs")),this._render()})}),this._el.querySelectorAll(".skill-row").forEach(n=>{n.addEventListener("click",()=>{n.classList.contains("locked")||(this.audio.playSfx("click"),this._selectedSkill=n.dataset.skill,this._mobileDetailView=!0,this._render())})}),this._el.querySelectorAll(".smt-tab").forEach(n=>{n.addEventListener("click",()=>{this.audio.playSfx("click"),this._tab=n.dataset.mode,this._selectedSkill=null,this._mobileDetailView=!1,this._render()})}),(l=this._el.querySelector("#recommend-btn"))==null||l.addEventListener("click",()=>{const i=_.get().party[this._selectedCharIdx];i&&this._applyOneRecommended(i)&&(this.audio.playSfx("spell"),this._render())}),(t=this._el.querySelector("#recommend-auto"))==null||t.addEventListener("change",n=>{const a=_.get().party[this._selectedCharIdx];if(!a){n.target.checked=!1;return}const b=`auto_${this._tab}`;n.target.checked?(n.target.checked=!1,Q({title:"Enable Auto-Recommend?",message:"Auto-apply recommended points on level-up for this tab? You can uncheck this later.",confirmText:"Enable Auto",cancelText:"Cancel",onConfirm:()=>{n.target.checked=!0,a.autoBuild||(a.autoBuild={}),a.autoBuild[b]=!0;let c=0;for(;this._applyOneRecommended(a)&&c++<200;);this.audio.playSfx("spell"),this._render()}})):a.autoBuild&&(a.autoBuild[b]=!1)}),this._el.querySelectorAll(".passive-node").forEach(n=>{se(),te(n,()=>{const i=n.querySelector("[data-passive]"),a=i==null?void 0:i.dataset.passive,b=_.get().party[this._selectedCharIdx];if(!b||!a)return"";const p=N(b.class).find(h=>h.id===a);if(!p)return"";const g=(b.passiveRanks||{})[a]||0;return`<div class="tt-title">${p.name}</div><div class="tt-sub">Rank ${g} / ${p.maxRank}</div><div class="tt-row">${p.desc}</div>`})}),this._el.querySelectorAll("[data-passive]").forEach(n=>{n.addEventListener("click",()=>{if(n.disabled)return;const a=_.get().party[this._selectedCharIdx];if(!a||(a.pendingPassivePoints||0)<=0)return;const r=n.dataset.passive,c=N(a.class).find(g=>g.id===r);if(!c)return;a.passiveRanks||(a.passiveRanks={});const p=a.passiveRanks[r]||0;p>=c.maxRank||(a.passiveRanks[r]=p+1,a.pendingPassivePoints-=1,J(a),this.audio.playSfx("spell"),this._render())})}),this._el.querySelectorAll("[data-attr]").forEach(n=>{n.addEventListener("click",()=>{if(n.disabled)return;const a=_.get().party[this._selectedCharIdx];if(!a||(a.pendingAttrPoints||0)<=0)return;const r=n.dataset.attr;a.attrs||(a.attrs={STR:8,DEX:8,INT:8,CON:8}),a.attrs[r]=(a.attrs[r]||8)+1,a.pendingAttrPoints-=1;try{a.maxHp=L(a),a.maxMp=D(a)}catch{}this.audio.playSfx("spell"),this._render()})}),this._el.querySelectorAll("[data-auto-tab]").forEach(n=>{n.addEventListener("click",()=>{const a=_.get().party[this._selectedCharIdx];if(!a)return;const r=n.dataset.autoTab,b=ae[r],c=Ce[r];if(!b)return;a.autoBuild||(a.autoBuild={});const p=!!a.autoBuild[b],g=a[c]||0,h=()=>{const f=this._tab;this._tab=r;let m=0;for(;this._applyOneRecommended(a)&&m++<200;);this._tab=f},v=f=>{a.autoBuild[b]=f,f&&h(),this.audio.playSfx("click"),this._render()};if(p&&g>0){h(),this.audio.playSfx("click"),this._render();return}if(p||g<=0){v(!p);return}Q({title:Pe[r]+"?",message:Ae[r],confirmText:"Enable Auto",cancelText:"Cancel",onConfirm:()=>v(!0)})})});const s=this._el.querySelector("#skill-stats-base");s&&!s._wired&&(s._wired=!0,s.addEventListener("change",()=>{K(s.checked),this._render()})),this._el.querySelectorAll("[data-talent]").forEach(n=>{n.addEventListener("click",()=>{var c;if(n.disabled)return;const a=_.get().party[this._selectedCharIdx];if(!a||(a.pendingSkillPoints||0)<=0||(a.talentsPurchased||(a.talentsPurchased={}),a.talentsPurchased[n.dataset.talent]))return;a.talentsPurchased[n.dataset.talent]=!0,a.pendingSkillPoints=Math.max(0,(a.pendingSkillPoints||0)-1);const r=n.dataset.talent,b=Object.values(z);for(const p of b){const g=(p.talents||[]).find(h=>h.id===r);if((c=g==null?void 0:g.effect)!=null&&c.unlocksCompanion){const h=g.effect.unlocksCompanion,v=$e[h];if(v){const f={...v,id:h+"_"+a.id,templateId:h,ownerId:a.id,ownerName:a.name,level:a.level||1,attrs:{...v.attrs}},m=Math.floor(((a.level||1)-1)*.5);f.attrs.STR+=m,f.attrs.DEX+=m,f.attrs.INT+=m,f.attrs.CON+=m,f.maxHp=50+f.attrs.CON*10,f.hp=f.maxHp,f.maxMp=10+f.attrs.INT*3,f.mp=f.maxMp,_.addToCompanions(f)||_.addToBench(f)}break}}this.audio.playSfx("spell"),this._render()})}),this._el.querySelectorAll(".sd-talent").forEach(n=>{const i=n.querySelector("[data-talent]");if(!i)return;const a=i.dataset.talent;let r=null,b=null;for(const c of Object.values(z)){const p=(c.talents||[]).find(g=>g.id===a);if(p){r=p.effect,b=p.desc;break}}se(),te(n,()=>{const c=r?Te(r):[];return!c.length&&!b?null:`${c.length?c.map(g=>`<div class="tt-row">${g}</div>`).join(""):""}`})})}onPause(){this._el&&(this._el.style.display="none")}onResume(){this._el&&(this._el.style.display="")}update(){}draw(){}onExit(){Z(this._el),this._el=null}destroy(){Z(this._el),this._el=null}}const Ee=`
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
@media (max-width: 600px) {
  .skill-layout { grid-template-columns: 1fr; }
  .skill-list-panel { border-right: none; border-bottom: 1px solid rgba(232,160,32,0.15); }
  .skill-layout.mobile-detail-open .skill-list-panel { display: none; }
  .skill-layout:not(.mobile-detail-open) .skill-detail-panel { display: none; }
  .skill-back-mobile { display: block; }
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
.smt-badge { display: inline-block; margin-left: 0.25rem; padding: 0.1rem 0.35rem; background: #c04030; color: #fff; font-size: 0.62rem; border-radius: 8px; }
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
.passive-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
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
.skill-panel-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
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
.auto-toggle .auto-check.auto-off { color: rgba(232,160,32,0.6); font-weight: 400; }
.auto-toggle .auto-check {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%;
  background: #48b060; color: #06200d; font-size: 10px; font-weight: 800;
  line-height: 1;
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
`;export{Me as SkillTreeScreen};
