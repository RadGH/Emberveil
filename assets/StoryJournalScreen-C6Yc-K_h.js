import{i as b,r as g,c as l,G as u}from"./play-13DYHLpj.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const f="story-journal-screen-styles",v=`
.sjr-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0a0608;
  color: #f0e8d8;
  font-family: Inter, sans-serif;
  overflow: hidden;
}

/* Top bar */
.sjr-topbar {
  display: flex;
  align-items: center;
  height: 48px;
  flex-shrink: 0;
  background: rgba(10,6,8,0.96);
  border-bottom: 1px solid rgba(232,160,32,0.2);
  padding: 0 4px;
  gap: 0;
}
.sjr-topbar-btn {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  background: transparent;
  border: none;
  color: #c8a060;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: background 0.12s;
}
.sjr-topbar-btn:hover,
.sjr-topbar-btn:active { background: rgba(232,160,32,0.12); }
.sjr-topbar-title {
  flex: 1;
  text-align: center;
  font-family: Cinzel, serif;
  font-size: 16px;
  font-weight: 700;
  color: #e8c070;
  letter-spacing: 0.08em;
}

/* Tab strip */
.sjr-tabs {
  display: flex;
  height: 40px;
  flex-shrink: 0;
  background: rgba(12,8,16,0.9);
  border-bottom: 1px solid rgba(232,160,32,0.12);
  overflow-x: auto;
  scrollbar-width: none;
}
.sjr-tabs::-webkit-scrollbar { display: none; }
.sjr-tab {
  flex: 1;
  min-width: 60px;
  height: 40px;
  min-height: 40px;
  padding: 0 8px;
  border: none;
  background: transparent;
  color: #7a6850;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.sjr-tab.active {
  color: #e8c070;
  border-bottom-color: #e8a020;
}
.sjr-tab:hover:not(.active) { color: #c0a050; }

/* Content scroll area */
.sjr-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 0 env(safe-area-inset-bottom, 0px);
  -webkit-overflow-scrolling: touch;
}

/* List rows (64pt each) */
.sjr-row {
  display: flex;
  align-items: center;
  min-height: 64px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 12px;
  cursor: default;
}
.sjr-row:hover { background: rgba(232,160,32,0.04); }

.sjr-row-icon {
  width: 36px;
  height: 36px;
  min-width: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  background: rgba(60,40,20,0.5);
}
.sjr-row-body {
  flex: 1;
  min-width: 0;
}
.sjr-row-title {
  font-size: 14px;
  font-weight: 600;
  color: #e0d0b0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sjr-row-sub {
  font-size: 12px;
  color: #7a6850;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sjr-row-badge {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(80,60,20,0.6);
  color: #c0a040;
  flex-shrink: 0;
}
.sjr-row-badge.active  { background: rgba(30,80,40,0.6); color: #60d080; }
.sjr-row-badge.failed  { background: rgba(80,20,20,0.6); color: #d06060; }
.sjr-row-badge.complete { background: rgba(40,60,80,0.6); color: #70b0e0; }
.sjr-row-badge.positive { background: rgba(30,80,40,0.6); color: #60d080; }
.sjr-row-badge.negative { background: rgba(80,20,20,0.6); color: #d06060; }
.sjr-row-badge.neutral  { background: rgba(40,40,60,0.6); color: #9090c0; }

/* Section header */
.sjr-section-header {
  padding: 8px 16px 4px;
  font-family: Cinzel, serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #5a4a3a;
  border-bottom: 1px solid rgba(232,160,32,0.07);
}

/* Empty state */
.sjr-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: #4a3a2a;
  font-size: 14px;
  font-style: italic;
}

/* Ledger tab — pre/code block */
.sjr-ledger-wrap {
  padding: 12px 16px;
}
.sjr-ledger-tree {
  background: rgba(6,3,10,0.8);
  border: 1px solid rgba(232,160,32,0.12);
  border-radius: 8px;
  padding: 12px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #a0c0a0;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  max-height: 600px;
  overflow-y: auto;
}

/* Faction meter */
.sjr-faction-meter {
  width: 80px;
  height: 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.sjr-faction-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s;
}
.sjr-faction-fill.positive { background: #40b060; }
.sjr-faction-fill.negative { background: #c04040; }
.sjr-faction-fill.neutral  { background: #6060a0; }
`,m=[{id:"quests",label:"Quests"},{id:"factions",label:"Factions"},{id:"companions",label:"Companions"},{id:"lore",label:"Lore"},{id:"ledger",label:"Ledger"}];class _{constructor(r,o){this.manager=r,this.audio=o,this._el=null,this._tab="quests"}onEnter(){b(f,v),this._build()}onResume(){}onPause(){}update(){}draw(){}onExit(){g(this._el),this._el=null}destroy(){this.onExit()}_build(){this._el=l("div","sjr-screen");const r=l("div","sjr-topbar");r.innerHTML=`
      <button type="button" class="sjr-topbar-btn" id="sjr-back" aria-label="Back">&#8592;</button>
      <span class="sjr-topbar-title">Journal</span>
      <div style="width:44px"></div>
    `,this._el.appendChild(r);const o=l("div","sjr-tabs");o.setAttribute("role","tablist");for(const i of m){const t=document.createElement("button");t.type="button",t.role="tab",t.className=`sjr-tab${this._tab===i.id?" active":""}`,t.dataset.tab=i.id,t.textContent=i.label,t.setAttribute("aria-selected",String(this._tab===i.id)),o.appendChild(t)}this._el.appendChild(o);const e=l("div","sjr-content");e.id="sjr-content",this._el.appendChild(e),this.manager.uiOverlay.appendChild(this._el),r.querySelector("#sjr-back").addEventListener("click",()=>{var i,t;(t=(i=this.audio)==null?void 0:i.playSfx)==null||t.call(i,"click"),this.manager.pop()}),o.querySelectorAll(".sjr-tab").forEach(i=>{i.addEventListener("click",()=>{var t,n;(n=(t=this.audio)==null?void 0:t.playSfx)==null||n.call(t,"click"),this._tab=i.dataset.tab,o.querySelectorAll(".sjr-tab").forEach(a=>{a.classList.toggle("active",a.dataset.tab===this._tab),a.setAttribute("aria-selected",String(a.dataset.tab===this._tab))}),this._renderContent(e)})}),this._renderContent(e)}_renderContent(r){r.innerHTML="";const o=u.get(),e=o.story;switch(this._tab){case"quests":this._renderQuests(r,o,e);break;case"factions":this._renderFactions(r,o,e);break;case"companions":this._renderCompanions(r,o,e);break;case"lore":this._renderLore(r,o,e);break;case"ledger":this._renderLedger(r,o,e);break}}_renderQuests(r,o,e){if(!(e!=null&&e.quests)||Object.keys(e.quests).length===0){r.appendChild(this._emptyState("No active quests"));return}const i=[],t=[],n=[];for(const[a,s]of Object.entries(e.quests))s.status==="completed"||s.status==="complete"?t.push([a,s]):s.status==="failed"?n.push([a,s]):i.push([a,s]);if(i.length){r.appendChild(this._sectionHeader("Active"));for(const[a,s]of i)r.appendChild(this._questRow(a,s,"active"))}if(t.length){r.appendChild(this._sectionHeader("Completed"));for(const[a,s]of t)r.appendChild(this._questRow(a,s,"complete"))}if(n.length){r.appendChild(this._sectionHeader("Failed"));for(const[a,s]of n)r.appendChild(this._questRow(a,s,"failed"))}}_questRow(r,o,e){const i=l("div","sjr-row"),t=e==="completed"?"complete":e,n=t==="complete"?"&#10003;":t==="failed"?"&#10007;":"&#9733;",a=o.phase||o.currentPhase||"—",s=t.charAt(0).toUpperCase()+t.slice(1);return i.innerHTML=`
      <div class="sjr-row-icon">${n}</div>
      <div class="sjr-row-body">
        <div class="sjr-row-title">${this._humanizeId(r)}</div>
        <div class="sjr-row-sub">Phase: ${this._humanizeId(a)}</div>
      </div>
      <span class="sjr-row-badge ${t}">${s}</span>
    `,i}_renderFactions(r,o,e){const i=(e==null?void 0:e.factions)||{},t=Object.entries(i);if(!t.length){r.appendChild(this._emptyState("No faction contacts yet"));return}for(const[n,a]of t.sort((s,d)=>d[1]-s[1])){const s=l("div","sjr-row"),d=Math.max(-10,Math.min(10,a)),p=((d+10)/20*100).toFixed(0),c=d>=3?"positive":d<=-3?"negative":"neutral",h=d>=3?"Friendly":d<=-3?"Hostile":"Neutral";s.innerHTML=`
        <div class="sjr-row-icon">&#9876;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${this._humanizeId(n)}</div>
          <div class="sjr-row-sub">Standing: ${a>0?"+":""}${a}</div>
        </div>
        <div>
          <div class="sjr-faction-meter">
            <div class="sjr-faction-fill ${c}" style="width:${p}%"></div>
          </div>
          <div class="sjr-row-badge ${c}" style="margin-top:4px">${h}</div>
        </div>
      `,r.appendChild(s)}}_renderCompanions(r,o,e){const t=((e==null?void 0:e.companions)||[]).filter(n=>n.recruited);if(!t.length){r.appendChild(this._emptyState("No companions recruited yet"));return}r.appendChild(this._sectionHeader("Party"));for(const n of t){const a=l("div","sjr-row"),s=n.approval||0,d=s>0?`+${s}`:String(s),p=s>=5?"positive":s<=-5?"negative":"neutral",c=n.active?"Active":"Benched";a.innerHTML=`
        <div class="sjr-row-icon">&#9812;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${this._humanizeId(n.id)}</div>
          <div class="sjr-row-sub">Approval: ${d} &middot; ${c}</div>
        </div>
        <span class="sjr-row-badge ${p}">Approval ${d}</span>
      `,r.appendChild(a)}}_renderLore(r,o,e){const i=(e==null?void 0:e.loreDiscovered)||[];if(!i.length){r.appendChild(this._emptyState("No lore fragments discovered"));return}r.appendChild(this._sectionHeader(`${i.length} Fragment${i.length!==1?"s":""} Discovered`));for(const t of i){const n=l("div","sjr-row"),a=typeof t=="string"?t:t.id||"?",s=typeof t=="object"&&t.title?t.title:this._humanizeId(a),d=typeof t=="object"&&t.text?t.text:"—";n.innerHTML=`
        <div class="sjr-row-icon">&#9781;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${s}</div>
          <div class="sjr-row-sub">${d.slice(0,80)}${d.length>80?"…":""}</div>
        </div>
      `,r.appendChild(n)}}_renderLedger(r,o,e){const i=l("div","sjr-ledger-wrap");if(!e){i.appendChild(this._emptyState("No story data available")),r.appendChild(i);return}const t=e.recentHistory||{},n={act:e.act,currentNodeId:e.currentNodeId,campaignSeed:e.campaignSeed,storytellerId:e.storytellerId,difficulty:e.difficulty,pressureMeter:e.pressureMeter,worldCorruption:e.worldCorruption,flags:e.flags,counters:e.counters,factions:e.factions,quests:Object.fromEntries(Object.entries(e.quests||{}).map(([s,d])=>[s,{status:d.status,phase:d.phase||d.currentPhase}])),companions:(e.companions||[]).map(s=>({id:s.id,approval:s.approval,active:s.active,recruited:s.recruited})),loreCount:(e.loreDiscovered||[]).length,rngState:e.rngState,recentHistory:{lastType:t.lastType,sameTypeStreak:t.sameTypeStreak,nodeTypes:(t.nodeTypes||[]).slice(0,5),biomes:(t.biomes||[]).slice(0,5)}},a=l("pre","sjr-ledger-tree");a.textContent=JSON.stringify(n,null,2),i.appendChild(a),r.appendChild(i)}_sectionHeader(r){const o=l("div","sjr-section-header");return o.textContent=r,o}_emptyState(r){const o=l("div","sjr-empty");return o.textContent=r,o}_humanizeId(r){return r?String(r).replace(/_/g," ").replace(/\b\w/g,o=>o.toUpperCase()):"—"}}export{_ as StoryJournalScreen};
