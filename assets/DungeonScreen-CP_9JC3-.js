const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/play-13DYHLpj.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/play-dErdlDnR.css"])))=>i.map(i=>d[i]);
import{ai as L,i as N,G as r,r as m,c as x,aj as k,ak as S,C as U,z as P,_ as T,al as z}from"./play-13DYHLpj.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const I=1.35,E=1.3,$=4,w=6,V=`
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
.dg-btn.pass    { background: rgba(64,160,96,0.22); color: #80e0a0; border-color: rgba(64,160,96,0.6); }
.dg-btn.fail    { background: rgba(192,64,48,0.22); color: #e88080; border-color: rgba(192,64,48,0.6); }
.dg-btn:hover { filter: brightness(1.15); }
.dg-info { font-size: 0.7rem; color: #8a7a6a; text-align: center; margin-top: 0.5rem; }
.dg-stage-tag { display: inline-block; background: rgba(232,160,32,0.18); color: #e8a020;
  padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.65rem; letter-spacing: 0.08em;
  text-transform: uppercase; margin-bottom: 0.5rem; }
.dg-buff-badge { display:inline-block; background:rgba(64,160,96,0.18); color:#80e0a0;
  border:1px solid rgba(64,160,96,0.4); border-radius:4px; font-size:0.72rem;
  padding:0.2rem 0.5rem; margin-top:0.4rem; }
.dg-skill-result { padding:0.75rem; border-radius:4px; margin-bottom:0.5rem; font-size:0.85rem; line-height:1.5; }
.dg-skill-result.pass { background:rgba(64,160,96,0.12); border:1px solid rgba(64,160,96,0.35); color:#a0e8b0; }
.dg-skill-result.fail { background:rgba(192,64,48,0.12); border:1px solid rgba(192,64,48,0.35); color:#e8a0a0; }
`;class A{constructor(e,t,s,i,a){this.manager=e,this.audio=t,this._dungeonId=s,this._anchorNodeId=i,this._anchorZoneId=a,this._dungeon=L[s],this._stageIdx=0,this._el=null,this._pendingStunBuff=!1,this._victoryPending=!1}onEnter(){if(N("dg-styles",V),!this._dungeon){console.warn("[DungeonScreen] unknown dungeonId",this._dungeonId),this.manager.pop();return}this._build()}onResume(){if(this._el&&(this._el.style.display=""),this._victoryPending){this._victoryPending=!1,this._showVictoryCard();return}if(this._nextStagePending){if(this._nextStagePending=!1,this._stageIdx++,this._stageIdx>=this._dungeon.stages.length){this._doVictorySequence();return}this._build();return}if(this._lastCombatVictory){this._lastCombatVictory=!1;const e=r.get();if([...e.party||[],...e.companions||[]].some(s=>s&&s._lastLevelUp)){this._nextStagePending=!0;return}if(this._stageIdx++,this._stageIdx>=this._dungeon.stages.length){this._doVictorySequence();return}}else if(this._lastCombatDefeat){this._lastCombatDefeat=!1,this.manager.pop();return}this._build()}onLeave(){this._purgeDom()}onExit(){this._purgeDom()}destroy(){this._purgeDom()}_purgeDom(){try{m(this._el)}catch{}try{document.querySelectorAll(".dg-screen").forEach(e=>e.remove())}catch{}this._el=null}_build(){if(this._el&&m(this._el),this._el=x("div","dg-screen"),this._stageIdx>=this._dungeon.stages.length){this._doVictorySequence();return}const e=this._dungeon.stages[this._stageIdx],t=this._dungeon.stages.length,s=Array.from({length:t},(o,d)=>d<this._stageIdx?'<div class="pip done"></div>':d===this._stageIdx?'<div class="pip active"></div>':'<div class="pip"></div>').join(""),i=e.type,a=`Stage ${this._stageIdx+1} / ${t}`;let n="";if(i==="combat"||i==="boss"){const o=k[e.encounter],g=this._scaledEncounterEnemies(o).reduce((h,u)=>h+(u.count||1),0),l=i==="boss",p=this._pendingStunBuff?'<div class="dg-buff-badge">Enemies will start stunned (skill check bonus)</div>':"";n=`
        <div class="dg-card">
          <span class="dg-stage-tag" style="${l?"color:#c060e0;background:rgba(192,96,224,0.15)":""}">${a} · ${l?"Mini-Boss":"Combat"}</span>
          <h2>${e.name||(o==null?void 0:o.name)||"Hostile encounter"}</h2>
          <p>${g} ${g===1?"enemy":"enemies"} ahead. ${l?"A mini-boss waits at the end of the run — defeat it to claim the chest.":"Cut through and press deeper."}</p>
          ${p}
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn primary" id="dg-fight">${l?"Confront Boss":"Engage"}</button>
          </div>
        </div>`}else if(i==="skill_check"){const o=S[e.checkId]||{};n=`
        <div class="dg-card">
          <span class="dg-stage-tag" style="color:#60c0e0;background:rgba(96,192,224,0.15)">${a} · Skill Check</span>
          <h2>${e.name||"Challenge Ahead"}</h2>
          <p>${o.flavor||"Something blocks your path."}</p>
          <p style="font-size:0.78rem;color:#a090c0">
            Roll ${o.stat||"?"} vs DC ${o.dc||"?"} &mdash;
            Pass: enemies start stunned next fight. Fail: party takes ~${Math.round((o.failDamagePct||.12)*100)}% max HP damage.
          </p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn primary" id="dg-attempt">Attempt (${o.stat||"?"} ${o.dc||"?"})</button>
          </div>
        </div>`}this._el.innerHTML=`
      <div class="dg-header">
        <div class="dg-title">${this._dungeon.name}</div>
      </div>
      <div class="dg-progress">${s}</div>
      <div class="dg-body">
        ${n}
        <div class="dg-info">No retreat to town inside a dungeon — only "Give Up" returns you to the surface (and forfeits the chest).</div>
      </div>
    `,this.manager.uiOverlay.appendChild(this._el),this._wire()}_wire(){const e=this._el.querySelector("#dg-giveup");e&&e.addEventListener("click",()=>this._giveUp());const t=this._el.querySelector("#dg-fight");t&&t.addEventListener("click",()=>this._engageCombat());const s=this._el.querySelector("#dg-attempt");s&&s.addEventListener("click",()=>this._resolveSkillCheck())}_scaledEncounterEnemies(e){if(!e)return[];const s=(e.enemies||[]).map(n=>({...n})).map(n=>({...n,hp:Math.round((n.hp||1)*I),maxHp:Math.round((n.maxHp||n.hp||1)*I),dmg:Array.isArray(n.dmg)?[Math.round(n.dmg[0]*E),Math.round(n.dmg[1]*E)]:n.dmg})),i=s.reduce((n,o)=>n+(o.count||1),0);if(i<$){const n=$-i;s.length>0&&(s[s.length-1]={...s[s.length-1],count:(s[s.length-1].count||1)+n})}const a=s.reduce((n,o)=>n+(o.count||1),0);if(a<w&&s.length>0){const n=w-a;s[0]={...s[0],count:(s[0].count||1)+n}}return s}_engageCombat(){var a,n;const e=this._dungeon.stages[this._stageIdx],t=k[e.encounter];if(!t){console.warn("[DungeonScreen] missing encounter",e.encounter),this._advance();return}const s=this._scaledEncounterEnemies(t),i={...t,enemies:s,name:e.name||t.name,_zoneId:this._anchorZoneId,_dungeonStage:this._stageIdx};if(this._pendingStunBuff){this._pendingStunBuff=!1;const o=r.get();o._pendingDungeonStunRound1=!0}(n=(a=this.audio)==null?void 0:a.playSfx)==null||n.call(a,"click"),this._lastCombatVictory=!0,this._lastCombatDefeat=!1,this._el&&(this._el.style.display="none"),this.manager.push(new U(this.manager,this.audio,null,i))}_resolveSkillCheck(){var u,b,_,f,v,y;(b=(u=this.audio)==null?void 0:u.playSfx)==null||b.call(u,"click");const e=this._dungeon.stages[this._stageIdx],t=S[e.checkId]||{},s=r.get(),i=(_=s.party)==null?void 0:_[0],a=t.stat||"STR",n=t.dc||12,o=((f=i==null?void 0:i.attrs)==null?void 0:f[a])||8,d=Math.floor(Math.random()*20)+1,g=o+d,l=g>=n;let p="";if(l)this._pendingStunBuff=!0,p=`
        <div class="dg-skill-result pass">
          <strong>Success!</strong> Rolled ${d} + ${o} (${a}) = ${g} vs DC ${n}.<br>
          ${t.passText||"You succeed."}
        </div>`;else{const C=t.failDamagePct||.12,D=[...s.party||[],...s.companions||[]].filter(c=>c&&c.hp>0);for(const c of D){const M=Math.max(1,Math.round((c.maxHp||c.hp||1)*C));c.hp=Math.max(1,(c.hp||1)-M)}p=`
        <div class="dg-skill-result fail">
          <strong>Failure.</strong> Rolled ${d} + ${o} (${a}) = ${g} vs DC ${n}.<br>
          ${t.failText||"You fail."}
        </div>`}const h=this._el.querySelector(".dg-card");h&&(h.innerHTML=`
        <span class="dg-stage-tag" style="color:#60c0e0;background:rgba(96,192,224,0.15)">Skill Check Result</span>
        <h2>${e.name||"Challenge"}</h2>
        ${p}
        <div class="dg-buttons" style="margin-top:0.5rem">
          <button type="button" class="dg-btn danger" id="dg-giveup-r">Give Up</button>
          <button type="button" class="dg-btn primary" id="dg-next-r">Press On</button>
        </div>
      `,(v=h.querySelector("#dg-giveup-r"))==null||v.addEventListener("click",()=>this._giveUp()),(y=h.querySelector("#dg-next-r"))==null||y.addEventListener("click",()=>this._advance()))}_advance(){var e,t;if((t=(e=this.audio)==null?void 0:e.playSfx)==null||t.call(e,"click"),this._stageIdx++,this._stageIdx>=this._dungeon.stages.length){this._doVictorySequence();return}this._build()}_giveUp(){var t,s;(s=(t=this.audio)==null?void 0:t.playSfx)==null||s.call(t,"click");const e=r.get();if(this._anchorZoneId&&(e.zoneId=this._anchorZoneId),this._anchorNodeId){e.nodeId=this._anchorNodeId;try{r.setZoneNode(this._anchorZoneId,this._anchorNodeId)}catch{}}this.manager.pop()}_doVictorySequence(){const e=this._dungeon.reward||{},t=r.get();Array.isArray(t.completedDungeons)||(t.completedDungeons=[]),t.completedDungeons.includes(this._dungeon.id)||t.completedDungeons.push(this._dungeon.id),e.gold&&r.addGold(e.gold),this._rewardItem=null;try{e.item&&(this._rewardItem=P(e.item,"rare","high"),this._rewardItem&&(r.addToInventory(this._rewardItem),T(()=>import("./play-13DYHLpj.js").then(i=>i.ax),__vite__mapDeps([0,1,2])).then(i=>i.recordDrop(this._rewardItem,{zoneId:this._anchorZoneId,source:"chest"})).catch(()=>{})))}catch(i){console.warn("[DungeonScreen] reward item gen failed",i)}if(e.xp){const i=(t.party||[]).filter(a=>a&&!(a.isCompanion||a.class==="companion"));if(i.length){const a=Math.floor(e.xp/i.length);i.forEach(n=>{n.xp=(n.xp||0)+a})}}[...t.party||[],...t.companions||[]].some(i=>i&&i._lastLevelUp)?(this._victoryPending=!0,this._el&&(this._el.style.display="none"),this.manager.push(new z(this.manager,this.audio))):this._showVictoryCard()}_showVictoryCard(){this._el&&m(this._el),this._el=x("div","dg-screen");const e=this._dungeon.reward||{},t=this._rewardItem;this._el.innerHTML=`
      <div class="dg-header"><div class="dg-title">Dungeon Cleared</div></div>
      <div class="dg-body">
        <div class="dg-card">
          <span class="dg-stage-tag" style="color:#40a060;background:rgba(64,160,96,0.15)">Victory</span>
          <h2>${this._dungeon.name}</h2>
          <p>You crack open the treasure chest. The dungeon settles, sealed behind you — never to be entered again.</p>
          <p style="color:#e8d090">
            +${e.gold||0} gold
            ${e.xp?`&middot; +${e.xp} xp distributed`:""}
            ${t?`&middot; <span style="color:#60c0e0">${t.name}</span>`:""}
          </p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn primary" id="dg-leave">Return to Surface</button>
          </div>
        </div>
      </div>
    `,this.manager.uiOverlay.appendChild(this._el),this._el.querySelector("#dg-leave").addEventListener("click",()=>this._giveUp())}}export{A as DungeonScreen};
