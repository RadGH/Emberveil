import{ak as I,E as R,J as H,al as L,Y as M,am as A,an as P,k as B,a1 as j,a2 as F,H as W,ao as q,ap as z,aq as K}from"./play-QH26u79V.js";import"./savesClient-Lt_9u8Ks-B0TWHWS2.js";function N(d,s,a={}){const t=d.getContext("2d"),e=window.devicePixelRatio||1,l=d.getBoundingClientRect();(d.width!==l.width*e||d.height!==l.height*e)&&(d.width=l.width*e,d.height=l.height*e),t.setTransform(e,0,0,e,0,0);const o=l.width,p=l.height;t.clearRect(0,0,o,p);const i=a.xKey||"t",n=a.yKey||"dps",x=a.color||"#e8a020",y="#5a4838",_="#8a7a6a",u=Object.assign({top:14,right:14,bottom:32,left:46},a.padding||{}),m=u.left,$=o-u.right,g=p-u.bottom,k=u.top;if(t.strokeStyle=y,t.lineWidth=1,t.beginPath(),t.moveTo(m,k),t.lineTo(m,g),t.lineTo($,g),t.stroke(),!s||s.length===0){t.fillStyle=_,t.font="12px Inter, system-ui, sans-serif",t.textAlign="center",t.fillText(a.emptyLabel||"No data yet",(m+$)/2,(g+k)/2);return}let f=1/0,b=-1/0,w=0,v=-1/0;for(const r of s){const c=r[i],h=r[n];c<f&&(f=c),c>b&&(b=c),h>v&&(v=h)}b===f&&(b=f+1),v===0&&(v=1);const C=r=>m+(r-f)*($-m)/(b-f),T=r=>g-(r-w)*(g-k)/(v-w);t.fillStyle=_,t.font="10px JetBrains Mono, monospace",t.textAlign="right",t.textBaseline="middle";const D=4;for(let r=0;r<=D;r++){const c=w+(v-w)*(r/D),h=T(c);t.strokeStyle=r===0?y:"rgba(90,72,56,0.45)",t.beginPath(),t.moveTo(m,h),t.lineTo($,h),t.stroke(),t.fillText(G(c),m-6,h)}t.textAlign="center",t.textBaseline="top";for(let r=0;r<=3;r++){const c=f+(b-f)*(r/3),h=C(c);t.fillText(`${Math.round(c)}s`,h,g+6)}t.strokeStyle=x,t.lineWidth=2,t.beginPath();for(let r=0;r<s.length;r++){const c=C(s[r][i]),h=T(s[r][n]);r===0?t.moveTo(c,h):t.lineTo(c,h)}t.stroke(),t.lineTo(C(s[s.length-1][i]),g),t.lineTo(C(s[0][i]),g),t.closePath();const S=t.createLinearGradient(0,k,0,g);S.addColorStop(0,E(x,.3)),S.addColorStop(1,E(x,.02)),t.fillStyle=S,t.fill(),a.title&&(t.fillStyle="#e8a020",t.font="bold 12px Inter, system-ui, sans-serif",t.textAlign="left",t.textBaseline="top",t.fillText(a.title,m,0))}function G(d){return d>=1e3?(d/1e3).toFixed(1)+"k":Math.abs(d)<1?d.toFixed(2):Math.round(d).toString()}function E(d,s){const a=d.match(/^#([0-9a-f]{6})$/i);if(!a)return`rgba(232,160,32,${s})`;const t=parseInt(a[1],16);return`rgba(${t>>16&255},${t>>8&255},${t&255},${s})`}class U{constructor(s,a,t={}){this.manager=s,this.audio=a,this.noGameMenuEsc=!0,this._tab=t.tab||"party",this._selectedCharId=null,this._filterLog="all",this._lifetimeOnly=!!t.lifetimeOnly}onEnter(){I(),R("stats-styles",O),this._el=H("div","stats-screen"),document.body.appendChild(this._el),this._lifetimeOnly&&(this._tab="lifetime"),this._render()}onExit(){this._el&&L(this._el),M(this._el),this._el=null}destroy(){this._el&&L(this._el),M(this._el),this._el=null}update(){}draw(){}_render(){const s=this._lifetimeOnly?[["lifetime","Lifetime"],["achievements","Achievements"]]:[["party","Party"],["lifetime","Lifetime"],["achievements","Achievements"]],a=A();let t="Last saved: never";if(a!=null&&a.savedAt){const e=new Date(a.savedAt),l=String(e.getHours()).padStart(2,"0"),o=String(e.getMinutes()).padStart(2,"0"),p=String(e.getSeconds()).padStart(2,"0");t=`Last saved: ${e.toISOString().slice(0,10)} ${l}:${o}:${p}`}this._el.innerHTML=`
      <div class="st-header">
        <div class="st-title">Statistics</div>
        <div class="st-tabs">
          ${s.map(([e,l])=>`<button class="st-tab${this._tab===e?" active":""}" data-tab="${e}">${l}</button>`).join("")}
        </div>
        <button class="st-close" id="st-close">✕ Close</button>
      </div>
      <div class="st-saved-at" style="font-size:11px;opacity:0.6;padding:2px 12px;text-align:right;">${t}</div>
      <div class="st-body" id="st-body">${this._renderTab()}</div>
    `,this._el.querySelector("#st-close").addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),this._el.querySelectorAll(".st-tab").forEach(e=>e.addEventListener("click",()=>{this.audio.playSfx("click"),this._tab=e.dataset.tab,this._render()})),this._postRender(),L(this._el),P(this._el,{layout:"vertical",focusFirst:!1,onEscape:()=>{this.audio.playSfx("click"),this.manager.pop()}})}_renderTab(){return this._tab==="party"?this._renderParty():this._tab==="lifetime"?this._renderLifetime():this._tab==="achievements"?this._renderAchievements():""}_renderParty(){const s=B.get(),a=[...s.party||[],...s.companions||[]];if(!a.length)return'<div class="st-empty">No party members yet.</div>';(!this._selectedCharId||!a.find(i=>i.id===this._selectedCharId))&&(this._selectedCharId=a[0].id);const t=a.find(i=>i.id===this._selectedCharId),e=j(t.id),l=F(t.id),o=this._filterLog==="all"?l:l.filter(i=>i.type===this._filterLog),p=(I().combatHistory||[]).filter(i=>(i.perChar||[]).some(n=>n.id===t.id)).slice(-15).reverse();return`
      <div class="st-party-grid">
        <div class="st-roster">
          ${a.map(i=>`
            <button class="st-roster-row${i.id===this._selectedCharId?" active":""}" data-char="${i.id}">
              <span class="st-roster-portrait">${W(i,36,"st-portrait")}</span>
              <span class="st-roster-name">
                <span class="rn">${i.name}</span>
                <span class="rc">${i.cls||i.class||"companion"} · L${i.level||1}</span>
              </span>
              <span class="st-roster-kills">${j(i.id).kills}<span class="lk">k</span></span>
            </button>
          `).join("")}
        </div>
        <div class="st-detail">
          <div class="st-detail-head">
            <div class="st-detail-name">${t.name} <span class="st-detail-class">— ${t.cls||t.class||""} L${t.level||1}</span></div>
          </div>
          <div class="st-stat-grid">
            ${this._statCell("Damage Dealt",e.damageDealt)}
            ${this._statCell("Damage Taken",e.damageTaken)}
            ${this._statCell("Kills",e.kills)}
            ${this._statCell("Crits",e.crits)}
            ${this._statCell("Heals Given",e.heals)}
            ${this._statCell("Heals Received",e.healsReceived)}
            ${this._statCell("Most Damage Hit",e.mostDamageHit)}
            ${this._statCell("Longest Streak",e.longestKillStreak)}
            ${this._statCell("Near-Deaths",e.nearDeaths)}
            ${this._statCell("Deaths",e.deaths)}
            ${this._statCell("Dodges",e.dodges)}
            ${this._statCell("Blocks",e.blocks)}
            ${this._statCell("Fights Won",e.fightsWon)}
            ${this._statCell("Fights Lost",e.fightsLost)}
          </div>
          <div class="st-section-title">DPS over time (this run)</div>
          <div class="st-chart-wrap"><canvas id="st-dps-chart" class="st-chart"></canvas></div>
          <div class="st-section-title">Recent Combats (this run)</div>
          <div class="st-combat-history">
            ${p.length?p.map(i=>{const n=(i.perChar||[]).find(u=>u.id===t.id);if(!n)return"";const x=new Date(i.ts).toLocaleString(),y=i.won?'<span class="ch-win">Win</span>':'<span class="ch-loss">Loss</span>',_=n.mvp?'<span class="ch-mvp">MVP</span>':"";return`
                <div class="st-ch-row">
                  <div class="ch-meta">${y}${_}<span class="ch-zone">${i.zoneId||"—"}</span><span class="ch-time">${x} · ${i.durationSec}s</span></div>
                  <div class="ch-stats">
                    <span><b>${this._fmt(n.dmgDealt)}</b> dmg</span>
                    <span><b>${this._fmt(n.dmgTaken)}</b> taken</span>
                    <span><b>${this._fmt(n.heals)}</b> healed</span>
                    <span><b>${n.kills}</b> kills</span>
                    ${n.deaths?`<span class="ch-died">died ${n.deaths}×</span>`:""}
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
            ${o.length?o.map(i=>`
              <div class="st-log-row" data-type="${i.type}">
                <span class="st-log-tag">${this._logTagLabel(i.type)}</span>
                <span class="st-log-text">${i.summary}</span>
                <span class="st-log-meta">${i.zoneId||""}</span>
              </div>
            `).join(""):'<div class="st-empty">No entries.</div>'}
          </div>
        </div>
      </div>
    `}_statCell(s,a){return`<div class="st-cell"><div class="st-cell-label">${s}</div><div class="st-cell-value">${this._fmt(a)}</div></div>`}_fmt(s){return typeof s!="number"?String(s):s>=1e6?(s/1e6).toFixed(1)+"M":s>=1e3?(s/1e3).toFixed(1)+"k":Math.round(s).toString()}_logTagLabel(s){return s==="major_kill"?"Boss":s==="elite_kill"?"Elite":s==="near_death"?"Near Death":s==="death"?"Fell":s==="story"?"Story":s}_renderLifetime(){const s=A(),a=s.global||{},t=(s.runHistory||[]).slice(0,20);return`
      <div class="st-lifetime">
        <div class="st-section-title">Lifetime totals (across all runs)</div>
        <div class="st-stat-grid">
          ${this._statCell("Total Kills",a.totalKills||0)}
          ${this._statCell("Total Damage",a.totalDamage||0)}
          ${this._statCell("Total Heals",a.totalHeals||0)}
          ${this._statCell("Fights Won",a.fightsWon||0)}
          ${this._statCell("Fights Lost",a.fightsLost||0)}
          ${this._statCell("Perfect Wins",a.perfectVictories||0)}
          ${this._statCell("Gold Earned",a.totalGoldEarned||0)}
          ${this._statCell("Gold Spent",a.totalGoldSpent||0)}
          ${this._statCell("XP Gained",a.totalXp||0)}
          ${this._statCell("Runs Started",a.runsStarted||0)}
          ${this._statCell("Runs Completed",a.runsCompleted||0)}
          ${this._statCell("Hardcore Deaths",a.hardcoreDeaths||0)}
        </div>
        <div class="st-section-title">Run history</div>
        ${t.length?`
          <div class="st-runlist">
            ${t.map(e=>{var l,o,p,i;return`
              <div class="st-run-row">
                <span class="st-run-date">${new Date(e.startedAt).toISOString().slice(0,10)}</span>
                <span class="st-run-label">${e.label||"Run"}</span>
                <span class="st-run-kpi">${((l=e.global)==null?void 0:l.totalKills)||0} kills</span>
                <span class="st-run-kpi">${this._fmt(((o=e.global)==null?void 0:o.totalDamage)||0)} dmg</span>
                <span class="st-run-kpi">${((p=e.global)==null?void 0:p.fightsWon)||0}-${((i=e.global)==null?void 0:i.fightsLost)||0}</span>
              </div>
            `}).join("")}
          </div>
        `:'<div class="st-empty">No completed runs archived yet.</div>'}
      </div>
    `}_renderAchievements(){const{current:s,life:a}=q(),t=z.length;return`
      <div class="st-ach">
        <div class="st-section-title">Achievements <span class="st-progress">${z.filter(e=>{var l,o;return((l=s[e.id])==null?void 0:l.unlocked)||((o=a[e.id])==null?void 0:o.unlocked)}).length} / ${t}</span></div>
        <div class="st-ach-grid">
          ${z.map(e=>{var l,o;const p=!!((l=a[e.id])!=null&&l.unlocked),i=!!((o=s[e.id])!=null&&o.unlocked),n=p||i;return`
              <div class="st-ach-card${n?" un":""} t-${e.tier}">
                <div class="st-ach-tier">${e.tier.toUpperCase()}</div>
                <div class="st-ach-name">${e.name}</div>
                <div class="st-ach-desc">${e.desc}</div>
                <div class="st-ach-status">${n?"★ Unlocked":"Locked"}</div>
              </div>
            `}).join("")}
        </div>
      </div>
    `}_postRender(){if(this._tab==="party"){this._el.querySelectorAll(".st-roster-row").forEach(t=>t.addEventListener("click",()=>{this.audio.playSfx("click"),this._selectedCharId=t.dataset.char,this._render()}));const s=this._el.querySelector("#st-log-filter");s&&s.addEventListener("change",()=>{this._filterLog=s.value,this._render()});const a=this._el.querySelector("#st-dps-chart");a&&this._selectedCharId&&requestAnimationFrame(()=>{const t=K(this._selectedCharId,5);N(a,t,{xKey:"t",yKey:"dps",color:"#e8a020",emptyLabel:"No combat damage logged this run."})})}}}const O=`
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
`;export{U as StatsScreen};
