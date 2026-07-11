import{E as b,Y as u,J as l,k as g}from"./play-QH26u79V.js";import"./savesClient-Lt_9u8Ks-B0TWHWS2.js";const f="story-journal-screen-styles",v=`
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
`,m=[{id:"quests",label:"Quests"},{id:"factions",label:"Factions"},{id:"companions",label:"Companions"},{id:"lore",label:"Lore"},{id:"ledger",label:"Ledger"}];class y{constructor(r,a){this.manager=r,this.audio=a,this._el=null,this._tab="quests"}onEnter(){b(f,v),this._build()}onResume(){}onPause(){}update(){}draw(){}onExit(){u(this._el),this._el=null}destroy(){this.onExit()}_build(){this._el=l("div","sjr-screen");const r=l("div","sjr-topbar");r.innerHTML=`
      <button type="button" class="sjr-topbar-btn" id="sjr-back" aria-label="Back">&#8592;</button>
      <span class="sjr-topbar-title">Journal</span>
      <div style="width:44px"></div>
    `,this._el.appendChild(r);const a=l("div","sjr-tabs");a.setAttribute("role","tablist");for(const i of m){const e=document.createElement("button");e.type="button",e.role="tab",e.className=`sjr-tab${this._tab===i.id?" active":""}`,e.dataset.tab=i.id,e.textContent=i.label,e.setAttribute("aria-selected",String(this._tab===i.id)),a.appendChild(e)}this._el.appendChild(a);const t=l("div","sjr-content");t.id="sjr-content",this._el.appendChild(t),this.manager.uiOverlay.appendChild(this._el),r.querySelector("#sjr-back").addEventListener("click",()=>{var i,e;(e=(i=this.audio)==null?void 0:i.playSfx)==null||e.call(i,"click"),this.manager.pop()}),a.querySelectorAll(".sjr-tab").forEach(i=>{i.addEventListener("click",()=>{var e,n;(n=(e=this.audio)==null?void 0:e.playSfx)==null||n.call(e,"click"),this._tab=i.dataset.tab,a.querySelectorAll(".sjr-tab").forEach(s=>{s.classList.toggle("active",s.dataset.tab===this._tab),s.setAttribute("aria-selected",String(s.dataset.tab===this._tab))}),this._renderContent(t)})}),this._renderContent(t)}_renderContent(r){r.innerHTML="";const a=g.get(),t=a.story;switch(this._tab){case"quests":this._renderQuests(r,a,t);break;case"factions":this._renderFactions(r,a,t);break;case"companions":this._renderCompanions(r,a,t);break;case"lore":this._renderLore(r,a,t);break;case"ledger":this._renderLedger(r,a,t);break}}_renderQuests(r,a,t){if(!(t!=null&&t.quests)||Object.keys(t.quests).length===0){r.appendChild(this._emptyState("No active quests"));return}const i=[],e=[],n=[];for(const[s,o]of Object.entries(t.quests))o.status==="completed"||o.status==="complete"?e.push([s,o]):o.status==="failed"?n.push([s,o]):i.push([s,o]);if(i.length){r.appendChild(this._sectionHeader("Active"));for(const[s,o]of i)r.appendChild(this._questRow(s,o,"active"))}if(e.length){r.appendChild(this._sectionHeader("Completed"));for(const[s,o]of e)r.appendChild(this._questRow(s,o,"complete"))}if(n.length){r.appendChild(this._sectionHeader("Failed"));for(const[s,o]of n)r.appendChild(this._questRow(s,o,"failed"))}}_questRow(r,a,t){const i=l("div","sjr-row"),e=t==="completed"?"complete":t,n=e==="complete"?"&#10003;":e==="failed"?"&#10007;":"&#9733;",s=a.phase||a.currentPhase||"—",o=e.charAt(0).toUpperCase()+e.slice(1);return i.innerHTML=`
      <div class="sjr-row-icon">${n}</div>
      <div class="sjr-row-body">
        <div class="sjr-row-title">${this._humanizeId(r)}</div>
        <div class="sjr-row-sub">Phase: ${this._humanizeId(s)}</div>
      </div>
      <span class="sjr-row-badge ${e}">${o}</span>
    `,i}_renderFactions(r,a,t){const i=(t==null?void 0:t.factions)||{},e=Object.entries(i);if(!e.length){r.appendChild(this._emptyState("No faction contacts yet"));return}for(const[n,s]of e.sort((o,d)=>d[1]-o[1])){const o=l("div","sjr-row"),d=Math.max(-10,Math.min(10,s)),c=((d+10)/20*100).toFixed(0),p=d>=3?"positive":d<=-3?"negative":"neutral",h=d>=3?"Friendly":d<=-3?"Hostile":"Neutral";o.innerHTML=`
        <div class="sjr-row-icon">&#9876;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${this._humanizeId(n)}</div>
          <div class="sjr-row-sub">Standing: ${s>0?"+":""}${s}</div>
        </div>
        <div>
          <div class="sjr-faction-meter">
            <div class="sjr-faction-fill ${p}" style="width:${c}%"></div>
          </div>
          <div class="sjr-row-badge ${p}" style="margin-top:4px">${h}</div>
        </div>
      `,r.appendChild(o)}}_renderCompanions(r,a,t){const i=((t==null?void 0:t.companions)||[]).filter(e=>e.recruited);if(!i.length){r.appendChild(this._emptyState("No companions recruited yet"));return}r.appendChild(this._sectionHeader("Party"));for(const e of i){const n=l("div","sjr-row"),s=e.approval||0,o=s>0?`+${s}`:String(s),d=s>=5?"positive":s<=-5?"negative":"neutral",c=e.active?"Active":"Benched";n.innerHTML=`
        <div class="sjr-row-icon">&#9812;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${this._humanizeId(e.id)}</div>
          <div class="sjr-row-sub">Approval: ${o} &middot; ${c}</div>
        </div>
        <span class="sjr-row-badge ${d}">Approval ${o}</span>
      `,r.appendChild(n)}}_renderLore(r,a,t){const i=(t==null?void 0:t.loreDiscovered)||[];if(!i.length){r.appendChild(this._emptyState("No lore fragments discovered"));return}r.appendChild(this._sectionHeader(`${i.length} Fragment${i.length!==1?"s":""} Discovered`));for(const e of i){const n=l("div","sjr-row"),s=typeof e=="string"?e:e.id||"?",o=typeof e=="object"&&e.title?e.title:this._humanizeId(s),d=typeof e=="object"&&e.text?e.text:"—";n.innerHTML=`
        <div class="sjr-row-icon">&#9781;</div>
        <div class="sjr-row-body">
          <div class="sjr-row-title">${o}</div>
          <div class="sjr-row-sub">${d.slice(0,80)}${d.length>80?"…":""}</div>
        </div>
      `,r.appendChild(n)}}_renderLedger(r,a,t){const i=l("div","sjr-ledger-wrap");if(!t){i.appendChild(this._emptyState("No story data available")),r.appendChild(i);return}const e=t.recentHistory||{},n={act:t.act,currentNodeId:t.currentNodeId,campaignSeed:t.campaignSeed,storytellerId:t.storytellerId,difficulty:t.difficulty,pressureMeter:t.pressureMeter,worldCorruption:t.worldCorruption,flags:t.flags,counters:t.counters,factions:t.factions,quests:Object.fromEntries(Object.entries(t.quests||{}).map(([o,d])=>[o,{status:d.status,phase:d.phase||d.currentPhase}])),companions:(t.companions||[]).map(o=>({id:o.id,approval:o.approval,active:o.active,recruited:o.recruited})),loreCount:(t.loreDiscovered||[]).length,rngState:t.rngState,recentHistory:{lastType:e.lastType,sameTypeStreak:e.sameTypeStreak,nodeTypes:(e.nodeTypes||[]).slice(0,5),biomes:(e.biomes||[]).slice(0,5)}},s=l("pre","sjr-ledger-tree");s.textContent=JSON.stringify(n,null,2),i.appendChild(s),r.appendChild(i)}_sectionHeader(r){const a=l("div","sjr-section-header");return a.textContent=r,a}_emptyState(r){const a=l("div","sjr-empty");return a.textContent=r,a}_humanizeId(r){return r?String(r).replace(/_/g," ").replace(/\b\w/g,a=>a.toUpperCase()):"—"}}export{y as StoryJournalScreen};
