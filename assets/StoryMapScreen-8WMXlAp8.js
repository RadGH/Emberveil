const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/play-CctEuBOF.js","assets/modulepreload-polyfill-B5Qt9EMX.js","assets/play-dErdlDnR.css","assets/PartyScreen-DG1gG-su.js","assets/InventoryScreen-Ch9IpDbr.js","assets/ConfirmModal-DQ97N49q.js","assets/StoryJournalScreen-CuZtZUIR.js","assets/storyEncounterBuilder-CqeAOLz-.js","assets/storyDirector-jadbW2ZA.js","assets/StoryDialogScreen-CdRCjxfs.js","assets/storyMode-C53fEJsR.js","assets/storyContent-JGlG7UiG.js","assets/storyMapGen-DrE0en0o.js"])))=>i.map(i=>d[i]);
import{G as E,r as ae,c as C,_ as S,i as ie}from"./play-CctEuBOF.js";import{b as ne,g as G,h as oe,s as le,c as de}from"./storyMapGen-DrE0en0o.js";import{s as ce,g as F,p as he,a as pe}from"./storyDirector-jadbW2ZA.js";import"./modulepreload-polyfill-B5Qt9EMX.js";const U=Object.create(null),ue="#0c0e14";function Y(n,e,s,t,r=0,i=null){if(!e)return;const a=e.backgroundOpacity??.55,o=e.backgroundDarken??.35,l=e.backgroundImage;if(me(n,e.palette||[],s,t),!l){A(n,o,s,t);return}const h=U[e.id];if(!h){const d={img:new Image,state:"loading"};U[e.id]=d,d.img.addEventListener("load",()=>{d.state="ready",typeof i=="function"&&i()}),d.img.addEventListener("error",()=>{d.state="error"});let u="/";try{u="/Emberveil/"}catch{}d.img.src=u.replace(/\/$/,"")+"/"+l,A(n,o,s,t);return}if(h.state!=="ready"){A(n,o,s,t);return}const p=Number.isFinite(r)?Math.sin(r*.3)*4:0;n.save(),n.globalAlpha=a,n.drawImage(h.img,p-4,0,s+8,t),n.restore(),A(n,o,s,t)}function me(n,e,s,t){const r=e.length>=2?e:["#1a1010","#0c0e14"],i=n.createLinearGradient(0,0,0,t);r.forEach((a,o)=>i.addColorStop(o/(r.length-1),a)),n.save(),n.globalAlpha=1,n.fillStyle=i,n.fillRect(0,0,s,t),n.restore()}function A(n,e,s,t){e<=0||(n.save(),n.globalAlpha=e,n.fillStyle=ue,n.fillRect(0,0,s,t),n.restore())}const _e=16,j=24,N=56,ge={combat:{color:"#c04030",label:"Combat",glyph:"⚔"},elite:{color:"#c86020",label:"Elite",glyph:"☠"},boss:{color:"#8020b0",label:"Boss",glyph:"♛"},dialog:{color:"#4080c0",label:"Dialog",glyph:"❁"},shrine:{color:"#80e0c8",label:"Shrine",glyph:"✶"},lore:{color:"#6a9040",label:"Lore",glyph:"℘"},merchant:{color:"#e0a020",label:"Merchant",glyph:"◎"},rest:{color:"#40a860",label:"Rest",glyph:"☽"},event:{color:"#9040c0",label:"Event",glyph:"✵"},waypoint:{color:"#4080c0",label:"Waypoint",glyph:"✦"},trailhead:{color:"#708050",label:"Trailhead",glyph:"⚑"},town:{color:"#c09030",label:"Town",glyph:"⌂"}},ye={color:"#806060",glyph:null},K={unexplored:"rgba(64,128,192,0.5)",discovered:"#4080c0",activated:"#40c860",corrupted:"#c04030",disabled:"#404040"},J="rgba(200,170,100,0.65)",be="rgba(200,60,60,0.3)",fe="rgba(232,192,96,0.65)",Q=24;function ve(n,e,s){const{lane:t,col:r}=n,i=[.22,.5,.78],a=r%2===0?-Q:Q,o=i[t]*s+a,h=N+r*N;return{x:Math.round(h),y:Math.round(o)}}function we(n,e,s,t,r={},i={}){const a=ge[t]||ye,o=_e,{selected:l,hovered:h,waypointState:p,visibility:d,overlay:u,state:c,recommended:m}=r;if(d==="hidden")return;const g=d==="revealed",y=c==="visited"||c==="cleared",b=g?.5:y?.55:1;if(n.save(),n.globalAlpha=b,l?(n.shadowBlur=22,n.shadowColor="#f0c040"):h&&(n.shadowBlur=10,n.shadowColor=a.color),n.beginPath(),n.arc(e,s,o,0,Math.PI*2),n.fillStyle=u==="corrupted"?"#8a2020":u==="cleansed"?"#40a860":y?Se(a.color,.6):a.color,n.fill(),n.lineWidth=l?3.5:1.5,n.strokeStyle=l?"#f0c040":y?"rgba(255,255,255,0.2)":"rgba(255,255,255,0.4)",n.stroke(),l&&(n.shadowBlur=0,n.beginPath(),n.arc(e,s,o+5,0,Math.PI*2),n.strokeStyle="rgba(240,192,64,0.55)",n.lineWidth=2,n.stroke()),m&&!l&&(n.shadowBlur=0,n.beginPath(),n.arc(e,s,o+6,0,Math.PI*2),n.strokeStyle="rgba(72,209,204,0.85)",n.lineWidth=2.5,n.stroke()),p){const x=K[p]||K.unexplored;n.beginPath(),n.arc(e,s,o+4,0,Math.PI*2),n.strokeStyle=x,n.lineWidth=2,n.stroke()}const w=a.glyph||xe(t);w&&(n.fillStyle=y?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.92)",n.font=`bold ${Math.round(o*.85)}px Inter, sans-serif`,n.textAlign="center",n.textBaseline="middle",n.fillText(w,e,s)),n.restore()}function Se(n,e){const s=parseInt(n.slice(1,3),16),t=parseInt(n.slice(3,5),16),r=parseInt(n.slice(5,7),16),i=42,a=32,o=16,l=Math.round(s*e+i*(1-e)),h=Math.round(t*e+a*(1-e)),p=Math.round(r*e+o*(1-e));return`rgb(${l},${h},${p})`}function xe(n){return{combat:"⚔",elite:"☠",boss:"♛",dialog:"❁",shrine:"✶",lore:"℘",merchant:"◎",rest:"☽",event:"✵",waypoint:"✦",trailhead:"⚑",town:"⌂"}[n]||null}function Z(n,e,s,t,r,i,a=0){n.save();let o,l,h,p;if(i==="open"){o=J,l=2.5,h=[],p=0;const P=.55+.1*Math.sin(a*1.8+e*.01);n.globalAlpha=P}else i==="hidden"?(o=`rgba(120,80,180,${(.28+.12*Math.sin(a*3.5)).toFixed(2)})`,l=1.5,h=[5,6],p=-(a*18)%11):i==="blocked"?(o=be,l=2,h=[4,4],p=0):i==="stitch"?(o=fe,l=2.5,h=[10,5],p=-(a*25)%15,n.shadowBlur=8,n.shadowColor="#e8c060"):(o=J,l=1.5,h=[],p=0);n.strokeStyle=o,n.lineWidth=l,n.setLineDash(h),n.lineDashOffset=p;const d=(e+t)/2,u=(s+r)/2,c=t-e,m=r-s,g=Math.sqrt(c*c+m*m)||1,y=-m/g,b=c/g,w=Math.min(12,g*.18),x=e*.6+d*.4+y*w,D=s*.6+u*.4+b*w,I=d*.4+t*.6-y*w,L=u*.4+r*.6-b*w;n.beginPath(),n.moveTo(e,s),n.bezierCurveTo(x,D,I,L,t,r),n.stroke(),n.setLineDash([]),n.globalAlpha=1,n.restore()}function Te(n,e,s,t){const r=n-s,i=e-t;return r*r+i*i<=j*j}const Ee="story-map-screen-styles";ie(Ee,`
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
`);const Me=8,O=60,ee=150,te={emberwood:["#602010","#c84828","#e8a020","#f0d090"],stoneward:["#404850","#808090","#c0b080","#e0d8c0"],fen:["#203010","#405030","#80a040","#c0d880"],old_road:["#504030","#908060","#c0a840","#f0e0a0"],gloomridge:["#181020","#302838","#5040a0","#9080e0"],veilscar:["#200830","#401858","#8028b0","#d060f0"],_default:["#1a1210","#3a2a18","#786040","#d0b070"]};class De{constructor(e,s){this.manager=e,this.audio=s,this._el=null,this._graph=null,this._regionIdx=0,this._selectedId=null,this._canvas=null,this._ctx=null,this._panX=0,this._panStart=null,this._didPan=!1,this._rubberBand=0,this._t=0,this._raf=null,this._lastFrameMs=0,this._drawerExpanded=!1,this._drawerDragStart=null,this._nodePosCache={},this._visibilityCache=null,this._biomeData=null,this._embers=[]}onEnter(){this._build(),this._loadBiomeData().then(()=>{this._loadOrGenerateMap()}),this._startLoop(),this._playBiomeMusic()}async _loadBiomeData(){try{this._biomeData={};for(const e of ne||[])this._biomeData[e.id]=e}catch{this._biomeData={}}}_playBiomeMusic(){var e,s,t;try{const i=((e=E.get().story)==null?void 0:e.act)||1,a={1:"overworld_act1.ogg",2:"overworld_act2.ogg",3:"overworld_act3.ogg"},o=a[i]||a[1];(t=(s=this.audio)==null?void 0:s.playMusic)==null||t.call(s,o)}catch{}}onResume(){this._startLoop()}onPause(){this._stopLoop()}onExit(){this._stopLoop(),ae(this._el),this._el=null,this._canvas=null,this._ctx=null}destroy(){this.onExit()}update(){}draw(){}_loadOrGenerateMap(){var r;const e=E.get();if(!e.story)return;const s=e.story.currentMapId||"act1_map",t=e.story.act||1;if((r=e.story.maps)!=null&&r[s]){const i=e.story.maps[s].seed||e.story.campaignSeed||"default",{mapGraph:a}=G({seed:i,act:t,salt:e.story.saltOffset||0});this._graph=oe(a,e.story.maps[s])}else{const i=e.story.campaignSeed||"default",{mapGraph:a,fallbackUsed:o}=G({seed:i,act:t,salt:e.story.saltOffset||0});this._graph=a,e.story.maps||(e.story.maps={}),e.story.maps[s]=le(a),e.story.currentMapId=a.mapId,o&&console.warn("[StoryMapScreen] Map generation failed after 10 attempts — using safety-net fallback.")}this._rebuildPosCache(),this._rebuildVisibilityCache(),this._computeDirectorRecommendation(),this._renderMap(),this._refreshTabs(),this._refreshDots()}_rebuildVisibilityCache(){var r,i,a;if(!this._graph){this._visibilityCache=null;return}const e=E.get(),s=(r=e.story)==null?void 0:r.currentMapId,t=(a=(i=e.story)==null?void 0:i.maps)==null?void 0:a[s];this._visibilityCache=de(this._graph,t)}_build(){var d;const s=((d=E.get().story)==null?void 0:d.act)||1;this._el=C("div","story-map-screen");const t=C("div","sms-topbar");t.innerHTML=`
      <span class="sms-topbar-btn sms-topbar-spacer" aria-hidden="true"></span>
      <span class="sms-topbar-title" id="sms-title">Act ${s} · Story Map</span>
      <button type="button" class="sms-topbar-btn" id="sms-menu" aria-label="Menu">&#9776;</button>
    `,this._el.appendChild(t);const r=C("div","sms-pressure-chip");r.id="sms-pressure-chip",r.setAttribute("role","button"),r.setAttribute("tabindex","0"),r.setAttribute("aria-label","Storyteller pressure — tap to expand"),r.innerHTML=`
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
    `,r.addEventListener("click",()=>this._togglePressureChip()),r.addEventListener("keydown",u=>{(u.key==="Enter"||u.key===" ")&&this._togglePressureChip()}),this._el.appendChild(r),this._refreshPressureChip();const i=C("div","sms-tab-strip");i.id="sms-tab-strip",this._el.appendChild(i);const a=C("div","sms-canvas-wrap");a.id="sms-canvas-wrap";const o=document.createElement("canvas");o.id="sms-map-canvas",o.className="sms-map-canvas",a.appendChild(o);const l=C("div","sms-page-dots");l.id="sms-page-dots",a.appendChild(l),this._el.appendChild(a);const h=C("div","sms-drawer");h.id="sms-drawer",h.innerHTML=`
      <div class="sms-drawer-handle" id="sms-drawer-handle">
        <div class="sms-drawer-pip"></div>
      </div>
      <div class="sms-drawer-body" id="sms-drawer-body">
        <div class="sms-drawer-empty">Tap a node to explore</div>
      </div>
    `,this._el.appendChild(h);const p=C("div","sms-action-bar");p.innerHTML=`
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
    `,this._el.appendChild(p),this.manager.uiOverlay.appendChild(this._el),this._canvas=o,this._ctx=o.getContext("2d"),this._setupCanvas(),this._bindEvents()}_setupCanvas(){const e=this._el.querySelector("#sms-canvas-wrap"),s=e.clientWidth||(window.innerWidth>=700?window.innerWidth:393),t=e.clientHeight||484;this._canvas.width=s,this._canvas.height=t,this._canvas.style.width=`${s}px`,this._canvas.style.height=`${t}px`,this._canvasW=s,this._canvasH=t,this._isDesktop=window.innerWidth>=700}_isRegionReachable(e){var o,l,h;if(!this._graph||e<0)return!1;if(e===0)return!0;const s=E.get(),t=(o=s.story)==null?void 0:o.currentMapId,r=(h=(l=s.story)==null?void 0:l.maps)==null?void 0:h[t],i=(r==null?void 0:r.nodes)||{},a=p=>{const d=this._graph.subRegions[p];if(!d)return!1;for(const u of d.nodeIds){const c=i[u],m=(c==null?void 0:c.state)||"unexplored";if(m==="visited"||m==="cleared")return!0}return!1};return!!(a(e)||e>0&&a(e-1))}_refreshTabs(){var s;const e=(s=this._el)==null?void 0:s.querySelector("#sms-tab-strip");if(!(!e||!this._graph)){e.innerHTML="";for(let t=0;t<this._graph.subRegions.length;t++){const r=this._graph.subRegions[t],i=this._isRegionReachable(t),a=document.createElement("button");a.type="button",a.className=`sms-tab${t===this._regionIdx?" active":""}${i?"":" sms-tab-locked"}`,a.setAttribute("aria-disabled",i?"false":"true"),a.innerHTML=i?r.name:`&#128274; ${r.name}`,i&&a.addEventListener("click",()=>this._goToRegion(t,"fade")),e.appendChild(a)}}}_refreshDots(){var s;const e=(s=this._el)==null?void 0:s.querySelector("#sms-page-dots");if(!(!e||!this._graph)){e.innerHTML="";for(let t=0;t<this._graph.subRegions.length;t++){const r=document.createElement("div");r.className=`sms-dot${t===this._regionIdx?" active":""}`,e.appendChild(r)}}}_bindEvents(){const e=this._canvas;e.addEventListener("pointerdown",t=>this._onPointerDown(t)),e.addEventListener("pointermove",t=>this._onPointerMove(t)),e.addEventListener("pointerup",t=>this._onPointerUp(t)),e.addEventListener("pointercancel",()=>this._onPointerCancel()),this._el.querySelector("#sms-drawer"),this._el.querySelector("#sms-drawer-handle").addEventListener("pointerdown",t=>this._onDrawerPointerDown(t)),this._el.querySelector("#sms-menu").addEventListener("click",()=>{var t,r;(r=(t=this.audio)==null?void 0:t.playSfx)==null||r.call(t,"click"),(async()=>{try{const{GameMenuScreen:i}=await S(async()=>{const{GameMenuScreen:a}=await import("./play-CctEuBOF.js").then(o=>o.az);return{GameMenuScreen:a}},__vite__mapDeps([0,1,2]));this.manager.push(new i(this.manager,this.audio))}catch{}})()}),this._el.querySelector("#sms-party").addEventListener("click",()=>{var t,r;(r=(t=this.audio)==null?void 0:t.playSfx)==null||r.call(t,"click"),(async()=>{try{const{PartyScreen:i}=await S(async()=>{const{PartyScreen:a}=await import("./PartyScreen-DG1gG-su.js");return{PartyScreen:a}},__vite__mapDeps([3,0,1,2]));this.manager.push(new i(this.manager,this.audio))}catch{console.warn("[StoryMapScreen] PartyScreen not available")}})()}),this._el.querySelector("#sms-inventory").addEventListener("click",()=>{var t,r;(r=(t=this.audio)==null?void 0:t.playSfx)==null||r.call(t,"click"),(async()=>{try{const{InventoryScreen:i}=await S(async()=>{const{InventoryScreen:a}=await import("./InventoryScreen-Ch9IpDbr.js");return{InventoryScreen:a}},__vite__mapDeps([4,0,1,2,5]));this.manager.push(new i(this.manager,this.audio))}catch{console.warn("[StoryMapScreen] InventoryScreen not available")}})()}),this._el.querySelector("#sms-quests").addEventListener("click",()=>{var t,r;(r=(t=this.audio)==null?void 0:t.playSfx)==null||r.call(t,"click"),S(async()=>{const{StoryJournalScreen:i}=await import("./StoryJournalScreen-CuZtZUIR.js");return{StoryJournalScreen:i}},__vite__mapDeps([6,0,1,2])).then(({StoryJournalScreen:i})=>{this.manager.push(new i(this.manager,this.audio))}).catch(i=>console.warn("[StoryMapScreen] StoryJournalScreen import failed",i))}),this._el.querySelector("#sms-rest").addEventListener("click",()=>{var a,o,l,h,p;(o=(a=this.audio)==null?void 0:a.playSfx)==null||o.call(a,"click");const t=E.get(),r=(l=t.story)==null?void 0:l.currentNodeId,i=r&&((p=(h=this._graph)==null?void 0:h.nodes)==null?void 0:p[r]);if((i==null?void 0:i.type)==="rest"){if(t.party)for(const d of t.party)d.alive!==!1&&(d.hp=d.maxHp||d.hp);S(()=>import("./play-CctEuBOF.js").then(d=>d.au),__vite__mapDeps([0,1,2])).then(d=>d.SaveManager.saveCurrentGame(t.currentSaveKey)).catch(()=>{}),this._showToast("Party rested — HP restored.")}else this._showToast("Find a rest node on the map to recover.")})}_onPointerDown(e){e.preventDefault(),this._panStart={x:e.clientX,y:e.clientY,panX:this._panX},this._didPan=!1,this._rubberBand=0,this._canvas.setPointerCapture(e.pointerId),this._el.querySelector("#sms-canvas-wrap").classList.add("panning")}_onPointerMove(e){if(!this._panStart)return;const s=e.clientX-this._panStart.x;if(!this._didPan&&Math.abs(s)>Me&&(this._didPan=!0),this._didPan){const t=Math.max(0,this._regionContentWidth()-this._canvasW),r=this._panStart.panX-s;r<0?(this._panX=0,this._rubberBand=Math.min(-r,O)):r>t?(this._panX=t,this._rubberBand=Math.min(r-t,O)):(this._panX=r,this._rubberBand=0)}}_onPointerUp(e){if(this._el.querySelector("#sms-canvas-wrap").classList.remove("panning"),!this._panStart)return;const t=e.clientX-this._panStart.x;this._didPan?this._rubberBand>=O*.5&&(t<0&&this._regionIdx<this._graph.subRegions.length-1?this._goToRegion(this._regionIdx+1,"slide"):t>0&&this._regionIdx>0?this._goToRegion(this._regionIdx-1,"slide"):this._snapBack()):this._handleTap(e),this._panStart=null,this._rubberBand=0}_onPointerCancel(){var e,s;(s=(e=this._el)==null?void 0:e.querySelector("#sms-canvas-wrap"))==null||s.classList.remove("panning"),this._panStart=null,this._rubberBand=0}_snapBack(){}_goToRegion(e,s="slide"){this._graph&&(e=Math.max(0,Math.min(e,this._graph.subRegions.length-1)),!(e===this._regionIdx&&s!=="init")&&(this._regionIdx=e,this._panX=0,this._selectedId=null,this._rebuildPosCache(),s==="fade"?this._canvas&&(this._canvas.style.transition=`opacity ${ee}ms`,this._canvas.style.opacity="0",setTimeout(()=>{this._canvas&&(this._canvas.style.opacity="1",this._renderMap())},ee)):this._renderMap(),this._refreshTabs(),this._refreshDots(),this._renderDrawer(null)))}_handleTap(e){if(!this._graph)return;const s=this._canvas.getBoundingClientRect(),t=e.clientX-s.left+this._panX,r=e.clientY-s.top,i=this._graph.subRegions[this._regionIdx];if(!i)return;let a=null;for(const o of i.nodeIds){const l=this._nodePosCache[o];if(l&&Te(t,r,l.x,l.y)){a=o;break}}a?(this._selectedId=a,this._renderDrawer(a)):(this._selectedId=null,this._renderDrawer(null))}_onDrawerPointerDown(e){this._drawerDragStart={y:e.clientY,expanded:this._drawerExpanded},this._el.querySelector("#sms-drawer");const s=i=>{const a=this._drawerDragStart.y-i.clientY;a>30&&!this._drawerExpanded?(this._setDrawerExpanded(!0),r()):a<-30&&this._drawerExpanded&&(this._setDrawerExpanded(!1),r())},t=()=>r(),r=()=>{window.removeEventListener("pointermove",s),window.removeEventListener("pointerup",t)};window.addEventListener("pointermove",s),window.addEventListener("pointerup",t)}_setDrawerExpanded(e){var t;this._drawerExpanded=e;const s=(t=this._el)==null?void 0:t.querySelector("#sms-drawer");s&&(e?s.classList.add("expanded"):s.classList.remove("expanded"))}_renderDrawer(e){var h,p,d,u;const s=(h=this._el)==null?void 0:h.querySelector("#sms-drawer-body");if(!s)return;if(!e||!this._graph){s.innerHTML='<div class="sms-drawer-empty">Tap a node to explore</div>',this._setDrawerExpanded(!1);return}const t=this._graph.nodes[e],r=((p=this._graph.nodeSave)==null?void 0:p[e])||{};if(!t){s.innerHTML='<div class="sms-drawer-empty">Unknown node</div>';return}const i=t.type.charAt(0).toUpperCase()+t.type.slice(1),a=t.biome.replace(/_/g," "),o=r.state||"unexplored",l=r.waypointState;s.innerHTML=`
      <div class="sms-drawer-node-name">${i} · ${a}</div>
      <div class="sms-drawer-node-meta">
        <span class="sms-drawer-badge">${o}</span>
        ${t.type==="boss"?'<span class="sms-drawer-badge">BOSS</span>':""}
        ${l?`<span class="sms-drawer-badge">Waypoint: ${l}</span>`:""}
        ${e===this._recommendedNodeId?'<span class="sms-drawer-badge" style="background:rgba(72,209,204,0.25);color:#7fe;">Storyteller’s path</span>':""}
      </div>
      <div class="sms-drawer-btns">
        <button type="button" class="sms-drawer-btn" id="sms-travel-btn">Travel</button>
        ${l==="activated"?'<button type="button" class="sms-drawer-btn secondary" id="sms-ft-btn">Fast Travel</button>':""}
      </div>
      ${this._drawerExpanded?`<div class="sms-drawer-detail">Region: ${a} · Node: ${e}</div>`:""}
    `,(d=s.querySelector("#sms-travel-btn"))==null||d.addEventListener("click",()=>{var c,m;(m=(c=this.audio)==null?void 0:c.playSfx)==null||m.call(c,"click"),this._resolveNodeTravel(e)}),(u=s.querySelector("#sms-ft-btn"))==null||u.addEventListener("click",()=>{var c,m;(m=(c=this.audio)==null?void 0:c.playSfx)==null||m.call(c,"click"),this._fastTravelTo(e)})}_fastTravelTo(e){var l,h,p;if(!this._graph||!e)return;const s=E.get();if(!s.story)return;const t=this._graph.nodes[e];if(!t)return;const r=s.story.currentMapId,i=(p=(h=(l=s.story.maps)==null?void 0:l[r])==null?void 0:h.nodes)==null?void 0:p[e];if(!i||i.waypointState!=="activated"){this._showToast("This waypoint is not yet activated.");return}s.story.currentNodeId=e;const a=this._graph.subRegions.findIndex(d=>d.nodeIds.includes(e));a>=0&&a!==this._regionIdx?this._goToRegion(a,"fade"):(this._rebuildPosCache(),this._renderMap());const o=this._nodePosCache[e];o&&(this._panX=Math.max(0,o.x-this._canvasW/2)),this._renderDrawer(null),this._showToast(`Fast traveled to ${t.type==="trailhead"?"Trailhead":t.biome.replace(/_/g," ")}.`),S(()=>import("./play-CctEuBOF.js").then(d=>d.au),__vite__mapDeps([0,1,2])).then(d=>{d.SaveManager.saveCurrentGame(s.currentSaveKey)}).catch(()=>{})}_checkDeathRespawn(){var i,a;const e=E.get();if(!e.story||!e.party||!e.party.every(o=>o.alive===!1||o.hp!=null&&o.hp<=0))return;const t=e.story.lastWaypointId||((i=this._graph)==null?void 0:i.entryNodeId);if(!t)return;for(const o of e.party)o.alive=!0,o.hp=Math.max(1,Math.floor((o.maxHp||10)*.25));e.story.currentNodeId=t,this._showToast("Party defeated — respawned at last waypoint.");const r=(a=this._graph)==null?void 0:a.subRegions.findIndex(o=>o.nodeIds.includes(t));r>=0&&r!==this._regionIdx&&this._goToRegion(r,"fade")}_resolveNodeTravel(e){var o,l,h,p,d,u,c,m,g,y,b,w,x,D,I,L,P,H,B,$,q;if(!this._graph||!e)return;const s=this._graph.nodes[e];if(!s)return;const t=E.get();if(!t.story)return;t.story.currentNodeId=e;const r=t.story.currentMapId;if(r&&((h=(l=(o=t.story.maps)==null?void 0:o[r])==null?void 0:l.nodes)!=null&&h[e])){t.story.maps[r].nodes[e].state="visited";const _=((p=this._graph.indexes)==null?void 0:p.outgoing)||{};for(const v of _[e]||[])if(v.kind==="open"&&((u=(d=t.story.maps[r])==null?void 0:d.nodes)!=null&&u[v.to])){const f=t.story.maps[r].nodes[v.to];f.visibility==="hidden"&&(f.visibility="visible")}}if(typeof t.story.pressureMeter=="number"){const _=s.type==="rest"?-10:5;t.story.pressureMeter=Math.max(0,Math.min(100,t.story.pressureMeter+_))}if(t.story.recentHistoryCount=(t.story.recentHistoryCount||0)+1,(!t.story.recentHistory||typeof t.story.recentHistory!="object"||Array.isArray(t.story.recentHistory))&&(t.story.recentHistory={nodeTypes:[],enemyFamilies:[],skillLabels:[],rewardTypes:[],biomes:[],tones:[],sameTypeStreak:0,lastType:null}),Array.isArray(t.story.recentHistory.nodeTypes)||(t.story.recentHistory.nodeTypes=[]),t.story.recentHistory.nodeTypes.push(s.type),t.story.recentHistory.nodeTypes.length>20&&t.story.recentHistory.nodeTypes.shift(),t.story.recentHistory.lastType=s.type,((c=s.tags)==null?void 0:c.includes("waypoint"))||s.type==="trailhead"||s.type==="town"){t.story.lastWaypointId=e;const _=(y=(g=(m=t.story.maps)==null?void 0:m[r])==null?void 0:g.nodes)==null?void 0:y[e];_&&(!_.waypointState||_.waypointState==="unexplored"||_.waypointState==="discovered")&&(_.waypointState="activated")}this._rebuildVisibilityCache();const a=s.type;if(a==="trailhead"){const _=((w=(b=this._graph.subRegions)==null?void 0:b[0])==null?void 0:w.name)||"Emberveil",v=(x=this._el)==null?void 0:x.querySelector("#sms-drawer-body");v&&(v.innerHTML=`
          <div class="sms-drawer-node-name">Trailhead &mdash; ${_}</div>
          <div class="sms-drawer-node-meta"><span class="sms-drawer-badge">Waypoint</span><span class="sms-drawer-badge activated">Activated</span></div>
          <div class="sms-drawer-btns">
            <button type="button" class="sms-drawer-btn" id="sms-trailhead-continue">Continue</button>
          </div>
        `,(D=v.querySelector("#sms-trailhead-continue"))==null||D.addEventListener("click",()=>{this._renderDrawer(null),this._setDrawerExpanded(!1)}));const f=t.story.currentMapId;f&&((P=(L=(I=t.story.maps)==null?void 0:I[f])==null?void 0:L.nodes)!=null&&P[e])&&(t.story.maps[f].nodes[e].waypointState="activated",((H=t.story.maps[e])==null?void 0:H.state)!=="visited"&&(t.story.maps[f].nodes[e].state="visited")),t.story.lastWaypointId=e;return}if(a==="town"){t.story&&(t.story.townTier=t.story.act||1),this._afterNodeResolved(t,e),t.story.lastWaypointId=e;const _=t.story.currentMapId;_&&((q=($=(B=t.story.maps)==null?void 0:B[_])==null?void 0:$.nodes)!=null&&q[e])&&(t.story.maps[_].nodes[e].waypointState="activated"),S(async()=>{const{TownScreen:v}=await import("./play-CctEuBOF.js").then(f=>f.aA);return{TownScreen:v}},__vite__mapDeps([0,1,2])).then(({TownScreen:v})=>{var T;const f=((T=t.party)==null?void 0:T[0])||null;this.manager.push(new v(this.manager,this.audio,f,!1))}).catch(()=>{this._showToast("Town services unavailable — returning to map."),this._renderDrawer(null)});return}if(a==="rest"){if(t.party)for(const _ of t.party)_.alive!==!1&&(_.hp=_.maxHp??_.hp,typeof _.mp=="number"&&(_.mp=_.maxMp??_.mp));this._afterNodeResolved(t,e),this._showToast(`Rested at ${s.biome.replace(/_/g," ")} — party fully restored.`),this._renderDrawer(null);return}if(a==="combat"||a==="elite"||a==="boss"){S(async()=>{const{buildEncounterForNode:_}=await import("./storyEncounterBuilder-CqeAOLz-.js");return{buildEncounterForNode:_}},__vite__mapDeps([7,0,1,2,8])).then(({buildEncounterForNode:_})=>{const v=_(t,e);if(!v){this._showToast(`Travelled through ${s.biome.replace(/_/g," ")}.`),this._afterNodeResolved(t,e),this._renderDrawer(null);return}S(async()=>{const{CombatScreen:f}=await import("./play-CctEuBOF.js").then(T=>T.ay);return{CombatScreen:f}},__vite__mapDeps([0,1,2])).then(({CombatScreen:f})=>{const T=new f(this.manager,this.audio,null,v),k=this.onResume.bind(this);this.onResume=()=>{this.onResume=k,this._afterNodeResolved(t,e),this._checkDeathRespawn(),this._rebuildVisibilityCache(),this._renderMap(),this._refreshTabs(),k()},this.manager.push(T)}).catch(()=>{this._showToast(`Travelled through ${s.biome.replace(/_/g," ")}.`),this._afterNodeResolved(t,e),this._renderDrawer(null)})}).catch(()=>{this._showToast(`Travelled through ${s.biome.replace(/_/g," ")}.`),this._afterNodeResolved(t,e),this._renderDrawer(null)});return}if(a==="dialog"||a==="event"||a==="shrine"||a==="lore"||a==="merchant"){const v={dialog:"arrival",event:"ambush",shrine:"shrine",lore:"lore",merchant:"merchant"}[a]||a;S(async()=>{const{loadDialoguePool:f}=await import("./storyContent-JGlG7UiG.js");return{loadDialoguePool:f}},[]).then(({loadDialoguePool:f})=>{const T=f(v),k=R=>{const W=Array.isArray(R)?R:(R==null?void 0:R.nodes)||[],se=t.story.act||1,V=W.filter(M=>(!M.biome||M.biome===s.biome)&&(!M.act||M.act===se)),X=V.length?V:W,z=X[Math.floor(Math.random()*X.length)];if(!z){this._showToast(`Travelled through ${s.biome.replace(/_/g," ")}.`),this._afterNodeResolved(t,e),this._renderDrawer(null);return}S(async()=>{const{StoryDialogScreen:M}=await import("./StoryDialogScreen-CdRCjxfs.js");return{StoryDialogScreen:M}},__vite__mapDeps([9,0,1,2,10,11,12])).then(({StoryDialogScreen:M})=>{const re=new M(this.manager,this.audio,z,()=>{this._afterNodeResolved(t,e),this._rebuildVisibilityCache(),this._renderMap(),this._renderDrawer(null)},{poolId:v,nodeId:e});this.manager.push(re)}).catch(()=>{this._showToast(`Travelled through ${s.biome.replace(/_/g," ")}.`),this._afterNodeResolved(t,e),this._renderDrawer(null)})};T&&typeof T.then=="function"?T.then(k).catch(()=>{this._showToast(`Travelled through ${s.biome.replace(/_/g," ")}.`),this._afterNodeResolved(t,e),this._renderDrawer(null)}):k(T)}).catch(()=>{this._showToast(`Travelled through ${s.biome.replace(/_/g," ")}.`),this._afterNodeResolved(t,e),this._renderDrawer(null)});return}this._showToast(`Travelled through ${s.biome.replace(/_/g," ")}.`),this._afterNodeResolved(t,e),this._renderDrawer(null)}_afterNodeResolved(e,s){S(async()=>{const{storyMode:t}=await import("./storyMode-C53fEJsR.js").then(r=>r.b);return{storyMode:t}},__vite__mapDeps([10,0,1,2,11,12])).then(({storyMode:t})=>{t.afterNodeResolved(e,s)}).catch(()=>{}),this._computeDirectorRecommendation(),S(()=>import("./play-CctEuBOF.js").then(t=>t.au),__vite__mapDeps([0,1,2])).then(t=>{t.SaveManager.saveCurrentGame(e.currentSaveKey)}).catch(()=>{})}_computeDirectorRecommendation(){var e,s,t;try{const r=E.get();if(!(r!=null&&r.story)||!this._graph){this._recommendedNodeId=null;return}const i=r.story.currentNodeId;if(!i){this._recommendedNodeId=null;return}let a=null;try{a=ce(r)}catch{a=null}r.story._lastDirectorIntent=a;const o=(a==null?void 0:a._profile)||F(r.story.storytellerId)||F("chronicler"),l=(a==null?void 0:a._band)||he(r),p=(((e=this._graph.indexes)==null?void 0:e.outgoing)||{})[i]||[],d=new Set(Object.entries(this._graph.nodeSave||{}).filter(([,m])=>m.state==="visited"||m.state==="cleared").map(([m])=>m));let u=null,c=-1/0;for(const m of p){const g=m.to,y=this._graph.nodes[g];if(!y)continue;const b=((s=this._graph.nodeSave)==null?void 0:s[g])||{};if((((t=this._visibilityCache)==null?void 0:t.get(g))??b.visibility??"visible")==="hidden")continue;const x=pe(y,g,d,o,{intent:a,band:l});x>c&&(c=x,u=g)}this._recommendedNodeId=u,this._canvas&&this._renderMap()}catch{this._recommendedNodeId=null}}_togglePressureChip(){var r;const e=(r=this._el)==null?void 0:r.querySelector("#sms-pressure-chip");if(!e)return;const s=e.classList.contains("expanded-chip");e.classList.toggle("expanded-chip",!s);const t=e.querySelector("#sms-chip-expanded");t&&t.setAttribute("aria-hidden",s?"true":"false"),this._refreshPressureChip()}_refreshPressureChip(){var h,p,d,u,c;const e=E.get(),s=(h=this._el)==null?void 0:h.querySelector("#sms-pressure-label"),t=(p=this._el)==null?void 0:p.querySelector("#sms-pips"),r=(d=this._el)==null?void 0:d.querySelector("#sms-band-label"),i=(u=this._el)==null?void 0:u.querySelector("#sms-chip-history");if(!e.story)return;const a=e.story.storytellerId||"chronicler",o=e.story.pressureMeter||e.story.pressure||0,l=o<25?"Calm":o<50?"Tense":o<75?"Urgent":"Crisis";if(s){const m={chronicler:"The Chronicler",ash_prophet:"The Ash Prophet",warbringer:"The Warbringer",trickster:"The Trickster",pilgrim:"The Pilgrim",iron_judge:"The Iron Judge"};s.textContent=m[a]||a}if(t){const m=Math.min(5,Math.round(o/20));t.querySelectorAll(".sms-pip").forEach((g,y)=>g.classList.toggle("active",y<m))}if(r&&(r.textContent=l),i){const m={combat:"⚔",elite:"☠",boss:"♛",dialog:"❁",shrine:"✶",lore:"℘",merchant:"◎",rest:"☽",event:"✵",trailhead:"⚑",town:"⌂"},y=(Array.isArray(e.story.recentHistory)?e.story.recentHistory:((c=e.story.recentHistory)==null?void 0:c.nodeTypes)||[]).slice(-5);i.innerHTML=y.map(b=>{const w=m[b]||"?";return`<span class="sms-chip-hist-glyph" title="${b}">${w}</span>`}).join("")}}_showToast(e){try{S(()=>import("./play-CctEuBOF.js").then(t=>t.av),__vite__mapDeps([0,1,2])).then(t=>t.showToast(e,{duration:3e3})).catch(()=>{})}catch{}const s=document.createElement("div");if(s.className="sms-toast-msg",s.textContent=e,s.setAttribute("role","status"),!document.querySelector("#sms-toast-styles")){const t=document.createElement("style");t.id="sms-toast-styles",t.textContent=".sms-toast-msg{position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:rgba(20,12,28,0.95);color:#e8c070;font-size:14px;padding:10px 18px;border-radius:8px;border:1px solid rgba(232,160,32,0.3);pointer-events:none;z-index:9999;animation:sms-fadein 0.2s ease}@keyframes sms-fadein{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}",document.head.appendChild(t)}document.body.appendChild(s),setTimeout(()=>s.remove(),2800)}_regionContentWidth(){if(!this._graph)return this._canvasW;const e=this._graph.subRegions[this._regionIdx];return e?(Math.max(...e.nodeIds.map(t=>{var r;return((r=this._graph.nodes[t])==null?void 0:r.col)||0}))+2)*N+N:this._canvasW}_rebuildPosCache(){if(this._nodePosCache={},!this._graph)return;const e=this._graph.subRegions[this._regionIdx];if(!e)return;const s=this._canvasH||484;for(const t of e.nodeIds){const r=this._graph.nodes[t];r&&(this._nodePosCache[t]=ve(r,this._canvasW,s))}}_startLoop(){if(this._raf)return;let e=performance.now();const s=t=>{this._raf=requestAnimationFrame(s);const r=Math.min((t-e)/1e3,.05);e=t,this._t+=r,this._renderMap()};this._raf=requestAnimationFrame(s)}_stopLoop(){this._raf&&(cancelAnimationFrame(this._raf),this._raf=null)}_renderMap(){var d,u;const e=this._ctx;if(!e||!this._graph)return;const s=this._canvasW,t=this._canvasH,r=performance.now();e.clearRect(0,0,s,t);const i=this._graph.subRegions[this._regionIdx],a=(i==null?void 0:i.biome)||"emberwood",o=((d=this._biomeData)==null?void 0:d[a])||null,l=this._getBiomePalette(a);if(o&&typeof Y=="function")Y(e,o,s,t,this._t,()=>{});else{const c=e.createLinearGradient(0,0,0,t);c.addColorStop(0,l[0]),c.addColorStop(.4,l[1]),c.addColorStop(1,l[0]),e.fillStyle=c,e.fillRect(0,0,s,t)}if(this._drawParchmentTexture(e,s,t,l),!i)return;const h=this._lastFrameMs<12;this._updateEmbers(s,t,h),h&&this._drawEmbers(e),e.save(),e.translate(-this._panX,0),this._drawEdges(e,i,s,t),this._drawStitchArrows(e,i,s,t);const p=this._visibilityCache;for(const c of i.nodeIds){const m=this._graph.nodes[c],g=this._nodePosCache[c];if(!m||!g)continue;const y=p?p.get(c):null,b=((u=this._graph.nodeSave)==null?void 0:u[c])||{},w=y??b.visibility??"visible";if(w==="hidden")continue;const x={state:b.state||"unexplored",visibility:w,waypointState:b.waypointState||null,overlay:b.overlay||null,selected:c===this._selectedId,hovered:!1,recommended:c===this._recommendedNodeId};we(e,g.x,g.y,m.type,x)}e.restore(),this._drawRegionLabel(e,s,i,a,l),this._drawVignette(e,s,t),this._lastFrameMs=performance.now()-r}_getBiomePalette(e){var s,t;if((t=(s=this._biomeData)==null?void 0:s[e])!=null&&t.palette){const r=this._biomeData[e].palette;return[r[0]||"#1a1210",r[1]||"#3a2a18",r[2]||"#786040",r[3]||"#d0b070"]}return te[e]||te._default}_drawParchmentTexture(e,s,t,r){e.save(),e.globalAlpha=.04,e.strokeStyle=r[2],e.lineWidth=.5;const i=18;for(let a=0;a<s;a+=i)e.beginPath(),e.moveTo(a,0),e.lineTo(a,t),e.stroke();for(let a=0;a<t;a+=i)e.beginPath(),e.moveTo(0,a),e.lineTo(s,a),e.stroke();e.restore()}_drawRegionLabel(e,s,t,r,i){const a=(t==null?void 0:t.name)||r.replace(/_/g," ").replace(/\b\w/g,o=>o.toUpperCase());e.save(),e.globalAlpha=.35,e.font="700 13px Cinzel, serif",e.fillStyle=i[3],e.textAlign="center",e.textBaseline="top",e.fillText(a.toUpperCase(),s/2,6),e.restore()}_drawVignette(e,s,t){e.save();const r=e.createRadialGradient(s/2,t/2,t*.3,s/2,t/2,t*.75);r.addColorStop(0,"rgba(0,0,0,0)"),r.addColorStop(1,"rgba(0,0,0,0.55)"),e.fillStyle=r,e.fillRect(0,0,s,t),e.restore()}_initEmbers(e,s){this._embers=[];const t=18;for(let r=0;r<t;r++)this._embers.push(this._spawnEmber(e,s,!0))}_spawnEmber(e,s,t=!1){return{x:Math.random()*e,y:t?Math.random()*s:s+4,vx:(Math.random()-.5)*.3,vy:-(.2+Math.random()*.4),alpha:.04+Math.random()*.1,r:1+Math.random()*1.5,life:1}}_updateEmbers(e,s,t){if(t){this._embers.length||this._initEmbers(e,s);for(let r=this._embers.length-1;r>=0;r--){const i=this._embers[r];i.x+=i.vx,i.y+=i.vy,i.alpha-=3e-4,(i.y<-4||i.alpha<=0)&&(this._embers[r]=this._spawnEmber(e,s))}}}_drawEmbers(e){e.save();for(const s of this._embers)e.globalAlpha=s.alpha,e.fillStyle="#f0a030",e.beginPath(),e.arc(s.x,s.y,s.r,0,Math.PI*2),e.fill();e.restore()}_drawEdges(e,s,t,r){var l;const i=((l=this._graph.indexes)==null?void 0:l.outgoing)||{},a=new Set(s.nodeIds),o=this._visibilityCache;for(const h of s.nodeIds){if((o?o.get(h):"visible")==="hidden")continue;const d=i[h]||[],u=this._nodePosCache[h];if(u)for(const c of d){if(!a.has(c.to))continue;const m=o?o.get(c.to):"visible";if(!m||m==="hidden")continue;const g=this._nodePosCache[c.to];if(!g)continue;const y=c.kind==="hidden"||c.kind==="blocked"?m==="revealed"?"hidden":"blocked":c.kind;Z(e,u.x,u.y,g.x,g.y,y,this._t)}}}_drawStitchArrows(e,s,t,r){var l;const i=((l=this._graph.indexes)==null?void 0:l.outgoing)||{},a=this._graph.subRegions,o=new Set(s.nodeIds);if(this._regionIdx<a.length-1){const h=Math.max(...s.nodeIds.map(p=>{var d;return((d=this._graph.nodes[p])==null?void 0:d.col)||0}));for(const p of s.nodeIds){const d=this._graph.nodes[p];if(((d==null?void 0:d.col)||0)<h)continue;const u=this._nodePosCache[p];if(!u||!(i[p]||[]).some(b=>!o.has(b.to)))continue;const g=t-this._panX+24;Z(e,u.x,u.y,g,u.y,"stitch",this._t);const y=t-this._panX+4;e.save(),e.fillStyle="rgba(232,192,96,0.8)",e.beginPath(),e.moveTo(y,u.y-8),e.lineTo(y+10,u.y),e.lineTo(y,u.y+8),e.closePath(),e.fill(),e.restore()}}}}export{De as StoryMapScreen};
