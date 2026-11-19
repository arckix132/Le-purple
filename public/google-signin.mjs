// Load GIS once and preserve its configuration when the account tabs change.
let sdkPromise=null;
export function loadGoogleSDK(){
 if(globalThis.google?.accounts?.id)return Promise.resolve(globalThis.google);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  let script=document.getElementById('google-identity-script');
  const timeout=setTimeout(()=>finish(Error('Google ne répond pas. Réessaie ou utilise la connexion par e-mail.')),10000);
  const finish=error=>{
   clearTimeout(timeout);
   if(error){script?.remove();reject(error);}
   else if(globalThis.google?.accounts?.id)resolve(globalThis.google);
   else reject(Error('La connexion Google n’a pas pu démarrer.'));
  };
  if(!script){script=document.createElement('script');script.id='google-identity-script';script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.referrerPolicy='strict-origin-when-cross-origin';document.head.append(script);}
  script.addEventListener('load',()=>finish(),{once:true});
  script.addEventListener('error',()=>finish(Error('Google est indisponible. Réessaie ou utilise ton e-mail.')),{once:true});
 }).catch(error=>{sdkPromise=null;throw error;});
 return sdkPromise;
}
export function createGoogleRenderer(loadSDK=loadGoogleSDK){
 let initializedClient=null,callback=null;
 return async(target,clientId,onCredential)=>{
  const sdk=await loadSDK();
  if(!target.isConnected)return;
  callback=onCredential;
  if(initializedClient!==clientId){
   sdk.accounts.id.initialize({client_id:clientId,ux_mode:'popup',auto_select:false,callback:result=>callback?.(result)});
   initializedClient=clientId;
  }
  target.innerHTML='';
  sdk.accounts.id.renderButton(target,{theme:'outline',size:'large',text:'continue_with',shape:'rectangular',logo_alignment:'left',width:Math.min(400,Math.floor(target.getBoundingClientRect().width)||340)});
 };
}
export const renderGoogleSignIn=createGoogleRenderer();
