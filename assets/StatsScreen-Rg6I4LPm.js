import{e as A,i as j,c as B,u as w,r as D,m as P,G as R,g as E,a as F,p as H,b as K,d as G,A as S,f as N}from"./play-B6UPjTKl.js";import"./savesClient-DUFjgBxb.js";function W(o,e,s={}){const t=o.getContext("2d"),a=window.devicePixelRatio||1,r=o.getBoundingClientRect();(o.width!==r.width*a||o.height!==r.height*a)&&(o.width=r.width*a,o.height=r.height*a),t.setTransform(a,0,0,a,0,0);const n=r.width,i=r.height;t.clearRect(0,0,n,i);const p=s.xKey||"t",x=s.yKey||"dps",m=s.color||"#e8a020",L="#5a4838",z="#8a7a6a",y=Object.assign({top:14,right:14,bottom:32,left:46},s.padding||{}),f=y.left,v=n-y.right,h=i-y.bottom,_=y.top;if(t.strokeStyle=L,t.lineWidth=1,t.beginPath(),t.moveTo(f,_),t.lineTo(f,h),t.lineTo(v,h),t.stroke(),!e||e.length===0){t.fillStyle=z,t.font="12px Inter, system-ui, sans-serif",t.textAlign="center",t.fillText(s.emptyLabel||"No data yet",(f+v)/2,(h+_)/2);return}let g=1/0,u=-1/0,$=0,b=-1/0;for(const l of e){const d=l[p],c=l[x];d<g&&(g=d),d>u&&(u=d),c>b&&(b=c)}u===g&&(u=g+1),b===0&&(b=1);const k=l=>f+(l-g)*(v-f)/(u-g),T=l=>h-(l-$)*(h-_)/(b-$);t.fillStyle=z,t.font="10px JetBrains Mono, monospace",t.textAlign="right",t.textBaseline="middle";const I=4;for(let l=0;l<=I;l++){const d=$+(b-$)*(l/I),c=T(d);t.strokeStyle=l===0?L:"rgba(90,72,56,0.45)",t.beginPath(),t.moveTo(f,c),t.lineTo(v,c),t.stroke(),t.fillText(q(d),f-6,c)}t.textAlign="center",t.textBaseline="top";for(let l=0;l<=3;l++){const d=g+(u-g)*(l/3),c=k(d);t.fillText(`${Math.round(d)}s`,c,h+6)}t.strokeStyle=m,t.lineWidth=2,t.beginPath();for(let l=0;l<e.length;l++){const d=k(e[l][p]),c=T(e[l][x]);l===0?t.moveTo(d,c):t.lineTo(d,c)}t.stroke(),t.lineTo(k(e[e.length-1][p]),h),t.lineTo(k(e[0][p]),h),t.closePath();const C=t.createLinearGradient(0,_,0,h);C.addColorStop(0,M(m,.3)),C.addColorStop(1,M(m,.02)),t.fillStyle=C,t.fill(),s.title&&(t.fillStyle="#e8a020",t.font="bold 12px Inter, system-ui, sans-serif",t.textAlign="left",t.textBaseline="top",t.fillText(s.title,f,0))}function q(o){return o>=1e3?(o/1e3).toFixed(1)+"k":Math.abs(o)<1?o.toFixed(2):Math.round(o).toString()}function M(o,e){const s=o.match(/^#([0-9a-f]{6})$/i);if(!s)return`rgba(232,160,32,${e})`;const t=parseInt(s[1],16);return`rgba(${t>>16&255},${t>>8&255},${t&255},${e})`}class V{constructor(e,s,t={}){this.manager=e,this.audio=s,this.noGameMenuEsc=!0,this._tab=t.tab||"party",this._selectedCharId=null,this._filterLog="all",this._lifetimeOnly=!!t.lifetimeOnly}onEnter(){A(),j("stats-styles",J),this._el=B("div","stats-screen"),document.body.appendChild(this._el),this._lifetimeOnly&&(this._tab="lifetime"),this._render()}onExit(){this._el&&w(this._el),D(this._el),this._el=null}destroy(){this._el&&w(this._el),D(this._el),this._el=null}update(){}draw(){}_render(){const e=this._lifetimeOnly?[["lifetime","Lifetime"],["achievements","Achievements"]]:[["party","Party"],["lifetime","Lifetime"],["achievements","Achievements"]];this._el.innerHTML=`
      <div class="st-header">
        <div class="st-title">Statistics</div>
        <div class="st-tabs">
          ${e.map(([s,t])=>`<button class="st-tab${this._tab===s?" active":""}" data-tab="${s}">${t}</button>`).join("")}
        </div>
        <button class="st-close" id="st-close">✕ Close</button>
      </div>
      <div class="st-body" id="st-body">${this._renderTab()}</div>
    `,this._el.querySelector("#st-close").addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),this._el.querySelectorAll(".st-tab").forEach(s=>s.addEventListener("click",()=>{this.audio.playSfx("click"),this._tab=s.dataset.tab,this._render()})),this._postRender(),w(this._el),P(this._el,{layout:"vertical",focusFirst:!1,onEscape:()=>{this.audio.playSfx("click"),this.manager.pop()}})}_renderTab(){return this._tab==="party"?this._renderParty():this._tab==="lifetime"?this._renderLifetime():this._tab==="achievements"?this._renderAchievements():""}_renderParty(){const e=R.get(),s=[...e.party||[],...e.companions||[]];if(!s.length)return'<div class="st-empty">No party members yet.</div>';(!this._selectedCharId||!s.find(i=>i.id===this._selectedCharId))&&(this._selectedCharId=s[0].id);const t=s.find(i=>i.id===this._selectedCharId),a=E(t.id),r=F(t.id),n=this._filterLog==="all"?r:r.filter(i=>i.type===this._filterLog);return`
      <div class="st-party-grid">
        <div class="st-roster">
          ${s.map(i=>`
            <button class="st-roster-row${i.id===this._selectedCharId?" active":""}" data-char="${i.id}">
              <span class="st-roster-portrait">${H(i,36,"st-portrait")}</span>
              <span class="st-roster-name">
                <span class="rn">${i.name}</span>
                <span class="rc">${i.cls||i.class||"companion"} · L${i.level||1}</span>
              </span>
              <span class="st-roster-kills">${E(i.id).kills}<span class="lk">k</span></span>
            </button>
          `).join("")}
        </div>
        <div class="st-detail">
          <div class="st-detail-head">
            <div class="st-detail-name">${t.name} <span class="st-detail-class">— ${t.cls||t.class||""} L${t.level||1}</span></div>
          </div>
          <div class="st-stat-grid">
            ${this._statCell("Damage Dealt",a.damageDealt)}
            ${this._statCell("Damage Taken",a.damageTaken)}
            ${this._statCell("Kills",a.kills)}
            ${this._statCell("Crits",a.crits)}
            ${this._statCell("Heals Given",a.heals)}
            ${this._statCell("Heals Received",a.healsReceived)}
            ${this._statCell("Most Damage Hit",a.mostDamageHit)}
            ${this._statCell("Longest Streak",a.longestKillStreak)}
            ${this._statCell("Near-Deaths",a.nearDeaths)}
            ${this._statCell("Deaths",a.deaths)}
            ${this._statCell("Dodges",a.dodges)}
            ${this._statCell("Blocks",a.blocks)}
            ${this._statCell("Fights Won",a.fightsWon)}
            ${this._statCell("Fights Lost",a.fightsLost)}
          </div>
          <div class="st-section-title">DPS over time (this run)</div>
          <div class="st-chart-wrap"><canvas id="st-dps-chart" class="st-chart"></canvas></div>
          <div class="st-section-title">Story Log
            <select class="st-filter" id="st-log-filter">
              <option value="all"${this._filterLog==="all"?" selected":""}>all</option>
              <option value="major_kill"${this._filterLog==="major_kill"?" selected":""}>major kills</option>
              <option value="elite_kill"${this._filterLog==="elite_kill"?" selected":""}>elites</option>
              <option value="near_death"${this._filterLog==="near_death"?" selected":""}>near-deaths</option>
              <option value="death"${this._filterLog==="death"?" selected":""}>deaths</option>
              <option value="story"${this._filterLog==="story"?" selected":""}>story</option>
            </select>
          </div>
          <div class="st-log">
            ${n.length?n.map(i=>`
              <div class="st-log-row" data-type="${i.type}">
                <span class="st-log-tag">${this._logTagLabel(i.type)}</span>
                <span class="st-log-text">${i.summary}</span>
                <span class="st-log-meta">${i.zoneId||""}</span>
              </div>
            `).join(""):'<div class="st-empty">No entries.</div>'}
          </div>
        </div>
      </div>
    `}_statCell(e,s){return`<div class="st-cell"><div class="st-cell-label">${e}</div><div class="st-cell-value">${this._fmt(s)}</div></div>`}_fmt(e){return typeof e!="number"?String(e):e>=1e6?(e/1e6).toFixed(1)+"M":e>=1e3?(e/1e3).toFixed(1)+"k":Math.round(e).toString()}_logTagLabel(e){return e==="major_kill"?"Boss":e==="elite_kill"?"Elite":e==="near_death"?"Near Death":e==="death"?"Fell":e==="story"?"Story":e}_renderLifetime(){const e=K(),s=e.global||{},t=(e.runHistory||[]).slice(0,20);return`
      <div class="st-lifetime">
        <div class="st-section-title">Lifetime totals (across all runs)</div>
        <div class="st-stat-grid">
          ${this._statCell("Total Kills",s.totalKills||0)}
          ${this._statCell("Total Damage",s.totalDamage||0)}
          ${this._statCell("Total Heals",s.totalHeals||0)}
          ${this._statCell("Fights Won",s.fightsWon||0)}
          ${this._statCell("Fights Lost",s.fightsLost||0)}
          ${this._statCell("Perfect Wins",s.perfectVictories||0)}
          ${this._statCell("Gold Earned",s.totalGoldEarned||0)}
          ${this._statCell("Gold Spent",s.totalGoldSpent||0)}
          ${this._statCell("XP Gained",s.totalXp||0)}
          ${this._statCell("Runs Started",s.runsStarted||0)}
          ${this._statCell("Runs Completed",s.runsCompleted||0)}
          ${this._statCell("Hardcore Deaths",s.hardcoreDeaths||0)}
        </div>
        <div class="st-section-title">Run history</div>
        ${t.length?`
          <div class="st-runlist">
            ${t.map(a=>{var r,n,i,p;return`
              <div class="st-run-row">
                <span class="st-run-date">${new Date(a.startedAt).toISOString().slice(0,10)}</span>
                <span class="st-run-label">${a.label||"Run"}</span>
                <span class="st-run-kpi">${((r=a.global)==null?void 0:r.totalKills)||0} kills</span>
                <span class="st-run-kpi">${this._fmt(((n=a.global)==null?void 0:n.totalDamage)||0)} dmg</span>
                <span class="st-run-kpi">${((i=a.global)==null?void 0:i.fightsWon)||0}-${((p=a.global)==null?void 0:p.fightsLost)||0}</span>
              </div>
            `}).join("")}
          </div>
        `:'<div class="st-empty">No completed runs archived yet.</div>'}
      </div>
    `}_renderAchievements(){const{current:e,life:s}=G(),t=S.length;return`
      <div class="st-ach">
        <div class="st-section-title">Achievements <span class="st-progress">${S.filter(r=>{var n,i;return((n=e[r.id])==null?void 0:n.unlocked)||((i=s[r.id])==null?void 0:i.unlocked)}).length} / ${t}</span></div>
        <div class="st-ach-grid">
          ${S.map(r=>{var x,m;const n=!!((x=s[r.id])!=null&&x.unlocked),i=!!((m=e[r.id])!=null&&m.unlocked),p=n||i;return`
              <div class="st-ach-card${p?" un":""} t-${r.tier}">
                <div class="st-ach-tier">${r.tier.toUpperCase()}</div>
                <div class="st-ach-name">${r.name}</div>
                <div class="st-ach-desc">${r.desc}</div>
                <div class="st-ach-status">${p?"★ Unlocked":"Locked"}</div>
              </div>
            `}).join("")}
        </div>
      </div>
    `}_postRender(){if(this._tab==="party"){this._el.querySelectorAll(".st-roster-row").forEach(t=>t.addEventListener("click",()=>{this.audio.playSfx("click"),this._selectedCharId=t.dataset.char,this._render()}));const e=this._el.querySelector("#st-log-filter");e&&e.addEventListener("change",()=>{this._filterLog=e.value,this._render()});const s=this._el.querySelector("#st-dps-chart");s&&this._selectedCharId&&requestAnimationFrame(()=>{const t=N(this._selectedCharId,5);W(s,t,{xKey:"t",yKey:"dps",color:"#e8a020",emptyLabel:"No combat damage logged this run."})})}}}const J=`
.stats-screen { position: absolute; inset: 0; display: flex; flex-direction: column; background: linear-gradient(180deg,#0a0608,#120a10); color: #f0e8d8; font-family: 'Inter', sans-serif; z-index: 100; }
.st-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1rem; border-bottom: 1px solid rgba(232,160,32,0.18); background: rgba(0,0,0,0.35); flex-shrink: 0; }
.st-title { font-family: 'Cinzel', serif; font-weight: 900; letter-spacing: 0.15em; color: #e8a020; font-size: 1rem; text-transform: uppercase; flex-shrink: 0; }
.st-tabs { display: flex; gap: 0.4rem; flex: 1; flex-wrap: wrap; }
.st-tab { background: transparent; border: 1px solid rgba(232,160,32,0.2); color: #8a7a6a; padding: 0.35rem 0.75rem; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; border-radius: 4px; cursor: pointer; min-height: 36px; }
.st-tab.active { background: rgba(232,160,32,0.14); color: #e8a020; border-color: rgba(232,160,32,0.5); }
.st-close { background: none; border: none; color: #8a7a6a; cursor: pointer; font-size: 0.78rem; padding: 0.4rem 0.6rem; min-height: 36px; }
.st-close:hover { color: #f0e8d8; }
.st-body { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; }
.st-empty { padding: 2rem; text-align: center; color: #4a3a32; font-size: 0.85rem; }
.st-section-title { font-family: 'Cinzel', serif; color: #c0a070; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; margin: 1rem 0 0.5rem; display: flex; justify-content: space-between; align-items: center; }
.st-progress { color: #8a7a6a; font-weight: 400; font-family: 'JetBrains Mono', monospace; }
.st-filter { background: #0a0608; border: 1px solid rgba(232,160,32,0.25); color: #f0e8d8; font-size: 0.72rem; padding: 2px 6px; border-radius: 3px; }

/* Party tab */
.st-party-grid { display: grid; grid-template-columns: 240px 1fr; gap: 0.75rem; }
@media (max-width: 720px) { .st-party-grid { grid-template-columns: 1fr; } }
.st-roster { display: flex; flex-direction: column; gap: 4px; }
.st-roster-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; background: rgba(26,18,24,0.6); border: 1px solid rgba(232,160,32,0.1); border-radius: 6px; cursor: pointer; min-height: 50px; text-align: left; color: #c0b090; }
.st-roster-row.active { border-color: rgba(232,160,32,0.5); background: rgba(232,160,32,0.08); }
.st-roster-portrait { width: 36px; height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,0.04); }
.st-roster-name { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.1; }
.st-roster-name .rn { font-size: 0.78rem; font-weight: 600; color: #f0e8d8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.st-roster-name .rc { font-size: 0.62rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.06em; }
.st-roster-kills { color: #e8a020; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; font-weight: 700; }
.st-roster-kills .lk { color: #8a7a6a; font-size: 0.65rem; margin-left: 1px; }
.st-detail { background: rgba(26,18,24,0.55); border: 1px solid rgba(232,160,32,0.12); border-radius: 8px; padding: 0.75rem 1rem; }
.st-detail-name { font-family: 'Cinzel', serif; font-size: 1rem; font-weight: 700; color: #e8a020; }
.st-detail-class { color: #8a7a6a; font-weight: 400; font-family: 'Inter', sans-serif; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; }
.st-stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; margin-top: 0.5rem; }
.st-cell { background: rgba(0,0,0,0.3); border: 1px solid rgba(232,160,32,0.08); border-radius: 4px; padding: 6px 8px; }
.st-cell-label { font-size: 0.62rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.08em; }
.st-cell-value { font-family: 'JetBrains Mono', monospace; font-size: 1rem; color: #f0e8d8; font-weight: 600; }
.st-chart-wrap { background: #0a0608; border: 1px solid rgba(232,160,32,0.12); border-radius: 6px; height: 200px; padding: 4px; }
.st-chart { width: 100%; height: 100%; display: block; }
.st-log { display: flex; flex-direction: column; gap: 4px; max-height: 360px; overflow-y: auto; }
.st-log-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.6rem; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.78rem; }
.st-log-row[data-type="major_kill"] { border-left: 3px solid #e8a020; }
.st-log-row[data-type="elite_kill"] { border-left: 3px solid #c060c0; }
.st-log-row[data-type="near_death"] { border-left: 3px solid #c08040; }
.st-log-row[data-type="death"] { border-left: 3px solid #c04030; }
.st-log-row[data-type="story"] { border-left: 3px solid #60a8e8; }
.st-log-tag { font-size: 0.62rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.08em; min-width: 70px; }
.st-log-text { flex: 1; }
.st-log-meta { color: #4a3a32; font-size: 0.7rem; font-style: italic; }

/* Lifetime tab */
.st-runlist { display: flex; flex-direction: column; gap: 4px; }
.st-run-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.6rem; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.78rem; }
.st-run-date { color: #8a7a6a; font-family: 'JetBrains Mono', monospace; min-width: 92px; }
.st-run-label { flex: 1; color: #f0e8d8; }
.st-run-kpi { font-family: 'JetBrains Mono', monospace; color: #c0a070; }

/* Achievements */
.st-ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.st-ach-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(232,160,32,0.08); border-radius: 6px; padding: 0.6rem 0.75rem; opacity: 0.5; }
.st-ach-card.un { opacity: 1; border-color: rgba(232,160,32,0.45); background: rgba(232,160,32,0.05); }
.st-ach-card.t-bronze.un { border-color: #b87a40; }
.st-ach-card.t-silver.un { border-color: #c0c0c8; }
.st-ach-card.t-gold.un { border-color: #f0c060; box-shadow: 0 0 10px rgba(240,192,96,0.25); }
.st-ach-tier { font-size: 0.6rem; letter-spacing: 0.14em; color: #8a7a6a; }
.st-ach-name { font-family: 'Cinzel', serif; font-size: 0.95rem; color: #e8a020; margin: 2px 0 4px; }
.st-ach-desc { font-size: 0.74rem; color: #c0b090; line-height: 1.4; }
.st-ach-status { font-size: 0.7rem; color: #8a7a6a; margin-top: 4px; }
.st-ach-card.un .st-ach-status { color: #e8a020; }
`;export{V as StatsScreen};
