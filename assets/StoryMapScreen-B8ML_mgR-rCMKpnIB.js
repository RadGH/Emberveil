const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./play-QH26u79V.js","./savesClient-Lt_9u8Ks-B0TWHWS2.js","./play-dErdlDnR.css","./PartyScreen-_L6TUmx_-CK_wtvgp.js","./InventoryScreen-8z22PVA4-CgCkqrQ5.js","./ConfirmModal-CGAPXyvG-BoJVsT_M.js","./StoryJournalScreen-Bdt8jcVy-BiX18C5y.js","./storyEncounterBuilder-D3lleGoN-CT12LV7v.js","./StoryDialogScreen-BEiDd4oH-Ba89bain.js","./storyMode-Ct4jEthF-BLk0DseA.js","./storyContent-BFtFSCKH-oq7IT1Qo.js","./storyMapGen-gFk4dOw6-BqYBDncd.js"])))=>i.map(i=>d[i]);
import{k as I,Y as re,J as D,s as S,_ as T,E as ae}from"./play-QH26u79V.js";import{_ as X,m as ie,p as oe,b as ne}from"./storyMapGen-gFk4dOw6-BqYBDncd.js";import"./savesClient-Lt_9u8Ks-B0TWHWS2.js";const M=(o,e=M,t=e.f||(e.f=["./play-B4Rs_XUc.js","./savesClient-Lt_9u8Ks.js","./play-dErdlDnR.css","./PartyScreen-_L6TUmx_.js","./InventoryScreen-8z22PVA4.js","./ConfirmModal-CGAPXyvG.js","./StoryJournalScreen-Bdt8jcVy.js","./storyEncounterBuilder-D3lleGoN.js","./StoryDialogScreen-BEiDd4oH.js","./storyMode-Ct4jEthF.js","./storyContent-BFtFSCKH.js","./storyMapGen-gFk4dOw6.js"]))=>o.map(s=>t[s]),F=Object.create(null),le="#0c0e14";function G(o,e,t,s,r=0,i=null){if(!e)return;const a=e.backgroundOpacity??.55,n=e.backgroundDarken??.35,c=e.backgroundImage;if(de(o,e.palette||[],t,s),!c){B(o,n,t,s);return}const p=F[e.id];if(!p){const h={img:new Image,state:"loading"};F[e.id]=h,h.img.addEventListener("load",()=>{h.state="ready",typeof i=="function"&&i()}),h.img.addEventListener("error",()=>{h.state="error"});let u="/";try{u="./"}catch{}h.img.src=u.replace(/\/$/,"")+"/"+c,B(o,n,t,s);return}if(p.state!=="ready"){B(o,n,t,s);return}const l=Number.isFinite(r)?Math.sin(r*.3)*4:0;o.save(),o.globalAlpha=a,o.drawImage(p.img,l-4,0,t+8,s),o.restore(),B(o,n,t,s)}function de(o,e,t,s){const r=e.length>=2?e:["#1a1010","#0c0e14"],i=o.createLinearGradient(0,0,0,s);r.forEach((a,n)=>i.addColorStop(n/(r.length-1),a)),o.save(),o.globalAlpha=1,o.fillStyle=i,o.fillRect(0,0,t,s),o.restore()}function B(o,e,t,s){e<=0||(o.save(),o.globalAlpha=e,o.fillStyle=le,o.fillRect(0,0,t,s),o.restore())}const ce=16,U=24,N=56,he={combat:{color:"#c04030",label:"Combat",glyph:"⚔"},elite:{color:"#c86020",label:"Elite",glyph:"☠"},boss:{color:"#8020b0",label:"Boss",glyph:"♛"},dialog:{color:"#4080c0",label:"Dialog",glyph:"❁"},shrine:{color:"#80e0c8",label:"Shrine",glyph:"✶"},lore:{color:"#6a9040",label:"Lore",glyph:"℘"},merchant:{color:"#e0a020",label:"Merchant",glyph:"◎"},rest:{color:"#40a860",label:"Rest",glyph:"☽"},event:{color:"#9040c0",label:"Event",glyph:"✵"},waypoint:{color:"#4080c0",label:"Waypoint",glyph:"✦"},trailhead:{color:"#708050",label:"Trailhead",glyph:"⚑"},town:{color:"#c09030",label:"Town",glyph:"⌂"}},pe={color:"#806060",glyph:null},J={unexplored:"rgba(64,128,192,0.5)",discovered:"#4080c0",activated:"#40c860",corrupted:"#c04030",disabled:"#404040"},Y="rgba(200,170,100,0.65)",ue="rgba(200,60,60,0.3)",me="rgba(232,192,96,0.65)",K=24;function _e(o,e,t){const{lane:s,col:r}=o,i=[.22,.5,.78],a=r%2===0?-K:K,n=i[s]*t+a,c=N+r*N;return{x:Math.round(c),y:Math.round(n)}}function ye(o,e,t,s,r={},i={}){const a=he[s]||pe,n=ce,{selected:c,hovered:p,waypointState:l,visibility:h,overlay:u,state:m}=r;if(h==="hidden")return;const _=h==="revealed",g=m==="visited"||m==="cleared",x=_?.5:g?.55:1;if(o.save(),o.globalAlpha=x,c?(o.shadowBlur=22,o.shadowColor="#f0c040"):p&&(o.shadowBlur=10,o.shadowColor=a.color),o.beginPath(),o.arc(e,t,n,0,Math.PI*2),o.fillStyle=u==="corrupted"?"#8a2020":u==="cleansed"?"#40a860":g?ge(a.color,.6):a.color,o.fill(),o.lineWidth=c?3.5:1.5,o.strokeStyle=c?"#f0c040":g?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.4)",o.stroke(),c&&(o.shadowBlur=0,o.beginPath(),o.arc(e,t,n+5,0,Math.PI*2),o.strokeStyle="rgba(240,192,64,0.55)",o.lineWidth=2,o.stroke()),l){const C=J[l]||J.unexplored;o.beginPath(),o.arc(e,t,n+4,0,Math.PI*2),o.strokeStyle=C,o.lineWidth=2,o.stroke()}const w=a.glyph||be(s);w&&(o.fillStyle=g?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.92)",o.font=`bold ${Math.round(n*.85)}px Inter, sans-serif`,o.textAlign="center",o.textBaseline="middle",o.fillText(w,e,t)),o.restore()}function ge(o,e){const t=parseInt(o.slice(1,3),16),s=parseInt(o.slice(3,5),16),r=parseInt(o.slice(5,7),16),i=42,a=32,n=16,c=Math.round(t*e+i*(1-e)),p=Math.round(s*e+a*(1-e)),l=Math.round(r*e+n*(1-e));return`rgb(${c},${p},${l})`}function be(o){return{combat:"⚔",elite:"☠",boss:"♛",dialog:"❁",shrine:"✶",lore:"℘",merchant:"◎",rest:"☽",event:"✵",waypoint:"✦",trailhead:"⚑",town:"⌂"}[o]||null}function Q(o,e,t,s,r,i,a=0){o.save();let n,c,p,l;if(i==="open"){n=Y,c=2.5,p=[],l=0;const v=.55+.1*Math.sin(a*1.8+e*.01);o.globalAlpha=v}else i==="hidden"?(n=`rgba(120,80,180,${(.28+.12*Math.sin(a*3.5)).toFixed(2)})`,c=1.5,p=[5,6],l=-(a*18)%11):i==="blocked"?(n=ue,c=2,p=[4,4],l=0):i==="stitch"?(n=me,c=2.5,p=[10,5],l=-(a*25)%15,o.shadowBlur=8,o.shadowColor="#e8c060"):(n=Y,c=1.5,p=[],l=0);o.strokeStyle=n,o.lineWidth=c,o.setLineDash(p),o.lineDashOffset=l;const h=(e+s)/2,u=(t+r)/2,m=s-e,_=r-t,g=Math.sqrt(m*m+_*_)||1,x=-_/g,w=m/g,C=Math.min(12,g*.18),R=e*.6+h*.4+x*C,$=t*.6+u*.4+w*C,H=h*.4+s*.6-x*C,q=u*.4+r*.6-w*C;o.beginPath(),o.moveTo(e,t),o.bezierCurveTo(R,$,H,q,s,r),o.stroke(),o.setLineDash([]),o.globalAlpha=1,o.restore()}function ve(o,e,t,s){const r=o-t,i=e-s;return r*r+i*i<=U*U}const fe="story-map-screen-styles";ae(fe,`
.story-map-screen {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #0a0608;
  color: #f0e8d8;
  font-family: Inter, sans-serif;
  overflow: hidden;
  touch-action: none;
}

/* --- Top bar --- */
.sms-topbar {
  display: flex;
  align-items: center;
  gap: 0;
  height: 48px;
  flex-shrink: 0;
  background: rgba(10,6,8,0.92);
  border-bottom: 1px solid rgba(232,160,32,0.18);
  padding: 0 4px;
}
.sms-topbar-btn {
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
.sms-topbar-btn:hover,
.sms-topbar-btn:active { background: rgba(232,160,32,0.12); }
.sms-topbar-title {
  flex: 1;
  text-align: center;
  font-family: Cinzel, serif;
  font-size: 15px;
  font-weight: 600;
  color: #e8c070;
  letter-spacing: 0.06em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* --- Pressure chip (fix #9) --- */
.sms-pressure-chip {
  flex-shrink: 0;
  overflow: hidden;
  background: rgba(20,10,30,0.7);
  border-bottom: 1px solid rgba(180,80,220,0.15);
  cursor: pointer;
  transition: height 0.18s ease;
  height: 28px;
}
.sms-pressure-chip.expanded-chip { height: 60px; }
.sms-chip-collapsed-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  gap: 8px;
}
.sms-chip-expanded-row {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  gap: 10px;
  overflow: hidden;
}
.sms-pressure-label {
  font-size: 12px;
  font-weight: 500;
  color: #a080d0;
  flex: 1;
}
.sms-chip-band-label {
  font-size: 11px;
  font-weight: 600;
  color: #c090f0;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  min-width: 48px;
}
.sms-chip-history {
  display: flex;
  gap: 4px;
  align-items: center;
}
.sms-chip-hist-glyph {
  font-size: 11px;
  color: rgba(160,128,220,0.6);
  line-height: 1;
}
.sms-pressure-pips {
  display: flex;
  gap: 3px;
}
.sms-pip {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(180,80,220,0.3);
}
.sms-pip.active { background: #a060e0; }

/* --- Sub-region tab strip --- */
.sms-tab-strip {
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  background: rgba(10,6,8,0.88);
  border-bottom: 1px solid rgba(232,160,32,0.12);
  overflow-x: auto;
  scrollbar-width: none;
}
.sms-tab-strip::-webkit-scrollbar { display: none; }
.sms-tab {
  flex-shrink: 0;
  padding: 0 14px;
  display: flex;
  align-items: center;
  font-size: 12px;
  font-weight: 500;
  color: #7a6850;
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color 0.12s, border-color 0.12s;
  white-space: nowrap;
  min-height: 36px;
}
.sms-tab.active {
  color: #e8c070;
  border-bottom-color: #e8a020;
  font-weight: 700;
}
.sms-tab:hover:not(.sms-tab-locked) { color: #c0a050; }
.sms-tab-locked {
  color: #4a3a2a;
  opacity: 0.55;
  cursor: not-allowed;
}

/* --- Map canvas wrap --- */
.sms-canvas-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  cursor: grab;
}
.sms-canvas-wrap.panning { cursor: grabbing; }
.sms-map-canvas {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  touch-action: none;
}

/* --- Peek drawer (fix #10: 128pt default, 360pt expanded, 4×40px handle) --- */
.sms-drawer {
  flex-shrink: 0;
  height: 128px;
  background: rgba(12,6,18,0.97);
  border-top: 1px solid rgba(232,160,32,0.25);
  display: flex;
  flex-direction: column;
  transition: height 0.22s ease;
  overflow: hidden;
}
.sms-drawer.expanded { height: 360px; }
.sms-drawer-handle {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ns-resize;
  flex-shrink: 0;
}
.sms-drawer-pip {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(232,160,32,0.35);
}
.sms-drawer-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 14px 8px;
  overflow-y: auto;
}
.sms-drawer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 60px;
  color: #4a3a2a;
  font-size: 13px;
}
.sms-drawer-node-name {
  font-family: Cinzel, serif;
  font-size: 15px;
  font-weight: 600;
  color: #e8c070;
}
.sms-drawer-node-meta {
  font-size: 12px;
  color: #8a7a6a;
  display: flex;
  gap: 8px;
}
.sms-drawer-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(80,60,30,0.6);
  color: #c0a060;
}
.sms-drawer-btns {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.sms-drawer-btn {
  flex: 1;
  height: 44px;
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid rgba(232,160,32,0.4);
  background: rgba(232,160,32,0.12);
  color: #e8a020;
  font-family: Cinzel, serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s;
}
.sms-drawer-btn:hover,
.sms-drawer-btn:active { background: rgba(232,160,32,0.25); }
.sms-drawer-btn.secondary {
  background: rgba(60,60,80,0.2);
  border-color: rgba(140,120,200,0.3);
  color: #a090c0;
}
.sms-drawer-detail {
  font-size: 13px;
  color: #a09080;
  line-height: 1.5;
}

/* --- Bottom action bar --- */
.sms-action-bar {
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  background: rgba(6,4,10,0.97);
  border-top: 1px solid rgba(232,160,32,0.12);
}
.sms-action-btn {
  flex: 1;
  height: 64px;
  min-height: 44px;
  border: none;
  background: transparent;
  color: #7a6850;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: color 0.12s;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.sms-action-btn:hover,
.sms-action-btn:active { color: #e8c070; }
.sms-action-icon {
  font-size: 18px;
  line-height: 1;
}

/* --- Desktop layout (fix #12: ≥700px uses full horizontal space) --- */
@media (min-width: 700px) {
  .story-map-screen {
    max-width: none;
  }
  .sms-canvas-wrap {
    /* Allow horizontal overflow for wider maps on desktop. */
    overflow-x: auto;
  }
  .sms-tab-strip {
    font-size: 13px;
  }
  .sms-drawer {
    height: 160px;
  }
  .sms-drawer.expanded {
    height: 400px;
  }
}

/* --- Page indicator dots --- */
.sms-page-dots {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  pointer-events: none;
}
.sms-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(200,160,80,0.25);
  transition: background 0.15s;
}
.sms-dot.active { background: #e8a020; }
`);const we=8,z=60,Z=150,ee={emberwood:["#602010","#c84828","#e8a020","#f0d090"],stoneward:["#404850","#808090","#c0b080","#e0d8c0"],fen:["#203010","#405030","#80a040","#c0d880"],old_road:["#504030","#908060","#c0a840","#f0e0a0"],gloomridge:["#181020","#302838","#5040a0","#9080e0"],veilscar:["#200830","#401858","#8028b0","#d060f0"],_default:["#1a1210","#3a2a18","#786040","#d0b070"]};class Me{constructor(e,t){this.manager=e,this.audio=t,this._el=null,this._graph=null,this._regionIdx=0,this._selectedId=null,this._canvas=null,this._ctx=null,this._panX=0,this._panStart=null,this._didPan=!1,this._rubberBand=0,this._t=0,this._raf=null,this._lastFrameMs=0,this._drawerExpanded=!1,this._drawerDragStart=null,this._nodePosCache={},this._visibilityCache=null,this._biomeData=null,this._embers=[]}onEnter(){this._build(),this._loadBiomeData().then(()=>{this._loadOrGenerateMap()}),this._startLoop(),this._playBiomeMusic()}async _loadBiomeData(){try{const e=await fetch(`${typeof import.meta<"u"&&"./"||"/"}assets/data/story/canonical-biomes.json`);if(e.ok){const t=await e.json();this._biomeData={};for(const s of t)this._biomeData[s.id]=s}}catch{this._biomeData={}}}_playBiomeMusic(){var e,t,s;try{const r=((e=I.get().story)==null?void 0:e.act)||1,i={1:"overworld_act1.ogg",2:"overworld_act2.ogg",3:"overworld_act3.ogg"},a=i[r]||i[1];(s=(t=this.audio)==null?void 0:t.playMusic)==null||s.call(t,a)}catch{}}onResume(){this._startLoop()}onPause(){this._stopLoop()}onExit(){this._stopLoop(),re(this._el),this._el=null,this._canvas=null,this._ctx=null}destroy(){this.onExit()}update(){}draw(){}_loadOrGenerateMap(){var e;const t=I.get();if(!t.story)return;const s=t.story.currentMapId||"act1_map",r=t.story.act||1;if((e=t.story.maps)!=null&&e[s]){const i=t.story.maps[s].seed||t.story.campaignSeed||"default",{mapGraph:a}=X({seed:i,act:r,salt:t.story.saltOffset||0});this._graph=ie(a,t.story.maps[s])}else{const i=t.story.campaignSeed||"default",{mapGraph:a,fallbackUsed:n}=X({seed:i,act:r,salt:t.story.saltOffset||0});this._graph=a,t.story.maps||(t.story.maps={}),t.story.maps[s]=oe(a),t.story.currentMapId=a.mapId,n&&console.warn("[StoryMapScreen] Map generation failed after 10 attempts — using safety-net fallback.")}this._rebuildPosCache(),this._rebuildVisibilityCache(),this._renderMap(),this._refreshTabs(),this._refreshDots()}_rebuildVisibilityCache(){var e,t,s;if(!this._graph){this._visibilityCache=null;return}const r=I.get(),i=(e=r.story)==null?void 0:e.currentMapId,a=(s=(t=r.story)==null?void 0:t.maps)==null?void 0:s[i];this._visibilityCache=ne(this._graph,a)}_build(){var e;const t=((e=I.get().story)==null?void 0:e.act)||1;this._el=D("div","story-map-screen");const s=D("div","sms-topbar");s.innerHTML=`
      <span class="sms-topbar-btn sms-topbar-spacer" aria-hidden="true"></span>
      <span class="sms-topbar-title" id="sms-title">Act ${t} · Story Map</span>
      <button type="button" class="sms-topbar-btn" id="sms-menu" aria-label="Menu">&#9776;</button>
    `,this._el.appendChild(s);const r=D("div","sms-pressure-chip");r.id="sms-pressure-chip",r.setAttribute("role","button"),r.setAttribute("tabindex","0"),r.setAttribute("aria-label","Storyteller pressure — tap to expand"),r.innerHTML=`
      <div class="sms-chip-collapsed-row">
        <span class="sms-pressure-label" id="sms-pressure-label">Chronicler</span>
        <div class="sms-pressure-pips" id="sms-pips">
          <div class="sms-pip"></div><div class="sms-pip"></div><div class="sms-pip"></div>
          <div class="sms-pip"></div><div class="sms-pip"></div>
        </div>
      </div>
      <div class="sms-chip-expanded-row" id="sms-chip-expanded" aria-hidden="true">
        <span class="sms-chip-band-label" id="sms-band-label">Calm</span>
        <div class="sms-chip-history" id="sms-chip-history"></div>
      </div>
    `,r.addEventListener("click",()=>this._togglePressureChip()),r.addEventListener("keydown",h=>{(h.key==="Enter"||h.key===" ")&&this._togglePressureChip()}),this._el.appendChild(r),this._refreshPressureChip();const i=D("div","sms-tab-strip");i.id="sms-tab-strip",this._el.appendChild(i);const a=D("div","sms-canvas-wrap");a.id="sms-canvas-wrap";const n=document.createElement("canvas");n.id="sms-map-canvas",n.className="sms-map-canvas",a.appendChild(n);const c=D("div","sms-page-dots");c.id="sms-page-dots",a.appendChild(c),this._el.appendChild(a);const p=D("div","sms-drawer");p.id="sms-drawer",p.innerHTML=`
      <div class="sms-drawer-handle" id="sms-drawer-handle">
        <div class="sms-drawer-pip"></div>
      </div>
      <div class="sms-drawer-body" id="sms-drawer-body">
        <div class="sms-drawer-empty">Tap a node to explore</div>
      </div>
    `,this._el.appendChild(p);const l=D("div","sms-action-bar");l.innerHTML=`
      <button type="button" class="sms-action-btn" id="sms-party" aria-label="Party">
        <span class="sms-action-icon">&#9812;</span>Party
      </button>
      <button type="button" class="sms-action-btn" id="sms-inventory" aria-label="Inventory">
        <span class="sms-action-icon">&#9827;</span>Items
      </button>
      <button type="button" class="sms-action-btn" id="sms-quests" aria-label="Quests">
        <span class="sms-action-icon">&#9733;</span>Quests
      </button>
      <button type="button" class="sms-action-btn" id="sms-rest" aria-label="Rest">
        <span class="sms-action-icon">&#9790;</span>Rest
      </button>
    `,this._el.appendChild(l),this.manager.uiOverlay.appendChild(this._el),this._canvas=n,this._ctx=n.getContext("2d"),this._setupCanvas(),this._bindEvents()}_setupCanvas(){const e=this._el.querySelector("#sms-canvas-wrap"),t=e.clientWidth||(window.innerWidth>=700?window.innerWidth:393),s=e.clientHeight||484;this._canvas.width=t,this._canvas.height=s,this._canvas.style.width=`${t}px`,this._canvas.style.height=`${s}px`,this._canvasW=t,this._canvasH=s,this._isDesktop=window.innerWidth>=700}_isRegionReachable(e){var t,s,r;if(!this._graph||e<0)return!1;if(e===0)return!0;const i=I.get(),a=(t=i.story)==null?void 0:t.currentMapId,n=(r=(s=i.story)==null?void 0:s.maps)==null?void 0:r[a],c=(n==null?void 0:n.nodes)||{},p=l=>{const h=this._graph.subRegions[l];if(!h)return!1;for(const u of h.nodeIds){const m=c[u],_=(m==null?void 0:m.state)||"unexplored";if(_==="visited"||_==="cleared")return!0}return!1};return!!(p(e)||e>0&&p(e-1))}_refreshTabs(){var e;const t=(e=this._el)==null?void 0:e.querySelector("#sms-tab-strip");if(!(!t||!this._graph)){t.innerHTML="";for(let s=0;s<this._graph.subRegions.length;s++){const r=this._graph.subRegions[s],i=this._isRegionReachable(s),a=document.createElement("button");a.type="button",a.className=`sms-tab${s===this._regionIdx?" active":""}${i?"":" sms-tab-locked"}`,a.setAttribute("aria-disabled",i?"false":"true"),a.innerHTML=i?r.name:`&#128274; ${r.name}`,i&&a.addEventListener("click",()=>this._goToRegion(s,"fade")),t.appendChild(a)}}}_refreshDots(){var e;const t=(e=this._el)==null?void 0:e.querySelector("#sms-page-dots");if(!(!t||!this._graph)){t.innerHTML="";for(let s=0;s<this._graph.subRegions.length;s++){const r=document.createElement("div");r.className=`sms-dot${s===this._regionIdx?" active":""}`,t.appendChild(r)}}}_bindEvents(){const e=this._canvas;e.addEventListener("pointerdown",t=>this._onPointerDown(t)),e.addEventListener("pointermove",t=>this._onPointerMove(t)),e.addEventListener("pointerup",t=>this._onPointerUp(t)),e.addEventListener("pointercancel",()=>this._onPointerCancel()),this._el.querySelector("#sms-drawer"),this._el.querySelector("#sms-drawer-handle").addEventListener("pointerdown",t=>this._onDrawerPointerDown(t)),this._el.querySelector("#sms-menu").addEventListener("click",()=>{var t,s;(s=(t=this.audio)==null?void 0:t.playSfx)==null||s.call(t,"click"),(async()=>{try{const{GameMenuScreen:r}=await S(async()=>{const{GameMenuScreen:i}=await T(()=>import("./play-QH26u79V.js").then(a=>a.at),__vite__mapDeps([0,1,2]),import.meta.url).then(a=>a.ax);return{GameMenuScreen:i}},M([0,1,2]),import.meta.url);this.manager.push(new r(this.manager,this.audio))}catch{}})()}),this._el.querySelector("#sms-party").addEventListener("click",()=>{var t,s;(s=(t=this.audio)==null?void 0:t.playSfx)==null||s.call(t,"click"),(async()=>{try{const{PartyScreen:r}=await S(async()=>{const{PartyScreen:i}=await T(()=>import("./PartyScreen-_L6TUmx_-CK_wtvgp.js"),__vite__mapDeps([3,0,1,2]),import.meta.url);return{PartyScreen:i}},M([3,0,1,2]),import.meta.url);this.manager.push(new r(this.manager,this.audio))}catch{console.warn("[StoryMapScreen] PartyScreen not available")}})()}),this._el.querySelector("#sms-inventory").addEventListener("click",()=>{var t,s;(s=(t=this.audio)==null?void 0:t.playSfx)==null||s.call(t,"click"),(async()=>{try{const{InventoryScreen:r}=await S(async()=>{const{InventoryScreen:i}=await T(()=>import("./InventoryScreen-8z22PVA4-CgCkqrQ5.js"),__vite__mapDeps([4,0,1,2,5]),import.meta.url);return{InventoryScreen:i}},M([4,0,1,2,5]),import.meta.url);this.manager.push(new r(this.manager,this.audio))}catch{console.warn("[StoryMapScreen] InventoryScreen not available")}})()}),this._el.querySelector("#sms-quests").addEventListener("click",()=>{var t,s;(s=(t=this.audio)==null?void 0:t.playSfx)==null||s.call(t,"click"),S(async()=>{const{StoryJournalScreen:r}=await T(()=>import("./StoryJournalScreen-Bdt8jcVy-BiX18C5y.js"),__vite__mapDeps([6,0,1,2]),import.meta.url);return{StoryJournalScreen:r}},M([6,0,1,2]),import.meta.url).then(({StoryJournalScreen:r})=>{this.manager.push(new r(this.manager,this.audio))}).catch(r=>console.warn("[StoryMapScreen] StoryJournalScreen import failed",r))}),this._el.querySelector("#sms-rest").addEventListener("click",()=>{var t,s,r,i,a;(s=(t=this.audio)==null?void 0:t.playSfx)==null||s.call(t,"click");const n=I.get(),c=(r=n.story)==null?void 0:r.currentNodeId,p=c&&((a=(i=this._graph)==null?void 0:i.nodes)==null?void 0:a[c]);if((p==null?void 0:p.type)==="rest"){if(n.party)for(const l of n.party)l.alive!==!1&&(l.hp=l.maxHp||l.hp);S(()=>T(()=>import("./play-QH26u79V.js").then(l=>l.at),__vite__mapDeps([0,1,2]),import.meta.url).then(l=>l.as),M([0,1,2]),import.meta.url).then(l=>l.SaveManager.saveCurrentGame(n.currentSaveKey)).catch(()=>{}),this._showToast("Party rested — HP restored.")}else this._showToast("Find a rest node on the map to recover.")})}_onPointerDown(e){e.preventDefault(),this._panStart={x:e.clientX,y:e.clientY,panX:this._panX},this._didPan=!1,this._rubberBand=0,this._canvas.setPointerCapture(e.pointerId),this._el.querySelector("#sms-canvas-wrap").classList.add("panning")}_onPointerMove(e){if(!this._panStart)return;const t=e.clientX-this._panStart.x;if(!this._didPan&&Math.abs(t)>we&&(this._didPan=!0),this._didPan){const s=Math.max(0,this._regionContentWidth()-this._canvasW),r=this._panStart.panX-t;r<0?(this._panX=0,this._rubberBand=Math.min(-r,z)):r>s?(this._panX=s,this._rubberBand=Math.min(r-s,z)):(this._panX=r,this._rubberBand=0)}}_onPointerUp(e){if(this._el.querySelector("#sms-canvas-wrap").classList.remove("panning"),!this._panStart)return;const t=e.clientX-this._panStart.x;this._didPan?this._rubberBand>=z*.5&&(t<0&&this._regionIdx<this._graph.subRegions.length-1?this._goToRegion(this._regionIdx+1,"slide"):t>0&&this._regionIdx>0?this._goToRegion(this._regionIdx-1,"slide"):this._snapBack()):this._handleTap(e),this._panStart=null,this._rubberBand=0}_onPointerCancel(){var e,t;(t=(e=this._el)==null?void 0:e.querySelector("#sms-canvas-wrap"))==null||t.classList.remove("panning"),this._panStart=null,this._rubberBand=0}_snapBack(){}_goToRegion(e,t="slide"){this._graph&&(e=Math.max(0,Math.min(e,this._graph.subRegions.length-1)),!(e===this._regionIdx&&t!=="init")&&(this._regionIdx=e,this._panX=0,this._selectedId=null,this._rebuildPosCache(),t==="fade"?this._canvas&&(this._canvas.style.transition=`opacity ${Z}ms`,this._canvas.style.opacity="0",setTimeout(()=>{this._canvas&&(this._canvas.style.opacity="1",this._renderMap())},Z)):this._renderMap(),this._refreshTabs(),this._refreshDots(),this._renderDrawer(null)))}_handleTap(e){if(!this._graph)return;const t=this._canvas.getBoundingClientRect(),s=e.clientX-t.left+this._panX,r=e.clientY-t.top,i=this._graph.subRegions[this._regionIdx];if(!i)return;let a=null;for(const n of i.nodeIds){const c=this._nodePosCache[n];if(c&&ve(s,r,c.x,c.y)){a=n;break}}a?(this._selectedId=a,this._renderDrawer(a)):(this._selectedId=null,this._renderDrawer(null))}_onDrawerPointerDown(e){this._drawerDragStart={y:e.clientY,expanded:this._drawerExpanded},this._el.querySelector("#sms-drawer");const t=i=>{const a=this._drawerDragStart.y-i.clientY;a>30&&!this._drawerExpanded?(this._setDrawerExpanded(!0),r()):a<-30&&this._drawerExpanded&&(this._setDrawerExpanded(!1),r())},s=()=>r(),r=()=>{window.removeEventListener("pointermove",t),window.removeEventListener("pointerup",s)};window.addEventListener("pointermove",t),window.addEventListener("pointerup",s)}_setDrawerExpanded(e){var t;this._drawerExpanded=e;const s=(t=this._el)==null?void 0:t.querySelector("#sms-drawer");s&&(e?s.classList.add("expanded"):s.classList.remove("expanded"))}_renderDrawer(e){var t,s,r,i;const a=(t=this._el)==null?void 0:t.querySelector("#sms-drawer-body");if(!a)return;if(!e||!this._graph){a.innerHTML='<div class="sms-drawer-empty">Tap a node to explore</div>',this._setDrawerExpanded(!1);return}const n=this._graph.nodes[e],c=((s=this._graph.nodeSave)==null?void 0:s[e])||{};if(!n){a.innerHTML='<div class="sms-drawer-empty">Unknown node</div>';return}const p=n.type.charAt(0).toUpperCase()+n.type.slice(1),l=n.biome.replace(/_/g," "),h=c.state||"unexplored",u=c.waypointState;a.innerHTML=`
      <div class="sms-drawer-node-name">${p} · ${l}</div>
      <div class="sms-drawer-node-meta">
        <span class="sms-drawer-badge">${h}</span>
        ${n.type==="boss"?'<span class="sms-drawer-badge">BOSS</span>':""}
        ${u?`<span class="sms-drawer-badge">Waypoint: ${u}</span>`:""}
      </div>
      <div class="sms-drawer-btns">
        <button type="button" class="sms-drawer-btn" id="sms-travel-btn">Travel</button>
        ${u==="activated"?'<button type="button" class="sms-drawer-btn secondary" id="sms-ft-btn">Fast Travel</button>':""}
      </div>
      ${this._drawerExpanded?`<div class="sms-drawer-detail">Region: ${l} · Node: ${e}</div>`:""}
    `,(r=a.querySelector("#sms-travel-btn"))==null||r.addEventListener("click",()=>{var m,_;(_=(m=this.audio)==null?void 0:m.playSfx)==null||_.call(m,"click"),this._resolveNodeTravel(e)}),(i=a.querySelector("#sms-ft-btn"))==null||i.addEventListener("click",()=>{var m,_;(_=(m=this.audio)==null?void 0:m.playSfx)==null||_.call(m,"click"),this._fastTravelTo(e)})}_fastTravelTo(e){var t,s,r;if(!this._graph||!e)return;const i=I.get();if(!i.story)return;const a=this._graph.nodes[e];if(!a)return;const n=i.story.currentMapId,c=(r=(s=(t=i.story.maps)==null?void 0:t[n])==null?void 0:s.nodes)==null?void 0:r[e];if(!c||c.waypointState!=="activated"){this._showToast("This waypoint is not yet activated.");return}i.story.currentNodeId=e;const p=this._graph.subRegions.findIndex(h=>h.nodeIds.includes(e));p>=0&&p!==this._regionIdx?this._goToRegion(p,"fade"):(this._rebuildPosCache(),this._renderMap());const l=this._nodePosCache[e];l&&(this._panX=Math.max(0,l.x-this._canvasW/2)),this._renderDrawer(null),this._showToast(`Fast traveled to ${a.type==="trailhead"?"Trailhead":a.biome.replace(/_/g," ")}.`),S(()=>T(()=>import("./play-QH26u79V.js").then(h=>h.at),__vite__mapDeps([0,1,2]),import.meta.url).then(h=>h.as),M([0,1,2]),import.meta.url).then(h=>{h.SaveManager.saveCurrentGame(i.currentSaveKey)}).catch(()=>{})}_checkDeathRespawn(){var e,t;const s=I.get();if(!s.story||!s.party||!s.party.every(a=>a.alive===!1||a.hp!=null&&a.hp<=0))return;const r=s.story.lastWaypointId||((e=this._graph)==null?void 0:e.entryNodeId);if(!r)return;for(const a of s.party)a.alive=!0,a.hp=Math.max(1,Math.floor((a.maxHp||10)*.25));s.story.currentNodeId=r,this._showToast("Party defeated — respawned at last waypoint.");const i=(t=this._graph)==null?void 0:t.subRegions.findIndex(a=>a.nodeIds.includes(r));i>=0&&i!==this._regionIdx&&this._goToRegion(i,"fade")}_resolveNodeTravel(e){var t,s,r,i,a,n,c,p,l,h,u,m,_,g,x,w,C,R,$,H,q;if(!this._graph||!e)return;const v=this._graph.nodes[e];if(!v)return;const d=I.get();if(!d.story)return;d.story.currentNodeId=e;const A=d.story.currentMapId;if(A&&(r=(s=(t=d.story.maps)==null?void 0:t[A])==null?void 0:s.nodes)!=null&&r[e]){d.story.maps[A].nodes[e].state="visited";const y=((i=this._graph.indexes)==null?void 0:i.outgoing)||{};for(const f of y[e]||[])if(f.kind==="open"&&(n=(a=d.story.maps[A])==null?void 0:a.nodes)!=null&&n[f.to]){const b=d.story.maps[A].nodes[f.to];b.visibility==="hidden"&&(b.visibility="visible")}}if(typeof d.story.pressureMeter=="number"){const y=v.type==="rest"?-10:5;d.story.pressureMeter=Math.max(0,Math.min(100,d.story.pressureMeter+y))}if(d.story.recentHistoryCount=(d.story.recentHistoryCount||0)+1,(!d.story.recentHistory||typeof d.story.recentHistory!="object"||Array.isArray(d.story.recentHistory))&&(d.story.recentHistory={nodeTypes:[],enemyFamilies:[],skillLabels:[],rewardTypes:[],biomes:[],tones:[],sameTypeStreak:0,lastType:null}),Array.isArray(d.story.recentHistory.nodeTypes)||(d.story.recentHistory.nodeTypes=[]),d.story.recentHistory.nodeTypes.push(v.type),d.story.recentHistory.nodeTypes.length>20&&d.story.recentHistory.nodeTypes.shift(),d.story.recentHistory.lastType=v.type,((c=v.tags)==null?void 0:c.includes("waypoint"))||v.type==="trailhead"||v.type==="town"){d.story.lastWaypointId=e;const y=(h=(l=(p=d.story.maps)==null?void 0:p[A])==null?void 0:l.nodes)==null?void 0:h[e];y&&(!y.waypointState||y.waypointState==="unexplored"||y.waypointState==="discovered")&&(y.waypointState="activated")}this._rebuildVisibilityCache();const k=v.type;if(k==="trailhead"){const y=((m=(u=this._graph.subRegions)==null?void 0:u[0])==null?void 0:m.name)||"Emberveil",f=(_=this._el)==null?void 0:_.querySelector("#sms-drawer-body");f&&(f.innerHTML=`
          <div class="sms-drawer-node-name">Trailhead &mdash; ${y}</div>
          <div class="sms-drawer-node-meta"><span class="sms-drawer-badge">Waypoint</span><span class="sms-drawer-badge activated">Activated</span></div>
          <div class="sms-drawer-btns">
            <button type="button" class="sms-drawer-btn" id="sms-trailhead-continue">Continue</button>
          </div>
        `,(g=f.querySelector("#sms-trailhead-continue"))==null||g.addEventListener("click",()=>{this._renderDrawer(null),this._setDrawerExpanded(!1)}));const b=d.story.currentMapId;b&&(C=(w=(x=d.story.maps)==null?void 0:x[b])==null?void 0:w.nodes)!=null&&C[e]&&(d.story.maps[b].nodes[e].waypointState="activated",((R=d.story.maps[e])==null?void 0:R.state)!=="visited"&&(d.story.maps[b].nodes[e].state="visited")),d.story.lastWaypointId=e;return}if(k==="town"){d.story&&(d.story.townTier=d.story.act||1),this._afterNodeResolved(d,e),d.story.lastWaypointId=e;const y=d.story.currentMapId;y&&(q=(H=($=d.story.maps)==null?void 0:$[y])==null?void 0:H.nodes)!=null&&q[e]&&(d.story.maps[y].nodes[e].waypointState="activated"),S(async()=>{const{TownScreen:f}=await T(()=>import("./play-QH26u79V.js").then(b=>b.at),__vite__mapDeps([0,1,2]),import.meta.url).then(b=>b.ay);return{TownScreen:f}},M([0,1,2]),import.meta.url).then(({TownScreen:f})=>{var b;const E=((b=d.party)==null?void 0:b[0])||null;this.manager.push(new f(this.manager,this.audio,E,!1))}).catch(()=>{this._showToast("Town services unavailable — returning to map."),this._renderDrawer(null)});return}if(k==="rest"){if(d.party)for(const y of d.party)y.alive!==!1&&(y.hp=y.maxHp??y.hp,typeof y.mp=="number"&&(y.mp=y.maxMp??y.mp));this._afterNodeResolved(d,e),this._showToast(`Rested at ${v.biome.replace(/_/g," ")} — party fully restored.`),this._renderDrawer(null);return}if(k==="combat"||k==="elite"||k==="boss"){S(async()=>{const{buildEncounterForNode:y}=await T(()=>import("./storyEncounterBuilder-D3lleGoN-CT12LV7v.js"),__vite__mapDeps([7,0,1,2]),import.meta.url);return{buildEncounterForNode:y}},M([7,0,1,2]),import.meta.url).then(({buildEncounterForNode:y})=>{const f=y(d,e);if(!f){this._showToast(`Travelled through ${v.biome.replace(/_/g," ")}.`),this._afterNodeResolved(d,e),this._renderDrawer(null);return}S(async()=>{const{CombatScreen:b}=await T(()=>import("./play-QH26u79V.js").then(E=>E.at),__vite__mapDeps([0,1,2]),import.meta.url).then(E=>E.aw);return{CombatScreen:b}},M([0,1,2]),import.meta.url).then(({CombatScreen:b})=>{const E=new b(this.manager,this.audio,null,f),L=this.onResume.bind(this);this.onResume=()=>{this.onResume=L,this._afterNodeResolved(d,e),this._checkDeathRespawn(),this._rebuildVisibilityCache(),this._renderMap(),this._refreshTabs(),L()},this.manager.push(E)}).catch(()=>{this._showToast(`Travelled through ${v.biome.replace(/_/g," ")}.`),this._afterNodeResolved(d,e),this._renderDrawer(null)})}).catch(()=>{this._showToast(`Travelled through ${v.biome.replace(/_/g," ")}.`),this._afterNodeResolved(d,e),this._renderDrawer(null)});return}if(k==="dialog"||k==="event"||k==="shrine"||k==="lore"||k==="merchant"){const y={dialog:"arrival",event:"ambush",shrine:"shrine",lore:"lore",merchant:"merchant"}[k]||k;S(async()=>{const{loadDialoguePool:f}=await T(()=>import("./storyContent-BFtFSCKH-oq7IT1Qo.js"),[],import.meta.url);return{loadDialoguePool:f}},[],import.meta.url).then(({loadDialoguePool:f})=>{const b=f(y),E=L=>{const W=Array.isArray(L)?L:(L==null?void 0:L.nodes)||[],te=d.story.act||1,j=W.filter(P=>(!P.biome||P.biome===v.biome)&&(!P.act||P.act===te)),O=j.length?j:W,V=O[Math.floor(Math.random()*O.length)];if(!V){this._showToast(`Travelled through ${v.biome.replace(/_/g," ")}.`),this._afterNodeResolved(d,e),this._renderDrawer(null);return}S(async()=>{const{StoryDialogScreen:P}=await T(()=>import("./StoryDialogScreen-BEiDd4oH-Ba89bain.js"),__vite__mapDeps([8,0,1,2,9,10,11]),import.meta.url);return{StoryDialogScreen:P}},M([8,0,1,2,9,10,11]),import.meta.url).then(({StoryDialogScreen:P})=>{const se=new P(this.manager,this.audio,V,()=>{this._afterNodeResolved(d,e),this._rebuildVisibilityCache(),this._renderMap(),this._renderDrawer(null)},{poolId:y,nodeId:e});this.manager.push(se)}).catch(()=>{this._showToast(`Travelled through ${v.biome.replace(/_/g," ")}.`),this._afterNodeResolved(d,e),this._renderDrawer(null)})};b&&typeof b.then=="function"?b.then(E).catch(()=>{this._showToast(`Travelled through ${v.biome.replace(/_/g," ")}.`),this._afterNodeResolved(d,e),this._renderDrawer(null)}):E(b)}).catch(()=>{this._showToast(`Travelled through ${v.biome.replace(/_/g," ")}.`),this._afterNodeResolved(d,e),this._renderDrawer(null)});return}this._showToast(`Travelled through ${v.biome.replace(/_/g," ")}.`),this._afterNodeResolved(d,e),this._renderDrawer(null)}_afterNodeResolved(e,t){S(async()=>{const{storyMode:s}=await T(()=>import("./storyMode-Ct4jEthF-BLk0DseA.js"),__vite__mapDeps([9,0,1,2,10,11]),import.meta.url).then(r=>r.b);return{storyMode:s}},M([9,0,1,2,10,11]),import.meta.url).then(({storyMode:s})=>{s.afterNodeResolved(e,t)}).catch(()=>{}),S(()=>T(()=>import("./play-QH26u79V.js").then(s=>s.at),__vite__mapDeps([0,1,2]),import.meta.url).then(s=>s.as),M([0,1,2]),import.meta.url).then(s=>{s.SaveManager.saveCurrentGame(e.currentSaveKey)}).catch(()=>{})}_togglePressureChip(){var e;const t=(e=this._el)==null?void 0:e.querySelector("#sms-pressure-chip");if(!t)return;const s=t.classList.contains("expanded-chip");t.classList.toggle("expanded-chip",!s);const r=t.querySelector("#sms-chip-expanded");r&&r.setAttribute("aria-hidden",s?"true":"false"),this._refreshPressureChip()}_refreshPressureChip(){var e,t,s,r,i;const a=I.get(),n=(e=this._el)==null?void 0:e.querySelector("#sms-pressure-label"),c=(t=this._el)==null?void 0:t.querySelector("#sms-pips"),p=(s=this._el)==null?void 0:s.querySelector("#sms-band-label"),l=(r=this._el)==null?void 0:r.querySelector("#sms-chip-history");if(!a.story)return;const h=a.story.storytellerId||"chronicler",u=a.story.pressureMeter||a.story.pressure||0,m=u<25?"Calm":u<50?"Tense":u<75?"Urgent":"Crisis";if(n){const _={chronicler:"The Chronicler",ash_prophet:"The Ash Prophet",warbringer:"The Warbringer",trickster:"The Trickster",pilgrim:"The Pilgrim",iron_judge:"The Iron Judge"};n.textContent=_[h]||h}if(c){const _=Math.min(5,Math.round(u/20));c.querySelectorAll(".sms-pip").forEach((g,x)=>g.classList.toggle("active",x<_))}if(p&&(p.textContent=m),l){const _={combat:"⚔",elite:"☠",boss:"♛",dialog:"❁",shrine:"✶",lore:"℘",merchant:"◎",rest:"☽",event:"✵",trailhead:"⚑",town:"⌂"},g=(Array.isArray(a.story.recentHistory)?a.story.recentHistory:((i=a.story.recentHistory)==null?void 0:i.nodeTypes)||[]).slice(-5);l.innerHTML=g.map(x=>{const w=_[x]||"?";return`<span class="sms-chip-hist-glyph" title="${x}">${w}</span>`}).join("")}}_showToast(e){try{S(()=>T(()=>import("./play-QH26u79V.js").then(s=>s.at),__vite__mapDeps([0,1,2]),import.meta.url).then(s=>s.at),M([0,1,2]),import.meta.url).then(s=>s.showToast(e,{duration:3e3})).catch(()=>{})}catch{}const t=document.createElement("div");if(t.className="sms-toast-msg",t.textContent=e,t.setAttribute("role","status"),!document.querySelector("#sms-toast-styles")){const s=document.createElement("style");s.id="sms-toast-styles",s.textContent=".sms-toast-msg{position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:rgba(20,12,28,0.95);color:#e8c070;font-size:14px;padding:10px 18px;border-radius:8px;border:1px solid rgba(232,160,32,0.3);pointer-events:none;z-index:9999;animation:sms-fadein 0.2s ease}@keyframes sms-fadein{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}",document.head.appendChild(s)}document.body.appendChild(t),setTimeout(()=>t.remove(),2800)}_regionContentWidth(){if(!this._graph)return this._canvasW;const e=this._graph.subRegions[this._regionIdx];return e?(Math.max(...e.nodeIds.map(t=>{var s;return((s=this._graph.nodes[t])==null?void 0:s.col)||0}))+2)*N+N:this._canvasW}_rebuildPosCache(){if(this._nodePosCache={},!this._graph)return;const e=this._graph.subRegions[this._regionIdx];if(!e)return;const t=this._canvasH||484;for(const s of e.nodeIds){const r=this._graph.nodes[s];r&&(this._nodePosCache[s]=_e(r,this._canvasW,t))}}_startLoop(){if(this._raf)return;let e=performance.now();const t=s=>{this._raf=requestAnimationFrame(t);const r=Math.min((s-e)/1e3,.05);e=s,this._t+=r,this._renderMap()};this._raf=requestAnimationFrame(t)}_stopLoop(){this._raf&&(cancelAnimationFrame(this._raf),this._raf=null)}_renderMap(){var e,t;const s=this._ctx;if(!s||!this._graph)return;const r=this._canvasW,i=this._canvasH,a=performance.now();s.clearRect(0,0,r,i);const n=this._graph.subRegions[this._regionIdx],c=(n==null?void 0:n.biome)||"emberwood",p=((e=this._biomeData)==null?void 0:e[c])||null,l=this._getBiomePalette(c);if(p&&typeof G=="function")G(s,p,r,i,this._t,()=>{});else{const m=s.createLinearGradient(0,0,0,i);m.addColorStop(0,l[0]),m.addColorStop(.4,l[1]),m.addColorStop(1,l[0]),s.fillStyle=m,s.fillRect(0,0,r,i)}if(this._drawParchmentTexture(s,r,i,l),!n)return;const h=this._lastFrameMs<12;this._updateEmbers(r,i,h),h&&this._drawEmbers(s),s.save(),s.translate(-this._panX,0),this._drawEdges(s,n,r,i),this._drawStitchArrows(s,n,r,i);const u=this._visibilityCache;for(const m of n.nodeIds){const _=this._graph.nodes[m],g=this._nodePosCache[m];if(!_||!g)continue;const x=u?u.get(m):null,w=((t=this._graph.nodeSave)==null?void 0:t[m])||{},C=x??w.visibility??"visible";if(C==="hidden")continue;const R={state:w.state||"unexplored",visibility:C,waypointState:w.waypointState||null,overlay:w.overlay||null,selected:m===this._selectedId,hovered:!1};ye(s,g.x,g.y,_.type,R)}s.restore(),this._drawRegionLabel(s,r,n,c,l),this._drawVignette(s,r,i),this._lastFrameMs=performance.now()-a}_getBiomePalette(e){var t,s;if((s=(t=this._biomeData)==null?void 0:t[e])!=null&&s.palette){const r=this._biomeData[e].palette;return[r[0]||"#1a1210",r[1]||"#3a2a18",r[2]||"#786040",r[3]||"#d0b070"]}return ee[e]||ee._default}_drawParchmentTexture(e,t,s,r){e.save(),e.globalAlpha=.04,e.strokeStyle=r[2],e.lineWidth=.5;const i=18;for(let a=0;a<t;a+=i)e.beginPath(),e.moveTo(a,0),e.lineTo(a,s),e.stroke();for(let a=0;a<s;a+=i)e.beginPath(),e.moveTo(0,a),e.lineTo(t,a),e.stroke();e.restore()}_drawRegionLabel(e,t,s,r,i){const a=(s==null?void 0:s.name)||r.replace(/_/g," ").replace(/\b\w/g,n=>n.toUpperCase());e.save(),e.globalAlpha=.35,e.font="700 13px Cinzel, serif",e.fillStyle=i[3],e.textAlign="center",e.textBaseline="top",e.fillText(a.toUpperCase(),t/2,6),e.restore()}_drawVignette(e,t,s){e.save();const r=e.createRadialGradient(t/2,s/2,s*.3,t/2,s/2,s*.75);r.addColorStop(0,"rgba(0,0,0,0)"),r.addColorStop(1,"rgba(0,0,0,0.55)"),e.fillStyle=r,e.fillRect(0,0,t,s),e.restore()}_initEmbers(e,t){this._embers=[];const s=18;for(let r=0;r<s;r++)this._embers.push(this._spawnEmber(e,t,!0))}_spawnEmber(e,t,s=!1){return{x:Math.random()*e,y:s?Math.random()*t:t+4,vx:(Math.random()-.5)*.3,vy:-(.2+Math.random()*.4),alpha:.04+Math.random()*.1,r:1+Math.random()*1.5,life:1}}_updateEmbers(e,t,s){if(s){this._embers.length||this._initEmbers(e,t);for(let r=this._embers.length-1;r>=0;r--){const i=this._embers[r];i.x+=i.vx,i.y+=i.vy,i.alpha-=3e-4,(i.y<-4||i.alpha<=0)&&(this._embers[r]=this._spawnEmber(e,t))}}}_drawEmbers(e){e.save();for(const t of this._embers)e.globalAlpha=t.alpha,e.fillStyle="#f0a030",e.beginPath(),e.arc(t.x,t.y,t.r,0,Math.PI*2),e.fill();e.restore()}_drawEdges(e,t,s,r){var i;const a=((i=this._graph.indexes)==null?void 0:i.outgoing)||{},n=new Set(t.nodeIds),c=this._visibilityCache;for(const p of t.nodeIds){if((c?c.get(p):"visible")==="hidden")continue;const l=a[p]||[],h=this._nodePosCache[p];if(h)for(const u of l){if(!n.has(u.to))continue;const m=c?c.get(u.to):"visible";if(!m||m==="hidden")continue;const _=this._nodePosCache[u.to];if(!_)continue;const g=u.kind==="hidden"||u.kind==="blocked"?m==="revealed"?"hidden":"blocked":u.kind;Q(e,h.x,h.y,_.x,_.y,g,this._t)}}}_drawStitchArrows(e,t,s,r){var i;const a=((i=this._graph.indexes)==null?void 0:i.outgoing)||{},n=this._graph.subRegions,c=new Set(t.nodeIds);if(this._regionIdx<n.length-1){const p=Math.max(...t.nodeIds.map(l=>{var h;return((h=this._graph.nodes[l])==null?void 0:h.col)||0}));for(const l of t.nodeIds){const h=this._graph.nodes[l];if(((h==null?void 0:h.col)||0)<p)continue;const u=this._nodePosCache[l];if(!u||!(a[l]||[]).some(g=>!c.has(g.to)))continue;const m=s-this._panX+24;Q(e,u.x,u.y,m,u.y,"stitch",this._t);const _=s-this._panX+4;e.save(),e.fillStyle="rgba(232,192,96,0.8)",e.beginPath(),e.moveTo(_,u.y-8),e.lineTo(_+10,u.y),e.lineTo(_,u.y+8),e.closePath(),e.fill(),e.restore()}}}}export{Me as StoryMapScreen};
