export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ALCOHOL_CHALLENGE = 'Boire une gorgée d’alcool';
export const CHALLENGE_CATALOG = [
 'Faire 5 pompes','Faire 10 squats','Tenir la planche 20 secondes','Faire 5 abdos',
 'Chanter un refrain','Danser 15 secondes','Imiter un animal','Faire un compliment sincère',
 'Faire rire un autre joueur','Raconter une anecdote','Mimer un film à faire deviner',
 'Fredonner une chanson à faire deviner','Prendre un accent pendant un tour',
 'Parler sans dire « je » pendant un tour','Raconter une blague',
 'Faire la statue pendant 20 secondes','Improviser un discours de 20 secondes',
 'Laisser les autres choisir un surnom pour ce tour'
];
export class GameError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
export function randomInt(max) {
  if (!Number.isInteger(max) || max<1) throw new Error('Invalid random bound');
  const limit=Math.floor(4294967296/max)*max;
  const a=new Uint32Array(1); do { crypto.getRandomValues(a); } while(a[0]>=limit);
  return a[0]%max;
}
export function shuffle(values) { const result=[...values]; for(let i=result.length-1;i>0;i--){const j=randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}return result; }
export function makeDeck(){return shuffle(Array.from({length:52},(_,i)=>i));}
export function newRoomCode(){return Array.from({length:6},()=>ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join('');}
export function cardInfo(id){
 const suit=Math.floor(id/13),symbols=['♥','♦','♠','♣'],suits=['cœur','carreau','pique','trèfle'];
 return {id,rank:['A','2','3','4','5','6','7','8','9','10','V','D','R'][id%13],suit:suits[suit],symbol:symbols[suit],color:suit<2?'red':'black'};
}
export function cleanName(value){if(typeof value!=='string')throw new GameError('Entre un prénom.');const name=value.trim();if(!name||name.length>24)throw new GameError('Le prénom doit contenir de 1 à 24 caractères.');return name;}
export function cleanPenalties(values){if(!Array.isArray(values)||values.length<1||values.length>24||values.some(v=>typeof v!=='string'||!v.trim()||v.trim().length>120))throw new GameError('Choisissez de 1 à 24 défis de 120 caractères maximum.');return values.map(v=>v.trim());}
export function createGame(names,penalties,lobby=false,penaltyMode='custom'){
 if(!Array.isArray(names)||names.length<(lobby?1:2)||names.length>12)throw new GameError('La table accueille de 2 à 12 joueurs.');
 if(!['custom','random'].includes(penaltyMode))throw new GameError('Mode de défis inconnu.');
 return {format:1,phase:lobby?'lobby':'playing',players:names.map(name=>({id:crypto.randomUUID(),name:cleanName(name),score:0,penalties:0,turns:0})),penalties:cleanPenalties(penalties),penaltyMode,challengeBag:[],lastChallenge:null,current:0,streak:0,completedTurns:0,deck:lobby?[]:makeDeck(),last:null,pending:[],turnPenalties:[],history:[],endReason:null};
}
export function publicGame(game){const {deck,challengeBag,lastChallenge,...visible}=game;return structuredClone({...visible,cardsLeft:game.phase==='lobby'?52:deck.length});}
function nextRandomChallenge(game){
 if(!game.challengeBag?.length){
  game.challengeBag=shuffle(game.penalties);
  if(game.challengeBag.length>1&&game.challengeBag.at(-1)===game.lastChallenge){
   const replacement=game.challengeBag.findIndex(challenge=>challenge!==game.lastChallenge);
   [game.challengeBag[replacement],game.challengeBag[game.challengeBag.length-1]]=[game.challengeBag.at(-1),game.challengeBag[replacement]];
  }
 }
 game.lastChallenge=game.challengeBag.pop();return game.lastChallenge;
}
// Equal challenge counts share a place; points and turns never break a tie.
export function ranking(game){return [...game.players].sort((a,b)=>a.penalties-b.penalties);}
export function applyAction(original,action){
 const g=structuredClone(original);if(!action||typeof action.type!=='string')throw new GameError('Action inconnue.');
 // Older saves can at least retain their currently displayed challenge.
 if(!Array.isArray(g.turnPenalties)){g.turnPenalties=g.phase==='penalty'?[...g.pending]:[];g.turnRecapPartial=Boolean(g.history?.length);}
 if(action.type==='rematch'){
  if(g.phase!=='ended')throw new GameError('Termine la partie avant de lancer la revanche.',409);
  if(g.players.length<2)throw new GameError('Il faut au moins deux joueurs pour la revanche.');
  const next=createGame(g.players.map(p=>p.name),g.penalties,false,g.penaltyMode||'custom');
  next.players.forEach((p,i)=>{p.id=g.players[i].id;});
  return next;
 }
 if(action.type==='end'){if(g.phase==='ended')return g;g.phase='ended';g.endReason='manual';g.pending=[];return g;}
 if(action.type==='leave'){
  const index=g.players.findIndex(p=>p.id===action.playerId);if(index<0)throw new GameError('Joueur introuvable.');
  g.players.splice(index,1);
  if(!g.players.length){g.current=0;g.streak=0;g.last=null;g.pending=[];g.turnPenalties=[];g.phase='ended';g.endReason='players';return g;}
  if(index===g.current){g.current=index%g.players.length;g.streak=0;g.last=null;g.pending=[];g.turnPenalties=[];g.turnRecapPartial=false;if(g.phase!=='lobby'&&g.phase!=='ended')g.phase=g.deck.length?'playing':'ended';}
  else if(index<g.current)g.current--;
  if(g.players.length<2&&g.phase!=='lobby'&&g.phase!=='ended'){g.phase='waiting';g.streak=0;g.last=null;g.pending=[];}
  return g;
 }
 if(action.type==='start'){if(g.phase!=='lobby')throw new GameError('La partie a déjà commencé.',409);if(g.players.length<2)throw new GameError('Attends au moins un autre joueur.');g.phase='playing';g.deck=makeDeck();return g;}
 if(action.type==='ack'){if(g.phase!=='penalty')throw new GameError('Aucune pénalité à valider.',409);g.pending=[];g.phase=g.deck.length?'playing':'ended';if(g.phase==='ended')g.endReason='deck';return g;}
 if(action.type==='next'){if(g.phase!=='passed')throw new GameError('Le tour n’est pas terminé.',409);g.current=(g.current+1)%g.players.length;g.streak=0;g.last=null;g.pending=[];g.turnPenalties=[];g.turnRecapPartial=false;g.phase=g.deck.length?'playing':'ended';if(g.phase==='ended')g.endReason='deck';return g;}
 if(action.type!=='guess'||!['red','black','purple'].includes(action.choice))throw new GameError('Choisis rouge, noir ou purple.');
 if(g.phase!=='playing')throw new GameError('Valide le résultat avant de tirer à nouveau.',409);
 const count=action.choice==='purple'?2:1,cards=[];
 if(g.deck.length<count)throw new GameError(count===2?'Il reste une seule carte. Choisis rouge ou noir.':'Le paquet est terminé.',409);
 for(let i=0;i<count;i++)cards.push(cardInfo(g.deck.pop()));
 const correct=count===2?cards[0].color!==cards[1].color:cards[0].color===action.choice;
 const player=g.players[g.current];
 if(correct){g.streak+=count;player.score=(player.score||0)+count;if(g.streak>=3){g.phase='passed';g.completedTurns++;player.turns++;}}
 else{g.streak=0;g.phase='penalty';player.penalties+=count;if(g.penaltyMode==='random')g.pending=Array.from({length:count},()=>nextRandomChallenge(g));else{let pool=shuffle(g.penalties);g.pending=Array.from({length:count},()=>{if(!pool.length)pool=shuffle(g.penalties);return pool.pop();});}g.turnPenalties.push(...g.pending);}
 g.last={id:crypto.randomUUID(),playerId:player.id,name:player.name,choice:action.choice,cards,correct,points:correct?count:0,penalties:correct?0:count,streak:g.streak};
 g.history=[g.last,...g.history].slice(0,12);
 if(!g.deck.length){g.endReason='deck';if(g.phase!=='penalty')g.phase='ended';}
 return g;
}
