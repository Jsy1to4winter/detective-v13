/* Retry failed public images without altering the stored immutable file URL. */
(() => {
  'use strict';
  const bindings = new WeakMap();
  const active = new Set();
  function clear(img) {bindings.get(img)?.dispose();}
  function bind(img,src,host=img.parentElement) {
    const existing = bindings.get(img);
    if (existing?.src === src) return;
    clear(img);
    if (!src) {img.removeAttribute('src');return;}
    let timer,delay,attempt=0,disposed=false,loaded=false,failed=false;
    const feedback=document.createElement('div');feedback.className='media-feedback';feedback.setAttribute('role','status');
    const text=document.createElement('span');const retry=document.createElement('button');retry.type='button';retry.textContent='重新加载图片';retry.hidden=true;
    feedback.append(text,retry);host.append(feedback);
    img.decoding='async';
    const state={src,connected:()=>img.isConnected,retry:(onlyFailed=false)=>{if(!loaded&&!disposed&&(!onlyFailed||failed)){attempt=0;start();}},dispose:()=>{
      disposed=true;clearTimeout(timer);clearTimeout(delay);feedback.remove();active.delete(state);
      img.removeEventListener('load',success);img.removeEventListener('error',failure);bindings.delete(img);
    }};
    function success() {
      if(disposed||!img.naturalWidth)return;
      loaded=true;clearTimeout(timer);clearTimeout(delay);feedback.hidden=true;img.style.visibility='';
    }
    function failure() {
      if(disposed||loaded)return;
      clearTimeout(timer);clearTimeout(delay);
      if(!img.isConnected){state.dispose();return;}
      img.style.visibility='hidden';feedback.hidden=false;
      if(attempt<3) {text.textContent='图片连接不稳定，正在重试…';delay=setTimeout(start,attempt*500);}
      else {failed=true;text.textContent='图片未能加载，请检查网络后重试。';retry.hidden=false;}
    }
    function start() {
      if(disposed)return;
      if(!img.isConnected){state.dispose();return;}
      clearTimeout(timer);clearTimeout(delay);loaded=false;failed=false;attempt++;
      feedback.hidden=false;retry.hidden=true;text.textContent='图片加载中…';img.style.visibility='hidden';
      let target=src;
      if(attempt>1 || img.hasAttribute('src')) {
        const url=new URL(src,location.href);url.searchParams.set('_retry',Date.now().toString(36)+'-'+attempt);target=url.href;
      }
      img.src=target;timer=setTimeout(failure,12000);
      if(img.complete&&img.naturalWidth)success();
    }
    img.addEventListener('load',success);img.addEventListener('error',failure);
    retry.onclick=e=>{e.preventDefault();e.stopPropagation();attempt=0;start();};
    bindings.set(img,state);active.add(state);start();
  }
  // Remove timers/listeners for images replaced while switching dossiers.
  new MutationObserver(()=>{for(const state of active)if(!state.connected())state.dispose();}).observe(document.body,{childList:true,subtree:true});
  window.DetectiveImages={bind,clear};
  window.addEventListener('online',()=>{for(const state of active)state.retry();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)for(const state of active)state.retry(true);});
  window.addEventListener('pageshow',e=>{if(e.persisted)for(const state of active)state.retry(true);});
})();
