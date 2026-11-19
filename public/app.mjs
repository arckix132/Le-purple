import {createGame,applyAction,publicGame,newRoomCode,ranking,cardInfo,CHALLENGE_CATALOG,ALCOHOL_CHALLENGE} from './game.mjs';
import {card,cardBack,icon,escape} from './cards.mjs';
import {renderTable,renderLobby,renderSummary,rulesMarkup,roster} from './ui.mjs';
import {renderGoogleSignIn} from './google-signin.mjs';
import {createPurpleReveal,isNewPurple} from './purple-reveal.mjs';
import {createSocial} from './social.mjs';
const $=s=>document.querySelector(s),app=$('#app'),setupHTML=app.innerHTML;
let mode='local',onlineAction='create',penalties=[],penaltyMode='custom',includeAlcohol=false,game=null,room=null,credentials=null,busy=false,pollTimer=null,screen='setup',lastAnimation=null,drawingChoice=null,farView=false,immersive=true,account=null,googleClientId=null,guideStage=0;
const saved=(key)=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
guideStage=saved('purple-guide-v1')??0;
const remember=(key,value)=>{try{value===null?localStorage.removeItem(key):localStorage.setItem(key,JSON.stringify(value));}catch{toast('La sauvegarde sur ce téléphone est indisponible.');}};
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const purpleReveal=createPurpleReveal(()=>renderGame());
let soundOn=saved('purple-sound')===true,audioContext=null;
let pendingFriendsOpen=false;
const social=createSocial({
 getAccount:()=>account,getRoom:()=>room,getCredentials:()=>credentials,
 onRequireAccount:()=>{pendingFriendsOpen=true;openAccount('login');},
 onSessionExpired:()=>{account=null;syncAccount();},
 onJoin:joinFriendRoom,onCreateRoom:prepareFriendRoom,toast,dialog:$('#social-dialog')
});
function unlockAudio(){try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});}catch{}}
function sound(kind){if(!soundOn||document.hidden)return;unlockAudio();if(!audioContext)return;const notes=kind==='pass'?[523,659,784,1047]:kind==='success'?[523,784]:kind==='miss'?[220,164]:[390];notes.forEach((frequency,i)=>{const oscillator=audioContext.createOscillator(),volume=audioContext.createGain(),time=audioContext.currentTime+i*.09;oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,time);volume.gain.setValueAtTime(0,time);volume.gain.linearRampToValueAtTime(.1,time+.015);volume.gain.exponentialRampToValueAtTime(.001,time+.19);oscillator.connect(volume);volume.connect(audioContext.destination);oscillator.start(time);oscillator.stop(time+.2);});}
function syncSound(){const b=$('#sound-toggle');b.innerHTML=icon(soundOn?'sound':'mute')+`<span class="sound-label">${soundOn?'Son activé':'Son coupé'}</span>`;b.setAttribute('aria-pressed',String(soundOn));b.setAttribute('aria-label',soundOn?'Désactiver les sons':'Activer les sons');}
$('#sound-toggle').onclick=()=>{soundOn=!soundOn;remember('purple-sound',soundOn);syncSound();if(soundOn)sound('success');};syncSound();
function feedback(last,passed){sound(passed?'pass':last.correct?'success':'miss');if(navigator.vibrate)navigator.vibrate(last.correct?[20,40,25]:40);if(passed&&!reducedMotion()){const burst=document.createElement('div');burst.className='celebration';burst.setAttribute('aria-hidden','true');burst.innerHTML=Array.from({length:16},(_,i)=>`<i style="--i:${i}"></i>`).join('');document.body.append(burst);setTimeout(()=>burst.remove(),1600);}}
function setScreen(value){document.documentElement.dataset.screen=value;document.body.dataset.screen=value;document.body.classList.toggle('immersive',immersive&&value==='game');document.body.classList.toggle('far-view',farView&&value==='game');document.querySelector('meta[name=theme-color]').content=value==='setup'?'#f3f0e9':'#201d25';}
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,3500);}
function dialog(title,content){$('#help-title').textContent=title;$('#help-content').innerHTML=content;$('#help').showModal();}
$('#help .close-dialog').onclick=()=>$('#help').close();
$('#help').addEventListener('click',e=>{if(e.target===$('#help')){const r=$('#help').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#help').close();}});
async function accountRequest(body){const res=await fetch('/api/account',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await res.json();if(!res.ok)throw Error(data.error||'Le compte ne répond pas.');return data;}
function accountName(){return account?.name||'';}
function syncAccount(){const button=$('#account-toggle');button.textContent=account?account.name:'Mon compte';button.setAttribute('aria-label',account?`Compte de ${account.name}`:'Créer un compte ou se connecter');if(screen==='setup'){const host=$('#host-name'),first=$('input[name=player]');if(host&&!host.value)host.value=accountName();if(first&&!first.value)first.value=accountName();}social.sync();if(account&&pendingFriendsOpen){pendingFriendsOpen=false;$('#account-dialog').close();social.open();}}
function accountForm(kind='register'){const register=kind==='register';$('#account-content').innerHTML=account?`<div class="account-profile"><span class="avatar avatar-0">${escape(account.name.slice(0,1).toUpperCase())}</span><strong>${escape(account.name)}</strong><span>${escape(account.email)}</span><p>Ton compte est actif sur cet appareil. Tu peux toujours jouer en invité sur un autre téléphone.</p><button class="primary-button" id="account-friends" type="button">Mes amis et invitations</button><button class="secondary-button" id="logout-button">Se déconnecter</button></div>`:`${googleClientId?'<div class="auth-google"><div id="google-button" aria-label="Continuer avec Google"><span class="google-loading">Chargement de Google…</span></div><a class="google-browser-link" href="/?connexion=1" target="_blank" rel="noopener">Un problème ? Essayer dans le navigateur ↗</a></div><div class="auth-divider">ou avec ton adresse e-mail</div>':''}<div class="auth-tabs"><button type="button" data-auth="register" class="${register?'active':''}">Créer un compte</button><button type="button" data-auth="login" class="${!register?'active':''}">Se connecter</button></div><form id="account-form" class="account-form"><label ${register?'':'hidden'}>Ton prénom<input name="name" class="text-input" maxlength="24" autocomplete="given-name" ${register?'required':''}></label><label>Adresse e-mail<input name="email" class="text-input" type="email" autocomplete="email" required></label><label>Mot de passe<input name="password" class="text-input" type="password" minlength="10" maxlength="128" autocomplete="${register?'new-password':'current-password'}" required></label><p class="auth-hint">${register?'Au moins 10 caractères. Ton prénom sera gardé pour les prochaines parties.':'Entre tes identifiants pour te connecter.'}</p><p id="account-error" class="error-message" role="alert" hidden></p><button class="primary-button" type="submit">${register?'Créer mon compte':'Me connecter'}</button></form><p class="auth-guest">Joue aussi sans compte · <a href="/confidentialite.html" target="_blank" rel="noopener">Confidentialité</a></p>`;
 if(account){$('#account-friends').onclick=()=>{$('#account-dialog').close();social.open();};$('#logout-button').onclick=async()=>{try{await accountRequest({type:'logout'});account=null;syncAccount();accountForm();toast('Tu es déconnecté.');}catch(e){toast(e.message);}};return;}
 document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>accountForm(b.dataset.auth));$('#account-form').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=form.querySelector('button[type=submit]'),error=$('#account-error');button.disabled=true;error.hidden=true;try{const data=await accountRequest({type:kind,name:form.elements.namedItem('name')?.value,email:form.elements.namedItem('email').value,password:form.elements.namedItem('password').value});account=data.account;remember('purple-account-known',true);remember('purple-welcome-seen-v1',true);syncAccount();$('#account-dialog').close();toast(`Bienvenue, ${account.name} !`);}catch(err){error.textContent=err.message;error.hidden=false;button.disabled=false;}};
 if(googleClientId)renderGoogleButton();}
function renderGoogleButton(){
 const target=$('#google-button');if(!target||!googleClientId)return;
 renderGoogleSignIn(target,googleClientId,async({credential})=>{
  try{
   const data=await accountRequest({type:'google',credential});
   account=data.account;remember('purple-account-known',true);remember('purple-welcome-seen-v1',true);
   syncAccount();$('#account-dialog').close();toast(`Bienvenue, ${account.name} !`);
  }catch(e){const error=$('#account-error');if(error){error.textContent=e.message;error.hidden=false;}else toast(e.message);}
 }).catch(error=>{if(target.isConnected)target.textContent=error.message;});
}
function openAccount(kind='login',welcome=false){
 $('#account-title').textContent=welcome?'Bienvenue.':account?'Mon compte':'Connexion';
 $('#account-intro').hidden=!!account;
 if(!$('#account-dialog').open)$('#account-dialog').showModal();
 accountForm(kind);
}
function welcomeAccount(){
 if(account||saved('purple-welcome-seen-v1')&&!new URL(location.href).searchParams.has('connexion'))return;
 openAccount('login',true);
 remember('purple-welcome-seen-v1',true);
}
$('#account-toggle').onclick=()=>openAccount();
$('#account-close').onclick=()=>$('#account-dialog').close();
accountRequest().then(data=>{
 account=data.account;googleClientId=data.googleClientId;syncAccount();
 if(account){remember('purple-account-known',true);remember('purple-welcome-seen-v1',true);}
 if($('#account-dialog').open)accountForm('login');else welcomeAccount();
}).catch(()=>welcomeAccount());
const rules=rulesMarkup;
document.querySelectorAll('[data-help]').forEach(b=>b.onclick=()=>b.dataset.help==='rules'?dialog('Les règles du Purple',rules):dialog('Le Purple sur ton iPhone','<p>Ajoute le jeu à ton écran d’accueil pour l’ouvrir en plein écran.</p><ol class="install-list"><li>Ouvre le lien dans <b>Safari</b>.</li><li>Touche <b>Partager</b>.</li><li>Choisis <b>Sur l’écran d’accueil</b>.</li><li>Active <b>Ouvrir comme app web</b> si l’option apparaît, puis touche <b>Ajouter</b>.</li></ol><p class="muted">Le mode un téléphone reste jouable hors connexion après une première ouverture. Les salons demandent une connexion Internet.</p>'));
function bindTabKeys(container){container.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...container.querySelectorAll('[role=tab]')],index=buttons.indexOf(document.activeElement);if(index<0)return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();});}
function setMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.mode===value));b.tabIndex=b.dataset.mode===value?0:-1;});$('#local-fields').hidden=value!=='local';$('#online-fields').hidden=value!=='online';updateSetup();}
function setOnline(value){onlineAction=value;document.querySelectorAll('[data-online]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.online===value));b.tabIndex=b.dataset.online===value?0:-1;});$('#code-field').hidden=value!=='join';updateSetup();}
function updateSetup(){
 if(!$('#start-button'))return;
 $('#penalty-setup').hidden=mode==='online'&&onlineAction==='join';
 $('#start-button').innerHTML=busy?'Un instant…':`${mode==='local'?'Jouer':onlineAction==='create'?'Créer le salon':'Rejoindre le salon'} <span aria-hidden="true">→</span>`;
 $('#start-button').disabled=busy;
 $('#setup-note').textContent=mode==='local'?(penaltyMode==='random'?'Les défis seront tirés au hasard pendant la partie.':'Les prénoms et défis restent sur cet appareil.'):onlineAction==='create'?'Partage le code, puis lance la partie.':'Entre le code reçu. Pas besoin de compte.';
}
function setupError(text){if($('#setup-error')){$('#setup-error').hidden=!text;$('#setup-error').textContent=text;if(text)$('#setup-error').scrollIntoView({block:'nearest'});}else toast(text);}
function reindex(){const rows=[...document.querySelectorAll('.player-input-row')];rows.forEach((row,i)=>{row.querySelector('.player-number').textContent=String(i+1).padStart(2,'0');const input=row.querySelector('input');input.placeholder=`Joueur ${i+1}`;input.setAttribute('aria-label',`Prénom du joueur ${i+1}`);const b=row.querySelector('button');b.disabled=rows.length<=2;b.setAttribute('aria-label',`Retirer le joueur ${i+1}`);b.onclick=()=>{row.remove();reindex();};});$('#player-count').textContent=`${rows.length}/12`;$('#add-player').hidden=rows.length>=12;}
function paintPenalties(){const draft=$('#penalty-draft');$('#penalty-list').innerHTML=penalties.map((p,i)=>`<div class="penalty-chip"><span>${escape(p)}</span><button type="button" class="icon-button" data-remove-penalty="${i}" aria-label="Retirer le défi ${escape(p)}">×</button></div>`).join('');document.querySelectorAll('[data-remove-penalty]').forEach(b=>b.onclick=()=>{penalties.splice(Number(b.dataset.removePenalty),1);paintPenalties();});$('.penalty-input').hidden=penalties.length>=8;$('#suggestions').hidden=penalties.length>=8;$('.alcohol-suggestion').hidden=penalties.length>=8||penalties.includes(ALCOHOL_CHALLENGE);document.querySelectorAll('[data-suggestion]').forEach(button=>button.hidden=penalties.includes(button.dataset.suggestion));draft.disabled=penalties.length>=8;$('#challenge-count').textContent=penaltyMode==='random'?`${CHALLENGE_CATALOG.length+Number(includeAlcohol)} au hasard`:penalties.length?`${penalties.length} choisi${penalties.length>1?'s':''}`:'À choisir';}
function selectPenaltyMode(value){penaltyMode=value;document.querySelectorAll('[data-penalty-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.penaltyMode===value)));$('#custom-challenges').hidden=value!=='custom';$('#random-challenges').hidden=value!=='random';paintPenalties();updateSetup();}
function addPenalty(value=$('#penalty-draft').value){const v=value.trim();if(v&&!penalties.includes(v)&&penalties.length<8){penalties.push(v.slice(0,120));$('#penalty-draft').value='';paintPenalties();}}
function bindGuide(){document.querySelectorAll('.guide-skip').forEach(b=>b.onclick=()=>{guideStage=3;remember('purple-guide-v1',3);renderGame();});}
const defaultPenalties=['Imiter un animal','Chanter un refrain','Faire un compliment sincère'];
function showSetup(joinCode){
 purpleReveal.cancel();
 stopPolling();screen='setup';farView=false;immersive=true;drawingChoice=null;setScreen('setup');game=null;room=null;credentials=null;busy=false;lastAnimation=null;$('#connection').hidden=true;
 app.innerHTML=setupHTML;mode='local';onlineAction='create';bindSetup();
 if(joinCode){setMode('online');setOnline('join');$('#room-code').value=joinCode;}
 syncAccount();social.roomChanged();
}
function bindSetup(){
 const prefs=saved('purple-preferences-v2');
 penalties=Array.isArray(prefs?.penalties)&&prefs.penalties.length?prefs.penalties.filter(p=>typeof p==='string'&&p.trim()).slice(0,8):[...defaultPenalties];
 penaltyMode=prefs?.penaltyMode==='random'?'random':'custom';includeAlcohol=prefs?.includeAlcohol===true;
 $('#suggestions').innerHTML=CHALLENGE_CATALOG.map(challenge=>`<button type="button" data-suggestion="${escape(challenge)}">+ ${escape(challenge)}</button>`).join('');
 $('#random-alcohol').checked=includeAlcohol;$('#random-alcohol').onchange=e=>{includeAlcohol=e.target.checked;paintPenalties();};
 document.querySelectorAll('[data-penalty-mode]').forEach(b=>b.onclick=()=>selectPenaltyMode(b.dataset.penaltyMode));
 $('#hero-cards').innerHTML=card(cardInfo(0))+card(cardInfo(26));
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
 document.querySelectorAll('[data-online]').forEach(b=>b.onclick=()=>setOnline(b.dataset.online));
 document.querySelectorAll('[role=tablist]').forEach(bindTabKeys);
 function appendPlayer(value=''){
  const row=document.createElement('div');row.className='player-input-row';
  row.innerHTML='<span class="player-number"></span><input name="player" maxlength="24" autocomplete="off"><button type="button" class="icon-button remove-player">×</button>';
  row.querySelector('input').value=value;$('#player-inputs').append(row);return row;
 }
 if(Array.isArray(prefs?.players)&&prefs.players.length>=2){
  $('#player-inputs').innerHTML='';prefs.players.slice(0,12).forEach(name=>appendPlayer(String(name).slice(0,24)));
 }
 reindex();
 $('#add-player').onclick=()=>{if(document.querySelectorAll('input[name=player]').length>=12)return;const row=appendPlayer();reindex();row.querySelector('input').focus();};
 $('#add-penalty').onclick=()=>addPenalty();$('#penalty-draft').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();addPenalty();}};
 document.querySelectorAll('[data-suggestion]').forEach(b=>b.onclick=()=>addPenalty(b.dataset.suggestion));
 $('#room-code').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'');
 $('#setup-form').onsubmit=start;
 const local=saved('peuple-local'),online=saved('peuple-room');
 if(local?.format===1&&local.players?.length>=2||online?.code){$('#resume').hidden=false;$('#resume').onclick=resume;}
 const invite=new URL(location.href).searchParams.get('salon');
 if(invite&&/^[A-Z2-9]{6}$/.test(invite.toUpperCase())){setMode('online');setOnline('join');$('#room-code').value=invite.toUpperCase();}
 selectPenaltyMode(penaltyMode);syncAccount();
}
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
function prepareFriendRoom(){
 if(busy||purpleReveal.current){toast('Attends la fin du tirage pour créer un salon.');return;}
 if(room&&game?.phase!=='ended'){toast('Tu peux déjà inviter tes amis dans ce salon.');social.open();return;}
 showSetup();setMode('online');setOnline('create');$('#host-name').value=accountName();
 window.scrollTo(0,0);toast('Choisis tes défis, puis crée le salon. Tu pourras inviter tes amis depuis Amis.');
}
async function joinFriendRoom(code){
 if(!account){pendingFriendsOpen=true;openAccount('login');return false;}
 if(busy||purpleReveal.current){toast('Attends la fin du tirage avant de rejoindre un autre salon.');return false;}
 if(room?.code===code){toast('Tu es déjà dans ce salon.');return true;}
 if(game&&game.phase!=='ended'){
  const confirmed=await new Promise(resolve=>{
   dialog('Rejoindre cette table ?',`<p>${room?'Tu quittes ton salon actuel pour rejoindre ton ami.':'Ta partie sur ce téléphone sera remplacée par celle de ton ami.'}</p><div class="confirm-actions"><button class="secondary-button" id="cancel-invite">Rester ici</button><button class="primary-button" id="confirm-invite">Rejoindre</button></div>`);
   const modal=$('#help');let settled=false;
   const finish=value=>{if(settled)return;settled=true;modal.removeEventListener('close',closed);modal.close();resolve(value);};
   const closed=()=>finish(false);modal.addEventListener('close',closed);
   $('#cancel-invite').onclick=()=>finish(false);$('#confirm-invite').onclick=()=>finish(true);
  });
  if(!confirmed)return false;
 }
 const priorRoom=room,priorIdent=credentials,previousJoin=saved('purple-invite-join');
 const ident=previousJoin?.code===code&&previousJoin.accountId===account.id?previousJoin:{code,playerId:crypto.randomUUID(),token:secret(),accountId:account.id};
 remember('purple-invite-join',ident);busy=true;
 try{
  // Join successfully before leaving the old room, so an unavailable invitation keeps the current game.
  const next=await request({type:'join',code,name:account.name,playerId:ident.playerId,token:ident.token},ident);
  if(priorRoom&&priorIdent){
   let left=false,version=priorRoom.version;
   for(let attempt=0;attempt<3&&!left;attempt++){
    try{await request({type:'leave',code:priorRoom.code,version,requestId:crypto.randomUUID()},priorIdent);left=true;}
    catch(problem){if([403,404].includes(problem.status)){left=true;break;}if(problem.status!==409)break;try{version=(await request(null,priorIdent)).version;}catch{break;}}
   }
   if(!left)toast('Ton ami est rejoint. La sortie de l’ancien salon n’a pas pu être confirmée.');
  }
  stopPolling();purpleReveal.cancel();room=null;game=null;credentials=ident;busy=false;immersive=true;lastAnimation=null;
  remember('peuple-room',ident);remember('purple-invite-join',null);remember('peuple-local',null);acceptRoom(next);startPolling();window.scrollTo(0,0);return true;
 }catch(problem){busy=false;if(problem.status&&problem.status<500)remember('purple-invite-join',null);toast(problem.message);return false;}
}
async function request(body=null,ident=credentials){const headers={'Content-Type':'application/json'};if(ident){headers['X-Player-Id']=ident.playerId;headers.Authorization=`Bearer ${ident.token}`;}const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);try{const res=await fetch(body?'/api/rooms':`/api/rooms?code=${encodeURIComponent(ident.code)}`,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store',signal:controller.signal});let data;try{data=await res.json();}catch{throw Error('Le salon ne répond pas. Réessaie dans un instant.');}if(!res.ok){const e=Error(data.error||'Le salon ne répond pas.');e.status=res.status;throw e;}return data;}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('Connexion interrompue. Réessaie lorsque Internet est disponible.');throw e;}finally{clearTimeout(timeout);}}
function acceptRoom(next){
 if(!credentials||next.code!==credentials.code)return;
 if(room&&room.version>next.version)return;
 const changed=!room||room.version!==next.version,previous=game;
 if(!room&&next.game.phase==='playing')lastAnimation=next.game.last?.id;
 room=next;game=next.game;$('#connection').hidden=true;
 if(changed||screen==='setup'){
  screen='game';
  if(isNewPurple(previous,game))purpleReveal.start(previous,game,reducedMotion());
  else{
   if(purpleReveal.current&&purpleReveal.current.last.id!==game.last?.id)purpleReveal.cancel();
   renderGame();
  }
 }
}
async function start(e){e.preventDefault();if(busy)return;setupError('');const names=mode==='local'?[...document.querySelectorAll('input[name=player]')].map((x,i)=>x.value.trim()||`Joueur ${i+1}`):[$('#host-name').value.trim()];const selected=[...penalties,...($('#penalty-draft').value.trim()&&penalties.length<8?[$('#penalty-draft').value.trim()]:[])],actions=penaltyMode==='random'?[...CHALLENGE_CATALOG,...(includeAlcohol?[ALCOHOL_CHALLENGE]:[])]:selected,prefs={players:names,penalties:selected,penaltyMode,includeAlcohol};try{if(mode==='local'){game=createGame(names,actions,false,penaltyMode);remember('purple-preferences-v2',prefs);room=null;credentials=null;remember('peuple-room',null);remember('peuple-local',game);screen='game';if(guideStage===0){guideStage=1;remember('purple-guide-v1',1);}window.scrollTo(0,0);renderGame();return;}if(!names[0])throw Error('Entre ton prénom pour rejoindre la table.');if(onlineAction==='create'&&!actions.length)throw Error('Choisissez au moins une action pour les pénalités.');const code=onlineAction==='join'?$('#room-code').value.trim():newRoomCode();if(!/^[A-Z2-9]{6}$/.test(code))throw Error('Entre le code de salon à 6 caractères.');busy=true;updateSetup();credentials={code,playerId:crypto.randomUUID(),token:secret()};remember('peuple-room',credentials);const data=await request({type:onlineAction,code,name:names[0],penalties:actions,penaltyMode,playerId:credentials.playerId,token:credentials.token});remember('peuple-local',null);if(onlineAction==='create')remember('purple-preferences-v2',{...prefs,players:saved('purple-preferences-v2')?.players});busy=false;if(guideStage===0){guideStage=1;remember('purple-guide-v1',1);}acceptRoom(data);startPolling();}catch(err){busy=false;setupError(err.message);updateSetup();if(err.status&&err.status<500){remember('peuple-room',null);credentials=null;}else if(credentials){$('#resume').hidden=false;$('#resume').onclick=resume;}}}
async function resume(){if(busy)return;const ident=saved('peuple-room');if(ident?.code){credentials=ident;busy=true;updateSetup();try{const data=await request();busy=false;acceptRoom(data);startPolling();}catch(e){busy=false;setupError(e.message);updateSetup();if([403,404].includes(e.status)){remember('peuple-room',null);credentials=null;}}return;}const local=saved('peuple-local');if(local?.format===1&&Array.isArray(local.players)&&local.players.length>=2&&['playing','penalty','passed','ended'].includes(local.phase)){game=local;room=null;credentials=null;screen='game';lastAnimation=local.phase==='playing'?local.last?.id:null;renderGame();}else{remember('peuple-local',null);setupError('La sauvegarde est indisponible. Crée une nouvelle partie.');}}
function stopPolling(){clearTimeout(pollTimer);pollTimer=null;}
function startPolling(){stopPolling();const tick=async()=>{if(!credentials||screen!=='game')return;try{if(!busy)acceptRoom(await request());}catch(e){$('#connection').textContent=[403,404].includes(e.status)?e.message:'Connexion interrompue. La partie sera actualisée dès le retour d’Internet.';$('#connection').hidden=true;$('#connection').hidden=false;}if(credentials&&screen==='game')pollTimer=setTimeout(tick,document.hidden?8000:1500);};pollTimer=setTimeout(tick,1500);}
function renderGame(){
 if(!game)return;
 const priorFocus=document.activeElement?.dataset?.choice;
 const reveal=purpleReveal.current;
 const view={game,room,credentials,busy:busy||!!reveal,drawingChoice,lastAnimation:purpleReveal.completedId===game.last?.id?game.last.id:lastAnimation,guideStage,farView,reveal,immersive,soundOn,fullscreenAvailable:!!document.fullscreenEnabled,fullscreenActive:!!document.fullscreenElement};
 const phase=reveal?'playing':game.phase;
 setScreen(['lobby','waiting'].includes(phase)?'lobby':phase==='ended'?'ended':'game');
 if(phase==='lobby'||phase==='waiting')app.innerHTML=renderLobby(view);
 else if(phase==='ended')app.innerHTML=renderSummary({...view,ranked:ranking(game)});
 else app.innerHTML=renderTable(view);
 purpleReveal.consumeAnimation();
 if(!reveal&&!drawingChoice&&game.last&&game.last.id!==lastAnimation){
  feedback(game.last,phase==='passed'||phase==='ended'&&game.last.correct&&game.last.streak>=3);
  lastAnimation=game.last.id;
 }
 bindGame();social.roomChanged();
 if(priorFocus&&!busy){const b=document.querySelector(`[data-choice="${priorFocus}"]`);if(b&&!b.disabled)b.focus({preventScroll:true});}
}
function bindGame(){
 bindGuide();
 if($('#immersive-toggle'))$('#immersive-toggle').onclick=()=>{immersive=!immersive;farView=false;renderGame();window.scrollTo(0,0);};
 if($('#game-scores'))$('#game-scores').onclick=()=>dialog('Défis des joueurs',roster(purpleReveal.current?.before||game,credentials));
 if($('#game-account'))$('#game-account').onclick=()=>openAccount();
 if($('#game-install'))$('#game-install').onclick=()=>document.querySelector('[data-help=install]').click();
 if($('#game-sound'))$('#game-sound').onclick=()=>{
  $('#sound-toggle').click();
  $('#game-sound').textContent=soundOn?'Couper le son':'Activer le son';
  $('#game-sound').setAttribute('aria-pressed',String(soundOn));
 };
 if($('#game-fullscreen'))$('#game-fullscreen').onclick=async()=>{
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else await document.documentElement.requestFullscreen();
  }catch{toast('Plein écran indisponible ici. Le mode immersif reste actif.');}
 };
 if($('#far-view'))$('#far-view').onclick=()=>{farView=!farView;renderGame();};
 if($('#game-rules'))$('#game-rules').onclick=()=>dialog('Le Purple, en 30 secondes.',rules);
 document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>action({type:'guess',choice:b.dataset.choice}));
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action({type:b.dataset.action}));
 if($('#copy-code'))$('#copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);toast('Code copié.');}catch{toast(`Code du salon : ${room.code}`);}};
 if($('#share-room'))$('#share-room').onclick=async()=>{
  const url=`${location.origin}/?salon=${room.code}`;
  try{if(navigator.share)await navigator.share({title:'Le Purple',text:`Rejoins ma table avec le code ${room.code}.`,url});else{await navigator.clipboard.writeText(url);toast('Lien copié. Partage-le aux autres joueurs.');}}
  catch(e){if(e.name!=='AbortError')toast(`Le code à partager : ${room.code}`);}
 };
 if($('#quit'))$('#quit').onclick=()=>{
  const online=!!room;
  dialog(online?'Quitter cette table ?':'Afficher le classement ?',online?'<p>Tu quittes le salon. Les autres peuvent continuer et tu peux revenir avec le code.</p><div class="confirm-actions"><button class="secondary-button" id="cancel-end">Rester</button><button class="primary-button" id="confirm-end">Quitter la table</button></div>':'<p>La partie se termine ici. Tu pourras lancer la revanche avec le même groupe.</p><div class="confirm-actions"><button class="secondary-button" id="cancel-end">Continuer</button><button class="primary-button" id="confirm-end">Voir le classement</button></div>');
  $('#cancel-end').onclick=()=>$('#help').close();$('#confirm-end').onclick=async()=>{$('#help').close();await action({type:online?'leave':'end'});};
 };
 if($('#end-game'))$('#end-game').onclick=()=>{
  dialog('Terminer la partie pour tous ?','<p>Le classement final sera affiché à tous les joueurs.</p><div class="confirm-actions"><button class="secondary-button" id="cancel-end">Continuer</button><button class="primary-button" id="confirm-end">Terminer</button></div>');
  $('#cancel-end').onclick=()=>$('#help').close();$('#confirm-end').onclick=async()=>{$('#help').close();await action({type:'end'});};
 };
 if($('#new-game'))$('#new-game').onclick=()=>{
  if(room){action({type:'leave'});return;}
  remember('peuple-local',null);remember('peuple-room',null);showSetup();window.scrollTo(0,0);
 };
}
async function action(input,throwOnError=false){
 if(busy||purpleReveal.current||!game)return;
 busy=true;drawingChoice=input.type==='guess'?input.choice:null;
 if(soundOn)unlockAudio();if(drawingChoice)sound('draw');renderGame();
 try{
  const delay=new Promise(resolve=>setTimeout(resolve,input.type==='guess'&&!reducedMotion()?230:0));
  let next;
  if(room){
   [next]=await Promise.all([request({...input,code:room.code,version:room.version,requestId:crypto.randomUUID()}),delay]);
   if(input.type==='leave'){
    const code=next.game.phase==='ended'?null:room.code;remember('peuple-room',null);showSetup(code);window.scrollTo(0,0);toast('Tu as quitté la table.');return;
   }
  }else{next=applyAction(game,input);await delay;}
  drawingChoice=null;
  if(['start','rematch'].includes(input.type))immersive=true;
  if(room)acceptRoom(next);else{
   const previous=game;game=next;remember('peuple-local',game);
   if(isNewPurple(previous,game))purpleReveal.start(previous,game,reducedMotion());else renderGame();
  }
  // Do not allow another action, show scores or play result sounds before card two.
  if(purpleReveal.current)await purpleReveal.done;
  else if(input.type==='guess'&&!reducedMotion())await new Promise(resolve=>setTimeout(resolve,580));
  busy=false;renderGame();
  if(['next','start','ack','rematch','end'].includes(input.type))window.scrollTo(0,0);
 }catch(e){
  busy=false;drawingChoice=null;
  if(room){try{acceptRoom(await request());}catch{}}
  renderGame();toast(e.message);if(throwOnError)throw e;
 }
}

// Shortcuts match the three labeled choices; form fields and dialogs keep their keys.
document.addEventListener('keydown',e=>{
 if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||e.target.closest('input,textarea,select,button,summary,a,[contenteditable="true"]'))return;
 const choice={r:'red',n:'black',p:'purple'}[e.key.toLowerCase()];
 if(choice&&screen==='game'&&game?.phase==='playing'){const button=document.querySelector(`[data-choice="${choice}"]`);if(button&&!button.disabled){e.preventDefault();button.click();}}
});

bindSetup();
document.addEventListener('fullscreenchange',()=>{
 const button=$('#game-fullscreen');
 if(button)button.textContent=document.fullscreenElement?'Quitter le plein écran':'Plein écran du navigateur';
});
if('serviceWorker'in navigator&&window.isSecureContext)navigator.serviceWorker.register('/sw.js').catch(()=>{});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&credentials&&screen==='game'){request().then(acceptRoom).catch(()=>{});startPolling();}});
// Expose the same visible journey to browsers supporting WebMCP.
if(document.modelContext?.registerTool){const life=new AbortController();const register=t=>Promise.resolve(document.modelContext.registerTool(t,{signal:life.signal})).catch(()=>{});register({name:'read_peuple_table',description:'Read the visible table and whose turn it is.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({screen,code:room?.code??null,game:game?(room?game:publicGame(game)):null})});register({name:'guess_peuple_color',description:'Draw cards by choosing red, black or purple for the active player. Updates points and real-world penalties.',inputSchema:{type:'object',properties:{choice:{type:'string',enum:['red','black','purple']}},required:['choice'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},async execute(input){if(!input||!['red','black','purple'].includes(input.choice))throw Error('Invalid color');if(busy||game?.phase!=='playing'||room&&game.players[game.current].id!==credentials.playerId)throw Error('It is not your turn to draw');await action({type:'guess',choice:input.choice},true);return {phase:game.phase,streak:game.streak,last:game.last};}});window.addEventListener('pagehide',()=>life.abort(),{once:true});}
