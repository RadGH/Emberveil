const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/play-B6UPjTKl.js","assets/savesClient-DUFjgBxb.js","assets/play-it207JdU.css"])))=>i.map(i=>d[i]);
import{ab as b,i as m,r as g,c,ac as h,a3 as _,G as o,a5 as f,_ as y}from"./play-B6UPjTKl.js";import"./savesClient-DUFjgBxb.js";const v=`
.dg-screen { position: absolute; inset: 0; background: #0b0810;
  display: flex; flex-direction: column; color: #f0e8d8;
  font-family: 'Inter', system-ui, sans-serif; overflow: hidden; }
.dg-header { padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.5rem;
  border-bottom: 1px solid rgba(232,160,32,0.25); background: rgba(20,16,12,0.65); }
.dg-title { font-family: 'Cinzel', serif; color: #e8a020; font-size: 1rem;
  font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; flex: 1; }
.dg-progress { display: flex; gap: 0.25rem; padding: 0.5rem 1rem;
  background: rgba(0,0,0,0.4); flex-shrink: 0; }
.dg-progress .pip { flex: 1; height: 4px; background: #2a1f30; border-radius: 2px; }
.dg-progress .pip.done   { background: #40a060; }
.dg-progress .pip.active { background: #e8a020; box-shadow: 0 0 6px rgba(232,160,32,0.6); }
.dg-body { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
.dg-card { background: rgba(20,16,12,0.85); border: 1px solid rgba(232,160,32,0.4);
  border-radius: 6px; padding: 1rem; max-width: 460px; width: 100%; }
.dg-card h2 { margin: 0 0 0.5rem; font-family: 'Cinzel', serif; color: #e8a020;
  font-size: 1.1rem; letter-spacing: 0.06em; }
.dg-card p { margin: 0 0 0.75rem; color: #c0b090; font-size: 0.85rem; line-height: 1.5; }
.dg-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.dg-btn { background: rgba(20,16,12,0.85); border: 1px solid rgba(232,160,32,0.4);
  color: #e8d090; padding: 0.55rem 0.9rem; border-radius: 4px; cursor: pointer;
  font-weight: 600; min-height: 44px; flex: 1; min-width: 140px; }
.dg-btn.primary { background: rgba(232,160,32,0.25); color: #f8e0a0; border-color: #e8a020; }
.dg-btn.danger  { background: rgba(192,64,48,0.18); color: #e88880; border-color: rgba(192,64,48,0.5); }
.dg-btn:hover { filter: brightness(1.15); }
.dg-info { font-size: 0.7rem; color: #8a7a6a; text-align: center; margin-top: 0.5rem; }
.dg-stage-tag { display: inline-block; background: rgba(232,160,32,0.18); color: #e8a020;
  padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.65rem; letter-spacing: 0.08em;
  text-transform: uppercase; margin-bottom: 0.5rem; }
`;class w{constructor(t,e,i,s,n){this.manager=t,this.audio=e,this._dungeonId=i,this._anchorNodeId=s,this._anchorZoneId=n,this._dungeon=b[i],this._stageIdx=0,this._el=null}onEnter(){if(m("dg-styles",v),!this._dungeon){console.warn("[DungeonScreen] unknown dungeonId",this._dungeonId),this.manager.pop();return}this._build()}onResume(){if(this._el&&(this._el.style.display=""),this._lastCombatVictory){if(this._lastCombatVictory=!1,this._stageIdx++,this._stageIdx>=this._dungeon.stages.length){this._showVictory();return}}else if(this._lastCombatDefeat){this._lastCombatDefeat=!1,this.manager.pop();return}this._build()}onLeave(){g(this._el),this._el=null}onExit(){g(this._el),this._el=null}destroy(){g(this._el),this._el=null}_build(){if(this._el&&g(this._el),this._el=c("div","dg-screen"),this._stageIdx>=this._dungeon.stages.length){this._showVictory();return}const t=this._dungeon.stages[this._stageIdx],e=this._dungeon.stages.length,i=Array.from({length:e},(r,d)=>d<this._stageIdx?'<div class="pip done"></div>':d===this._stageIdx?'<div class="pip active"></div>':'<div class="pip"></div>').join(""),s=t.type,n=`Stage ${this._stageIdx+1} / ${e}`;let a="";if(s==="combat"||s==="boss"){const r=h[t.encounter],d=r?(r.enemies||[]).reduce((p,u)=>p+(u.count||1),0):0,l=s==="boss";a=`
        <div class="dg-card">
          <span class="dg-stage-tag" style="${l?"color:#c060e0;background:rgba(192,96,224,0.15)":""}">${n} · ${l?"Mini-Boss":"Combat"}</span>
          <h2>${t.name||(r==null?void 0:r.name)||"Hostile encounter"}</h2>
          <p>${d} ${d===1?"enemy":"enemies"} ahead. ${l?"A mini-boss waits at the end of the run — defeat it to claim the chest.":"Cut through and press deeper."}</p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn primary" id="dg-fight">${l?"Confront Boss":"Engage"}</button>
          </div>
        </div>`}else s==="lore"?a=`
        <div class="dg-card">
          <span class="dg-stage-tag">${n} · Discovery</span>
          <h2>A pause in the dark</h2>
          <p>${t.text||"You stop to catch your breath."}</p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn primary" id="dg-next">Press Onward</button>
          </div>
        </div>`:s==="shrine"&&(a=`
        <div class="dg-card">
          <span class="dg-stage-tag" style="color:#60c0e0;background:rgba(96,192,224,0.15)">${n} · Shrine</span>
          <h2>A moment of relief</h2>
          <p>${t.text||"A spring of warm water bubbles up."}</p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn" id="dg-skip">Skip</button>
            <button type="button" class="dg-btn primary" id="dg-rest">Restore HP/MP</button>
          </div>
        </div>`);this._el.innerHTML=`
      <div class="dg-header">
        <div class="dg-title">${this._dungeon.name}</div>
      </div>
      <div class="dg-progress">${i}</div>
      <div class="dg-body">
        ${a}
        <div class="dg-info">No retreat to town inside a dungeon — only "Give Up" returns you to the surface (and forfeits the chest).</div>
      </div>
    `,this.manager.uiOverlay.appendChild(this._el),this._wire()}_wire(){const t=this._el.querySelector("#dg-giveup");t&&t.addEventListener("click",()=>this._giveUp());const e=this._el.querySelector("#dg-next");e&&e.addEventListener("click",()=>this._advance());const i=this._el.querySelector("#dg-fight");i&&i.addEventListener("click",()=>this._engageCombat());const s=this._el.querySelector("#dg-rest");s&&s.addEventListener("click",()=>{this._restoreParty(),this._advance()});const n=this._el.querySelector("#dg-skip");n&&n.addEventListener("click",()=>this._advance())}_engageCombat(){var s,n;const t=this._dungeon.stages[this._stageIdx],e=h[t.encounter];if(!e){console.warn("[DungeonScreen] missing encounter",t.encounter),this._advance();return}const i={...e,name:t.name||e.name,_zoneId:this._anchorZoneId,_dungeonStage:this._stageIdx};(n=(s=this.audio)==null?void 0:s.playSfx)==null||n.call(s,"click"),this._lastCombatVictory=!0,this._lastCombatDefeat=!1,this._el&&(this._el.style.display="none"),this.manager.push(new _(this.manager,this.audio,null,i))}_snapshotPartyHp(){return(o.get().party||[]).map(e=>(e==null?void 0:e.hp)||0)}_restoreParty(){const t=o.get();[...t.party||[],...t.companions||[]].forEach(e=>{e&&(e.maxHp&&(e.hp=e.maxHp),e.maxMp&&(e.mp=e.maxMp))})}_advance(){var t,e;if((e=(t=this.audio)==null?void 0:t.playSfx)==null||e.call(t,"click"),this._stageIdx++,this._stageIdx>=this._dungeon.stages.length){this._showVictory();return}this._build()}_giveUp(){var e,i;(i=(e=this.audio)==null?void 0:e.playSfx)==null||i.call(e,"click");const t=o.get();if(this._anchorZoneId&&(t.zoneId=this._anchorZoneId),this._anchorNodeId){t.nodeId=this._anchorNodeId;try{o.setZoneNode(this._anchorZoneId,this._anchorNodeId)}catch{}}this.manager.pop()}_showVictory(){this._el&&g(this._el),this._el=c("div","dg-screen");const t=this._dungeon.reward||{},e=o.get();Array.isArray(e.completedDungeons)||(e.completedDungeons=[]),e.completedDungeons.includes(this._dungeon.id)||e.completedDungeons.push(this._dungeon.id),t.gold&&o.addGold(t.gold);let i=null;try{t.item&&(i=f(t.item,"rare","high"),i&&(o.addToInventory(i),y(()=>import("./play-B6UPjTKl.js").then(s=>s.ad),__vite__mapDeps([0,1,2])).then(s=>s.recordDrop(i,{zoneId:this._anchorZoneId,source:"chest"})).catch(()=>{})))}catch(s){console.warn("[DungeonScreen] reward item gen failed",s)}if(this._el.innerHTML=`
      <div class="dg-header"><div class="dg-title">Dungeon Cleared</div></div>
      <div class="dg-body">
        <div class="dg-card">
          <span class="dg-stage-tag" style="color:#40a060;background:rgba(64,160,96,0.15)">Victory</span>
          <h2>${this._dungeon.name}</h2>
          <p>You crack open the treasure chest. The dungeon settles, sealed behind you — never to be entered again.</p>
          <p style="color:#e8d090">
            +${t.gold||0} gold
            ${t.xp?`· +${t.xp} xp distributed`:""}
            ${i?`· <span style="color:#60c0e0">${i.name}</span>`:""}
          </p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn primary" id="dg-leave">Return to Surface</button>
          </div>
        </div>
      </div>
    `,this.manager.uiOverlay.appendChild(this._el),t.xp){const s=(e.party||[]).filter(n=>n&&!(n.isCompanion||n.class==="companion"));if(s.length){const n=Math.floor(t.xp/s.length);s.forEach(a=>{a.xp=(a.xp||0)+n})}}this._el.querySelector("#dg-leave").addEventListener("click",()=>this._giveUp())}}export{w as DungeonScreen};
