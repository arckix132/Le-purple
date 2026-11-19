import {escape as esc} from './cards.mjs';

const prettyCode=code=>code?code.slice(0,4)+'-'+code.slice(4):'…';
const actionButton=(action,id,text,busy,extra='')=>`<button type="button" class="social-button ${extra}" data-social-action="${action}" data-id="${esc(id)}" ${busy?'disabled':''}>${text}</button>`;
const avatar=name=>`<span class="avatar" aria-hidden="true">${esc(name.slice(0,1).toUpperCase())}</span>`;
export function renderSocial({data=null,room=null,busy=false,error='',stale=false,removingId=null,draft=''}){
 const ready=!!data,canInvite=!!room&&room.game.phase!=='ended'&&room.game.players.length<12;
 const friends=[...(data?.friends||[])].sort((a,b)=>Number(b.online)-Number(a.online)||a.name.localeCompare(b.name,'fr'));
 const requests=data?.incoming||[],sent=data?.outgoing||[],invites=data?.invitations||[];
 return `<div class="friend-code-panel"><span>TON CODE AMI</span><div><strong>${esc(prettyCode(data?.friendCode))}</strong><button type="button" class="social-button" data-social-action="copy" ${!ready||busy?'disabled':''}>Copier</button><button type="button" class="social-button" data-social-action="share" ${!ready||busy?'disabled':''}>Partager</button></div><p>Partage ton code. Ton ami t’envoie une demande, puis tu l’acceptes.</p></div>
 <form id="friend-add-form" class="friend-add-form"><label for="friend-code-input">Ajouter un ami avec son code</label><div><input class="text-input" id="friend-code-input" value="${esc(draft)}" maxlength="12" placeholder="ABCD-EFGH" autocomplete="off" autocapitalize="characters" spellcheck="false" required><button type="submit" class="social-button social-primary" ${!ready||busy?'disabled':''}>Ajouter</button></div></form>
 ${error?`<p class="error-message" role="alert">${esc(error)}</p><button class="social-button" type="button" data-social-action="refresh" ${busy?'disabled':''}>Actualiser</button>`:''}
 ${!ready&&!error?'<p role="status">Chargement de tes amis…</p>':''}
 ${invites.length?`<section class="social-section"><h3>Invitations à jouer <span>${invites.length}</span></h3>${invites.map(i=>`<div class="social-invitation"><div>${avatar(i.name)}<p><strong>${esc(i.name)}</strong><span>t’invite à rejoindre sa table</span></p></div><div class="social-row-actions">${actionButton('join',i.id,'Rejoindre',busy,'social-primary')}${actionButton('decline-invite',i.id,'Refuser',busy)}</div></div>`).join('')}<p class="social-note">Valables 15 minutes, tant que le salon est ouvert.</p></section>`:''}
 ${requests.length?`<section class="social-section"><h3>Demandes reçues <span>${requests.length}</span></h3>${requests.map(f=>`<div class="social-row">${avatar(f.name)}<div class="social-person"><strong>${esc(f.name)}</strong><small>${esc(prettyCode(f.friendCode))}</small></div><div class="social-row-actions">${actionButton('accept',f.id,'Accepter',busy,'social-primary')}${actionButton('decline',f.id,'Refuser',busy)}</div></div>`).join('')}</section>`:''}
 <section class="social-section"><div class="social-section-heading"><h3>Mes amis <span>${friends.length}</span></h3><span>${stale?'Statuts indisponibles':`${friends.filter(f=>f.online).length} en ligne`}</span></div>
 ${friends.length?friends.map(f=>`<div class="social-row">${avatar(f.name)}<div class="social-person"><strong>${esc(f.name)}</strong><small class="presence ${!stale&&f.online?'is-online':''}"><i aria-hidden="true"></i>${stale?'Statut indisponible':f.online?'En ligne':'Hors ligne'}</small></div><div class="social-row-actions">${actionButton('invite',f.id,'Inviter',busy||!canInvite,'social-primary')}<details class="friend-menu"><summary aria-label="Options pour ${esc(f.name)}">•••</summary>${actionButton('remove',f.id,'Retirer des amis',busy)}</details></div></div>${removingId===f.id?`<div class="friend-remove-confirm"><p>Retirer ${esc(f.name)} de tes amis ?</p>${actionButton('confirm-remove',f.id,'Retirer',busy)}${actionButton('cancel-remove',f.id,'Garder',busy)}</div>`:''}`).join(''):'<p class="social-empty">Ta prochaine table commence ici.<br>Ajoute un ami avec son code.</p>'}
 <p class="social-note">En ligne = actif dans Le Purple depuis moins de 90 secondes. Visible uniquement par tes amis.</p>
 ${canInvite?`<p class="social-room-note">Les invitations rejoindront ton salon <strong>${esc(room.code)}</strong>, même si ton ami est hors ligne.</p>`:`<div class="social-room-note"><p>${room?.game.players.length>=12?'Ton salon est complet.':room?.game.phase==='ended'?'Cette partie est terminée. Crée un nouveau salon pour inviter tes amis.':'Crée un salon en ligne pour inviter tes amis.'}</p><button type="button" class="social-button social-primary" data-social-action="create-room" ${busy?'disabled':''}>Créer un salon</button></div>`}</section>
 ${sent.length?`<details class="social-section social-sent"><summary>Demandes envoyées · ${sent.length}</summary>${sent.map(f=>`<div class="social-row"><div class="social-person"><strong>${esc(f.name)}</strong><small>En attente de réponse</small></div>${actionButton('cancel',f.id,'Annuler',busy)}</div>`).join('')}</details>`:''}
 <p class="social-note">Les invitations arrivent ici quand l’application est ouverte. Tes amis restent liés à ton compte sur tes autres appareils.</p>`;
}

export function createSocial({getAccount,getRoom,getCredentials,onRequireAccount,onJoin,onCreateRoom,onSessionExpired,toast,dialog}){
 const content=dialog.querySelector('#social-content');
 let data=null,accountId=null,timer=null,loading=false,busy=false,error='',stale=false,removingId=null,generation=0,lastNotifications=null;
 async function request(body){
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
  try{
   const response=await fetch('/api/social',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:abort.signal});
   const result=await response.json();if(!response.ok){const problem=Error(result.error||'Tes amis sont indisponibles.');problem.status=response.status;throw problem;}return result;
  }catch(problem){if(problem.name==='AbortError'||problem instanceof TypeError)throw Error('Connexion interrompue. Tes amis seront actualisés au retour d’Internet.');throw problem;}
  finally{clearTimeout(timeout);}
 }
 function badges(){
  const count=(data?.incoming.length||0)+(data?.invitations.length||0);
  document.querySelectorAll('[data-social-open]').forEach(button=>{
   const label=button.dataset.socialLabel||'Amis';button.textContent=label;
   if(count){const badge=document.createElement('span');badge.className='social-badge';badge.textContent=count;button.append(badge);}
   button.setAttribute('aria-label',count?`${label}, ${count} notification${count>1?'s':''}`:label);
  });
 }
 function paint(){
  badges();if(!dialog.open)return;
  const input=content.querySelector('#friend-code-input'),draft=input?.value||'',focus=document.activeElement;
  const focusKey=focus?.dataset.socialAction,focusId=focus?.dataset.id,inputFocused=focus===input,selection=input?.selectionStart,scroll=dialog.scrollTop;
  content.innerHTML=renderSocial({data,room:getRoom(),busy,error,stale,removingId,draft});
  if(inputFocused){const next=content.querySelector('#friend-code-input');next.focus({preventScroll:true});if(selection!==null&&selection!==undefined)next.setSelectionRange(selection,selection);}
  else if(focusKey){const next=[...content.querySelectorAll('[data-social-action]')].find(button=>button.dataset.socialAction===focusKey&&button.dataset.id===focusId);if(next&&!next.disabled)next.focus({preventScroll:true});}
  dialog.scrollTop=scroll;
 }
 function accept(next){
  data=next;stale=false;error='';
  const keys=new Set([...next.incoming.map(f=>'friend:'+f.id),...next.invitations.map(i=>'invite:'+i.id)]);
  if(lastNotifications&&[...keys].some(key=>!lastNotifications.has(key)))toast('Tu as une nouvelle demande ou invitation dans Amis.');
  lastNotifications=keys;paint();
 }
 async function refresh(){
  if(loading||busy||!getAccount()||document.hidden)return;
  const current=generation;loading=true;
  try{const next=await request({type:'heartbeat'});if(current===generation)accept(next);}
  catch(problem){if(current===generation){error=problem.message;stale=true;paint();if(problem.status===401){stop();onSessionExpired();}}}
  finally{loading=false;}
 }
 function schedule(){clearTimeout(timer);if(!accountId)return;timer=setTimeout(async()=>{await refresh();schedule();},25000);}
 function stop(){generation++;clearTimeout(timer);timer=null;accountId=null;data=null;error='';stale=false;removingId=null;lastNotifications=null;paint();}
 function sync(){
  const id=getAccount()?.id;
  if(!id){if(accountId)stop();else badges();return;}
  if(id!==accountId){stop();accountId=id;refresh().then(schedule);}
  else badges();
 }
 function open(){
  if(!getAccount()){onRequireAccount();return;}
  if(!dialog.open)dialog.showModal();paint();refresh();
 }
 async function mutate(body,message){
  if(busy)return;busy=true;error='';paint();const current=generation;
  try{const next=await request(body);if(current===generation){accept(next);if(message)toast(message);}return current===generation;}
  catch(problem){if(current===generation){error=problem.message;if(problem.status===401){stop();dialog.close();onSessionExpired();onRequireAccount();}}return false;}
  finally{busy=false;paint();}
 }
 dialog.querySelector('.close-dialog').onclick=()=>dialog.close();
 content.addEventListener('submit',async event=>{
  if(event.target.id!=='friend-add-form')return;event.preventDefault();const input=content.querySelector('#friend-code-input'),code=input.value;
  if(await mutate({type:'request',code},'Demande envoyée. Ton ami peut maintenant l’accepter.')){content.querySelector('#friend-code-input').value='';}
 });
 content.addEventListener('click',async event=>{
  const button=event.target.closest('[data-social-action]');if(!button||button.disabled||busy)return;
  const action=button.dataset.socialAction,id=button.dataset.id;
  if(action==='refresh'){refresh();return;}
  if(action==='copy'||action==='share'){
   try{if(action==='share'&&navigator.share)await navigator.share({title:'Ajoute-moi sur Le Purple',text:`Mon code ami Le Purple : ${prettyCode(data.friendCode)}.`,url:location.origin});else{await navigator.clipboard.writeText(prettyCode(data.friendCode));toast('Ton code ami est copié.');}}
   catch(problem){if(problem.name!=='AbortError')toast(`Ton code ami : ${prettyCode(data.friendCode)}`);}return;
  }
  if(action==='create-room'){dialog.close();onCreateRoom();return;}
  if(action==='remove'){removingId=id;paint();return;}
  if(action==='cancel-remove'){removingId=null;paint();return;}
  if(action==='confirm-remove'){if(await mutate({type:'remove',friendId:id},'Cette personne a été retirée de tes amis.'))removingId=null;paint();return;}
  if(['accept','decline','cancel'].includes(action)){await mutate({type:action,friendId:id},action==='accept'?'Vous êtes maintenant amis.':action==='decline'?'Demande refusée.':'Demande annulée.');return;}
  if(action==='invite'){
   const room=getRoom(),ident=getCredentials();if(!room||!ident){error='Crée ou rejoins un salon avant d’inviter.';paint();return;}
   await mutate({type:'invite',friendId:id,roomCode:room.code,playerId:ident.playerId,token:ident.token},'Invitation envoyée dans Le Purple.');return;
  }
  if(action==='decline-invite'){await mutate({type:'resolve_invite',inviteId:id,decision:'declined'},'Invitation refusée.');return;}
  if(action==='join'){
   busy=true;error='';paint();const current=generation;
   try{
    const invite=await request({type:'open_invite',inviteId:id});if(current!==generation)return;
    dialog.close();const joined=await onJoin(invite.roomCode);
    if(joined){try{const next=await request({type:'resolve_invite',inviteId:id,decision:'accepted'});if(current===generation)accept(next);}catch{/* The room is already joined; a later refresh can retry the invitation. */}}
    else if(current===generation){dialog.showModal();}
   }catch(problem){if(current===generation){error=problem.message;toast(problem.message);}}
   finally{busy=false;paint();}
  }
 });
 document.addEventListener('click',event=>{if(event.target.closest('[data-social-open]'))open();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){refresh();schedule();}});
 return {open,sync,refresh,badges,stop,roomChanged:()=>{if(dialog.open)paint();else badges();}};
}
