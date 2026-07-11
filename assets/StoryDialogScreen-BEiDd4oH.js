import{E as M,ar as R,G as T,i as B}from"./play-B4Rs_XUc.js";import{e as A,r as O,a as Y,s as $}from"./storyMode-Ct4jEthF.js";import"./savesClient-Lt_9u8Ks.js";import"./storyContent-BFtFSCKH.js";import"./storyMapGen-gFk4dOw6.js";const z={STR:["str","strength"],DEX:["dex","dexterity","agility"],INT:["int","intelligence","magic","spell"],CON:["con","constitution","endurance"]};function D(t,e){if(!t)return 8;const n=z[e]||[];for(const r of n)if(typeof t[r]=="number")return t[r];const s=t[e.toLowerCase()];if(typeof s=="number")return s;if(t.stats){for(const r of n)if(typeof t.stats[r]=="number")return t.stats[r]}return 8}let _=null;function G(){var t,e,n;if(_)return _;try{if(typeof process<"u"&&((t=process.versions)!=null&&t.node)){const s=(e=globalThis.require)==null?void 0:e.call(globalThis,"fs"),r=(n=globalThis.require)==null?void 0:n.call(globalThis,"path");if(s&&r){const a=r.resolve(process.cwd(),"data/story/skill-affinities.json");_=JSON.parse(s.readFileSync(a,"utf8"))}}}catch{_=N}return _||N}function j(t,e){const s=G()[t==null?void 0:t.toLowerCase()];return s&&s[e==null?void 0:e.toLowerCase()]||0}function Q(t){let e=0;for(const n of t||[])if(typeof n.equipScore=="number")e+=n.equipScore;else if(n.equipped){const s=Object.values(n.equipped||{}).filter(Boolean).length;e+=s*2}return Math.floor(e/10)}function W(t){let e=2166136261;for(let n=0;n<t.length;n++)e^=t.charCodeAt(n),e=Math.imul(e,16777619)>>>0;return e>>>0}function K(t,e,n){var x,F,S,E,I;const{skill:s,stat:r="STR",dc:a=12,scaling:i}=e,o=n||((x=t.story)==null?void 0:x.currentNodeId)||"_default",l=(t.party||[]).find(L=>L.alive!==!1&&L.hp>0)||((F=t.party)==null?void 0:F[0])||{},f=D(l,r),C=l.level||1,v=Math.floor(C/4)+1,y=(l.class||l.className||"").toLowerCase(),m=j(y,s==null?void 0:s.toLowerCase()),g=(((S=t.story)==null?void 0:S.flags)||{})[`skillcheck_bonus_${s==null?void 0:s.toLowerCase()}`]?2:0,h=Q(t.party||[]),b=((((E=t.story)==null?void 0:E.rngState)||1)^W(o))>>>0||1,u=M(b);u();const p=1+Math.floor(u()*20);let d=0;i==="act_level"&&(d=(((I=t.story)==null?void 0:I.act)||1)*2);const c=f+v+m+g+h+p+d;return{pass:c>=a,partial:!(c>=a)&&c>=a-3,power:c,dc:a,breakdown:{statValue:f,levelBonus:v,classAffinityBonus:m,storyFlagBonus:g,gearUtility:h,randomRoll:p,scalingBonus:d}}}const N={warrior:{strength:2,intimidation:2,medicine:2},rogue:{stealth:2,mechanisms:2,deception:2},mage:{arcana:2,intelligence:2,occult:2},ranger:{nature:2,survival:2,perception:2},priest:{religion:2,medicine:2,wisdom:2},monk:{wisdom:2,dexterity:2,perception:2},shaman:{nature:2,occult:2,wisdom:2},witch_hunter:{occult:2,perception:2,intimidation:2},runesmith:{crafting:2,mechanisms:2,arcana:2},tinker:{mechanisms:2,crafting:2,perception:2}};function U(t,e){var r;const n=(t==null?void 0:t.choices)||[],s=[];for(const a of n){if(a.requires&&!A(a.requires,e))continue;let i=null;if(a.companionCondition&&A(a.companionCondition,e)){const o=a.companionCondition.companion,l=(e.companions||[]).find(f=>f.id===o);l&&l.id,i=o||"Companion",l&&((r=e.gs)!=null&&r.story)&&(i={lyra_ashwalker:"Lyra",orren_gravetide:"Orren",tessaly_veil:"Tessaly",bram_coldfire:"Bram",yasha_stonewill:"Yasha",captain_maer:"Maer"}[o]||o)}s.push({...a,_companionLabel:i})}return s}function H(t,e){if(t==null||typeof t!="string")return null;if(t.startsWith("pool:")){const s=t.slice(5),r=s.indexOf("#");return r<0?(console.warn("[storyDialogConductor] pool: ref missing #nodeId",t),null):{poolId:s.slice(0,r),nodeId:s.slice(r+1)}}const n=t.startsWith("#")?t.slice(1):t;return{poolId:e,nodeId:n}}function J(t,e,n,s,r){var y,m,k,g,h,w,b;const a=q(e),i=[];let o=null,l=a;if(e.skillCheck){o=K(t,e.skillCheck,r);const u=e.skillCheck,p=o.pass?"Pass":o.partial?"Partial":"Fail";i.push(`[${u.skill||u.stat} check ${p}: ${o.power} vs DC ${o.dc}]`);let d=[];o.pass&&((y=e.onPass)!=null&&y.effects)?d=e.onPass.effects:!o.pass&&o.partial&&((m=e.onPartial)!=null&&m.effects)?d=e.onPartial.effects:!o.pass&&((k=e.onFail)!=null&&k.effects)&&(d=e.onFail.effects);let c=a.next??a.nextNode??null;o.pass&&((g=e.onPass)==null?void 0:g.next)!==void 0?c=e.onPass.next:!o.pass&&o.partial&&((h=e.onPartial)==null?void 0:h.next)!==void 0?c=e.onPartial.next:!o.pass&&((w=e.onFail)==null?void 0:w.next)!==void 0&&(c=e.onFail.next),l={...a,effects:[...a.effects||[],...d],_resolvedNext:c}}if((b=l.effects)!=null&&b.length){for(const u of l.effects){const p=Z(u);p&&i.push(p)}O(l.effects,n,{currentNodeId:r})}const f=e.id||e.text||String(i.length);Y(t,r,f);const C=l._resolvedNext??e.next??e.nextNode??null;return{nextRef:H(C,s),effectFeedback:i,skillCheckResult:o}}function q(t){if(t.effects)return t;const e=[];if(t.effect){const n=t.effect;typeof n.gold=="number"&&e.push({type:"gold",amount:n.gold}),typeof n.startCombat=="string"&&e.push({type:"start_encounter",template:n.startCombat})}if(t.reward){const n=t.reward;typeof n.gold=="number"&&e.push({type:"gold",amount:n.gold}),typeof n.xp=="number"&&e.push({type:"inc_counter",counter:"_reward_xp",amount:n.xp}),n.item&&e.push({type:"reward_item",itemId:n.item}),typeof n.setFlag=="string"&&e.push({type:"set_flag",flag:n.setFlag})}return typeof t.setFlag=="string"&&e.push({type:"set_flag",flag:t.setFlag}),typeof t.outcome=="string"&&t.outcome==="fight"&&e.push({type:"start_encounter",template:"fight"}),{...t,effects:e}}const X={emberguard:"Emberguard",ash_cult:"Ash Cult",ancient_pact:"Ancient Pact",merchant_guild:"Merchant Guild",veil_wardens:"Veil Wardens",free_cities:"Free Cities"};function Z(t){switch(t.type){case"gold":return t.amount>0?`+${t.amount} Gold`:`${t.amount} Gold`;case"faction_delta":{const e=X[t.faction]||t.faction;return t.amount>0?`+${t.amount} ${e} reputation`:`${t.amount} ${e} reputation`}case"companion_approval":{const n={lyra_ashwalker:"Lyra",orren_gravetide:"Orren",tessaly_veil:"Tessaly",bram_coldfire:"Bram",yasha_stonewill:"Yasha",captain_maer:"Maer"}[t.companion]||t.companion;return t.amount>=0?`${n} approves`:`${n} disapproves`}case"recruit_companion":return"Recruited a companion";case"dismiss_companion":return"Companion dismissed";case"quest_advance":return"Quest updated";case"quest_complete":return"Quest complete";case"quest_fail":return"Quest failed";case"quest_log":return t.text||null;case"lore_unlock":return"Lore discovered";case"set_flag":return null;case"clear_flag":return null;case"reward_item":return"Item received";default:return null}}class ae extends R{constructor(e,n,s,r,a={}){super(e,n,s,r),this._poolId=a.poolId||"inline",this._storyNodeId=a.nodeId||s.id||"node",this._feedbackEl=null}_showChoices(){var s,r;const e=(r=(s=T).get)==null?void 0:r.call(s),n=e!=null&&e.story?$.buildCtx(e):null;if(n){const a=this._activeChoices(),i=U({choices:a},n);this._storyFilteredChoices=i}else this._storyFilteredChoices=null;super._showChoices()}_activeChoices(){return this._storyFilteredChoices!==null&&this._storyFilteredChoices!==void 0?this._storyFilteredChoices:super._activeChoices()}_selectChoice(e){var r,a;const n=this._activeChoices()[e];if(!n)return;const s=(a=(r=T).get)==null?void 0:a.call(r);if(s!=null&&s.story){const i=$.buildCtx(s);q(n);const{effectFeedback:o}=J(s,n,i,this._poolId,this._storyNodeId);o.length&&this._showEffectFeedback(o)}super._selectChoice(e)}_showEffectFeedback(e){if(this._feedbackEl&&(this._feedbackEl.remove(),this._feedbackEl=null),!e.length||!this._el)return;B("story-dialog-styles",V);const n=document.createElement("div");n.className="sdlg-feedback-panel sdlg-feedback-panel--hidden",n.setAttribute("aria-live","polite"),n.setAttribute("aria-label","Effect feedback"),n.innerHTML=e.map(r=>`<div class="sdlg-chip">${P(r)}</div>`).join("");const s=this._el.querySelector("#dlg-choices");s?s.before(n):this._el.appendChild(n),this._feedbackEl=n,requestAnimationFrame(()=>{n.classList.remove("sdlg-feedback-panel--hidden"),n.classList.add("sdlg-feedback-panel--visible")}),setTimeout(()=>{n.isConnected&&(n.classList.remove("sdlg-feedback-panel--visible"),n.classList.add("sdlg-feedback-panel--hidden"),setTimeout(()=>{n.isConnected&&n.remove()},220))},2500)}_choiceLabel(e){return`${e._companionLabel?`<span class="sdlg-companion-badge">${P(e._companionLabel)}</span>`:""}${e.text||""}`}onExit(){this._feedbackEl=null,super.onExit()}destroy(){this._feedbackEl=null,super.destroy()}}function P(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}const V=`
.sdlg-feedback-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  margin: 0 0.75rem 0.25rem;
  background: rgba(12, 8, 20, 0.88);
  border: 1px solid rgba(168, 120, 240, 0.3);
  border-radius: 8px;
  transform: translateY(8px);
  opacity: 0;
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
  pointer-events: none;
}
.sdlg-feedback-panel--visible {
  opacity: 1;
  transform: translateY(0);
}
.sdlg-feedback-panel--hidden {
  opacity: 0;
  transform: translateY(8px);
}
.sdlg-chip {
  font-size: 0.75rem;
  font-family: 'Cinzel', serif;
  color: #c8a0f0;
  background: rgba(120, 80, 200, 0.15);
  border: 1px solid rgba(120, 80, 200, 0.3);
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
  white-space: nowrap;
  letter-spacing: 0.04em;
}
.sdlg-companion-badge {
  display: inline-block;
  font-size: 0.65rem;
  font-weight: 700;
  font-family: 'Cinzel', serif;
  letter-spacing: 0.06em;
  color: #c8a0f0;
  background: rgba(120, 80, 200, 0.2);
  border: 1px solid rgba(120, 80, 200, 0.4);
  border-radius: 3px;
  padding: 0.08rem 0.35rem;
  margin-right: 0.4rem;
  vertical-align: middle;
  text-transform: uppercase;
}
@media (max-width: 420px) {
  .sdlg-chip { font-size: 0.7rem; }
  .sdlg-companion-badge { font-size: 0.6rem; }
}
`;export{ae as StoryDialogScreen};
