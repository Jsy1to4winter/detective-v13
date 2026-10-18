/* Root editor only. Server-side root identity checks also protect every action. */
(() => {
  'use strict';
  if (DetectiveCloud.isChild) return;
  const group = document.createElement('div'); group.className = 'admin-group link-manager';
  group.innerHTML = '<h3>分发专属子链接</h3><p class="admin-tip">每份资料从原始模板开始，独立保存。持有人只需编辑密码，不能再分发链接。</p><label class="admin-label">子链接编号<input id="childSlug" maxlength="64" autocomplete="off"></label><label class="admin-label">独立编辑密码<input id="childPassword" type="text" autocomplete="off" spellcheck="false" maxlength="64"></label><p class="admin-tip">密码须为 12–64 个字符。请把链接和密码分别交给使用者，密码不会出现在链接里。</p><div class="link-actions"><button type="button" class="admin-save" id="childGenerate">重新生成</button><button type="button" class="admin-save" id="childCreate">创建子链接</button><button type="button" class="admin-save" id="childList">读取管理列表</button></div><p class="admin-tip" id="childStatus" role="status"></p><div id="childResult" hidden><label class="admin-label">链接<input id="childResultUrl" readonly></label><label class="admin-label">本次密码（请自行保管）<input id="childResultPassword" readonly></label><button type="button" class="admin-save" id="childCopy">复制链接和密码</button></div><div id="childLinks"></div>';
  document.querySelector('#adminOverlay .admin-body').prepend(group);
  const $ = id => document.getElementById(id);
  let busy = false;
  const password = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  };
  function generate() {$('childSlug').value = 'p_' + crypto.randomUUID().replace(/-/g,'').slice(0,18); $('childPassword').value = password();}
  function link(slug) {const u = new URL(location.href);u.search = '';u.hash = '';u.searchParams.set('profile',slug);return u.href;}
  function result(slug,secret) {$('childResultUrl').value=link(slug);$('childResultPassword').value=secret;$('childResult').hidden=false;}
  function lock(value) {busy=value;group.querySelectorAll('button').forEach(b=>b.disabled=value);$('childSlug').disabled=value;$('childPassword').disabled=value;}
  async function run(operation) {
    if(busy)return;
    lock(true);$('childStatus').textContent='正在处理…';
    try{await operation();}catch(error){$('childStatus').textContent=error.message;}finally{lock(false);}
  }
  async function refresh() {
    const data = await DetectiveCloud.manageLinks('list');
    if(!Array.isArray(data.profiles))throw Error('管理列表返回异常，请检查函数部署。');
    $('childLinks').replaceChildren();
    for(const item of data.profiles) {
      if(typeof item.slug!=='string'||!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(item.slug))continue;
      const row=document.createElement('div');row.className='child-link-row';
      const a=document.createElement('a');a.href=link(item.slug);a.target='_blank';a.rel='noopener';a.textContent=item.slug;
      const reset=document.createElement('button');reset.type='button';reset.className='admin-save';reset.textContent='重置编辑密码';
      reset.onclick=()=>{
        if(busy||!confirm('重置 '+item.slug+' 的密码？旧密码和旧编辑会话将立即失效，资料和文件保留。'))return;
        const next=password();result(item.slug,next);
        run(async()=>{await DetectiveCloud.manageLinks('reset',{slug:item.slug,password:next});$('childStatus').textContent='密码已重置。请把本次密码交给持有人，旧编辑权限已撤销。';});
      };
      row.append(a,reset);$('childLinks').append(row);
    }
    return data.profiles.length;
  }
  $('childGenerate').onclick=generate;
  $('childCreate').onclick=()=>run(async()=>{
    const slug=$('childSlug').value.trim(),secret=$('childPassword').value;
    if(!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(slug)||['main','root'].includes(slug))throw Error('编号须为 3–64 位小写字母、数字、下划线或短横线，不能使用 main/root。');
    if(secret.length<12||secret.length>64||new TextEncoder().encode(secret).length>72)throw Error('密码须为 12–64 个字符，UTF-8 长度不超过 72 字节。');
    // Keep chosen credentials visible even if the request outcome is uncertain.
    result(slug,secret);
    await DetectiveCloud.manageLinks('create',{slug,password:secret});
    $('childStatus').textContent='子链接已创建。请保管下面的链接和密码；再次读取列表不会返回原密码。';
    try{await refresh();}catch(_){$('childStatus').textContent+=' 管理列表暂时读取失败，可稍后重试。';}
  });
  $('childList').onclick=()=>run(async()=>{const n=await refresh();$('childStatus').textContent='已读取 '+n+' 个子链接。列表不会显示原密码。';});
  $('childCopy').onclick=async()=>{
    try{await navigator.clipboard.writeText('链接：'+$('childResultUrl').value+'\n编辑密码：'+$('childResultPassword').value);$('childStatus').textContent='链接和密码已复制，请仅交给对应使用者。';}
    catch(_){$('childResultUrl').select();$('childStatus').textContent='自动复制未成功，请分别长按复制上方链接和密码。';}
  };
  // Do not leave generated passwords visible when the root editor closes.
  new MutationObserver(()=>{if(!document.getElementById('adminOverlay').classList.contains('show')){$('childResultPassword').value='';$('childResult').hidden=true;generate();}})
    .observe(document.getElementById('adminOverlay'),{attributes:true,attributeFilter:['class']});
  generate();
})();
