const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./play-QH26u79V.js","./savesClient-Lt_9u8Ks-B0TWHWS2.js","./play-dErdlDnR.css"])))=>i.map(i=>d[i]);
import{R as P,E as V,k as l,Y as v,J as x,S as k,T as I,V as z,X as R,s as U,_ as A,a0 as T}from"./play-QH26u79V.js";import"./savesClient-Lt_9u8Ks-B0TWHWS2.js";const D=(y,t=D,e=t.f||(t.f=["./play-B4Rs_XUc.js","./savesClient-Lt_9u8Ks.js","./play-dErdlDnR.css"]))=>y.map(s=>e[s]),$=1.35,S=1.3,w=4,C=6,B=`
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
`;class N{constructor(t,e,s,i,n){this.manager=t,this.audio=e,this._dungeonId=s,this._anchorNodeId=i,this._anchorZoneId=n,this._dungeon=P[s],this._stageIdx=0,this._el=null,this._pendingStunBuff=!1,this._victoryPending=!1}onEnter(){if(V("dg-styles",B),!this._dungeon){console.warn("[DungeonScreen] unknown dungeonId",this._dungeonId),this.manager.pop();return}this._build()}onResume(){if(this._el&&(this._el.style.display=""),this._victoryPending){this._victoryPending=!1,this._showVictoryCard();return}if(this._nextStagePending){if(this._nextStagePending=!1,this._stageIdx++,this._stageIdx>=this._dungeon.stages.length){this._doVictorySequence();return}this._build();return}if(this._lastCombatVictory){this._lastCombatVictory=!1;const t=l.get();if([...t.party||[],...t.companions||[]].some(e=>e&&e._lastLevelUp)){this._nextStagePending=!0;return}if(this._stageIdx++,this._stageIdx>=this._dungeon.stages.length){this._doVictorySequence();return}}else if(this._lastCombatDefeat){this._lastCombatDefeat=!1,this.manager.pop();return}this._build()}onLeave(){this._purgeDom()}onExit(){this._purgeDom()}destroy(){this._purgeDom()}_purgeDom(){try{v(this._el)}catch{}try{document.querySelectorAll(".dg-screen").forEach(t=>t.remove())}catch{}this._el=null}_build(){if(this._el&&v(this._el),this._el=x("div","dg-screen"),this._stageIdx>=this._dungeon.stages.length){this._doVictorySequence();return}const t=this._dungeon.stages[this._stageIdx],e=this._dungeon.stages.length,s=Array.from({length:e},(a,o)=>o<this._stageIdx?'<div class="pip done"></div>':o===this._stageIdx?'<div class="pip active"></div>':'<div class="pip"></div>').join(""),i=t.type,n=`Stage ${this._stageIdx+1} / ${e}`;let r="";if(i==="combat"||i==="boss"){const a=k[t.encounter],o=this._scaledEncounterEnemies(a).reduce((c,h)=>c+(h.count||1),0),d=i==="boss",u=this._pendingStunBuff?'<div class="dg-buff-badge">Enemies will start stunned (skill check bonus)</div>':"";r=`
        <div class="dg-card">
          <span class="dg-stage-tag" style="${d?"color:#c060e0;background:rgba(192,96,224,0.15)":""}">${n} · ${d?"Mini-Boss":"Combat"}</span>
          <h2>${t.name||(a==null?void 0:a.name)||"Hostile encounter"}</h2>
          <p>${o} ${o===1?"enemy":"enemies"} ahead. ${d?"A mini-boss waits at the end of the run — defeat it to claim the chest.":"Cut through and press deeper."}</p>
          ${u}
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn primary" id="dg-fight">${d?"Confront Boss":"Engage"}</button>
          </div>
        </div>`}else if(i==="skill_check"){const a=I[t.checkId]||{};r=`
        <div class="dg-card">
          <span class="dg-stage-tag" style="color:#60c0e0;background:rgba(96,192,224,0.15)">${n} · Skill Check</span>
          <h2>${t.name||"Challenge Ahead"}</h2>
          <p>${a.flavor||"Something blocks your path."}</p>
          <p style="font-size:0.78rem;color:#a090c0">
            Roll ${a.stat||"?"} vs DC ${a.dc||"?"} &mdash;
            Pass: enemies start stunned next fight. Fail: party takes ~${Math.round((a.failDamagePct||.12)*100)}% max HP damage.
          </p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn danger" id="dg-giveup">Give Up</button>
            <button type="button" class="dg-btn primary" id="dg-attempt">Attempt (${a.stat||"?"} ${a.dc||"?"})</button>
          </div>
        </div>`}this._el.innerHTML=`
      <div class="dg-header">
        <div class="dg-title">${this._dungeon.name}</div>
      </div>
      <div class="dg-progress">${s}</div>
      <div class="dg-body">
        ${r}
        <div class="dg-info">No retreat to town inside a dungeon — only "Give Up" returns you to the surface (and forfeits the chest).</div>
      </div>
    `,this.manager.uiOverlay.appendChild(this._el),this._wire()}_wire(){const t=this._el.querySelector("#dg-giveup");t&&t.addEventListener("click",()=>this._giveUp());const e=this._el.querySelector("#dg-fight");e&&e.addEventListener("click",()=>this._engageCombat());const s=this._el.querySelector("#dg-attempt");s&&s.addEventListener("click",()=>this._resolveSkillCheck())}_scaledEncounterEnemies(t){if(!t)return[];const e=(t.enemies||[]).map(n=>({...n})).map(n=>({...n,hp:Math.round((n.hp||1)*$),maxHp:Math.round((n.maxHp||n.hp||1)*$),dmg:Array.isArray(n.dmg)?[Math.round(n.dmg[0]*S),Math.round(n.dmg[1]*S)]:n.dmg})),s=e.reduce((n,r)=>n+(r.count||1),0);if(s<w){const n=w-s;e.length>0&&(e[e.length-1]={...e[e.length-1],count:(e[e.length-1].count||1)+n})}const i=e.reduce((n,r)=>n+(r.count||1),0);if(i<C&&e.length>0){const n=C-i;e[0]={...e[0],count:(e[0].count||1)+n}}return e}_engageCombat(){var t,e;const s=this._dungeon.stages[this._stageIdx],i=k[s.encounter];if(!i){console.warn("[DungeonScreen] missing encounter",s.encounter),this._advance();return}const n=this._scaledEncounterEnemies(i),r={...i,enemies:n,name:s.name||i.name,_zoneId:this._anchorZoneId,_dungeonStage:this._stageIdx};if(this._pendingStunBuff){this._pendingStunBuff=!1;const a=l.get();a._pendingDungeonStunRound1=!0}(e=(t=this.audio)==null?void 0:t.playSfx)==null||e.call(t,"click"),this._lastCombatVictory=!0,this._lastCombatDefeat=!1,this._el&&(this._el.style.display="none"),this.manager.push(new z(this.manager,this.audio,null,r))}_resolveSkillCheck(){var t,e,s,i,n,r;(e=(t=this.audio)==null?void 0:t.playSfx)==null||e.call(t,"click");const a=this._dungeon.stages[this._stageIdx],o=I[a.checkId]||{},d=l.get(),u=(s=d.party)==null?void 0:s[0],c=o.stat||"STR",h=o.dc||12,m=((i=u==null?void 0:u.attrs)==null?void 0:i[c])||8,b=Math.floor(Math.random()*20)+1,_=m+b,E=_>=h;let f="";if(E)this._pendingStunBuff=!0,f=`
        <div class="dg-skill-result pass">
          <strong>Success!</strong> Rolled ${b} + ${m} (${c}) = ${_} vs DC ${h}.<br>
          ${o.passText||"You succeed."}
        </div>`;else{const M=o.failDamagePct||.12,q=[...d.party||[],...d.companions||[]].filter(g=>g&&g.hp>0);for(const g of q){const L=Math.max(1,Math.round((g.maxHp||g.hp||1)*M));g.hp=Math.max(1,(g.hp||1)-L)}f=`
        <div class="dg-skill-result fail">
          <strong>Failure.</strong> Rolled ${b} + ${m} (${c}) = ${_} vs DC ${h}.<br>
          ${o.failText||"You fail."}
        </div>`}const p=this._el.querySelector(".dg-card");p&&(p.innerHTML=`
        <span class="dg-stage-tag" style="color:#60c0e0;background:rgba(96,192,224,0.15)">Skill Check Result</span>
        <h2>${a.name||"Challenge"}</h2>
        ${f}
        <div class="dg-buttons" style="margin-top:0.5rem">
          <button type="button" class="dg-btn danger" id="dg-giveup-r">Give Up</button>
          <button type="button" class="dg-btn primary" id="dg-next-r">Press On</button>
        </div>
      `,(n=p.querySelector("#dg-giveup-r"))==null||n.addEventListener("click",()=>this._giveUp()),(r=p.querySelector("#dg-next-r"))==null||r.addEventListener("click",()=>this._advance()))}_advance(){var t,e;if((e=(t=this.audio)==null?void 0:t.playSfx)==null||e.call(t,"click"),this._stageIdx++,this._stageIdx>=this._dungeon.stages.length){this._doVictorySequence();return}this._build()}_giveUp(){var t,e;(e=(t=this.audio)==null?void 0:t.playSfx)==null||e.call(t,"click");const s=l.get();if(this._anchorZoneId&&(s.zoneId=this._anchorZoneId),this._anchorNodeId){s.nodeId=this._anchorNodeId;try{l.setZoneNode(this._anchorZoneId,this._anchorNodeId)}catch{}}this.manager.pop()}_doVictorySequence(){const t=this._dungeon.reward||{},e=l.get();Array.isArray(e.completedDungeons)||(e.completedDungeons=[]),e.completedDungeons.includes(this._dungeon.id)||e.completedDungeons.push(this._dungeon.id),t.gold&&l.addGold(t.gold),this._rewardItem=null;try{t.item&&(this._rewardItem=R(t.item,"rare","high"),this._rewardItem&&(l.addToInventory(this._rewardItem),U(()=>A(()=>import("./play-QH26u79V.js").then(s=>s.at),__vite__mapDeps([0,1,2]),import.meta.url).then(s=>s.av),D([0,1,2]),import.meta.url).then(s=>s.recordDrop(this._rewardItem,{zoneId:this._anchorZoneId,source:"chest"})).catch(()=>{})))}catch(s){console.warn("[DungeonScreen] reward item gen failed",s)}if(t.xp){const s=(e.party||[]).filter(i=>i&&!(i.isCompanion||i.class==="companion"));if(s.length){const i=Math.floor(t.xp/s.length);s.forEach(n=>{n.xp=(n.xp||0)+i})}}[...e.party||[],...e.companions||[]].some(s=>s&&s._lastLevelUp)?(this._victoryPending=!0,this._el&&(this._el.style.display="none"),this.manager.push(new T(this.manager,this.audio))):this._showVictoryCard()}_showVictoryCard(){this._el&&v(this._el),this._el=x("div","dg-screen");const t=this._dungeon.reward||{},e=this._rewardItem;this._el.innerHTML=`
      <div class="dg-header"><div class="dg-title">Dungeon Cleared</div></div>
      <div class="dg-body">
        <div class="dg-card">
          <span class="dg-stage-tag" style="color:#40a060;background:rgba(64,160,96,0.15)">Victory</span>
          <h2>${this._dungeon.name}</h2>
          <p>You crack open the treasure chest. The dungeon settles, sealed behind you — never to be entered again.</p>
          <p style="color:#e8d090">
            +${t.gold||0} gold
            ${t.xp?`&middot; +${t.xp} xp distributed`:""}
            ${e?`&middot; <span style="color:#60c0e0">${e.name}</span>`:""}
          </p>
          <div class="dg-buttons">
            <button type="button" class="dg-btn primary" id="dg-leave">Return to Surface</button>
          </div>
        </div>
      </div>
    `,this.manager.uiOverlay.appendChild(this._el),this._el.querySelector("#dg-leave").addEventListener("click",()=>this._giveUp())}}export{N as DungeonScreen};
