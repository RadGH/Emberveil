import{i as w,Y as g,Z as $,r as p,$ as b,a0 as k,a1 as C,c as f,a2 as h,a3 as I,G as m,a4 as S,a5 as E,a6 as T,a7 as L,a8 as F,a9 as _,aa as y,ab as z,ac as v,ad as R,ae as x}from"./play-s89t1fqt.js";import"./savesClient-DUFjgBxb.js";const A=`
.id-screen {
  position: absolute; inset: 0; background: #080612;
  display: flex; flex-direction: column; color: #f0e8d8;
  font-family: 'Inter', system-ui, sans-serif; overflow: hidden;
}
.id-header {
  padding: 0.65rem 1rem; display: flex; align-items: center; gap: 0.75rem;
  border-bottom: 1px solid rgba(140,80,200,0.35);
  background: rgba(16,10,28,0.7); flex-shrink: 0;
}
.id-header-title {
  font-family: 'Cinzel', serif; color: #c080f0; font-size: 1rem;
  font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; flex: 1;
}
.id-floor-badge {
  background: rgba(160,80,240,0.2); border: 1px solid rgba(160,80,240,0.5);
  border-radius: 20px; padding: 0.2rem 0.75rem; font-size: 0.8rem;
  color: #d0a0ff; font-weight: 700; letter-spacing: 0.05em;
}
.id-timer {
  font-size: 0.72rem; color: #8a7090; letter-spacing: 0.04em;
}
.id-effects-bar {
  padding: 0.4rem 1rem; display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;
  background: rgba(60,20,80,0.25); border-bottom: 1px solid rgba(140,80,200,0.2);
  flex-shrink: 0;
}
.id-effect-chip {
  display: inline-flex; align-items: center; gap: 0.25rem;
  padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.68rem;
  font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
  border: 1px solid;
}
.id-effects-label { font-size: 0.65rem; color: #7a6080; text-transform: uppercase; letter-spacing: 0.06em; }
.id-body {
  flex: 1; overflow-y: auto; padding: 1rem; display: flex;
  flex-direction: column; align-items: center; gap: 0.75rem;
}
.id-progress {
  display: flex; gap: 0.3rem; width: 100%; max-width: 460px;
  align-items: center; padding: 0.35rem 0;
}
.id-pip { flex: 1; height: 5px; border-radius: 3px; background: #201828; }
.id-pip.done   { background: #8040c0; }
.id-pip.active { background: #c080f0; box-shadow: 0 0 8px rgba(192,128,240,0.6); }
.id-card {
  background: rgba(16,10,28,0.85); border: 1px solid rgba(160,80,240,0.35);
  border-radius: 8px; padding: 1rem 1.25rem; max-width: 460px; width: 100%;
}
.id-card.anchor {
  border-color: rgba(240,192,32,0.5);
  background: rgba(30,20,8,0.9);
  box-shadow: 0 0 18px rgba(240,192,32,0.12);
}
.id-card-tag {
  display: inline-block; background: rgba(160,80,240,0.18); color: #c080f0;
  padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.65rem;
  letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.5rem;
}
.id-card-tag.anchor { background: rgba(240,192,32,0.18); color: #f0c020; border-color: rgba(240,192,32,0.4); }
.id-card h2 {
  margin: 0 0 0.4rem; font-family: 'Cinzel', serif; font-size: 1.1rem;
  letter-spacing: 0.06em; color: #e8d0ff;
}
.id-card.anchor h2 { color: #f0d060; }
.id-card p { margin: 0 0 0.75rem; color: #b090c0; font-size: 0.85rem; line-height: 1.5; }
.id-btns { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.id-btn {
  background: rgba(16,10,28,0.85); border: 1px solid rgba(160,80,240,0.4);
  color: #d0b0f0; padding: 0.55rem 0.9rem; border-radius: 5px; cursor: pointer;
  font-weight: 600; min-height: 44px; flex: 1; min-width: 130px;
  font-family: inherit; font-size: 0.85rem;
}
.id-btn.primary {
  background: rgba(160,80,240,0.25); color: #f0d0ff;
  border-color: rgba(160,80,240,0.7);
}
.id-btn.primary.anchor {
  background: rgba(240,192,32,0.2); color: #f0e080;
  border-color: rgba(240,192,32,0.6);
}
.id-btn.danger  {
  background: rgba(192,48,32,0.18); color: #e08880;
  border-color: rgba(192,48,32,0.5);
}
.id-btn:hover { filter: brightness(1.15); }
.id-floor-end {
  padding: 0.75rem 1rem; border-top: 1px solid rgba(140,80,200,0.25);
  background: rgba(14,10,22,0.8); display: flex; gap: 0.5rem;
  flex-shrink: 0; flex-wrap: wrap; justify-content: center;
}
.id-info { font-size: 0.7rem; color: #7a6090; text-align: center; margin-top: 0.25rem; }
.id-loot-result {
  background: rgba(20,16,30,0.9); border: 1px solid rgba(160,80,240,0.3);
  border-radius: 6px; padding: 0.6rem 0.9rem; max-width: 460px; width: 100%;
  font-size: 0.8rem; color: #d0b0f0;
}
.id-run-summary {
  background: rgba(20,16,30,0.9); border: 1px solid rgba(160,80,240,0.4);
  border-radius: 8px; padding: 1.25rem; max-width: 460px; width: 100%;
}
.id-run-summary h3 {
  font-family: 'Cinzel', serif; color: #c080f0; margin: 0 0 0.75rem;
  font-size: 1rem; letter-spacing: 0.06em;
}
.id-stat-row { display: flex; justify-content: space-between; padding: 0.25rem 0;
  font-size: 0.82rem; border-bottom: 1px solid rgba(160,80,240,0.1); }
.id-stat-row:last-child { border-bottom: none; }
.id-stat-row span { color: #8a7090; }
.id-stat-row strong { color: #d0b0f0; }
.id-lb-title {
  font-family: 'Cinzel', serif; color: #a060d0; font-size: 0.85rem;
  letter-spacing: 0.06em; text-transform: uppercase; margin-top: 1rem;
}
.id-lb-row { display: flex; gap: 0.5rem; font-size: 0.75rem; padding: 0.3rem 0;
  border-bottom: 1px solid rgba(160,80,240,0.08); color: #b090c0; }
.id-lb-row strong { color: #d0b0f0; }
.id-lb-row .id-lb-floor { color: #c080f0; font-weight: 700; min-width: 36px; }
.id-confirm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex;
  align-items: center; justify-content: center; z-index: 9999;
}
.id-confirm-box {
  background: #120c20; border: 1px solid rgba(160,80,240,0.5); border-radius: 10px;
  padding: 1.5rem; max-width: 340px; width: 90%; text-align: center;
}
.id-confirm-box h2 {
  font-family: 'Cinzel', serif; color: #c080f0; margin: 0 0 0.75rem;
  font-size: 1.15rem; letter-spacing: 0.06em;
}
.id-confirm-box p { color: #c0a0e0; font-size: 0.85rem; line-height: 1.55; margin: 0 0 1rem; }
.id-confirm-btns { display: flex; gap: 0.5rem; }
`;class B{constructor(e,t){this.manager=e,this.audio=t,this._el=null,this._run=null,this._stages=[],this._stageIdx=0,this._floorEffects=[],this._floorCleared=!1,this._lastLoot=null,this._timerInterval=null}onEnter(){w("id-styles",A),this._run=g(),this._run||(this._run=$()),this._prepareFloor(),this._build(),this._startTimer()}onResume(){this._el&&(this._el.style.display=""),this._pendingCombatResult==="victory"?(this._pendingCombatResult=null,this._onNodeCleared()):this._build()}onPause(){this._el&&(this._el.style.display="none")}onExit(){this._stopTimer(),p(this._el),this._el=null}destroy(){this._stopTimer(),this._pendingCombatResult==="victory"&&b(!1),p(this._el),this._el=null}_prepareFloor(){if(!this._run)return;const e=this._run.floor;this._floorEffects=k(e,this._run.seed||0),this._stages=C(e,this._floorEffects,this._run.seed||0),this._stageIdx=0,this._floorCleared=!1,this._lastLoot=null}_build(){this._el&&p(this._el),this._el=f("div","id-screen");const e=this._run;if(!e){this.manager.pop();return}const t=e.floor,r=t%5===0,s=Math.round((Date.now()-(e.runStartedAt||Date.now()))/1e3),l=this._floorEffects.map(d=>`<span class="id-effect-chip" style="color:${d.color};border-color:${d.color}40;background:${d.color}15" title="${d.desc}">${d.icon} ${d.name}</span>`).join(""),o=this._floorEffects.length?`<div class="id-effects-bar"><span class="id-effects-label">Floor effects</span>${l}</div>`:"",c=this._stages.length,i=Array.from({length:c},(d,u)=>u<this._stageIdx?'<div class="id-pip done"></div>':u===this._stageIdx?'<div class="id-pip active"></div>':'<div class="id-pip"></div>').join("");let n="";this._floorCleared?n=this._renderFloorClearedCard(t):n=this._renderStageCard(t,r);const a=this._lastLoot?`<div class="id-loot-result">${this._lastLoot}</div>`:"";this._el.innerHTML=`
      <div class="id-header">
        <div class="id-header-title">Infinite Depths</div>
        <span class="id-floor-badge">Floor ${t}${r?" — Anchor":""}</span>
        <span class="id-timer" id="id-timer">${h(s)}</span>
      </div>
      ${o}
      <div class="id-body">
        <div class="id-progress">${i}</div>
        ${n}
        ${a}
        <div class="id-info">Infinite Depths — survive as long as you can. Loot scales with depth. Die and you keep what you found.</div>
      </div>
      ${this._floorCleared?`
        <div class="id-floor-end">
          <button type="button" class="id-btn danger" id="id-btn-town">Return to Town</button>
          <button type="button" class="id-btn primary" id="id-btn-descend">Descend to Floor ${t+1}</button>
        </div>
      `:""}
    `,this.manager.uiOverlay.appendChild(this._el),this._wireEvents()}_renderStageCard(e,t){if(this._stageIdx>=this._stages.length)return"";const r=this._stages[this._stageIdx],s=`Node ${this._stageIdx+1} / ${this._stages.length}`;if(r.type==="combat")return`
        <div class="id-card${t?" anchor":""}">
          <span class="id-card-tag${t?" anchor":""}">${s} · Combat</span>
          <h2>Hostile Encounter</h2>
          <p>Scaled enemies inhabit this level. Defeat them to press deeper.</p>
          <div class="id-btns">
            <button type="button" class="id-btn primary${t?" anchor":""}" id="id-btn-fight">Engage</button>
          </div>
        </div>`;if(r.type==="anchor_boss"){const l=x(e);return`
        <div class="id-card anchor">
          <span class="id-card-tag anchor">${s} · Anchor Boss</span>
          <h2>${l.name}</h2>
          <p>A vastly empowered guardian blocks the anchor floor. A unique item awaits its defeat.</p>
          <div class="id-btns">
            <button type="button" class="id-btn primary anchor" id="id-btn-fight">Confront Boss</button>
          </div>
        </div>`}return r.type==="treasure"?`
        <div class="id-card">
          <span class="id-card-tag">Treasure</span>
          <h2>A Rift Cache</h2>
          <p>A shimmering crack in reality spills loot from beyond the veil.</p>
          <div class="id-btns">
            <button type="button" class="id-btn primary" id="id-btn-loot">Claim Loot</button>
          </div>
        </div>`:""}_renderFloorClearedCard(e){const t=this._run,r=Math.round((Date.now()-(t.runStartedAt||Date.now()))/1e3);return`
      <div class="id-card" style="border-color:rgba(160,80,240,0.5);background:rgba(30,16,50,0.9)">
        <span class="id-card-tag" style="color:#80e080;background:rgba(64,220,80,0.15)">Floor ${e} Cleared</span>
        <h2>Depths Conquered</h2>
        <p>All nodes on this floor are clear. Descend to Floor ${e+1} or return to town with your spoils.</p>
        <div class="id-run-summary">
          <div class="id-stat-row"><span>Floor</span><strong>${e}</strong></div>
          <div class="id-stat-row"><span>Anchors</span><strong>${(t.anchors||[]).length}</strong></div>
          <div class="id-stat-row"><span>Items found</span><strong>${(t.runLoot||[]).length}</strong></div>
          <div class="id-stat-row"><span>Time</span><strong>${h(r)}</strong></div>
        </div>
      </div>`}_wireEvents(){var e,t,r,s;(e=this._el.querySelector("#id-btn-fight"))==null||e.addEventListener("click",()=>{this.audio.playSfx("click"),this._engageCombat()}),(t=this._el.querySelector("#id-btn-loot"))==null||t.addEventListener("click",()=>{this.audio.playSfx("click"),this._claimTreasure()}),(r=this._el.querySelector("#id-btn-descend"))==null||r.addEventListener("click",()=>{this.audio.playSfx("click"),I(),this._run=g(),this._prepareFloor(),this._build()}),(s=this._el.querySelector("#id-btn-town"))==null||s.addEventListener("click",()=>{this.audio.playSfx("click"),this._showReturnConfirm()})}_engageCombat(){const e=this._run;if(!e)return;const t=e.floor,r=this._stages[this._stageIdx],s=m.get(),l=Math.round((s.party||[]).reduce((n,a)=>n+(a.level||1),0)/Math.max(1,(s.party||[]).length));let o,c=!1;if(r.type==="anchor_boss"){c=!0;const n=x(t);o=[{...S(n,t,l),count:1}]}else o=E(t,this._floorEffects,e.seed||0).map(a=>T(a,t,l));const i={id:`infinite_floor${t}_node${this._stageIdx}`,name:c?`Anchor Boss — Floor ${t}`:`Floor ${t} — Node ${this._stageIdx+1}`,enemies:o,_zoneId:"infinite_depths",_infiniteFloor:t,_isAnchorBoss:c,_floorEffects:this._floorEffects,isBoss:c};this._el&&(this._el.style.display="none"),this._pendingCombatResult="victory",this.manager.push(new L(this.manager,this.audio,null,i))}_onNodeCleared(){const e=this._run;if(!e)return;const t=this._stages[this._stageIdx],r=F(e.floor,this._getLootMods()),s=.45+e.floor*.01,l=this._floorEffects.some(i=>i.id==="double_damage"),o=[],c=l?2:1;for(let i=0;i<c;i++)if(Math.random()<s*r.dropChanceMult){const n=["sword","dagger","ring","necklace","medium_chest","heavy_chest","staff","wand","cloth_chest","heavy_helm"],a=n[Math.floor(Math.random()*n.length)],d=_(a,r.rarity,r.quality);d&&(m.addToInventory(d),y(d),o.push(d))}if(t.type==="anchor_boss"){z(e.floor);const i=["ring","necklace","heavy_chest","staff","sword"],n=i[Math.floor(Math.random()*i.length)],a=_(n,"legendary","exotic");a&&(m.addToInventory(a),y(a),o.push(a))}this._lastLoot=o.length?`Loot: ${o.map(i=>`<span style="color:var(--rarity-${i.rarity})">${i.name}</span>`).join(", ")}`:"No loot dropped this node.",this._stageIdx++,this._stageIdx>=this._stages.length&&(this._floorCleared=!0),this._el&&(this._el.style.display=""),this._build()}_getLootMods(){const e={};for(const t of this._floorEffects)t.lootMod&&Object.assign(e,t.lootMod);return e}_claimTreasure(){this._pendingCombatResult=null,this._onNodeCleared()}_showRunEndSummary(){var s,l,o;const e=this._run?Math.round((Date.now()-(this._run.runStartedAt||Date.now()))/1e3):0,t=((s=this._run)==null?void 0:s.floor)||1,r=(((l=this._run)==null?void 0:l.runLoot)||[]).length;this._el&&p(this._el),this._el=f("div","id-screen"),this._el.innerHTML=`
      <div class="id-header">
        <div class="id-header-title">Run Ended</div>
        <span class="id-floor-badge">Floor ${t}</span>
      </div>
      <div class="id-body">
        <div class="id-run-summary">
          <h3>The Depths Claimed You</h3>
          <div class="id-stat-row"><span>Deepest floor</span><strong>${t}</strong></div>
          <div class="id-stat-row"><span>Items claimed</span><strong>${r}</strong></div>
          <div class="id-stat-row"><span>Run time</span><strong>${h(e)}</strong></div>
          <p style="margin:0.75rem 0 0;font-size:0.8rem;color:#9070a0">Your loot has been added to your inventory. A new run starts from the entrance.</p>
        </div>
        ${this._renderLeaderboardSnippet()}
        <div class="id-btns" style="max-width:460px;width:100%;margin-top:0.5rem">
          <button type="button" class="id-btn danger" id="id-btn-town-end">Return to Town</button>
        </div>
      </div>
    `,this.manager.uiOverlay.appendChild(this._el),(o=this._el.querySelector("#id-btn-town-end"))==null||o.addEventListener("click",()=>{this.audio.playSfx("click"),this._returnToTown()})}_returnToTown(){var t;this._run&&b(!1),this.manager.pop(),((t=this.manager._stack)==null?void 0:t[this.manager._stack.length-1])instanceof v||this.manager.push(new v(this.manager,this.audio,null))}_showReturnConfirm(){const e=f("div","id-confirm-overlay");e.innerHTML=`
      <div class="id-confirm-box">
        <h2>Return to Town?</h2>
        <p>You will exit the Infinite Depths. All loot collected this run remains in your inventory. Your run will end and progress recorded.</p>
        <div class="id-confirm-btns">
          <button type="button" class="id-btn" id="id-cancel-town" style="flex:1">Stay</button>
          <button type="button" class="id-btn danger" id="id-confirm-town" style="flex:1">Return</button>
        </div>
      </div>
    `,document.body.appendChild(e),e.querySelector("#id-cancel-town").addEventListener("click",()=>e.remove()),e.querySelector("#id-confirm-town").addEventListener("click",()=>{e.remove(),this.audio.playSfx("click"),this._returnToTown()})}_renderLeaderboardSnippet(){const e=R().slice(0,5);return e.length?`
      <div class="id-run-summary" style="max-width:460px;width:100%">
        <div class="id-lb-title">Top Runs</div>
        ${e.map((r,s)=>`<div class="id-lb-row">
        <span class="id-lb-floor">#${s+1} F${r.deepestFloor}</span>
        <strong>${r.heroName}</strong>
        <span>${r.heroClass}</span>
        <span>${h(r.runTime)}</span>
      </div>`).join("")}
      </div>`:""}_startTimer(){this._stopTimer(),this._timerInterval=setInterval(()=>{var r;const e=(r=this._el)==null?void 0:r.querySelector("#id-timer");if(!e||!this._run)return;const t=Math.round((Date.now()-(this._run.runStartedAt||Date.now()))/1e3);e.textContent=h(t)},1e3)}_stopTimer(){this._timerInterval&&(clearInterval(this._timerInterval),this._timerInterval=null)}}export{B as InfiniteDungeonScreen};
