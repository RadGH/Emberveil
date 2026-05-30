import{as as T,k as I,E as M,aj as z}from"./play-QH26u79V.js";import{s as L,e as q,r as A,a as B}from"./storyMode-Ct4jEthF-BLk0DseA.js";import"./savesClient-Lt_9u8Ks-B0TWHWS2.js";import"./storyMapGen-gFk4dOw6-BqYBDncd.js";import"./storyContent-BFtFSCKH-oq7IT1Qo.js";const O={STR:["str","strength"],DEX:["dex","dexterity","agility"],INT:["int","intelligence","magic","spell"],CON:["con","constitution","endurance"]};function R(t,e){if(!t)return 8;const n=O[e]||[];for(const s of n)if(typeof t[s]=="number")return t[s];const o=t[e.toLowerCase()];if(typeof o=="number")return o;if(t.stats){for(const s of n)if(typeof t.stats[s]=="number")return t.stats[s]}return 8}let y=null;function j(){var t,e,n;if(y)return y;try{if(typeof process<"u"&&(t=process.versions)!=null&&t.node){const o=(e=globalThis.require)==null?void 0:e.call(globalThis,"fs"),s=(n=globalThis.require)==null?void 0:n.call(globalThis,"path");if(o&&s){const a=s.resolve(process.cwd(),"data/story/skill-affinities.json");y=JSON.parse(o.readFileSync(a,"utf8"))}}}catch{y=N}return y||N}function D(t,e){const n=j()[t==null?void 0:t.toLowerCase()];return n&&n[e==null?void 0:e.toLowerCase()]||0}function Q(t){let e=0;for(const n of t||[])if(typeof n.equipScore=="number")e+=n.equipScore;else if(n.equipped){const o=Object.values(n.equipped||{}).filter(Boolean).length;e+=o*2}return Math.floor(e/10)}function Y(t){let e=2166136261;for(let n=0;n<t.length;n++)e^=t.charCodeAt(n),e=Math.imul(e,16777619)>>>0;return e>>>0}function G(t,e,n){var o,s,a,i,l;const{skill:c,stat:_="STR",dc:u=12,scaling:v}=e,p=n||((o=t.story)==null?void 0:o.currentNodeId)||"_default",d=(t.party||[]).find(E=>E.alive!==!1&&E.hp>0)||((s=t.party)==null?void 0:s[0])||{},r=R(d,_),f=d.level||1,k=Math.floor(f/4)+1,x=(d.class||d.className||"").toLowerCase(),m=D(x,c==null?void 0:c.toLowerCase()),h=(((a=t.story)==null?void 0:a.flags)||{})[`skillcheck_bonus_${c==null?void 0:c.toLowerCase()}`]?2:0,g=Q(t.party||[]),b=((((i=t.story)==null?void 0:i.rngState)||1)^Y(p))>>>0||1,F=z(b);F();const $=1+Math.floor(F()*20);let w=0;v==="act_level"&&(w=(((l=t.story)==null?void 0:l.act)||1)*2);const C=r+k+m+h+g+$+w;return{pass:C>=u,partial:!(C>=u)&&C>=u-3,power:C,dc:u,breakdown:{statValue:r,levelBonus:k,classAffinityBonus:m,storyFlagBonus:h,gearUtility:g,randomRoll:$,scalingBonus:w}}}const N={warrior:{strength:2,intimidation:2,medicine:2},rogue:{stealth:2,mechanisms:2,deception:2},mage:{arcana:2,intelligence:2,occult:2},ranger:{nature:2,survival:2,perception:2},priest:{religion:2,medicine:2,wisdom:2},monk:{wisdom:2,dexterity:2,perception:2},shaman:{nature:2,occult:2,wisdom:2},witch_hunter:{occult:2,perception:2,intimidation:2},runesmith:{crafting:2,mechanisms:2,arcana:2},tinker:{mechanisms:2,crafting:2,perception:2}};function W(t,e){var n;const o=(t==null?void 0:t.choices)||[],s=[];for(const a of o){if(a.requires&&!q(a.requires,e))continue;let i=null;if(a.companionCondition&&q(a.companionCondition,e)){const l=a.companionCondition.companion,c=(e.companions||[]).find(_=>_.id===l);c&&c.id,i=l||"Companion",c&&(n=e.gs)!=null&&n.story&&(i={lyra_ashwalker:"Lyra",orren_gravetide:"Orren",tessaly_veil:"Tessaly",bram_coldfire:"Bram",yasha_stonewill:"Yasha",captain_maer:"Maer"}[l]||l)}s.push({...a,_companionLabel:i})}return s}function V(t,e){if(t==null||typeof t!="string")return null;if(t.startsWith("pool:")){const o=t.slice(5),s=o.indexOf("#");return s<0?(console.warn("[storyDialogConductor] pool: ref missing #nodeId",t),null):{poolId:o.slice(0,s),nodeId:o.slice(s+1)}}const n=t.startsWith("#")?t.slice(1):t;return{poolId:e,nodeId:n}}function H(t,e,n,o,s){var a,i,l,c,_,u,v;const p=P(e),d=[];let r=null,f=p;if(e.skillCheck){r=G(t,e.skillCheck,s);const m=e.skillCheck,h=r.pass?"Pass":r.partial?"Partial":"Fail";d.push(`[${m.skill||m.stat} check ${h}: ${r.power} vs DC ${r.dc}]`);let g=[];r.pass&&(a=e.onPass)!=null&&a.effects?g=e.onPass.effects:!r.pass&&r.partial&&(i=e.onPartial)!=null&&i.effects?g=e.onPartial.effects:!r.pass&&(l=e.onFail)!=null&&l.effects&&(g=e.onFail.effects);let b=p.next??p.nextNode??null;r.pass&&((c=e.onPass)==null?void 0:c.next)!==void 0?b=e.onPass.next:!r.pass&&r.partial&&((_=e.onPartial)==null?void 0:_.next)!==void 0?b=e.onPartial.next:!r.pass&&((u=e.onFail)==null?void 0:u.next)!==void 0&&(b=e.onFail.next),f={...p,effects:[...p.effects||[],...g],_resolvedNext:b}}if((v=f.effects)!=null&&v.length){for(const m of f.effects){const h=U(m);h&&d.push(h)}A(f.effects,n,{currentNodeId:s})}const k=e.id||e.text||String(d.length);B(t,s,k);const x=f._resolvedNext??e.next??e.nextNode??null;return{nextRef:V(x,o),effectFeedback:d,skillCheckResult:r}}function P(t){if(t.effects)return t;const e=[];if(t.effect){const n=t.effect;typeof n.gold=="number"&&e.push({type:"gold",amount:n.gold}),typeof n.startCombat=="string"&&e.push({type:"start_encounter",template:n.startCombat})}if(t.reward){const n=t.reward;typeof n.gold=="number"&&e.push({type:"gold",amount:n.gold}),typeof n.xp=="number"&&e.push({type:"inc_counter",counter:"_reward_xp",amount:n.xp}),n.item&&e.push({type:"reward_item",itemId:n.item}),typeof n.setFlag=="string"&&e.push({type:"set_flag",flag:n.setFlag})}return typeof t.setFlag=="string"&&e.push({type:"set_flag",flag:t.setFlag}),typeof t.outcome=="string"&&t.outcome==="fight"&&e.push({type:"start_encounter",template:"fight"}),{...t,effects:e}}const J={emberguard:"Emberguard",ash_cult:"Ash Cult",ancient_pact:"Ancient Pact",merchant_guild:"Merchant Guild",veil_wardens:"Veil Wardens",free_cities:"Free Cities"};function U(t){switch(t.type){case"gold":return t.amount>0?`+${t.amount} Gold`:`${t.amount} Gold`;case"faction_delta":{const e=J[t.faction]||t.faction;return t.amount>0?`+${t.amount} ${e} reputation`:`${t.amount} ${e} reputation`}case"companion_approval":{const e={lyra_ashwalker:"Lyra",orren_gravetide:"Orren",tessaly_veil:"Tessaly",bram_coldfire:"Bram",yasha_stonewill:"Yasha",captain_maer:"Maer"}[t.companion]||t.companion;return t.amount>=0?`${e} approves`:`${e} disapproves`}case"recruit_companion":return"Recruited a companion";case"dismiss_companion":return"Companion dismissed";case"quest_advance":return"Quest updated";case"quest_complete":return"Quest complete";case"quest_fail":return"Quest failed";case"quest_log":return t.text||null;case"lore_unlock":return"Lore discovered";case"set_flag":return null;case"clear_flag":return null;case"reward_item":return"Item received";default:return null}}class se extends T{constructor(e,n,o,s,a={}){super(e,n,o,s),this._poolId=a.poolId||"inline",this._storyNodeId=a.nodeId||o.id||"node",this._feedbackEl=null}_showChoices(){var e,n;const o=(n=(e=I).get)==null?void 0:n.call(e),s=o!=null&&o.story?L.buildCtx(o):null;if(s){const a=this._activeChoices(),i=W({choices:a},s);this._storyFilteredChoices=i}else this._storyFilteredChoices=null;super._showChoices()}_activeChoices(){return this._storyFilteredChoices!==null&&this._storyFilteredChoices!==void 0?this._storyFilteredChoices:super._activeChoices()}_selectChoice(e){var n,o;const s=this._activeChoices()[e];if(!s)return;const a=(o=(n=I).get)==null?void 0:o.call(n);if(a!=null&&a.story){const i=L.buildCtx(a);P(s);const{effectFeedback:l}=H(a,s,i,this._poolId,this._storyNodeId);l.length&&this._showEffectFeedback(l)}super._selectChoice(e)}_showEffectFeedback(e){if(this._feedbackEl&&(this._feedbackEl.remove(),this._feedbackEl=null),!e.length||!this._el)return;M("story-dialog-styles",X);const n=document.createElement("div");n.className="sdlg-feedback-panel sdlg-feedback-panel--hidden",n.setAttribute("aria-live","polite"),n.setAttribute("aria-label","Effect feedback"),n.innerHTML=e.map(s=>`<div class="sdlg-chip">${S(s)}</div>`).join("");const o=this._el.querySelector("#dlg-choices");o?o.before(n):this._el.appendChild(n),this._feedbackEl=n,requestAnimationFrame(()=>{n.classList.remove("sdlg-feedback-panel--hidden"),n.classList.add("sdlg-feedback-panel--visible")}),setTimeout(()=>{n.isConnected&&(n.classList.remove("sdlg-feedback-panel--visible"),n.classList.add("sdlg-feedback-panel--hidden"),setTimeout(()=>{n.isConnected&&n.remove()},220))},2500)}_choiceLabel(e){return`${e._companionLabel?`<span class="sdlg-companion-badge">${S(e._companionLabel)}</span>`:""}${e.text||""}`}onExit(){this._feedbackEl=null,super.onExit()}destroy(){this._feedbackEl=null,super.destroy()}}function S(t){return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}const X=`
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
`;export{se as StoryDialogScreen};
