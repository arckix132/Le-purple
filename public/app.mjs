import {createGame,applyAction,publicGame,newRoomCode,ranking,cardInfo,CHALLENGE_CATALOG,ALCOHOL_CHALLENGE} from './game.mjs';
import {card,icon,escape} from './cards.mjs';
import {renderTable,renderHandoff,renderLobby,renderSummary,renderMenu,rulesMarkup,roster,shareText} from './ui.mjs';
import {renderGoogleSignIn} from './google-signin.mjs';
import {createPurpleReveal,isNewPurple} from './purple-reveal.mjs';
import {createSocial} from './social.mjs';
import {play,buzz,setSound,unlock} from './sound.mjs';
import {confetti,sparks} from './fx.mjs';
import {loadRecords,recordGame} from './records.mjs';

const $=s=>document.querySelector(s),app=$('#app'),setupHTML=app.innerHTML;
const saved=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const remember=(key,value)=>{try{value===null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value));}catch{/* private mode: the game still works */}};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait=ms=>new Promise(r=>setTimeout(r,ms));

let mode='local',onlineAction='create',penalties=[],penaltyMode='custom',includeAlcohol=false;
let game=null,room=null,credentials=null,busy=false,pollTimer=null,screen='setup';
let lastAnimation=null,drawingChoice=null,holding=null,holdTimer=null,freshRecords=[],recordedKey=null;
let farView=saved('purple-far-view')===true,showCounter=saved('purple-counter')!==false,guideDone=saved('purple-guide-v1')>=3;
let soundOn=saved('purple-sound')!==false,account=null,googleClientId=null,installPrompt=null,wakeLock=null;
setSound(soundOn);

const purpleReveal=createPurpleReveal(()=>renderGame());
let pendingFriendsOpen=false;
const social=createSocial({
 getAccount:()=>account,getRoom:()=>room,getCredentials:()=>credentials,
 onRequireAccount:()=>{pendingFriendsOpen=true;openAccount('login');},
 onSessionExpired:()=>{account=null;syncAccount();},
 onJoin:joinFriendRoom,onCreateRoom:prepareFriendRoom,toast,dialog:$('#social-dialog')
});

// ---------- small shared pieces ----------
function toast(text){const t=$('#toast');t.textContent=text;t.hidden=false;t.classList.remove('toast-in');void t.offsetWidth;t.classList.add('toast-in');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,3200);}
function dialog(title,content){$('#help-title').textContent=title;$('#help-content').innerHTML=content;if(!$('#help').open)$('#help').showModal();}
function closeOnBackdrop(d){d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});}
document.querySelectorAll('dialog').forEach(closeOnBackdrop);
$('#help .close-dialog').onclick=()=>$('#help').close();
function confirmBox(title,text,ok,cancel='Annuler'){
 return new Promise(resolve=>{
  dialog(title,`<p>${text}</p><div class="confirm-actions"><button class="ghost-btn" id="confirm-no" type="button">${cancel}</button><button class="big-btn" id="confirm-yes" type="button">${ok}</button></div>`);
  const modal=$('#help');let done=false;
  const finish=v=>{if(done)return;done=true;modal.removeEventListener('close',closed);modal.close();resolve(v);};
  const closed=()=>finish(false);modal.addEventListener('close',closed);
  $('#confirm-no').onclick=()=>finish(false);$('#confirm-yes').onclick=()=>finish(true);
 });
}

function syncSound(){
 const b=$('#sound-toggle');b.innerHTML=icon(soundOn?'sound':'mute');b.setAttribute('aria-pressed',String(soundOn));b.setAttribute('aria-label',soundOn?'Couper le son':'Remettre le son');
}
function toggleSound(){soundOn=!soundOn;remember('purple-sound',soundOn);setSound(soundOn);syncSound();if(soundOn)play('chip');}
$('#sound-toggle').onclick=toggleSound;syncSound();
document.addEventListener('pointerdown',()=>unlock(),{once:true,capture:true});

function setScreen(value){
 document.documentElement.dataset.screen=value;document.body.dataset.screen=value;
 document.body.classList.toggle('far-view',farView&&value==='game');
}

// Keep the screen on while the phone sits on the table.
async function keepAwake(on){
 try{
  if(on&&!wakeLock&&navigator.wakeLock&&!document.hidden){wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null;});}
  else if(!on&&wakeLock){await wakeLock.release();wakeLock=null;}
 }catch{wakeLock=null;}
}

// ---------- install ----------
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;syncInstall();});
function syncInstall(){document.querySelectorAll('.install-link').forEach(b=>b.hidden=standalone());}
async function install(){
 if(installPrompt){installPrompt.prompt();try{await installPrompt.userChoice;}catch{}installPrompt=null;return;}
 dialog('Le Purple sur ton écran d’accueil','<p>Il s’ouvre alors en plein écran, comme une appli, et la partie à un téléphone marche même sans réseau.</p><ol class="install-list"><li>Sur iPhone, ouvre le lien dans <b>Safari</b>.</li><li>Touche <b>Partager</b>.</li><li>Choisis <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.</li></ol><p class="muted">Sur Android, le menu de Chrome propose <b>Installer l’application</b>.</p>');
}

// ---------- account ----------
async function accountRequest(body){const res=await fetch('/api/account',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});let data;try{data=await res.json();}catch{throw Error('Le compte ne répond pas.');}if(!res.ok)throw Error(data.error||'Le compte ne répond pas.');return data;}
const accountName=()=>account?.name||'';
function syncAccount(){
 const button=$('#account-toggle');button.textContent=account?account.name:'Compte';button.setAttribute('aria-label',account?`Compte de ${account.name}`:'Se connecter ou créer un compte');
 if(screen==='setup'){const host=$('#host-name'),first=$('input[name=player]');if(host&&!host.value)host.value=accountName();if(first&&!first.value&&account){first.value=accountName();first.dispatchEvent(new Event('input'));}}
 social.sync();
 if(account&&pendingFriendsOpen){pendingFriendsOpen=false;$('#account-dialog').close();social.open();}
}
function accountForm(kind='register'){
 const register=kind==='register';
 $('#account-content').innerHTML=account?`<div class="account-profile"><span class="avatar av-2 avatar-lg">${escape(account.name.slice(0,1).toUpperCase())}</span><strong>${escape(account.name)}</strong><span>${escape(account.email)}</span><button class="big-btn" id="account-friends" type="button">Mes amis</button><button class="ghost-btn" id="logout-button" type="button">Se déconnecter</button></div>`:`${googleClientId?'<div class="auth-google"><div id="google-button" aria-label="Continuer avec Google"><span class="google-loading">Chargement de Google…</span></div><a class="small-link" href="/?connexion=1" target="_blank" rel="noopener">Un souci ? Ouvrir dans le navigateur</a></div><div class="auth-divider">ou par e-mail</div>':''}<div class="auth-tabs" role="tablist"><button type="button" data-auth="login" aria-selected="${!register}">J’ai un compte</button><button type="button" data-auth="register" aria-selected="${register}">Créer un compte</button></div><form id="account-form" class="account-form"><label ${register?'':'hidden'}>Prénom<input name="name" class="text-input" maxlength="24" autocomplete="given-name" ${register?'required':''}></label><label>E-mail<input name="email" class="text-input" type="email" autocomplete="email" required></label><label>Mot de passe<input name="password" class="text-input" type="password" minlength="10" maxlength="128" autocomplete="${register?'new-password':'current-password'}" required></label>${register?'<p class="hint">10 caractères minimum.</p>':''}<p id="account-error" class="error-message" role="alert" hidden></p><button class="big-btn" type="submit">${register?'Créer mon compte':'Me connecter'}</button></form><p class="footnote">Tu peux jouer sans compte. <a href="/confidentialite.html" target="_blank" rel="noopener">Confidentialité</a></p>`;
 if(account){$('#account-friends').onclick=()=>{$('#account-dialog').close();social.open();};$('#logout-button').onclick=async()=>{try{await accountRequest({type:'logout'});account=null;syncAccount();accountForm('login');toast('Tu es déconnecté.');}catch(e){toast(e.message);}};return;}
 document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>accountForm(b.dataset.auth));
 $('#account-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type=submit]'),error=$('#account-error');button.disabled=true;error.hidden=true;try{const data=await accountRequest({type:kind,name:form.elements.namedItem('name')?.value,email:form.elements.namedItem('email').value,password:form.elements.namedItem('password').value});account=data.account;syncAccount();$('#account-dialog').close();toast(`Salut ${account.name} !`);}catch(err){error.textContent=err.message;error.hidden=false;button.disabled=false;}};
 if(googleClientId)renderGoogleButton();
}
function renderGoogleButton(){
 const target=$('#google-button');if(!target||!googleClientId)return;
 renderGoogleSignIn(target,googleClientId,async({credential})=>{
  try{const data=await accountRequest({type:'google',credential});account=data.account;syncAccount();$('#account-dialog').close();toast(`Salut ${account.name} !`);}
  catch(e){const error=$('#account-error');if(error){error.textContent=e.message;error.hidden=false;}else toast(e.message);}
 }).catch(error=>{if(target.isConnected)target.textContent=error.message;});
}
function openAccount(kind='login'){
 $('#account-title').textContent=account?'Ton compte':'Connexion';
 $('#account-intro').hidden=!!account;
 if(!$('#account-dialog').open)$('#account-dialog').showModal();
 accountForm(kind);
}
$('#account-toggle').onclick=()=>openAccount();
$('#account-close').onclick=()=>$('#account-dialog').close();
accountRequest().then(data=>{
 account=data.account;googleClientId=data.googleClientId;syncAccount();
 if($('#account-dialog').open)accountForm('login');
 else if(!account&&new URL(location.href).searchParams.has('connexion'))openAccount('login');
}).catch(()=>{});

function bindHelp(){document.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>b.dataset.help==='rules'?dialog('Les règles',rulesMarkup):install());}

// ---------- setup screen ----------
function bindTabKeys(container){container.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...container.querySelectorAll('[role=tab]')],index=buttons.indexOf(document.activeElement);if(index<0)return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();});}
function setMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.mode===value));b.tabIndex=b.dataset.mode===value?0:-1;});$('#local-fields').hidden=value!=='local';$('#online-fields').hidden=value!=='online';updateSetup();}
function setOnline(value){onlineAction=value;document.querySelectorAll('[data-online]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.online===value));b.tabIndex=b.dataset.online===value?0:-1;});$('#code-field').hidden=value!=='join';updateSetup();}
function updateSetup(){
 if(!$('#start-button'))return;
 $('#penalty-setup').hidden=mode==='online'&&onlineAction==='join';
 $('#start-button').innerHTML=busy?'Un instant…':`${mode==='local'?'Jouer':onlineAction==='create'?'Ouvrir un salon':'Rejoindre'} ${icon('arrow')}`;
 $('#start-button').disabled=busy;
 $('#setup-note').textContent=mode==='local'?'Les prénoms et les défis restent sur ce téléphone.':onlineAction==='create'?'Tu recevras un code à partager.':'Pas besoin de compte.';
}
function setupError(text){const el=$('#setup-error');if(el){el.hidden=!text;el.textContent=text;if(text){el.scrollIntoView({block:'nearest',behavior:'smooth'});buzz(30);}}else if(text)toast(text);}
function paintRow(row,i,count){
 const input=row.querySelector('input'),badge=row.querySelector('.avatar'),name=input.value.trim();
 badge.className=`avatar av-${i%8}`;badge.textContent=name?[...name][0].toUpperCase():String(i+1);
 input.placeholder=`Joueur ${i+1}`;input.setAttribute('aria-label',`Prénom du joueur ${i+1}`);
 const b=row.querySelector('button');b.disabled=count<=2;b.setAttribute('aria-label',`Retirer le joueur ${i+1}`);
}
function reindex(){const rows=[...document.querySelectorAll('.player-row')];rows.forEach((row,i)=>paintRow(row,i,rows.length));$('#player-count').textContent=`${rows.length}/12`;$('#add-player').hidden=rows.length>=12;}
function paintPenalties(){
 const draft=$('#penalty-draft'),full=penalties.length>=8;
 $('#penalty-list').innerHTML=penalties.map((p,i)=>`<div class="penalty-chip"><span>${escape(p)}</span><button type="button" data-remove-penalty="${i}" aria-label="Retirer le défi ${escape(p)}">×</button></div>`).join('')||'<p class="hint">Aucun défi pour l’instant.</p>';
 document.querySelectorAll('[data-remove-penalty]').forEach(b=>b.onclick=()=>{penalties.splice(Number(b.dataset.removePenalty),1);paintPenalties();});
 $('.penalty-input').hidden=full;$('#suggestions').hidden=full;
 $('.alcohol-suggestion').hidden=full||penalties.includes(ALCOHOL_CHALLENGE);
 document.querySelectorAll('[data-suggestion]').forEach(button=>button.hidden=penalties.includes(button.dataset.suggestion));
 draft.disabled=full;
 const random=penaltyMode==='random';
 $('#challenge-count').textContent=random?`${CHALLENGE_CATALOG.length+Number(includeAlcohol)}`:String(penalties.length);
 $('#challenge-preview').textContent=random?'Surprise, tirés au hasard':penalties.length?penalties.join(' · '):'À choisir';
}
function selectPenaltyMode(value){penaltyMode=value;document.querySelectorAll('[data-penalty-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.penaltyMode===value)));$('#custom-challenges').hidden=value!=='custom';$('#random-challenges').hidden=value!=='random';paintPenalties();updateSetup();}
function addPenalty(value=$('#penalty-draft').value){const v=value.trim();if(v&&!penalties.includes(v)&&penalties.length<8){penalties.push(v.slice(0,120));$('#penalty-draft').value='';paintPenalties();play('tap');}}
const defaultPenalties=['Imiter un animal','Chanter un refrain','Faire 10 squats'];

function heroCards(){
 const box=$('#hero-cards');if(!box)return;
 const deal=()=>{const ids=[...Array(52).keys()].sort(()=>Math.random()-.5);const red=ids.find(i=>i<26),black=ids.find(i=>i>=26);box.innerHTML=card(cardInfo(red),true,'hero-a')+card(cardInfo(black),true,'hero-b');};
 box.innerHTML=card(cardInfo(0),false,'hero-a')+card(cardInfo(37),false,'hero-b');
 box.onclick=()=>{deal();play('flip');play('purple',null,240);sparks(box,'purple',18);};
}

function paintRecords(){
 const r=loadRecords(),el=$('#records');if(!el)return;
 if(!r.games){el.hidden=true;return;}
 el.hidden=false;
 el.innerHTML=`<span><b>${r.games}</b> ${r.games>1?'parties':'partie'}</span><span><b>${r.cards}</b> cartes retournées</span><span><b>${r.purpleHits}</b> Purples réussis</span>`;
}

function showSetup(joinCode){
 purpleReveal.cancel();clearTimeout(holdTimer);holding=null;
 stopPolling();keepAwake(false);screen='setup';drawingChoice=null;setScreen('setup');game=null;room=null;credentials=null;busy=false;lastAnimation=null;$('#connection').hidden=true;
 app.innerHTML=setupHTML;mode='local';onlineAction='create';bindSetup();
 if(joinCode){setMode('online');setOnline('join');$('#room-code').value=joinCode;}
 syncAccount();social.roomChanged();
}
function bindSetup(){
 bindHelp();syncInstall();heroCards();paintRecords();
 const prefs=saved('purple-preferences-v2');
 penalties=Array.isArray(prefs?.penalties)&&prefs.penalties.length?prefs.penalties.filter(p=>typeof p==='string'&&p.trim()).slice(0,8):[...defaultPenalties];
 penaltyMode=prefs?.penaltyMode==='random'?'random':'custom';includeAlcohol=prefs?.includeAlcohol===true;
 $('#suggestions').innerHTML=CHALLENGE_CATALOG.map(c=>`<button type="button" data-suggestion="${escape(c)}">+ ${escape(c)}</button>`).join('');
 $('#random-alcohol').checked=includeAlcohol;$('#random-alcohol').onchange=e=>{includeAlcohol=e.target.checked;paintPenalties();};
 document.querySelectorAll('[data-penalty-mode]').forEach(b=>b.onclick=()=>selectPenaltyMode(b.dataset.penaltyMode));
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);play('tap');});
 document.querySelectorAll('[data-online]').forEach(b=>b.onclick=()=>{setOnline(b.dataset.online);play('tap');});
 document.querySelectorAll('[role=tablist]').forEach(bindTabKeys);
 const list=$('#player-inputs');
 function appendPlayer(value=''){
  const row=document.createElement('div');row.className='player-row';
  row.innerHTML='<span class="avatar" aria-hidden="true"></span><input name="player" maxlength="24" autocomplete="off" enterkeyhint="next"><button type="button" class="row-remove">×</button>';
  row.querySelector('input').value=value;list.append(row);return row;
 }
 if(Array.isArray(prefs?.players)&&prefs.players.length>=2){list.innerHTML='';prefs.players.slice(0,12).forEach(n=>appendPlayer(String(n).slice(0,24)));}
 reindex();
 list.addEventListener('input',e=>{const row=e.target.closest('.player-row');if(row){const rows=[...list.children];paintRow(row,rows.indexOf(row),rows.length);}});
 list.addEventListener('click',e=>{const b=e.target.closest('.row-remove');if(!b||b.disabled)return;const row=b.closest('.player-row');row.classList.add('is-leaving');setTimeout(()=>{row.remove();reindex();},160);play('tap');});
 list.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.target.name!=='player')return;e.preventDefault();
  const rows=[...list.children],i=rows.indexOf(e.target.closest('.player-row'));
  if(i<rows.length-1)rows[i+1].querySelector('input').focus();
  else if(e.target.value.trim()&&rows.length<12){const row=appendPlayer();reindex();row.querySelector('input').focus();}
  else $('#start-button').focus();
 });
 $('#add-player').onclick=()=>{if(list.children.length>=12)return;const row=appendPlayer();row.classList.add('is-new');reindex();row.querySelector('input').focus();play('tap');};
 $('#add-penalty').onclick=()=>addPenalty();$('#penalty-draft').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addPenalty();}};
 document.querySelectorAll('[data-suggestion]').forEach(b=>b.onclick=()=>addPenalty(b.dataset.suggestion));
 $('#room-code').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'');
 $('#setup-form').onsubmit=start;
 const local=saved('peuple-local'),online=saved('peuple-room');
 if(local?.format===1&&local.players?.length>=2&&local.phase!=='ended'||online?.code){
  $('#resume').hidden=false;$('#resume').onclick=resume;
  $('#resume-detail').textContent=online?.code?`Salon ${online.code}`:`${local.players.map(p=>p.name).join(', ')} · ${local.deck?.length??0} cartes restantes`;
 }
 const invite=new URL(location.href).searchParams.get('salon');
 if(invite&&/^[A-Z2-9]{6}$/.test(invite.toUpperCase())){setMode('online');setOnline('join');$('#room-code').value=invite.toUpperCase();}
 selectPenaltyMode(penaltyMode);updateSetup();syncAccount();
}

// ---------- online rooms ----------
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
function prepareFriendRoom(){
 if(busy||purpleReveal.current){toast('Attends la fin du tirage.');return;}
 if(room&&game?.phase!=='ended'){toast('Tu peux déjà inviter tes amis dans ce salon.');social.open();return;}
 showSetup();setMode('online');setOnline('create');$('#host-name').value=accountName();
 window.scrollTo(0,0);toast('Choisis tes défis, ouvre le salon, puis invite tes amis.');
}
async function joinFriendRoom(code){
 if(!account){pendingFriendsOpen=true;openAccount('login');return false;}
 if(busy||purpleReveal.current){toast('Attends la fin du tirage.');return false;}
 if(room?.code===code){toast('Tu es déjà dans ce salon.');return true;}
 if(game&&game.phase!=='ended'&&!(await confirmBox('Rejoindre cette table ?',room?'Tu quittes ton salon actuel pour rejoindre ton ami.':'La partie en cours sur ce téléphone sera remplacée.','Rejoindre','Rester ici')))return false;
 const priorRoom=room,priorIdent=credentials,previousJoin=saved('purple-invite-join');
 const ident=previousJoin?.code===code&&previousJoin.accountId===account.id?previousJoin:{code,playerId:crypto.randomUUID(),token:secret(),accountId:account.id};
 remember('purple-invite-join',ident);busy=true;
 try{
  // Join first, so a dead invitation never costs the current game.
  const next=await request({type:'join',code,name:account.name,playerId:ident.playerId,token:ident.token},ident);
  if(priorRoom&&priorIdent){
   let left=false,version=priorRoom.version;
   for(let attempt=0;attempt<3&&!left;attempt++){
    try{await request({type:'leave',code:priorRoom.code,version,requestId:crypto.randomUUID()},priorIdent);left=true;}
    catch(problem){if([403,404].includes(problem.status)){left=true;break;}if(problem.status!==409)break;try{version=(await request(null,priorIdent)).version;}catch{break;}}
   }
  }
  stopPolling();purpleReveal.cancel();room=null;game=null;credentials=ident;busy=false;lastAnimation=null;
  remember('peuple-room',ident);remember('purple-invite-join',null);remember('peuple-local',null);acceptRoom(next);startPolling();window.scrollTo(0,0);return true;
 }catch(problem){busy=false;if(problem.status&&problem.status<500)remember('purple-invite-join',null);toast(problem.message);return false;}
}
async function request(body=null,ident=credentials){const headers={'Content-Type':'application/json'};if(ident){headers['X-Player-Id']=ident.playerId;headers.Authorization=`Bearer ${ident.token}`;}const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);try{const res=await fetch(body?'/api/rooms':`/api/rooms?code=${encodeURIComponent(ident.code)}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});let data;try{data=await res.json();}catch{throw Error('Le salon ne répond pas. Réessaie dans un instant.');}if(!res.ok){const e=Error(data.error||'Le salon ne répond pas.');e.status=res.status;throw e;}return data;}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('Connexion coupée. Réessaie quand le réseau revient.');throw e;}finally{clearTimeout(timeout);}}
function acceptRoom(next){
 if(!credentials||next.code!==credentials.code)return;
 if(room&&room.version>next.version)return;
 const changed=!room||room.version!==next.version,previous=game;
 if(!room&&next.game.phase==='playing')lastAnimation=next.game.last?.id;
 if(previous&&next.game.players.length>previous.players.length&&['lobby','waiting'].includes(next.game.phase))play('join');
 room=next;game=next.game;$('#connection').hidden=true;
 if(changed||screen==='setup'){
  if(screen==='setup')screen='game';
  if(isNewPurple(previous,game))purpleReveal.start(previous,game,reducedMotion());
  else{if(purpleReveal.current&&purpleReveal.current.last.id!==game.last?.id)purpleReveal.cancel();renderGame();}
 }
}
async function start(e){
 e.preventDefault();if(busy)return;setupError('');
 const names=mode==='local'?[...document.querySelectorAll('input[name=player]')].map((x,i)=>x.value.trim()||`Joueur ${i+1}`):[$('#host-name').value.trim()];
 const draft=$('#penalty-draft').value.trim();
 const selected=[...penalties,...(draft&&penalties.length<8&&!penalties.includes(draft)?[draft]:[])];
 const actions=penaltyMode==='random'?[...CHALLENGE_CATALOG,...(includeAlcohol?[ALCOHOL_CHALLENGE]:[])]:selected;
 const typed=mode==='local'?[...document.querySelectorAll('input[name=player]')].map(x=>x.value.trim()):names;
 const prefs={players:typed,penalties:selected,penaltyMode,includeAlcohol};
 try{
  if(penaltyMode==='custom'&&!actions.length&&!(mode==='online'&&onlineAction==='join')){$('#penalty-setup').open=true;throw Error('Ajoute au moins un défi, ou passe en mode Surprise.');}
  if(mode==='local'){
   if(new Set(names.map(n=>n.toLocaleLowerCase('fr'))).size<names.length)throw Error('Deux joueurs ont le même prénom. Ajoute une initiale pour les distinguer.');
   game=createGame(names,actions,false,penaltyMode);remember('purple-preferences-v2',prefs);room=null;credentials=null;remember('peuple-room',null);remember('peuple-local',game);
   screen='game';window.scrollTo(0,0);play('deal');renderGame();return;
  }
  if(!names[0])throw Error('Entre ton prénom pour rejoindre la table.');
  const code=onlineAction==='join'?$('#room-code').value.trim():newRoomCode();
  if(!/^[A-Z2-9]{6}$/.test(code))throw Error('Le code du salon fait 6 caractères.');
  busy=true;updateSetup();
  credentials={code,playerId:crypto.randomUUID(),token:secret()};remember('peuple-room',credentials);
  const data=await request({type:onlineAction,code,name:names[0],penalties:actions,penaltyMode,playerId:credentials.playerId,token:credentials.token});
  remember('peuple-local',null);if(onlineAction==='create')remember('purple-preferences-v2',{...prefs,players:saved('purple-preferences-v2')?.players});
  busy=false;acceptRoom(data);startPolling();
 }catch(err){
  busy=false;setupError(err.message);updateSetup();
  if(err.status&&err.status<500){remember('peuple-room',null);credentials=null;}
  else if(credentials){$('#resume').hidden=false;$('#resume').onclick=resume;}
 }
}
async function resume(){
 if(busy)return;const ident=saved('peuple-room');
 if(ident?.code){credentials=ident;busy=true;updateSetup();try{const data=await request();busy=false;acceptRoom(data);startPolling();}catch(e){busy=false;setupError(e.message);updateSetup();if([403,404].includes(e.status)){remember('peuple-room',null);credentials=null;}}return;}
 const local=saved('peuple-local');
 if(local?.format===1&&Array.isArray(local.players)&&local.players.length>=2&&['playing','penalty','passed','ended'].includes(local.phase)){game=local;room=null;credentials=null;screen='game';lastAnimation=local.last?.id;renderGame();}
 else{remember('peuple-local',null);setupError('La sauvegarde est illisible. Lance une nouvelle partie.');}
}
function stopPolling(){clearTimeout(pollTimer);pollTimer=null;}
function startPolling(){stopPolling();const tick=async()=>{if(!credentials||screen==='setup')return;try{if(!busy)acceptRoom(await request());}catch(e){$('#connection').textContent=[403,404].includes(e.status)?e.message:'Connexion coupée. La table se remettra à jour dès le retour du réseau.';$('#connection').hidden=false;}if(credentials&&screen!=='setup')pollTimer=setTimeout(tick,document.hidden?8000:1200);};pollTimer=setTimeout(tick,1200);}

// ---------- feedback: sound, haptics, confetti ----------
function feedback(last,phase,delay){
 const passed=phase==='passed'||(phase==='ended'&&last.correct&&last.streak>=3);
 const purple=last.choice==='purple';
 setTimeout(()=>{
  const target=document.querySelector('.drawn');
  if(last.correct){
   if(passed){play('pass');buzz([20,60,20,60,40]);confetti({palette:'party',y:innerHeight*.45});}
   else if(purple){play('purple');buzz([15,40,15,40,30]);confetti({palette:'purple',count:60,y:innerHeight*.42,spread:.7});}
   else{play('hit',game?.streak||1);buzz(18);sparks(target,'gold');}
  }else{play('miss');buzz([60,40,90]);}
 },delay);
 if(passed||phase==='ended'){
  holding=last.id;clearTimeout(holdTimer);
  holdTimer=setTimeout(()=>{holding=null;if(game?.last?.id===last.id)renderGame();},reducedMotion()?900:(phase==='ended'?2200:1800));
 }
}

// ---------- rendering ----------
const view=()=>({game,room,credentials,busy:busy||!!purpleReveal.current,drawingChoice,reveal:purpleReveal.current,farView,showCounter,soundOn,guide:!guideDone,
 fullscreenAvailable:!!document.fullscreenEnabled,fullscreenActive:!!document.fullscreenElement,installable:!standalone()});
function renderGame(){
 if(!game)return;
 const priorFocus=document.activeElement?.dataset?.choice;
 const reveal=purpleReveal.current,v=view();
 const fresh=!reveal&&!drawingChoice&&game.last&&game.last.id!==lastAnimation;
 const flipFresh=fresh&&purpleReveal.completedId!==game.last.id;
 const phase=reveal?'playing':game.phase;
 if(fresh){if(flipFresh)play('flip',null,reducedMotion()?0:110);feedback(game.last,phase,flipFresh&&!reducedMotion()?330:40);lastAnimation=game.last.id;}
 if(reveal&&reveal.animateIndex>=0){play('flip',null,110);if(reveal.visible===1&&!reducedMotion())play('heartbeat',null,560);}
 const held=holding&&holding===game.last?.id;
 let next;
 if(phase==='lobby'||phase==='waiting'){next='lobby';app.innerHTML=renderLobby(v);}
 else if(phase==='ended'&&!held){next='ended';const ranked=ranking(game);finishGame();app.innerHTML=renderSummary({...v,ranked,freshRecords});}
 else if(phase==='passed'&&!held){next='handoff';app.innerHTML=renderHandoff(v);}
 else{next='game';app.innerHTML=renderTable({...v,flipFresh,stampFresh:fresh});}
 if(next!==screen&&next==='ended'){play('win');setTimeout(()=>confetti({count:140,y:innerHeight*.3}),150);}
 if(next==='handoff'&&screen!=='handoff')play('deal');
 setScreen(next==='lobby'?'lobby':next==='ended'?'ended':next==='handoff'?'handoff':'game');
 screen=next;
 keepAwake(next!=='ended');
 purpleReveal.consumeAnimation();
 bindGame();social.roomChanged();
 if(priorFocus&&!busy){const b=document.querySelector(`[data-choice="${priorFocus}"]`);if(b&&!b.disabled)b.focus({preventScroll:true});}
}
function finishGame(){
 if(!game.history?.length)return;
 const key=(room?room.code+':':'local:')+game.last?.id;
 const mine=room?game.players.filter(p=>p.id===credentials?.playerId):game.players;
 if(key===recordedKey)return;
 recordedKey=key;freshRecords=recordGame(key,game,mine).fresh;
}

function openMenu(){
 const m=$('#menu');$('#menu-content').innerHTML=renderMenu(view());
 if(!m.open)m.showModal();
 bindMenu();social.badges();
}
function bindMenu(){
 const m=$('#menu'),close=()=>m.close(),on=(id,fn)=>{const b=document.getElementById(id);if(b)b.onclick=fn;};
 on('game-rules',()=>{close();dialog('Les règles',rulesMarkup);});
 on('game-scores',()=>{close();dialog('Défis des joueurs',roster(purpleReveal.current?.before||game,credentials));});
 on('game-sound',()=>{toggleSound();openMenu();renderGame();});
 on('toggle-counter',()=>{showCounter=!showCounter;remember('purple-counter',showCounter);openMenu();renderGame();});
 on('far-view',()=>{farView=!farView;remember('purple-far-view',farView);close();renderGame();});
 on('game-fullscreen',async()=>{close();try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Plein écran indisponible ici.');}});
 on('game-account',()=>{close();openAccount();});
 on('game-install',()=>{close();install();});
 on('copy-code',copyCode);on('share-room',shareRoom);
 on('quit',async()=>{
  close();const online=!!room;
  if(await confirmBox(online?'Quitter la table ?':'Arrêter la partie ?',online?'Les autres peuvent continuer sans toi. Tu peux revenir avec le code.':'On passe directement au classement. Vous pourrez lancer la revanche.',online?'Quitter':'Voir le classement',online?'Rester':'Continuer'))await action({type:online?'leave':'end'});
 });
 on('end-game',async()=>{close();if(await confirmBox('Terminer pour tout le monde ?','Le classement s’affiche chez tous les joueurs.','Terminer','Continuer'))await action({type:'end'});});
 m.querySelectorAll('[data-social-open]').forEach(b=>b.addEventListener('click',close));
}
async function copyCode(){try{await navigator.clipboard.writeText(room.code);toast('Code copié.');play('tap');}catch{toast(`Code du salon : ${room.code}`);}}
async function shareRoom(){
 const url=`${location.origin}/?salon=${room.code}`;
 try{if(navigator.share)await navigator.share({title:'Le Purple',text:`Viens jouer au Purple ! Code ${room.code}`,url});else{await navigator.clipboard.writeText(url);toast('Lien copié, envoie-le aux autres.');}}
 catch(e){if(e.name!=='AbortError')toast(`Le code à partager : ${room.code}`);}
}
function bindGame(){
 const on=(sel,fn)=>{const b=document.querySelector(sel);if(b)b.onclick=fn;};
 on('#open-menu',openMenu);
 on('#quick-sound',()=>{toggleSound();renderGame();});
 on('.tip-ok',()=>{guideDone=true;remember('purple-guide-v1',3);renderGame();});
 on('#copy-code',copyCode);on('#share-room',shareRoom);
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>action({type:'guess',choice:b.dataset.choice}));
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action({type:b.dataset.action}));
 on('#share-result',async()=>{
  const text=shareText(game,ranking(game));
  try{if(navigator.share)await navigator.share({title:'Le Purple',text,url:location.origin});else{await navigator.clipboard.writeText(text+'\n'+location.origin);toast('Résultat copié.');}}catch(e){if(e.name!=='AbortError')toast('Partage indisponible ici.');}
 });
 on('#new-game',()=>{if(room){action({type:'leave'});return;}remember('peuple-local',null);remember('peuple-room',null);showSetup();window.scrollTo(0,0);});
}

async function action(input,throwOnError=false){
 if(busy||purpleReveal.current||!game)return;
 busy=true;drawingChoice=input.type==='guess'?input.choice:null;
 unlock();
 if(drawingChoice){play('chip');buzz(8);if(!guideDone){guideDone=true;remember('purple-guide-v1',3);}}else play('tap');
 renderGame();
 try{
  const suspense=input.type==='guess'&&!reducedMotion()?(drawingChoice==='purple'?260:420):0;
  if(suspense)play('deal',null,60);
  const delay=wait(suspense);
  let next;
  if(room){
   [next]=await Promise.all([request({...input,code:room.code,version:room.version,requestId:crypto.randomUUID()}),delay]);
   if(input.type==='leave'){const code=next.game.phase==='ended'?null:room.code;remember('peuple-room',null);showSetup(code);window.scrollTo(0,0);toast('Tu as quitté la table.');return;}
  }else{next=applyAction(game,input);await delay;}
  drawingChoice=null;
  if(room)acceptRoom(next);
  else{const previous=game;game=next;remember('peuple-local',game);if(isNewPurple(previous,game))purpleReveal.start(previous,game,reducedMotion());else renderGame();}
  // No new action, score or sound before the second Purple card lands.
  if(purpleReveal.current)await purpleReveal.done;
  else if(input.type==='guess'&&!reducedMotion())await wait(520);
  busy=false;renderGame();
  if(['next','start','ack','rematch','end'].includes(input.type))window.scrollTo({top:0,behavior:'smooth'});
 }catch(e){
  busy=false;drawingChoice=null;
  if(room){try{acceptRoom(await request());}catch{}}
  renderGame();toast(e.message);if(throwOnError)throw e;
 }
}

// R / N / P pick a colour, Enter or Space runs the main button.
document.addEventListener('keydown',e=>{
 if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,button,summary,a,[contenteditable="true"]'))return;
 if(screen==='setup')return;
 const choice={r:'red',n:'black',b:'black',p:'purple'}[e.key.toLowerCase()];
 const target=choice?document.querySelector(`[data-choice="${choice}"]`):(e.key==='Enter'||e.key===' ')?document.querySelector('[data-primary]'):null;
 if(target&&!target.disabled){e.preventDefault();target.click();}
});

bindSetup();
document.addEventListener('fullscreenchange',()=>{if($('#menu').open)openMenu();});
if('serviceWorker'in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js').catch(()=>{});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&screen!=='setup'&&screen!=='ended')keepAwake(true);
 if(!document.hidden&&credentials&&screen!=='setup'){request().then(acceptRoom).catch(()=>{});startPolling();}
});

// Same visible journey for browsers that support WebMCP.
if(document.modelContext?.registerTool){const life=new AbortController();const register=t=>Promise.resolve(document.modelContext.registerTool(t,{signal:life.signal})).catch(()=>{});register({name:'read_peuple_table',description:'Read the visible table and whose turn it is.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({screen,code:room?.code??null,game:game?(room?game:publicGame(game)):null})});register({name:'guess_peuple_color',description:'Draw cards by choosing red, black or purple for the active player. Updates points and real-world penalties.',inputSchema:{type:'object',properties:{choice:{type:'string',enum:['red','black','purple']}},required:['choice'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input){if(!input||!['red','black','purple'].includes(input.choice))throw Error('Invalid color');if(busy||game?.phase!=='playing'||room&&game.players[game.current].id!==credentials.playerId)throw Error('It is not your turn to draw');await action({type:'guess',choice:input.choice},true);return {phase:game.phase,streak:game.streak,last:game.last};}});window.addEventListener('pagehide',()=>life.abort(),{once:true});}
