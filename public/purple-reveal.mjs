// Presentation only: the engine still draws the two cards atomically.
export function isNewPurple(before,after){
 return before?.phase==='playing'&&after?.last?.choice==='purple'&&after.last.cards.length===2&&before.last?.id!==after.last.id;
}
export function createPurpleReveal(render,{setTimer=setTimeout,clearTimer=clearTimeout}={}){
 let current=null,timer=null,resolveDone=null,done=Promise.resolve(false),completedId=null;
 function cancel(){clearTimer(timer);timer=null;current=null;resolveDone?.(false);resolveDone=null;}
 return {
  get current(){return current;},get done(){return done;},get completedId(){return completedId;},
  cancel,
  consumeAnimation(){if(current)current.animateIndex=-1;},
  start(before,after,reducedMotion=false){
   cancel();
   current={before,last:after.last,visible:1,animateIndex:reducedMotion?-1:0};
   done=new Promise(resolve=>{resolveDone=resolve;});
   render();
   // Schedule the second hold only after it is rendered, including in background tabs.
   timer=setTimer(()=>{
    current={...current,visible:2,animateIndex:reducedMotion?-1:1};render();
    timer=setTimer(()=>{
     completedId=after.last.id;current=null;timer=null;
     const finish=resolveDone;resolveDone=null;render();finish?.(true);
    },after.phase==='ended'?1600:900);
   },reducedMotion?750:1100);
   return done;
  }
 };
}
