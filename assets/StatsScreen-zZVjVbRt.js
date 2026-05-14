import{e as D,i as R,c as H,u as L,r as M,g as A,m as P,G as B,a as E,b as F,p as K,d as G,A as z,f as N}from"./play-Bp7KHP-k.js";import"./savesClient-DUFjgBxb.js";function W(n,e,s={}){const t=n.getContext("2d"),a=window.devicePixelRatio||1,r=n.getBoundingClientRect();(n.width!==r.width*a||n.height!==r.height*a)&&(n.width=r.width*a,n.height=r.height*a),t.setTransform(a,0,0,a,0,0);const d=r.width,c=r.height;t.clearRect(0,0,d,c);const p=s.xKey||"t",i=s.yKey||"dps",o=s.color||"#e8a020",y="#5a4838",_="#8a7a6a",b=Object.assign({top:14,right:14,bottom:32,left:46},s.padding||{}),f=b.left,$=d-b.right,m=c-b.bottom,k=b.top;if(t.strokeStyle=y,t.lineWidth=1,t.beginPath(),t.moveTo(f,k),t.lineTo(f,m),t.lineTo($,m),t.stroke(),!e||e.length===0){t.fillStyle=_,t.font="12px Inter, system-ui, sans-serif",t.textAlign="center",t.fillText(s.emptyLabel||"No data yet",(f+$)/2,(m+k)/2);return}let u=1/0,x=-1/0,w=0,v=-1/0;for(const l of e){const h=l[p],g=l[i];h<u&&(u=h),h>x&&(x=h),g>v&&(v=g)}x===u&&(x=u+1),v===0&&(v=1);const C=l=>f+(l-u)*($-f)/(x-u),T=l=>m-(l-w)*(m-k)/(v-w);t.fillStyle=_,t.font="10px JetBrains Mono, monospace",t.textAlign="right",t.textBaseline="middle";const I=4;for(let l=0;l<=I;l++){const h=w+(v-w)*(l/I),g=T(h);t.strokeStyle=l===0?y:"rgba(90,72,56,0.45)",t.beginPath(),t.moveTo(f,g),t.lineTo($,g),t.stroke(),t.fillText(O(h),f-6,g)}t.textAlign="center",t.textBaseline="top";for(let l=0;l<=3;l++){const h=u+(x-u)*(l/3),g=C(h);t.fillText(`${Math.round(h)}s`,g,m+6)}t.strokeStyle=o,t.lineWidth=2,t.beginPath();for(let l=0;l<e.length;l++){const h=C(e[l][p]),g=T(e[l][i]);l===0?t.moveTo(h,g):t.lineTo(h,g)}t.stroke(),t.lineTo(C(e[e.length-1][p]),m),t.lineTo(C(e[0][p]),m),t.closePath();const S=t.createLinearGradient(0,k,0,m);S.addColorStop(0,j(o,.3)),S.addColorStop(1,j(o,.02)),t.fillStyle=S,t.fill(),s.title&&(t.fillStyle="#e8a020",t.font="bold 12px Inter, system-ui, sans-serif",t.textAlign="left",t.textBaseline="top",t.fillText(s.title,f,0))}function O(n){return n>=1e3?(n/1e3).toFixed(1)+"k":Math.abs(n)<1?n.toFixed(2):Math.round(n).toString()}function j(n,e){const s=n.match(/^#([0-9a-f]{6})$/i);if(!s)return`rgba(232,160,32,${e})`;const t=parseInt(s[1],16);return`rgba(${t>>16&255},${t>>8&255},${t&255},${e})`}class V{constructor(e,s,t={}){this.manager=e,this.audio=s,this.noGameMenuEsc=!0,this._tab=t.tab||"party",this._selectedCharId=null,this._filterLog="all",this._lifetimeOnly=!!t.lifetimeOnly}onEnter(){D(),R("stats-styles",q),this._el=H("div","stats-screen"),document.body.appendChild(this._el),this._lifetimeOnly&&(this._tab="lifetime"),this._render()}onExit(){this._el&&L(this._el),M(this._el),this._el=null}destroy(){this._el&&L(this._el),M(this._el),this._el=null}update(){}draw(){}_render(){const e=this._lifetimeOnly?[["lifetime","Lifetime"],["achievements","Achievements"]]:[["party","Party"],["lifetime","Lifetime"],["achievements","Achievements"]],s=A();let t="Last saved: never";if(s!=null&&s.savedAt){const a=new Date(s.savedAt),r=String(a.getHours()).padStart(2,"0"),d=String(a.getMinutes()).padStart(2,"0"),c=String(a.getSeconds()).padStart(2,"0");t=`Last saved: ${a.toISOString().slice(0,10)} ${r}:${d}:${c}`}this._el.innerHTML=`
      <div class="st-header">
        <div class="st-title">Statistics</div>
        <div class="st-tabs">
          ${e.map(([a,r])=>`<button class="st-tab${this._tab===a?" active":""}" data-tab="${a}">${r}</button>`).join("")}
        </div>
        <button class="st-close" id="st-close">✕ Close</button>
      </div>
      <div class="st-saved-at" style="font-size:11px;opacity:0.6;padding:2px 12px;text-align:right;">${t}</div>
      <div class="st-body" id="st-body">${this._renderTab()}</div>
    `,this._el.querySelector("#st-close").addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),this._el.querySelectorAll(".st-tab").forEach(a=>a.addEventListener("click",()=>{this.audio.playSfx("click"),this._tab=a.dataset.tab,this._render()})),this._postRender(),L(this._el),P(this._el,{layout:"vertical",focusFirst:!1,onEscape:()=>{this.audio.playSfx("click"),this.manager.pop()}})}_renderTab(){return this._tab==="party"?this._renderParty():this._tab==="lifetime"?this._renderLifetime():this._tab==="achievements"?this._renderAchievements():""}_renderParty(){const e=B.get(),s=[...e.party||[],...e.companions||[]];if(!s.length)return'<div class="st-empty">No party members yet.</div>';(!this._selectedCharId||!s.find(i=>i.id===this._selectedCharId))&&(this._selectedCharId=s[0].id);const t=s.find(i=>i.id===this._selectedCharId),a=E(t.id),r=F(t.id),d=this._filterLog==="all"?r:r.filter(i=>i.type===this._filterLog),p=(D().combatHistory||[]).filter(i=>(i.perChar||[]).some(o=>o.id===t.id)).slice(-15).reverse();return`
      <div class="st-party-grid">
        <div class="st-roster">
          ${s.map(i=>`
            <button class="st-roster-row${i.id===this._selectedCharId?" active":""}" data-char="${i.id}">
              <span class="st-roster-portrait">${K(i,36,"st-portrait")}</span>
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
          <div class="st-section-title">Recent Combats (this run)</div>
          <div class="st-combat-history">
            ${p.length?p.map(i=>{const o=(i.perChar||[]).find(f=>f.id===t.id);if(!o)return"";const y=new Date(i.ts).toLocaleString(),_=i.won?'<span class="ch-win">Win</span>':'<span class="ch-loss">Loss</span>',b=o.mvp?'<span class="ch-mvp">MVP</span>':"";return`
                <div class="st-ch-row">
                  <div class="ch-meta">${_}${b}<span class="ch-zone">${i.zoneId||"—"}</span><span class="ch-time">${y} · ${i.durationSec}s</span></div>
                  <div class="ch-stats">
                    <span><b>${this._fmt(o.dmgDealt)}</b> dmg</span>
                    <span><b>${this._fmt(o.dmgTaken)}</b> taken</span>
                    <span><b>${this._fmt(o.heals)}</b> healed</span>
                    <span><b>${o.kills}</b> kills</span>
                    ${o.deaths?`<span class="ch-died">died ${o.deaths}×</span>`:""}
                  </div>
                </div>`}).join(""):'<div class="st-empty">No combats logged yet.</div>'}
          </div>
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
            ${d.length?d.map(i=>`
              <div class="st-log-row" data-type="${i.type}">
                <span class="st-log-tag">${this._logTagLabel(i.type)}</span>
                <span class="st-log-text">${i.summary}</span>
                <span class="st-log-meta">${i.zoneId||""}</span>
              </div>
            `).join(""):'<div class="st-empty">No entries.</div>'}
          </div>
        </div>
      </div>
    `}_statCell(e,s){return`<div class="st-cell"><div class="st-cell-label">${e}</div><div class="st-cell-value">${this._fmt(s)}</div></div>`}_fmt(e){return typeof e!="number"?String(e):e>=1e6?(e/1e6).toFixed(1)+"M":e>=1e3?(e/1e3).toFixed(1)+"k":Math.round(e).toString()}_logTagLabel(e){return e==="major_kill"?"Boss":e==="elite_kill"?"Elite":e==="near_death"?"Near Death":e==="death"?"Fell":e==="story"?"Story":e}_renderLifetime(){const e=A(),s=e.global||{},t=(e.runHistory||[]).slice(0,20);return`
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
            ${t.map(a=>{var r,d,c,p;return`
              <div class="st-run-row">
                <span class="st-run-date">${new Date(a.startedAt).toISOString().slice(0,10)}</span>
                <span class="st-run-label">${a.label||"Run"}</span>
                <span class="st-run-kpi">${((r=a.global)==null?void 0:r.totalKills)||0} kills</span>
                <span class="st-run-kpi">${this._fmt(((d=a.global)==null?void 0:d.totalDamage)||0)} dmg</span>
                <span class="st-run-kpi">${((c=a.global)==null?void 0:c.fightsWon)||0}-${((p=a.global)==null?void 0:p.fightsLost)||0}</span>
              </div>
            `}).join("")}
          </div>
        `:'<div class="st-empty">No completed runs archived yet.</div>'}
      </div>
    `}_renderAchievements(){const{current:e,life:s}=G(),t=z.length;return`
      <div class="st-ach">
        <div class="st-section-title">Achievements <span class="st-progress">${z.filter(r=>{var d,c;return((d=e[r.id])==null?void 0:d.unlocked)||((c=s[r.id])==null?void 0:c.unlocked)}).length} / ${t}</span></div>
        <div class="st-ach-grid">
          ${z.map(r=>{var i,o;const d=!!((i=s[r.id])!=null&&i.unlocked),c=!!((o=e[r.id])!=null&&o.unlocked),p=d||c;return`
              <div class="st-ach-card${p?" un":""} t-${r.tier}">
                <div class="st-ach-tier">${r.tier.toUpperCase()}</div>
                <div class="st-ach-name">${r.name}</div>
                <div class="st-ach-desc">${r.desc}</div>
                <div class="st-ach-status">${p?"★ Unlocked":"Locked"}</div>
              </div>
            `}).join("")}
        </div>
      </div>
    `}_postRender(){if(this._tab==="party"){this._el.querySelectorAll(".st-roster-row").forEach(t=>t.addEventListener("click",()=>{this.audio.playSfx("click"),this._selectedCharId=t.dataset.char,this._render()}));const e=this._el.querySelector("#st-log-filter");e&&e.addEventListener("change",()=>{this._filterLog=e.value,this._render()});const s=this._el.querySelector("#st-dps-chart");s&&this._selectedCharId&&requestAnimationFrame(()=>{const t=N(this._selectedCharId,5);W(s,t,{xKey:"t",yKey:"dps",color:"#e8a020",emptyLabel:"No combat damage logged this run."})})}}}const q=`
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

/* M415 Recent Combats */
.st-combat-history { display: flex; flex-direction: column; gap: 4px; max-height: 280px; overflow-y: auto; }
.st-ch-row { padding: 6px 8px; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.78rem; }
.st-ch-row .ch-meta { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; color: #8a7a6a; margin-bottom: 3px; }
.st-ch-row .ch-meta .ch-zone { color: #c0a070; }
.st-ch-row .ch-meta .ch-time { margin-left: auto; font-style: italic; }
.st-ch-row .ch-stats { display: flex; flex-wrap: wrap; gap: 10px; color: #c0b090; }
.st-ch-row .ch-stats b { color: #f0e8d8; }
.ch-win { color: #60c080; font-weight: 700; }
.ch-loss { color: #c08060; font-weight: 700; }
.ch-mvp { color: #ffd060; font-weight: 700; font-size: 0.68rem; padding: 1px 5px; background: rgba(232,160,32,0.18); border-radius: 3px; }
.ch-died { color: #c04030; }
`;export{V as StatsScreen};
