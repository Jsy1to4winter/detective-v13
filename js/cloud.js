/* Public configuration only. The database and Storage RLS enforce ownership. */
(() => {
  'use strict';
  const URL = 'https://uzjvnbaspmnxmzdjwgtl.supabase.co';
  const KEY = 'sb_publishable_qVLBVRMphdAIkkPVuX3j0g_R0rMnjMT';
  const OWNER = '12b1d5ba-432f-47b5-857d-793347769c16';
  const BUCKET = 'detective-v13-media';
  const params = new URLSearchParams(location.search);
  const isChild = params.has('profile');
  const profile = isChild ? params.get('profile') : null;
  const validProfile = !isChild || (params.getAll('profile').length === 1 && /^[a-z0-9][a-z0-9_-]{2,63}$/.test(profile || '') && !['main','root'].includes(profile));
  const table = isChild ? 'detective_v13_profiles' : 'detective_v13_page';
  const identityColumn = isChild ? 'slug' : 'id';
  const identity = isChild ? profile : 1;
  const mediaFolder = isChild ? 'profiles/' + profile : OWNER;
  let row = null, client = null, queue = Promise.resolve(), pending = 0;
  let loadPromise;
  const validKey = k => /^(?:[0-2]-[0-5]|witness-portrait|poster-cover-[0-2]|case-background-music)$/.test(k);
  const notice = document.createElement('div');
  notice.className = 'cloud-notice';
  notice.setAttribute('role', 'status');
  const message = document.createElement('span');
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = '重新读取'; retry.hidden = true;
  notice.append(message, retry); document.body.append(notice);
  function status(text, bad = false) {
    message.textContent = text; notice.hidden = !text;
    notice.classList.toggle('cloud-error', bad); retry.hidden = !bad;
  }
  async function timedFetch(url, options = {}) {
    const controller = new AbortController();
    const external = options.signal;
    const abort = () => controller.abort();
    if (external?.aborted) abort(); else external?.addEventListener('abort', abort, {once:true});
    const timer = setTimeout(abort, 60000);
    try { return await fetch(url, {...options, signal:controller.signal}); }
    finally { clearTimeout(timer); external?.removeEventListener('abort', abort); }
  }
  function sdk() {
    if (!client) {
      if (!window.supabase?.createClient) throw Error('登录组件未能加载，请刷新页面后重试。');
      client = window.supabase.createClient(URL, KEY, {
        auth: {storageKey:isChild ? 'detective-v13-auth-child:' + profile : 'detective-v13-auth', persistSession:true, autoRefreshToken:true, detectSessionInUrl:false},
        global: {fetch:timedFetch}
      });
    }
    return client;
  }
  function validateRow(value) {
    if (!value || value[identityColumn] !== identity || (isChild ? !/^[a-f0-9-]{36}$/.test(value.owner_id || '') : value.owner_id !== OWNER) || !Number.isSafeInteger(value.revision)
        || !value.content || typeof value.content !== 'object' || Array.isArray(value.content)) {
      throw Error('云端数据结构不匹配，请检查数据库安装结果。');
    }
    return value;
  }
  async function load() {
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      status('正在读取云端资料…');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        if (!validProfile) throw Error('子链接编号无效，请使用主链接管理员提供的完整链接。');
        const response = await fetch(URL + '/rest/v1/' + table + '?' + identityColumn + '=eq.' + encodeURIComponent(identity) + '&select=' + identityColumn + ',owner_id,content,revision', {
          headers:{apikey:KEY}, cache:'no-store', signal:controller.signal
        });
        if (!response.ok) throw Error('云端读取失败（' + response.status + '），请检查网络和数据库安装。');
        const data = await response.json();
        if (!Array.isArray(data) || data.length !== 1) throw Error(isChild ? '这个子链接不存在，请联系主链接管理员。' : '没有找到云端资料，请先完成数据库安装。');
        row = validateRow(data[0]);
        status(''); window.dispatchEvent(new Event('detective-cloud-loaded'));
        return row;
      } catch (error) {
        const e = error.name === 'AbortError' ? Error('云端读取超时，请检查网络后重新读取。') : error;
        status(e.message || '云端读取失败，请检查网络。', true); throw e;
      } finally {clearTimeout(timer); loadPromise = null;}
    })();
    return loadPromise;
  }
  function current() {
    if (!row) throw Error('云端资料尚未读取成功，请先重新读取。');
    return row.content;
  }
  async function owner() {
    current();
    const {data, error} = await sdk().auth.getSession();
    if (error || !data.session || data.session.user.id !== row.owner_id) throw Error(isChild ? '请先用此子链接的编辑密码解锁。' : '请先使用管理员账号登录。');
    return data.session;
  }
  function enqueue(fn) {
    pending++;
    const task = queue.then(async () => {
      await owner(); status('正在保存到云端…');
      try {const result = await fn(); status(''); return result;}
      catch (e) { status(e.message || '保存失败，云端未确认保存。', true); throw e; }
    });
    queue = task.catch(() => {});
    return task.finally(() => {pending--;});
  }
  async function commit(content) {
    const before = row;
    const {data, error} = await sdk().from(table).update({content})
      .eq(identityColumn, identity).eq('revision', before.revision).select(identityColumn + ',owner_id,content,revision');
    if (error) throw Error('云端保存失败：' + error.message);
    if (!data || data.length !== 1) throw Error('资料已被其他页面更新，或当前登录已失效。请先保留未保存文字，再重新读取后编辑。');
    row = validateRow(data[0]);
  }
  function publicPath(src) {
    const prefix = URL + '/storage/v1/object/public/' + BUCKET + '/' + mediaFolder + '/';
    return typeof src === 'string' && src.startsWith(prefix) ? mediaFolder + '/' + src.slice(prefix.length) : null;
  }
  async function cleanup(src) {
    const path = publicPath(src);
    if (!path) return;
    // Never remove an object still referenced by another field.
    if (Object.values(row.content.media || {}).includes(src)) return;
    const {error} = await sdk().storage.from(BUCKET).remove([path]);
    if (error) console.warn('旧文件清理未完成；已保存的资料不受影响。');
  }
  async function removeMedia(k) {
    if (!validKey(k)) throw Error('无效素材位置。');
    return enqueue(async () => {
      const old = current().media?.[k];
      const media = {...(current().media || {})}; delete media[k];
      await commit({...current(), media});
      await cleanup(old).catch(() => {});
    });
  }
  async function putMedia(k, data) {
    if (!validKey(k)) throw Error('无效素材位置。');
    return enqueue(async () => {
      if (typeof data !== 'string' || !data.startsWith('data:')) throw Error('上传文件读取失败。');
      let blob = await (await fetch(data)).blob();
      const audio = k === 'case-background-music';
      // Browsers commonly label M4A as x-m4a; keep the bytes unchanged.
      if (audio && ['audio/x-m4a','audio/m4a','video/mp4'].includes(blob.type)) {
        blob = new Blob([blob], {type:'audio/mp4'});
      }
      const allowed = audio ? ['audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav','audio/webm']
        : ['image/jpeg','image/png','image/webp','image/gif','image/avif'];
      if (!allowed.includes(blob.type)) throw Error('不支持此文件类型，请选择常用图片或 MP3/M4A 音频。');
      if (blob.size > 50 * 1024 * 1024) throw Error('单个文件不能超过 50 MB。');
      const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif',
        'audio/mpeg':'mp3','audio/mp4':'m4a','audio/aac':'aac','audio/ogg':'ogg','audio/wav':'wav','audio/x-wav':'wav','audio/webm':'webm'}[blob.type];
      const path = mediaFolder + '/' + crypto.randomUUID() + '.' + ext;
      const {error} = await sdk().storage.from(BUCKET).upload(path, blob, {contentType:blob.type, upsert:false});
      if (error) throw Error('文件上传失败：' + error.message);
      const src = URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
      const old = current().media?.[k];
      try {await commit({...current(), media:{...(current().media || {}), [k]:src}});}
      catch (e) {
        // An ambiguous network failure may occur after the server committed.
        // Keep the new object: deleting it could break a successful save.
        throw e;
      }
      await cleanup(old).catch(() => {});
      return src;
    });
  }
  async function setText(field, value) {
    if (!['statement','tags'].includes(field)) throw Error('无效资料字段。');
    if (field === 'statement' && (typeof value !== 'string' || value.length > 3000)) throw Error('证词最多 3000 字。');
    if (field === 'tags' && (!Array.isArray(value) || value.length > 3 || value.some(t => typeof t !== 'string' || t.length > 4))) throw Error('最多三个标签，每个最多四字。');
    return enqueue(() => commit({...current(), [field]:value}));
  }
  async function signedIn() {
    const {data, error} = await sdk().auth.getSession();
    return !!row && !error && data.session?.user.id === row.owner_id;
  }
  const authOverlay = document.createElement('div');
  authOverlay.className = 'admin-overlay'; authOverlay.id = 'cloudLogin';
  authOverlay.innerHTML = '<section class="admin-panel" role="dialog" aria-modal="true" aria-labelledby="cloudLoginTitle"><header class="admin-header"><div><small>CONTROL ROOM / 027-A</small><h2 id="cloudLoginTitle">管理员登录</h2></div><button type="button" id="cloudLoginClose" aria-label="关闭登录">×</button></header><form class="admin-body" id="cloudLoginForm"><div class="admin-group"><label class="admin-label">邮箱<input id="cloudEmail" type="email" autocomplete="username" required></label><label class="admin-label">密码<input id="cloudPassword" type="password" autocomplete="current-password" required></label><p class="admin-tip" id="cloudLoginStatus" role="status">仅管理员可编辑，访客可以直接浏览。</p><button class="admin-save" type="submit" id="cloudLoginSubmit">登录</button></div></form></section>';
  document.body.append(authOverlay);
  if (isChild) {
    document.getElementById('cloudLoginTitle').textContent = '解锁编辑';
    document.getElementById('cloudEmail').closest('label').hidden = true;
    document.getElementById('cloudEmail').required = false;
    document.getElementById('cloudPassword').autocomplete = 'off';
    document.getElementById('cloudPassword').required = true;
    document.getElementById('cloudLoginStatus').textContent = '输入此子链接的编辑密码，仅可修改这份资料。';
    document.getElementById('cloudLoginSubmit').textContent = '解锁编辑';
  }
  async function access(action, payload = {}) {
    const headers = {apikey:KEY, 'Content-Type':'application/json'};
    if (action !== 'unlock') {
      if (isChild) throw Error('只有主链接管理员可以管理子链接。');
      const session = await owner(); headers.Authorization = 'Bearer ' + session.access_token;
    }
    const controller = new AbortController(); const timer = setTimeout(()=>controller.abort(),30000);
    try {
      const response = await fetch(URL + '/functions/v1/detective-access', {
        method:'POST',headers,body:JSON.stringify({action,...payload}),signal:controller.signal
      });
      let data;try {data = await response.json();} catch (_) {throw Error('子链接服务返回异常，请检查 detective-access 函数部署。');}
      if (!response.ok) throw Error(typeof data.error === 'string' ? data.error : '子链接服务尚未配置，请联系主链接管理员。');
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw Error('子链接服务超时，操作结果尚未确认。请重新读取列表核对后再重试。');
      throw error;
    } finally {clearTimeout(timer);}
  }
  let afterLogin;
  function closeLogin() {authOverlay.classList.remove('show'); document.getElementById('cloudPassword').value = ''; afterLogin = null;}
  document.getElementById('cloudLoginClose').onclick = closeLogin;
  authOverlay.onclick = e => {if (e.target === authOverlay) closeLogin();};
  document.addEventListener('keydown', e => {if(e.key === 'Escape') closeLogin();});
  document.getElementById('cloudLoginForm').onsubmit = async e => {
    e.preventDefault(); const button = document.getElementById('cloudLoginSubmit'); button.disabled = true;
    const label = document.getElementById('cloudLoginStatus'); label.textContent = '正在登录…';
    try {
      let user;
      if (isChild) {
        const result = await access('unlock',{slug:profile,password:document.getElementById('cloudPassword').value});
        if (!result.session?.access_token || !result.session?.refresh_token) throw Error('解锁结果异常，请重试。');
        const {data,error} = await sdk().auth.setSession(result.session);
        if (error || !data.session) throw Error('编辑会话未建立，请重试。');
        await load(); user = data.user;
      } else {
        const {data, error} = await sdk().auth.signInWithPassword({email:document.getElementById('cloudEmail').value.trim(), password:document.getElementById('cloudPassword').value});
        if (error) throw Error('登录失败，请检查邮箱和密码后重试。');
        user = data.user;
      }
      document.getElementById('cloudPassword').value = '';
      if (user?.id !== row.owner_id) {await sdk().auth.signOut({scope:'local'}); throw Error('这个账号没有这份资料的编辑权限。');}
      const callback = afterLogin; closeLogin(); await callback?.();
    } catch (error) {document.getElementById('cloudPassword').value = '';label.textContent = error.message;} finally {button.disabled = false;}
  };
  async function edit(callback) {
    if (!row) await load();
    if (await signedIn()) {await callback(); return;}
    afterLogin = callback; authOverlay.classList.add('show'); document.getElementById(isChild ? 'cloudPassword' : 'cloudEmail').focus();
  }
  async function logout() {
    if (pending) throw Error('资料正在保存，请等待保存完成后再退出。');
    const {error} = await sdk().auth.signOut({scope:'local'});
    if (error) throw Error('退出失败，请重试。');
  }
  retry.onclick = async () => {
    if (pending) return;
    if (document.getElementById('adminOverlay').classList.contains('show') && !confirm('重新读取会更新编辑框。请先复制尚未保存的文字。继续吗？')) return;
    try {await load();} catch (_) {}
  };
  // Preserve old local data until the owner explicitly chooses to migrate it.
  async function migrateLocal() {
    if (isChild) throw Error('旧版主链接资料只能在主链接迁移。');
    await owner();
    if (!confirm('将本浏览器旧版资料复制到公开云端，并替换云端同名项目。原本地数据会保留。继续吗？')) return;
    let statement, tags;
    try {statement = localStorage.getItem('casefile-witness-statement-v2'); tags = localStorage.getItem('casefile-witness-traits-v1');}
    catch (_) {throw Error('无法读取本浏览器旧资料。');}
    const local = await new Promise((resolve, reject) => {
      const request = indexedDB.open('casefile-027a',1);
      request.onupgradeneeded = () => request.result.createObjectStore('images');
      request.onerror = () => reject(Error('旧版本地数据库读取失败。'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('images','readonly'); const store = tx.objectStore('images');
        const entries = []; const cursor = store.openCursor();
        cursor.onsuccess = () => {const c = cursor.result; if (c) {if(validKey(String(c.key))) entries.push([String(c.key), c.value]); c.continue();}};
        tx.oncomplete = () => {db.close();resolve(entries);};
        tx.onerror = () => {db.close();reject(Error('旧版本地资料读取失败。'));};
      };
    });
    let count = 0;
    if (statement !== null) {await setText('statement',statement); count++;}
    if (tags !== null) {
      let values; try {values = JSON.parse(tags);} catch (_) {throw Error('旧版标签数据损坏；原本地数据未删除。');}
      if (!Array.isArray(values)) throw Error('旧版标签数据格式无效。');
      await setText('tags',values.filter(v=>typeof v === 'string').map(v=>v.trim().slice(0,4)).filter(Boolean).slice(0,3)); count++;
    }
    for (const [k,v] of local) {await putMedia(k,v);count++;}
    window.dispatchEvent(new Event('detective-cloud-loaded'));
    alert(count ? '已迁移 ' + count + ' 项到云端，原本地数据保留。' : '当前网址和浏览器没有找到旧版已保存资料。');
  }
  window.DetectiveCloud = {load, current, edit, logout, setText, putMedia, removeMedia, migrateLocal,
    isChild, profile,
    manageLinks:access,
    media:async k => {current();const src = row.content.media?.[k];return publicPath(src) ? src : null;},
    get pending() {return pending;}};
  window.addEventListener('beforeunload', e => {if(pending){e.preventDefault();e.returnValue='';}});
  window.addEventListener('unhandledrejection', e => {e.preventDefault(); alert(e.reason?.message || '操作失败，请检查网络后重试。');});
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !pending && !document.querySelector('.admin-overlay.show')) load().catch(()=>{});
  });
})();
