const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./StatsScreen-DHA1Bp37.js","./play-B4Rs_XUc.js","./savesClient-Lt_9u8Ks.js","./play-dErdlDnR.css"])))=>i.map(i=>d[i]);
import{i as l,c as n,r as o,G as p,a as d,p as c,_ as m,b as g}from"./play-B4Rs_XUc.js";import"./savesClient-Lt_9u8Ks.js";class b{constructor(r,e){this.manager=r,this.audio=e,this.noGameMenuEsc=!0}onEnter(){l("rip-styles",f),this._el=n("div","rip-screen"),document.body.appendChild(this._el),this._render()}onExit(){o(this._el),this._el=null}destroy(){o(this._el),this._el=null}update(){}draw(){}_render(){const r=p.get(),e=r.rip||{},t=[...r.party||[],...r.companions||[]],s=e.date?new Date(e.date).toLocaleString():"—";this._el.innerHTML=`
      <div class="rip-header">
        <div class="rip-skull">⚰</div>
        <div class="rip-title-block">
          <div class="rip-title">RIP</div>
          <div class="rip-sub">Hardcore — fell ${s} in <em>${e.zoneId||"an unknown place"}</em></div>
        </div>
        <button class="rip-close" id="rip-close">✕ Close</button>
      </div>

      <div class="rip-body">
        <div class="rip-section">
          <div class="rip-section-title">Final Party</div>
          <div class="rip-party">
            ${t.map(i=>{const a=d(i.id);return`
                <div class="rip-card">
                  <div class="rip-card-portrait">${c(i,56,"rip-portrait")}</div>
                  <div class="rip-card-info">
                    <div class="rip-card-name">${i.name}</div>
                    <div class="rip-card-class">${i.cls||i.class||"companion"} · L${i.level||1}</div>
                    <div class="rip-card-stats">
                      <span title="Kills">⚔ ${a.kills}</span>
                      <span title="Damage Dealt">${this._fmt(a.damageDealt)} dmg</span>
                      <span title="Heals Given">+${this._fmt(a.heals)}</span>
                      <span title="Deaths">☠ ${a.deaths}</span>
                    </div>
                  </div>
                </div>
              `}).join("")}
          </div>
        </div>

        <div class="rip-section">
          <div class="rip-section-title">Inventory</div>
          ${(r.inventory||[]).length?`
            <div class="rip-items">
              ${r.inventory.map(i=>`
                <div class="rip-item" style="border-color:var(--rarity-${i.rarity}, #8a7a6a)">
                  <div class="rii-name" style="color:var(--rarity-${i.rarity}, #f0e8d8)">${i.name}</div>
                  <div class="rii-type">${i.subtype||i.type}</div>
                </div>
              `).join("")}
            </div>`:'<div class="rip-empty">No items remained.</div>'}
        </div>

        <div class="rip-section">
          <div class="rip-section-title">Final Log</div>
          <div class="rip-log">
            ${this._collectLog(t).slice(0,30).map(i=>`
              <div class="rip-log-row" data-type="${i.type}">
                <span class="rip-log-tag">${i.type}</span>
                <span class="rip-log-text">${i.who}: ${i.summary}</span>
              </div>
            `).join("")||'<div class="rip-empty">No notable events recorded.</div>'}
          </div>
        </div>

        <div class="rip-actions">
          <button class="rip-btn" id="rip-stats">📊 Full Statistics</button>
          <button class="rip-btn rip-btn-danger" id="rip-back">← Back</button>
        </div>
      </div>
    `,this._el.querySelector("#rip-close").addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),this._el.querySelector("#rip-back").addEventListener("click",()=>{this.audio.playSfx("click"),this.manager.pop()}),this._el.querySelector("#rip-stats").addEventListener("click",async()=>{this.audio.playSfx("click");const{StatsScreen:i}=await m(async()=>{const{StatsScreen:a}=await import("./StatsScreen-DHA1Bp37.js");return{StatsScreen:a}},__vite__mapDeps([0,1,2,3]),import.meta.url);this.manager.push(new i(this.manager,this.audio,{tab:"party"}))})}_collectLog(r){const e=[];for(const t of r)for(const s of g(t.id))e.push({...s,who:t.name});return e.sort((t,s)=>(s.ts||0)-(t.ts||0)),e}_fmt(r){return r>=1e3?(r/1e3).toFixed(1)+"k":Math.round(r).toString()}}const f=`
.rip-screen { position: absolute; inset: 0; background: linear-gradient(180deg,#0a0608,#1a0808); color: #f0e8d8; font-family: 'Inter',sans-serif; overflow-y: auto; z-index: 100; display: flex; flex-direction: column; }
.rip-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(192,64,48,0.35); background: rgba(0,0,0,0.5); flex-shrink: 0; }
.rip-skull { font-size: 2rem; color: #c04030; }
.rip-title-block { flex: 1; }
.rip-title { font-family: 'Cinzel',serif; font-size: 1.5rem; font-weight: 900; letter-spacing: 0.2em; color: #c04030; text-transform: uppercase; }
.rip-sub { font-size: 0.78rem; color: #8a7a6a; }
.rip-sub em { color: #c0a070; font-style: normal; }
.rip-close { background: none; border: none; color: #8a7a6a; cursor: pointer; padding: 0.4rem 0.8rem; font-size: 0.78rem; }
.rip-body { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.rip-section-title { font-family: 'Cinzel',serif; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; color: #c0a070; margin-bottom: 0.5rem; }
.rip-party { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
.rip-card { display: flex; gap: 0.65rem; background: rgba(0,0,0,0.35); border: 1px solid rgba(192,64,48,0.2); border-radius: 6px; padding: 0.6rem 0.75rem; }
.rip-card-portrait { width: 56px; height: 56px; flex-shrink: 0; overflow: hidden; border-radius: 6px; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; filter: grayscale(0.6); }
.rip-card-name { font-family: 'Cinzel',serif; font-size: 0.95rem; color: #e8a020; }
.rip-card-class { font-size: 0.7rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.06em; }
.rip-card-stats { display: flex; gap: 0.65rem; margin-top: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.74rem; color: #c0b090; }
.rip-items { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px; }
.rip-item { background: rgba(0,0,0,0.35); border: 1px solid; border-radius: 4px; padding: 0.4rem 0.6rem; opacity: 0.85; }
.rii-name { font-size: 0.78rem; font-weight: 600; }
.rii-type { font-size: 0.66rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.06em; }
.rip-log { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow-y: auto; }
.rip-log-row { display: flex; gap: 0.5rem; padding: 0.35rem 0.6rem; background: rgba(0,0,0,0.25); border-radius: 4px; font-size: 0.78rem; }
.rip-log-tag { font-size: 0.62rem; color: #8a7a6a; text-transform: uppercase; letter-spacing: 0.08em; min-width: 80px; }
.rip-log-row[data-type="major_kill"] { border-left: 3px solid #e8a020; }
.rip-log-row[data-type="death"] { border-left: 3px solid #c04030; }
.rip-empty { padding: 1rem; text-align: center; color: #4a3a32; font-size: 0.85rem; }
.rip-actions { display: flex; justify-content: center; gap: 0.6rem; margin: 1rem 0 2rem; }
.rip-btn { background: rgba(232,160,32,0.1); border: 1px solid rgba(232,160,32,0.4); color: #e8a020; padding: 0.6rem 1rem; border-radius: 6px; font-size: 0.78rem; cursor: pointer; min-height: 44px; font-family: 'Cinzel',serif; letter-spacing: 0.06em; }
.rip-btn-danger { background: rgba(192,64,48,0.1); border-color: rgba(192,64,48,0.4); color: #ff8a70; }
`;export{b as RipViewScreen};
