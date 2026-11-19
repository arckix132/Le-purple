import {card,cardBack,icon,logoMark,escape as esc} from './cards.mjs';
import {colorsLeft} from './game.mjs';
import {awards} from './records.mjs';

export const remaining=g=>g.cardsLeft??g.deck?.length??0;
const plural=(n,one,many=one+'s')=>`${n} ${n>1?many:one}`;
const seedOf=id=>[...String(id||'')].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);
const pick=(list,id)=>list[seedOf(id)%list.length];
export const avatar=(game,p,cls='')=>`<span class="avatar av-${Math.max(0,game.players.findIndex(q=>q.id===p.id))%8} ${cls}" aria-hidden="true">${esc([...p.name][0]?.toUpperCase()||'?')}</span>`;

// Only simple quantities are added up. Anything custom keeps its own wording.
export function summarizePenalties(values=[]){
 const groups=new Map(),units={pompe:['pompe','pompes'],gorgee:['gorgée','gorgées'],squat:['squat','squats'],abdo:['abdo','abdos']};
 for(const value of values){
  const label=value.trim(),match=label.match(/^(?:(?:faire|boire|prendre|effectuer)\s+)?(\d+)\s+([\p{L}-]+)$/iu);
  const unit=match?.[2].toLocaleLowerCase('fr'),plain=unit?.normalize('NFD').replace(/[̀-ͯ]/g,''),canonical=plain?.replace(/s$/,''),known=Object.hasOwn(units,canonical)?units[canonical]:null;
  const amount=match?Number(match[1]):null,numeric=Number.isSafeInteger(amount)&&amount>0;
  const key=numeric?'quantity:'+(known?canonical:unit):'text:'+label.toLocaleLowerCase('fr');
  if(!groups.has(key))groups.set(key,{label,amount:0,count:0,unit,known,numeric});
  const group=groups.get(key);group.count++;if(numeric)group.amount+=amount;
 }
 return [...groups.values()].map(g=>g.numeric?`${g.amount} ${g.known?g.known[g.amount===1?0:1]:g.unit}`:g.label+(g.count>1?` × ${g.count}`:''));
}

export function turnRecap(game){
 const player=game.players[game.current];if(!player)return '';
 const list=game.turnPenalties||[],items=summarizePenalties(list);
 if(!items.length)return `<div class="recap recap-clean"><strong>Tour parfait.</strong> Aucun défi pour ${esc(player.name)}.</div>`;
 return `<div class="recap"><div class="recap-head"><strong>À régler avant de passer</strong><span>${plural(list.length,'défi')}</span></div><ul>${items.map(label=>`<li>${esc(label)}</li>`).join('')}</ul><p>Déjà fait pendant le tour ? Alors c’est bon.</p></div>`;
}

const mini=(rank,suit,red)=>`<span class="mini-card ${red?'is-red':''}">${rank}<i>${suit}</i></span>`;
export const rulesMarkup=`
<div class="rules">
 <p class="rules-lead">Devine la couleur de la prochaine carte. Fais <b>3 points d’affilée</b> et tu passes la main. À la fin du paquet, celui qui a reçu <b>le moins de défis</b> gagne.</p>
 <div class="rules-bets">
  <div class="rules-bet bet-red"><div>${mini('7','♥',true)}</div><p><strong>Rouge</strong>1 carte, +1 point</p></div>
  <div class="rules-bet bet-black"><div>${mini('D','♠')}</div><p><strong>Noir</strong>1 carte, +1 point</p></div>
  <div class="rules-bet bet-purple"><div>${mini('4','♦',true)}${mini('V','♣')}</div><p><strong>Purple</strong>2 cartes, une rouge et une noire, +2 points</p></div>
 </div>
 <h3>Si tu te trompes</h3>
 <p>Ta série repart de zéro et tu prends un défi (deux si c’était un Purple). Tu le fais tout de suite ou à la fin de ton tour, puis tu retentes.</p>
 <h3>Le paquet</h3>
 <p>52 cartes, jamais remélangées. Le compteur sous la table montre combien de rouges et de noires il reste : à toi d’en profiter. Le Purple n’est plus possible quand il ne reste qu’une carte.</p>
 <h3>Raccourcis</h3>
 <p><kbd>R</kbd> rouge · <kbd>N</kbd> noir · <kbd>P</kbd> Purple · <kbd>Entrée</kbd> continuer</p>
</div>`;

export function roster(game,credentials){
 const max=Math.max(1,...game.players.map(p=>p.penalties));
 return `<section class="roster" aria-label="Défis de chaque joueur"><div class="side-head"><h2>Défis reçus</h2><span>${plural(game.players.length,'joueur')}</span></div><ol>${game.players.map((p,i)=>{const active=i===game.current&&!['ended','lobby'].includes(game.phase);return `<li class="${active?'is-active':''}">${avatar(game,p)}<div class="roster-name"><strong>${esc(p.name)}${credentials?.playerId===p.id?' <em>toi</em>':''}</strong><span class="roster-bar"><i style="width:${p.penalties/max*100}%"></i></span></div><b class="roster-count">${p.penalties}</b></li>`;}).join('')}</ol><p class="side-note">Le moins de défis gagne.</p></section>`;
}

function strip(game,credentials){
 return `<div class="strip" aria-label="Les joueurs">${game.players.map((p,i)=>`<div class="strip-player ${i===game.current?'is-active':''}" title="${esc(p.name)} : ${plural(p.penalties,'défi')}">${avatar(game,p)}<span class="strip-name">${esc(p.name)}${credentials?.playerId===p.id?'<em> · toi</em>':''}</span><b>${p.penalties}</b></div>`).join('')}</div>`;
}

function history(game){
 if(!game.history?.length)return '';
 return `<section class="history" aria-label="Derniers tirages"><div class="side-head"><h2>Derniers tirages</h2></div><ol>${game.history.slice(0,7).map(h=>`<li><span class="history-bet bet-${h.choice}">${h.choice==='red'?'R':h.choice==='black'?'N':'P'}</span><strong>${esc(h.name)}</strong><span class="history-cards">${h.cards.map(c=>`<i class="${c.color==='red'?'is-red':''}">${esc(c.rank)}${c.symbol}</i>`).join('')}</span><em class="${h.correct?'is-hit':'is-miss'}">${h.correct?'+'+h.points:plural(h.penalties,'défi')}</em></li>`).join('')}</ol></section>`;
}

function challengesList(game){
 return `<details class="side-challenges"><summary>${game.penaltyMode==='random'?'Défis tirés au hasard':'Les défis de la table'} · ${game.penalties.length}</summary><ul>${game.penalties.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></details>`;
}

function pile(left,tension){
 const layers=Math.min(10,Math.ceil(left/5));
 const shadow=Array.from({length:layers},(_,i)=>`0 ${(i+1)*2}px 0 ${i%2?'#2a0b55':'#e9dcc4'}`).join(',');
 return `<div class="pile ${left?'':'is-empty'}" aria-hidden="true">${left?`<div class="pile-stack" style="box-shadow:${shadow||'none'};--depth:${layers*2}px">${cardBack(tension?'tension':'')}</div>`:'<div class="pile-ghost"></div>'}<span class="pile-count">${left}</span></div>`;
}

function counter(game,left){
 const c=colorsLeft(game);if(!c||!left)return '';
 return `<div class="counter" aria-label="Dans le paquet : ${c.red} rouges et ${c.black} noires"><span class="counter-label is-red">${c.red} <small>rouges</small></span><div class="counter-bar"><i class="is-red" style="flex:${c.red}"></i><i style="flex:${c.black}"></i></div><span class="counter-label">${c.black} <small>noires</small></span></div>`;
}

export function odds(game){
 const c=colorsLeft(game),n=remaining(game);if(!c||!n)return null;
 const pct=x=>Math.round(x*100);
 return {red:pct(c.red/n),black:pct(c.black/n),purple:n>1?pct(2*c.red*c.black/(n*(n-1))):0};
}

function stamp(last,fresh,pass){
 if(!last)return '';
 const purple=last.choice==='purple';
 const [cls,text,sub]=last.correct?(purple?['is-purple','+2','Purple']:['is-hit','+'+last.points,pass?'Main passée':'']):['is-miss','Raté',purple?'2 défis':'1 défi'];
 return `<div class="stamp ${cls} ${fresh?'stamp-in':''}" aria-hidden="true"><strong>${text}</strong>${sub?`<small>${sub}</small>`:''}</div>`;
}

export function renderMenu({game,room,credentials,soundOn,farView,showCounter,fullscreenAvailable,fullscreenActive,installable}){
 const host=!room||room.hostId===credentials?.playerId;
 const item=(id,ic,label,extra='')=>`<button type="button" class="menu-item" id="${id}" ${extra}>${icon(ic)}<span>${label}</span></button>`;
 return `<div class="sheet-grab" aria-hidden="true"></div>
 <h2 class="sheet-title">${room?`Salon ${esc(room.code)}`:'La partie'}</h2>
 ${room?`<div class="menu-row">${item('copy-code','copy','Copier le code')}${item('share-room','share','Inviter')}</div>`:''}
 <div class="menu-group">
  ${item('game-rules','help','Les règles')}
  ${item('game-scores','people','Défis des joueurs')}
  ${item('game-sound',soundOn?'sound':'mute',soundOn?'Couper le son':'Remettre le son',`aria-pressed="${soundOn}"`)}
  ${item('toggle-counter','eye',showCounter?'Masquer le compteur de cartes':'Afficher le compteur de cartes',`aria-pressed="${showCounter}"`)}
  ${item('far-view','expand',farView?'Taille normale':'Grandes cartes (jeu à table)',`aria-pressed="${farView}"`)}
  ${fullscreenAvailable?item('game-fullscreen','fullscreen',fullscreenActive?'Quitter le plein écran':'Plein écran'):''}
 </div>
 <div class="menu-group">
  <button type="button" class="menu-item" data-social-open data-social-label="Amis et invitations">${icon('heart')}<span class="social-label">Amis et invitations</span></button>
  ${item('game-account','user','Mon compte')}
  ${installable?item('game-install','download','Installer l’appli'):''}
 </div>
 <div class="menu-group menu-danger">
  ${item('quit','door',room?'Quitter la table':'Arrêter la partie')}
  ${room&&host?item('end-game','flag','Terminer pour tout le monde'):''}
 </div>`;
}

const SUCCESS=['Bien vu.','Dans le mille.','Tu lis dans les cartes ?','Propre.','Ça rentre.','Joli coup.'];
const PURPLE=['Purple !','Purple, rien que ça.','Une rouge, une noire. Parfait.'];
const MISS=['Raté.','Aïe.','Pas cette fois.','La carte a dit non.','Presque.'];
const MISS_PURPLE=['Purple raté.','Deux cartes, deux défis.','Trop gourmand.'];

export function renderTable(view){
 let {game,room,credentials,busy,drawingChoice,flipFresh,stampFresh,reveal,showCounter,guide}=view;
 // Freeze every result-bearing element until both Purple cards are on the table.
 if(reveal){game=reveal.before;busy=true;drawingChoice='purple';}
 const me=credentials?.playerId,player=game.players[game.current],myTurn=!room||player.id===me,left=remaining(game),last=reveal?null:game.last;
 const pass=game.phase==='passed'||game.phase==='ended',fail=game.phase==='penalty',drawing=Boolean(drawingChoice)&&!reveal;
 const o=odds(game);
 let title,hint='';
 if(reveal){title=reveal.visible===1?'Et de une…':'Et la deuxième…';hint=reveal.visible===1?'Il faut maintenant l’autre couleur.':'';}
 else if(drawing)title=drawingChoice==='purple'?'Purple ? Voyons ça.':drawingChoice==='red'?'Rouge…':'Noir…';
 else if(!last){title=myTurn?'Rouge, noir ou Purple ?':`${player.name} réfléchit…`;hint=myTurn?'3 points d’affilée pour passer la main.':'';}
 else if(last.correct){title=last.choice==='purple'?pick(PURPLE,last.id):pick(SUCCESS,last.id);hint=pass?'Trois points. La main passe.':`Encore ${plural(Math.max(0,3-game.streak),'point')} pour passer la main.`;}
 else{title=last.choice==='purple'?pick(MISS_PURPLE,last.id):pick(MISS,last.id);hint='La série repart de zéro.';}

 const cards=reveal?reveal.last.cards.slice(0,reveal.visible).map((c,i)=>card(c,i===reveal.animateIndex,i?'second':'')).join(''):last&&!drawing?last.cards.map((c,i)=>card(c,flipFresh,i?'second':'')).join(''):'';
 const double=reveal||(!drawing&&last?.cards.length===2);
 const streakView=game.streak;
 const gained=stampFresh&&last?.correct?last.points:0;
 const pips=[1,2,3].map(n=>{const on=streakView>=n,pop=on&&n>streakView-gained;return `<span class="pip ${on?'is-on':''} ${pop?'pop':''}" style="--d:${(n-(streakView-gained))*90}ms">${on?icon('check'):''}</span>`;}).join('');

 let controls;
 if(fail&&!drawing)controls=`<div class="challenge ${stampFresh?'rise':''}"><div class="challenge-head"><span>${game.pending.length>1?'Deux défis':'Défi'} pour ${esc(player.name)}</span></div><ol>${game.pending.map(p=>`<li>${esc(p)}</li>`).join('')}</ol><p>${myTurn?'Maintenant, ou à la fin de ton tour.':'Maintenant, ou à la fin de son tour.'}</p></div><button class="big-btn" data-action="ack" data-primary ${!myTurn||busy?'disabled':''}>${myTurn?(left?'C’est noté, je continue':'Voir le classement'):`${esc(player.name)} reprend la main…`}${myTurn?icon('arrow'):''}</button>`;
 else if(pass&&!drawing)controls=`<div class="pass-banner ${stampFresh?'rise':''}">${icon('check')}<span><strong>${esc(player.name)} passe la main</strong>${game.phase==='ended'?'Fin du paquet.':'Place au suivant.'}</span></div>`;
 else{
  const dis=!myTurn||busy;
  const showOdds=showCounter&&o;
  controls=`<div class="choices ${myTurn?'':'is-waiting'}" role="group" aria-label="Choisir une couleur">
   <button class="choice choice-red ${drawingChoice==='red'?'is-chosen':''}" data-choice="red" aria-label="Rouge : une carte, un point" ${dis?'disabled':''}><span class="choice-suits" aria-hidden="true">♥♦</span><strong>Rouge</strong><small>+1${showOdds?` · ${o.red} %`:''}</small><kbd aria-hidden="true">R</kbd></button>
   <button class="choice choice-black ${drawingChoice==='black'?'is-chosen':''}" data-choice="black" aria-label="Noir : une carte, un point" ${dis?'disabled':''}><span class="choice-suits" aria-hidden="true">♠♣</span><strong>Noir</strong><small>+1${showOdds?` · ${o.black} %`:''}</small><kbd aria-hidden="true">N</kbd></button>
   <button class="choice choice-purple ${drawingChoice==='purple'?'is-chosen':''}" data-choice="purple" aria-label="Purple : deux cartes de couleurs différentes, deux points" ${dis||left<2?'disabled':''}><span class="choice-suits" aria-hidden="true"><i>♥</i><i>♠</i></span><strong>Purple</strong><small>${left<2?'Plus possible':`+2${showOdds?` · ${o.purple} %`:''}`}</small><kbd aria-hidden="true">P</kbd></button>
  </div>
  <p class="choice-note">${myTurn?'Raté : 1 défi. Purple raté : 2 défis.':`Tu regardes ${esc(player.name)} jouer.`}</p>`;
 }

 const top=`<header class="table-top"><button type="button" class="icon-btn" id="open-menu" aria-label="Menu de la partie" aria-haspopup="dialog">${icon('menu')}</button><div class="table-where">${logoMark()}<span>${room?`Salon <b>${esc(room.code)}</b>`:'le purple'}</span></div><button type="button" class="icon-btn" id="quick-sound" aria-pressed="${view.soundOn}" aria-label="${view.soundOn?'Couper le son':'Remettre le son'}">${icon(view.soundOn?'sound':'mute')}</button></header>`;
 const shake=stampFresh&&last&&!last.correct?'shake':'';
 const tip=guide&&myTurn&&!last&&!drawing?`<div class="tip"><p><b>Rouge ou noir</b> : +1. <b>Purple</b> : une rouge et une noire, +2. Trois points d’affilée et tu passes la main.</p><button type="button" class="tip-ok">Compris</button></div>`:'';

 return `<div class="game-layout"><section class="table ${fail?'is-penalty':''} ${pass?'is-passed':''} ${shake}" aria-label="Table de jeu">
 ${top}
 ${strip(game,credentials)}
 <div class="turn">
  ${avatar(game,player,'avatar-lg')}
  <div class="turn-name"><small>${myTurn?'À toi de jouer':'Au tour de'}</small><h1>${esc(player.name)}</h1></div>
  <div class="streak" aria-label="Série : ${streakView} sur 3"><div class="pips">${pips}</div><small>${streakView>=3?'Réussi':`${streakView}/3`}</small></div>
 </div>
 <div class="felt ${double?'is-double':''} ${cards?'':'is-empty'}">
  ${pile(reveal?remaining(reveal.before)-reveal.visible:left,drawing)}
  <div class="drawn">${cards||'<div class="slot" aria-hidden="true"><span>?</span></div>'}</div>
  ${!drawing?stamp(last,stampFresh,pass):''}
 </div>
 ${showCounter?counter(game,left):''}
 <div class="table-line" role="status" aria-live="polite"><strong>${esc(title)}</strong>${hint?`<span>${esc(hint)}</span>`:''}</div>
 ${tip}
 <div class="table-actions">${controls}</div>
 </section>
 <aside class="sidebar">${roster(game,credentials)}${history(game)}${challengesList(game)}</aside></div>`;
}

export function renderHandoff({game,room,credentials,busy}){
 const me=credentials?.playerId,player=game.players[game.current],next=game.players[(game.current+1)%game.players.length];
 const mine=!room||player.id===me,host=!room||room.hostId===me,nextIsMe=room&&next.id===me;
 const can=(mine||host)&&!busy;
 const label=!room?`C’est ${next.name}, je prends`:mine||host?`Passer la main à ${next.name}`:nextIsMe?`${player.name} te passe la main…`:`${player.name} passe la main…`;
 return `<section class="handoff" aria-label="Changement de joueur">
  <div class="handoff-done">${avatar(game,player)}<p><strong>${esc(player.name)}</strong> a fait ses 3 points.</p></div>
  ${turnRecap(game)}
  <div class="handoff-next">
   ${avatar(game,next,'avatar-xl')}
   <p>${room?(nextIsMe?'À toi de jouer !':'Au tour de'):'Passe le téléphone à'}</p>
   <h1>${esc(next.name)}</h1>
  </div>
  <button class="big-btn" data-action="next" data-primary ${can?'':'disabled'}>${esc(label)}${can?icon('arrow'):''}</button>
 </section>`;
}

export function renderLobby({game,room,credentials,busy}){
 const host=room.hostId===credentials.playerId,waiting=game.phase==='waiting';
 return `<section class="lobby">
  <div class="lobby-top"><button type="button" class="icon-btn" id="open-menu" aria-label="Menu" aria-haspopup="dialog">${icon('menu')}</button></div>
  <p class="kicker">${waiting?'Partie en pause':'Salon ouvert'}</p>
  <h1>${waiting?'Il manque quelqu’un.':game.players.length<2?'On attend tes amis.':'Tout le monde est là ?'}</h1>
  <p class="lobby-sub">${waiting?'Il faut au moins deux joueurs pour reprendre.':'Ils entrent ce code sur leur téléphone, ou ouvrent ton lien.'}</p>
  <button type="button" class="code-tiles" id="copy-code" aria-label="Copier le code ${esc(room.code)}">${[...room.code].map((c,i)=>`<span style="--i:${i}">${esc(c)}</span>`).join('')}</button>
  <div class="lobby-actions"><button class="ghost-btn" id="share-room" type="button">${icon('share')} Envoyer le lien</button><button type="button" class="ghost-btn" data-social-open data-social-label="Inviter des amis">Inviter des amis</button></div>
  <ul class="lobby-players">${game.players.map(p=>`<li>${avatar(game,p)}<span>${esc(p.name)}</span>${p.id===room.hostId?'<em>hôte</em>':''}${p.id===credentials.playerId?'<em>toi</em>':''}</li>`).join('')}${game.players.length<12?'<li class="is-empty"><span class="avatar avatar-ghost" aria-hidden="true">+</span><span>En attente…</span></li>':''}</ul>
  ${!waiting?`<button class="big-btn" data-action="start" data-primary ${!host||game.players.length<2||busy?'disabled':''}>${busy?'Un instant…':host?(game.players.length<2?'Il faut un deuxième joueur':`Lancer la partie à ${game.players.length}`):'L’hôte va lancer la partie'}${host&&game.players.length>=2?icon('arrow'):''}</button>`:''}
  <p class="footnote">Le salon reste ouvert 24 h.</p>
 </section>`;
}

export function renderSummary({game,room,credentials,busy,ranked,freshRecords=[]}){
 const host=!room||room.hostId===credentials?.playerId,played=Boolean(game.history?.length);
 const place=p=>ranked.findIndex(q=>q.penalties===p.penalties)+1;
 const leaders=ranked.filter(p=>p.penalties===ranked[0]?.penalties);
 const title=!played||!leaders.length?'Partie terminée.':leaders.length===1?`${esc(leaders[0].name)} gagne !`:leaders.length===ranked.length?'Égalité parfaite.':`${leaders.map(p=>esc(p.name)).join(' et ')}, ex æquo !`;
 const total=game.players.reduce((n,p)=>n+p.penalties,0);
 const podium=ranked.slice(0,3),order=podium.length===3?[1,0,2]:podium.length===2?[1,0]:[0];
 const titles=played?awards(game):[];
 return `<section class="summary">
  <p class="kicker">${game.endReason==='deck'?'Le paquet est vide':'Partie terminée'}</p>
  <h1>${title}</h1>
  <p class="summary-sub">Le moins de défis l’emporte.</p>
  ${played?`<div class="podium">${order.map(i=>{const p=podium[i];if(!p)return '';const n=place(p);return `<div class="podium-step step-${Math.min(n,3)}" style="--i:${i}">${n===1?`<span class="crown">${icon('crown')}</span>`:''}${avatar(game,p,'avatar-lg')}<strong>${esc(p.name)}</strong><span>${plural(p.penalties,'défi')}</span><div class="podium-block"><b>${n}</b></div></div>`;}).join('')}</div>`:''}
  ${ranked.length>3?`<ol class="rest" start="4">${ranked.slice(3).map(p=>`<li><b>${place(p)}</b>${avatar(game,p)}<span>${esc(p.name)}</span><em>${plural(p.penalties,'défi')}</em></li>`).join('')}</ol>`:''}
  ${freshRecords.length?`<div class="record-flash">${icon('trophy')}<p><strong>Nouveau record sur ce téléphone</strong>${freshRecords.map(esc).join(' · ')}</p></div>`:''}
  ${titles.length?`<div class="titles"><h2>Les titres de la partie</h2><div class="titles-grid">${titles.map((t,i)=>`<div class="title-card title-${t.key}" style="--i:${i}"><small>${t.title}</small><strong>${t.names.map(esc).join(', ')}</strong><span>${esc(t.detail)}</span></div>`).join('')}</div></div>`:''}
  <div class="summary-stats"><span><b>${52-remaining(game)}</b> cartes</span><span><b>${total}</b> défis</span><span><b>${game.players.reduce((n,p)=>n+p.turns,0)}</b> ${game.players.reduce((n,p)=>n+p.turns,0)>1?'mains passées':'main passée'}</span></div>
  ${game.turnPenalties?.length&&game.players[game.current]?turnRecap(game):''}
  <div class="summary-actions">
   ${host?`<button class="big-btn" data-action="rematch" data-primary ${busy||game.players.length<2?'disabled':''}>La revanche ${icon('refresh')}</button>`:'<p class="footnote">L’hôte peut relancer une partie avec la même table.</p>'}
   <div class="summary-row"><button class="ghost-btn" id="share-result" type="button">${icon('share')} Partager</button><button class="ghost-btn" id="new-game" type="button" ${busy?'disabled':''}>${room?'Quitter la table':'Nouveaux joueurs'}</button></div>
  </div>
 </section>`;
}

export function shareText(game,ranked){
 const lines=ranked.map((p,i)=>`${ranked.findIndex(q=>q.penalties===p.penalties)+1}. ${p.name} · ${plural(p.penalties,'défi')}`);
 return `Le Purple, partie terminée :\n${lines.join('\n')}`;
}
